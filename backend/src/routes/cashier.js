import { Router } from 'express';
import { z } from 'zod';
import { all, get } from '../db/index.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { receivePayment, queueFor, getOrder } from '../services/orders.js';
import { config } from '../config.js';
import { notFound } from '../utils/errors.js';

const router = Router();
router.use(authenticate, requireRole('cashier', 'manager'));

/** Payment queue + the day's till summary. */
router.get('/queue', (_req, res) => {
  const waiting = queueFor('cashier');
  const summary = get(
    `SELECT COUNT(*) AS paid_today,
            COALESCE(SUM(CASE WHEN method = 'cash' THEN amount_paid END), 0)         AS cash_today,
            COALESCE(SUM(CASE WHEN method = 'mobile_money' THEN amount_paid END), 0) AS momo_today,
            COALESCE(SUM(CASE WHEN method = 'card' THEN amount_paid END), 0)         AS card_today
       FROM payments WHERE date(created_at) = date('now')`
  );
  res.json({
    orders: waiting,
    summary: { waiting: waiting.length, ...summary },
  });
});

/** Record a payment and push the order on to Accounts. */
router.post(
  '/orders/:id/payment',
  validate(z.object({
    method: z.enum(['cash', 'mobile_money', 'card']),
    amountPaid: z.number().int().positive(),
    transactionRef: z.string().optional().nullable(),
  })),
  (req, res, next) => {
    try {
      const order = receivePayment(req.user, Number(req.params.id), req.body);
      res.json({ order, receipt: order.payment });
    } catch (e) { next(e); }
  }
);

/** Receipts issued by this cashier (today by default). */
router.get('/receipts', (req, res) => {
  const { date, mine } = req.query;
  const where = ['date(p.created_at) = ?'];
  const params = [date || new Date().toISOString().slice(0, 10)];
  if (mine === '1') { where.push('p.cashier_id = ?'); params.push(req.user.id); }
  res.json({
    receipts: all(
      `SELECT p.*, o.order_no, o.status, u.full_name AS customer_name, c.company_name
         FROM payments p
         JOIN orders o ON o.id = p.order_id
         JOIN users u ON u.id = o.customer_id
         LEFT JOIN companies c ON c.id = o.company_id
        WHERE ${where.join(' AND ')}
        ORDER BY p.created_at DESC`,
      params
    ),
  });
});

/** A printable / shareable receipt. */
router.get('/receipts/:receiptNo', (req, res, next) => {
  try {
    const payment = get('SELECT * FROM payments WHERE receipt_no = ?', [req.params.receiptNo]);
    if (!payment) throw notFound('Receipt not found');
    const order = getOrder(payment.order_id);
    res.json({
      receipt: {
        shop: config.shopName,
        currency: config.currency,
        receiptNo: payment.receipt_no,
        orderNo: order.order_no,
        customer: order.company_name || order.ordered_by_name,
        orderedBy: order.ordered_by_name,
        items: order.items,
        subtotal: order.subtotal,
        deliveryFee: order.delivery_fee,
        total: order.total,
        amountPaid: payment.amount_paid,
        change: payment.amount_paid - payment.amount_due,
        method: payment.method,
        transactionRef: payment.transaction_ref,
        cashier: payment.cashier_name,
        dateTime: payment.created_at,
      },
    });
  } catch (e) { next(e); }
});

/** End of day: what this cashier took in. */
router.get('/end-of-day', (req, res) => {
  const date = req.query.date || new Date().toISOString().slice(0, 10);
  const totals = get(
    `SELECT COUNT(*) AS receipts,
            COALESCE(SUM(amount_paid), 0) AS total,
            COALESCE(SUM(CASE WHEN method = 'cash' THEN amount_paid END), 0) AS cash,
            COALESCE(SUM(CASE WHEN method = 'mobile_money' THEN amount_paid END), 0) AS mobile_money,
            COALESCE(SUM(CASE WHEN method = 'card' THEN amount_paid END), 0) AS card
       FROM payments WHERE date(created_at) = ? AND cashier_id = ?`,
    [date, req.user.id]
  );
  res.json({ date, cashier: req.user.full_name, ...totals });
});

export default router;
