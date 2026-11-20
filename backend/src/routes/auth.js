import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { all, get, run, tx } from '../db/index.js';
import { signToken } from '../utils/tokens.js';
import { validate } from '../middleware/validate.js';
import { authenticate } from '../middleware/auth.js';
import { badRequest, unauthorized, conflict } from '../utils/errors.js';
import { config } from '../config.js';
import { sendSms, otpMessage, normalisePhone } from '../utils/sms.js';

const router = Router();

const publicUser = (u) => ({
  id: u.id,
  fullName: u.full_name,
  phone: u.phone,
  email: u.email,
  role: u.role,
  accountType: u.account_type,
  companyId: u.company_id,
  staffRole: u.staff_role,
  spendingLimit: u.spending_limit,
  status: u.status,
});

// ---------------------------------------------------------------------
// Customer registration: individual or company
// ---------------------------------------------------------------------
const registerSchema = z.object({
  accountType: z.enum(['individual', 'company']),
  fullName: z.string().min(2),
  phone: z.string().min(9),
  email: z.string().email().optional().nullable(),
  address: z.string().optional().nullable(),
  companyName: z.string().min(2).optional(),
  tin: z.string().optional().nullable(),
});

router.post('/register', validate(registerSchema), (req, res, next) => {
  try {
    const b = req.body;
    if (get('SELECT id FROM users WHERE phone = ?', [b.phone])) {
      throw conflict('That phone number is already registered');
    }
    if (b.accountType === 'company' && !b.companyName) {
      throw badRequest('Company name is required for a company account');
    }

    const user = tx(() => {
      let companyId = null;
      if (b.accountType === 'company') {
        const c = run(
          `INSERT INTO companies (company_name, tin, contact_person, phone, email, address)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [b.companyName, b.tin || null, b.fullName, b.phone, b.email || null, b.address || null]
        );
        companyId = Number(c.lastInsertRowid);
      }
      const r = run(
        `INSERT INTO users (full_name, phone, email, role, account_type, company_id, tin, address)
         VALUES (?, ?, ?, 'customer', ?, ?, ?, ?)`,
        [
          b.fullName,
          b.phone,
          b.email || null,
          b.accountType === 'company' ? 'company_owner' : 'individual',
          companyId,
          b.tin || null,
          b.address || null,
        ]
      );
      return get('SELECT * FROM users WHERE id = ?', [Number(r.lastInsertRowid)]);
    });

    res.status(201).json({ user: publicUser(user), token: signToken(user) });
  } catch (e) { next(e); }
});

// ---------------------------------------------------------------------
// Customer login: phone + OTP
// ---------------------------------------------------------------------
router.post('/otp/request', validate(z.object({ phone: z.string().min(9) })), async (req, res, next) => {
  try {
    // 0772 123 456, 772123456 and +256772123456 are the same number, and
    // people type all three. Match on the stored form.
    const phone = normalisePhone(req.body.phone);
    const user = get('SELECT * FROM users WHERE phone = ?', [phone]);
    if (!user) throw badRequest('That phone number is not registered');
    if (user.status !== 'active') throw unauthorized('This account has been suspended');

    const code = config.otpDevMode
      ? '123456'
      : String(Math.floor(100000 + Math.random() * 900000));

    run('UPDATE otp_codes SET consumed = 1 WHERE phone = ? AND consumed = 0', [phone]);
    run(
      `INSERT INTO otp_codes (phone, code, expires_at)
       VALUES (?, ?, datetime('now', '+5 minutes'))`,
      [phone, code]
    );

    const sms = await sendSms(phone, otpMessage(code));
    if (!sms.ok && !config.otpDevMode) {
      // Better to say the message did not go than to leave someone
      // waiting for an SMS that is never coming.
      throw badRequest(
        'We could not send the code to that number just now. Try again in a moment.'
      );
    }

    res.json({
      sent: true,
      phone,
      message: `A 6-digit code was sent to ${phone}`,
      // Which desk this number belongs to, so the app can open the right
      // side once the code is verified. It is not a secret: the number
      // had to be registered to get this far.
      role: user.role,
      devCode: config.otpDevMode ? code : undefined,
    });
  } catch (e) { next(e); }
});

router.post(
  '/otp/verify',
  validate(z.object({ phone: z.string().min(9), code: z.string().length(6) })),
  (req, res, next) => {
    try {
      // Normalised the same way as the request, or a code sent to
      // +256772123456 could not be verified by someone who typed 0772…
      const phone = normalisePhone(req.body.phone);
      const { code } = req.body;
      const otp = get(
        `SELECT * FROM otp_codes
          WHERE phone = ? AND code = ? AND consumed = 0 AND expires_at > datetime('now')
          ORDER BY id DESC LIMIT 1`,
        [phone, code]
      );
      if (!otp) throw unauthorized('That code is wrong or has expired');
      run('UPDATE otp_codes SET consumed = 1 WHERE id = ?', [otp.id]);

      const user = get('SELECT * FROM users WHERE phone = ?', [phone]);
      if (!user) throw unauthorized('Account not found');
      res.json({ user: publicUser(user), token: signToken(user) });
    } catch (e) { next(e); }
  }
);

// ---------------------------------------------------------------------
// Staff login: phone/email + password (app and web)
// ---------------------------------------------------------------------
router.post(
  '/staff/login',
  validate(z.object({ identifier: z.string().min(3), password: z.string().min(4) })),
  (req, res, next) => {
    try {
      const { identifier, password } = req.body;
      const user = get(
        `SELECT * FROM users WHERE (phone = ? OR email = ?) AND role != 'customer'`,
        [identifier, identifier]
      );
      if (!user || !user.password_hash) throw unauthorized('Wrong login details');
      if (!bcrypt.compareSync(password, user.password_hash)) throw unauthorized('Wrong login details');
      if (user.status !== 'active') throw unauthorized('This staff account has been suspended');

      res.json({ user: publicUser(user), token: signToken(user) });
    } catch (e) { next(e); }
  }
);

router.get('/me', authenticate, (req, res) => {
  const user = publicUser(req.user);
  if (req.user.company_id) {
    user.company = get('SELECT * FROM companies WHERE id = ?', [req.user.company_id]);
  }
  res.json({ user });
});

router.post(
  '/change-password',
  authenticate,
  validate(z.object({ currentPassword: z.string(), newPassword: z.string().min(6) })),
  (req, res, next) => {
    try {
      const u = req.user;
      if (!u.password_hash || !bcrypt.compareSync(req.body.currentPassword, u.password_hash)) {
        throw unauthorized('Your current password is wrong');
      }
      run('UPDATE users SET password_hash = ? WHERE id = ?', [
        bcrypt.hashSync(req.body.newPassword, 10),
        u.id,
      ]);
      res.json({ ok: true });
    } catch (e) { next(e); }
  }
);

export default router;
export { publicUser };
