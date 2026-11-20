import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { all, get, run, tx } from '../db/index.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { notFound, badRequest, conflict } from '../utils/errors.js';
import { publicUser } from './auth.js';
import { logEvent } from '../utils/audit.js';
import { notifyUser } from '../utils/notify.js';
import { emitToDesks } from '../realtime.js';
import { getOrder } from '../services/orders.js';

const router = Router();
router.use(authenticate, requireRole('manager'));

// ------------------------------------------------------------ Dashboard
router.get('/dashboard', async (_req, res) => {
  const sales = await get(
    `SELECT COALESCE(SUM(p.amount_paid), 0) AS sales_today, COUNT(*) AS payments_today
       FROM payments p WHERE p.verified = 1 AND substr(p.created_at, 1, 10) = today_text()`
  );
  const ordersToday = (await get(
    `SELECT COUNT(*) AS n FROM orders WHERE substr(created_at, 1, 10) = today_text()`
  )).n;
  const byMethod = await get(
    `SELECT COALESCE(SUM(CASE WHEN method='cash' THEN amount_paid END),0) AS cash,
            COALESCE(SUM(CASE WHEN method='mobile_money' THEN amount_paid END),0) AS mobile_money,
            COALESCE(SUM(CASE WHEN method='card' THEN amount_paid END),0) AS card
       FROM payments WHERE substr(created_at, 1, 10) = today_text()`
  );
  const byStage = await get(
    // SQLite let SUM() add up a comparison as 1 and 0; PostgreSQL will
    // not add booleans, so the count is filtered instead — which says
    // what it means rather more plainly anyway.
    `SELECT
       COUNT(*) FILTER (WHERE status = 'pending_payment')  AS cashier,
       COUNT(*) FILTER (WHERE status = 'paid')             AS accounts,
       COUNT(*) FILTER (WHERE status = 'payment_verified') AS store,
       COUNT(*) FILTER (WHERE status = 'released')         AS done
     FROM orders`
  );
  const lowStock = await all(
    `SELECT id, name, code, unit, stock_available, reorder_level
       FROM products WHERE active = 1 AND stock_available <= reorder_level ORDER BY stock_available`
  );
  const last7Days = await all(
    `SELECT substr(p.created_at, 1, 10) AS day, COALESCE(SUM(p.amount_paid), 0) AS total
       FROM payments p
      WHERE p.verified = 1
        AND substr(p.created_at, 1, 10) >= to_char(now() - interval '6 days', 'YYYY-MM-DD')
      GROUP BY day ORDER BY day`
  );
  const refunds = await all(
    `SELECT r.*, o.order_no, u.full_name AS requested_by_name
       FROM refunds r
       JOIN orders o ON o.id = r.order_id
       LEFT JOIN users u ON u.id = r.requested_by
      WHERE r.status = 'requested' ORDER BY r.created_at DESC`
  );

  res.json({
    salesToday: sales.sales_today,
    ordersToday,
    byMethod,
    byStage: {
      cashier: byStage.cashier || 0,
      accounts: byStage.accounts || 0,
      store: byStage.store || 0,
      done: byStage.done || 0,
    },
    lowStock,
    last7Days,
    pendingRefunds: refunds,
  });
});

// ------------------------------------------------------- Staff accounts
const staffSchema = z.object({
  fullName: z.string().min(2),
  phone: z.string().min(9),
  email: z.string().email().optional().nullable(),
  role: z.enum(['cashier', 'accounts', 'store', 'manager']),
  password: z.string().min(6),
});

router.get('/staff', async (_req, res) => {
  res.json({
    staff: (await all(
      `SELECT * FROM users WHERE role != 'customer' ORDER BY role, full_name`
    )).map(publicUser),
  });
});

router.post('/staff', validate(staffSchema), async (req, res, next) => {
  try {
    const b = req.body;
    if (await get('SELECT id FROM users WHERE phone = ?', [b.phone])) {
      throw conflict('That phone number already has an account');
    }
    const r = await run(
      `INSERT INTO users (full_name, phone, email, password_hash, role, account_type, added_by)
       VALUES (?, ?, ?, ?, ?, 'staff', ?)`,
      [b.fullName, b.phone, b.email || null, bcrypt.hashSync(b.password, 10), b.role, req.user.id]
    );
    res.status(201).json({ staff: publicUser(await get('SELECT * FROM users WHERE id = ?', [Number(r.lastInsertRowid)])) });
  } catch (e) { next(e); }
});

router.patch('/staff/:id', validate(staffSchema.partial().extend({
  status: z.enum(['active', 'suspended']).optional(),
})), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const staff = await get(`SELECT * FROM users WHERE id = ? AND role != 'customer'`, [id]);
    if (!staff) throw notFound('Staff member not found');
    if (id === req.user.id && req.body.status === 'suspended') {
      throw badRequest('You cannot suspend your own account');
    }

    const b = req.body;
    const sets = [], params = [];
    const map = { fullName: 'full_name', phone: 'phone', email: 'email', role: 'role', status: 'status' };
    for (const [key, col] of Object.entries(map)) {
      if (b[key] !== undefined) { sets.push(`${col} = ?`); params.push(b[key]); }
    }
    if (b.password) { sets.push('password_hash = ?'); params.push(bcrypt.hashSync(b.password, 10)); }
    if (sets.length) await run(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, [...params, id]);

    res.json({ staff: publicUser(await get('SELECT * FROM users WHERE id = ?', [id])) });
  } catch (e) { next(e); }
});

