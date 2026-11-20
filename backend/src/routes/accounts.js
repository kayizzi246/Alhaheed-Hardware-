import { Router } from 'express';
import { z } from 'zod';
import { all, get, run } from '../db/index.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { verifyPayment, queueFor } from '../services/orders.js';

const router = Router();
router.use(authenticate, requireRole('accounts', 'manager'));

/** Queue of paid orders awaiting verification. */
router.get('/queue', async (_req, res) => {
  const awaiting = await all(
    `SELECT o.*, p.receipt_no, p.method, p.amount_paid, p.transaction_ref, p.cashier_name,
            u.full_name AS ordered_by_name, c.company_name
       FROM orders o
       JOIN payments p ON p.order_id = o.id AND p.verified = 0
       JOIN users u ON u.id = o.customer_id
       LEFT JOIN companies c ON c.id = o.company_id
      WHERE o.status = 'paid'
      ORDER BY o.created_at ASC`
  );
  const today = await get(
    `SELECT COUNT(*) AS verified_today,
            COALESCE(SUM(amount_paid), 0) AS verified_amount
       FROM payments WHERE verified = 1 AND substr(verified_at, 1, 10) = today_text()`
  );
  const cash = await get(
    `SELECT COALESCE(SUM(cash_in), 0) AS cash_in, COALESCE(SUM(cash_out), 0) AS cash_out
       FROM cash_book WHERE entry_date = today_text()`
  );
  res.json({ orders: awaiting, summary: { awaiting: awaiting.length, ...today, ...cash } });
});

/** Verify or reject a payment. */
router.post(
  '/orders/:id/verify',
  validate(z.object({ approve: z.boolean(), remarks: z.string().optional().nullable() })),
  async (req, res, next) => {
    try {
      res.json({ order: await verifyPayment(req.user, Number(req.params.id), req.body) });
    } catch (e) { next(e); }
  }
);

// ------------------------------------------------------------ Cash book
router.get('/cash-book', async (req, res) => {
  const date = req.query.date || new Date().toISOString().slice(0, 10);
  const opening = (await get(
    `SELECT COALESCE(SUM(cash_in - cash_out), 0) AS balance FROM cash_book WHERE entry_date < ?`,
    [date]
  )).balance;

  const rows = await all(
    `SELECT cb.*, u.full_name AS recorded_by_name
       FROM cash_book cb JOIN users u ON u.id = cb.recorded_by
      WHERE cb.entry_date = ? ORDER BY cb.created_at ASC`,
    [date]
  );

  let balance = opening;
  const entries = rows.map((r) => {
    balance += r.cash_in - r.cash_out;
    return { ...r, balance };
  });

  res.json({
    date,
    opening,
    closing: balance,
    totalIn: rows.reduce((s, r) => s + r.cash_in, 0),
    totalOut: rows.reduce((s, r) => s + r.cash_out, 0),
    entries,
  });
});

/** Manual cash-book entry, e.g. "Transport - delivery truck fuel". */
router.post(
  '/cash-book',
  validate(z.object({
    details: z.string().min(2),
    cashIn: z.number().int().nonnegative().default(0),
    cashOut: z.number().int().nonnegative().default(0),
    method: z.string().optional().nullable(),
    entryDate: z.string().optional(),
  })),
  async (req, res, next) => {
    try {
      const b = req.body;
      const r = await run(
        `INSERT INTO cash_book (entry_date, details, cash_in, cash_out, method, recorded_by)
         VALUES (COALESCE(?, today_text()), ?, ?, ?, ?, ?)`,
        [b.entryDate || null, b.details, b.cashIn, b.cashOut, b.method || null, req.user.id]
      );
      res.status(201).json({ entry: await get('SELECT * FROM cash_book WHERE id = ?', [Number(r.lastInsertRowid)]) });
    } catch (e) { next(e); }
  }
);

/** Daily reconciliation: till and mobile money against verified payments. */
router.get('/reconciliation', async (req, res) => {
  const date = req.query.date || new Date().toISOString().slice(0, 10);
  const byMethod = await all(
    `SELECT method,
            COUNT(*) AS count,
            COALESCE(SUM(amount_paid), 0) AS collected,
            COALESCE(SUM(CASE WHEN verified = 1 THEN amount_paid END), 0) AS verified,
            COALESCE(SUM(CASE WHEN verified = 0 THEN amount_paid END), 0) AS pending,
            COALESCE(SUM(CASE WHEN verified = -1 THEN amount_paid END), 0) AS rejected
       FROM payments WHERE substr(created_at, 1, 10) = ?
      GROUP BY method`,
    [date]
  );
  const cashBook = await get(
    `SELECT COALESCE(SUM(cash_in), 0) AS cash_in, COALESCE(SUM(cash_out), 0) AS cash_out
       FROM cash_book WHERE entry_date = ?`,
    [date]
  );
  res.json({
    date,
    byMethod,
    cashBook,
    difference: cashBook.cash_in - byMethod.reduce((s, m) => s + m.verified, 0),
  });
});

export default router;
