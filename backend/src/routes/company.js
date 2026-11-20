import { Router } from 'express';
import { z } from 'zod';
import { all, get, run } from '../db/index.js';
import { authenticate, requireRole, requireCompanyOwner } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { notFound, badRequest, conflict, forbidden } from '../utils/errors.js';
import { publicUser } from './auth.js';
import { formatMoney } from '../utils/money.js';

const router = Router();
router.use(authenticate, requireRole('customer'));

/** The company profile of the signed-in customer. */
router.get('/', (req, res, next) => {
  try {
    if (!req.user.company_id) throw badRequest('You are not on a company account');
    const company = get('SELECT * FROM companies WHERE id = ?', [req.user.company_id]);
    if (!company) throw notFound('Company not found');
    res.json({ company, isOwner: req.user.account_type === 'company_owner' });
  } catch (e) { next(e); }
});

/** Staff the company has added to order on its behalf. */
router.get('/staff', requireCompanyOwner, (req, res) => {
  const staff = all(
    `SELECT u.*,
            (SELECT COUNT(*) FROM orders o WHERE o.customer_id = u.id) AS order_count,
            (SELECT COALESCE(SUM(o.total),0) FROM orders o
              WHERE o.customer_id = u.id AND o.status NOT IN ('cancelled','rejected')) AS total_spent
       FROM users u
      WHERE u.company_id = ? AND u.account_type = 'company_staff'
      ORDER BY u.full_name`,
    [req.user.company_id]
  );
  res.json({
    staff: staff.map((s) => ({
      ...publicUser(s),
      orderCount: s.order_count,
      totalSpent: s.total_spent,
      spendingLimitLabel: s.spending_limit ? formatMoney(s.spending_limit) : 'No limit',
    })),
  });
});

/** Add a staff member (its cashier, buyer, site supervisor...). */
router.post(
  '/staff',
  requireCompanyOwner,
  validate(z.object({
    fullName: z.string().min(2),
    phone: z.string().min(9),
    email: z.string().email().optional().nullable(),
    staffRole: z.string().min(2),
    spendingLimit: z.number().int().nonnegative().nullable().optional(),
  })),
  (req, res, next) => {
    try {
      const b = req.body;
      if (get('SELECT id FROM users WHERE phone = ?', [b.phone])) {
        throw conflict('That phone number already has an account');
      }
      const r = run(
        `INSERT INTO users
           (full_name, phone, email, role, account_type, company_id, staff_role, spending_limit, added_by)
         VALUES (?, ?, ?, 'customer', 'company_staff', ?, ?, ?, ?)`,
        [b.fullName, b.phone, b.email || null, req.user.company_id, b.staffRole,
         b.spendingLimit ?? null, req.user.id]
      );
      res.status(201).json({ staff: publicUser(get('SELECT * FROM users WHERE id = ?', [Number(r.lastInsertRowid)])) });
    } catch (e) { next(e); }
  }
);

/** Change a staff member's role, limit, or suspend them. */
router.patch(
  '/staff/:id',
  requireCompanyOwner,
  validate(z.object({
    fullName: z.string().min(2).optional(),
    staffRole: z.string().min(2).optional(),
    spendingLimit: z.number().int().nonnegative().nullable().optional(),
    status: z.enum(['active', 'suspended']).optional(),
  })),
  (req, res, next) => {
    try {
      const id = Number(req.params.id);
      const staff = get(
        `SELECT * FROM users WHERE id = ? AND company_id = ? AND account_type = 'company_staff'`,
        [id, req.user.company_id]
      );
      if (!staff) throw notFound('That person is not on your company account');

      const b = req.body;
      const map = { fullName: 'full_name', staffRole: 'staff_role', spendingLimit: 'spending_limit', status: 'status' };
      const sets = [], params = [];
      for (const [key, col] of Object.entries(map)) {
        if (b[key] !== undefined) { sets.push(`${col} = ?`); params.push(b[key]); }
      }
      if (sets.length) run(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, [...params, id]);

      res.json({ staff: publicUser(get('SELECT * FROM users WHERE id = ?', [id])) });
    } catch (e) { next(e); }
  }
);

/** Remove a staff member. Their past orders stay on the company record. */
router.delete('/staff/:id', requireCompanyOwner, (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const staff = get(
      `SELECT * FROM users WHERE id = ? AND company_id = ? AND account_type = 'company_staff'`,
      [id, req.user.company_id]
    );
    if (!staff) throw notFound('That person is not on your company account');
    run(`UPDATE users SET status = 'suspended' WHERE id = ?`, [id]);
    res.json({ ok: true, message: `${staff.full_name} can no longer order for the company` });
  } catch (e) { next(e); }
});

/** Every order placed under the company account, with who ordered and when. */
router.get('/orders', requireCompanyOwner, (req, res) => {
  const orders = all(
    `SELECT o.*, u.full_name AS ordered_by_name, u.staff_role,
            (SELECT COUNT(*) FROM order_items i WHERE i.order_id = o.id) AS item_count
       FROM orders o JOIN users u ON u.id = o.customer_id
      WHERE o.company_id = ?
      ORDER BY o.created_at DESC LIMIT 300`,
    [req.user.company_id]
  );
  const summary = get(
    `SELECT COUNT(*) AS total_orders,
            COALESCE(SUM(CASE WHEN status = 'released' THEN total END), 0) AS total_spent,
            COALESCE(SUM(CASE WHEN status NOT IN ('released','cancelled','rejected') THEN total END), 0) AS in_progress
       FROM orders WHERE company_id = ?`,
    [req.user.company_id]
  );
  res.json({ orders, summary });
});

export default router;