// ----------------------------------------------------------- Customers
router.get('/customers', async (req, res) => {
  const { q } = req.query;
  const where = [`u.role = 'customer'`], params = [];
  if (q) { where.push('(u.full_name ILIKE ? OR u.phone ILIKE ? OR c.company_name ILIKE ?)'); params.push(`%${q}%`, `%${q}%`, `%${q}%`); }
  res.json({
    customers: await all(
      `SELECT u.*, c.company_name,
              (SELECT COUNT(*) FROM orders o WHERE o.customer_id = u.id) AS order_count,
              (SELECT COALESCE(SUM(o.total),0) FROM orders o WHERE o.customer_id = u.id AND o.status = 'released') AS lifetime_value
         FROM users u LEFT JOIN companies c ON c.id = u.company_id
        WHERE ${where.join(' AND ')} ORDER BY u.created_at DESC LIMIT 300`,
      params
    ),
  });
});

router.get('/companies', async (_req, res) => {
  res.json({
    companies: await all(
      `SELECT c.*,
              (SELECT COUNT(*) FROM users u WHERE u.company_id = c.id) AS staff_count,
              (SELECT COUNT(*) FROM orders o WHERE o.company_id = c.id) AS order_count
         FROM companies c ORDER BY c.company_name`
    ),
  });
});

// ------------------------------------------------------------- Refunds
router.get('/refunds', async (_req, res) => {
  res.json({
    refunds: await all(
      `SELECT r.*, o.order_no, o.total, u.full_name AS requested_by_name
         FROM refunds r JOIN orders o ON o.id = r.order_id
         LEFT JOIN users u ON u.id = r.requested_by
        ORDER BY r.created_at DESC LIMIT 200`
    ),
  });
});

router.post(
  '/refunds/:id/decide',
  validate(z.object({ approve: z.boolean(), notes: z.string().optional().nullable() })),
  async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      const refund = await get('SELECT * FROM refunds WHERE id = ?', [id]);
      if (!refund) throw notFound('Refund request not found');
      if (refund.status !== 'requested') throw conflict('This refund has already been decided');

      const order = await tx(async () => {
        await run(
          `UPDATE refunds SET status = ?, decided_by = ?, decided_at = now_text() WHERE id = ?`,
          [req.body.approve ? 'approved' : 'declined', req.user.id, id]
        );
        if (req.body.approve) {
          await run(`UPDATE orders SET status = 'refunded', current_stage = 'done', updated_at = now_text() WHERE id = ?`,
            [refund.order_id]);
          await run(
            `INSERT INTO cash_book (details, cash_out, order_id, recorded_by)
             VALUES (?, ?, ?, ?)`,
            [`Refund on order #${get('SELECT order_no FROM orders WHERE id = ?', [refund.order_id]).order_no}`,
             refund.amount, refund.order_id, req.user.id]
          );
        }
        await logEvent({
          orderId: refund.order_id,
          stage: 'manager',
          action: req.body.approve ? 'refunded' : 'refund_declined',
          user: req.user,
          notes: req.body.notes || refund.reason,
        });
        return await getOrder(refund.order_id);
      });

      await notifyUser(order.customer_id, {
        title: req.body.approve
          ? `Refund approved for #${order.order_no}`
          : `Refund declined for #${order.order_no}`,
        body: req.body.notes || '',
        orderId: order.id,
      });
      emitToDesks('order:updated', order);
      res.json({ order, refund: await get('SELECT * FROM refunds WHERE id = ?', [id]) });
    } catch (e) { next(e); }
  }
);

/** Anyone at a desk can raise a refund request; the manager decides. */
router.post(
  '/refunds',
  validate(z.object({
    orderId: z.number().int().positive(),
    amount: z.number().int().positive(),
    reason: z.string().min(2),
  })),
  async (req, res, next) => {
    try {
      const order = await getOrder(req.body.orderId);
      const r = await run(
        'INSERT INTO refunds (order_id, amount, reason, requested_by) VALUES (?, ?, ?, ?)',
        [order.id, req.body.amount, req.body.reason, req.user.id]
      );
      res.status(201).json({ refund: await get('SELECT * FROM refunds WHERE id = ?', [Number(r.lastInsertRowid)]) });
    } catch (e) { next(e); }
  }
);

/** Full audit trail across all orders. */
router.get('/audit', async (req, res) => {
  const { from, to, userId, limit = 300 } = req.query;
  const where = [], params = [];
  if (from) { where.push('substr(e.created_at, 1, 10) >= ?'); params.push(from); }
  if (to) { where.push('substr(e.created_at, 1, 10) <= ?'); params.push(to); }
  if (userId) { where.push('e.handled_by = ?'); params.push(Number(userId)); }
  res.json({
    events: await all(
      `SELECT e.*, o.order_no
         FROM order_events e JOIN orders o ON o.id = e.order_id
        ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
        ORDER BY e.created_at DESC LIMIT ?`,
      [...params, Number(limit)]
    ),
  });
});

export default router;
