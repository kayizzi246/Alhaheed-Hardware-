import { Router } from 'express';
import { all, get } from '../db/index.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { badRequest } from '../utils/errors.js';
import { config } from '../config.js';

const router = Router();
router.use(authenticate, requireRole('manager', 'accounts'));

const today = () => new Date().toISOString().slice(0, 10);

/** Resolve ?period=daily|weekly|monthly or explicit from/to. */
function range(req) {
  const to = req.query.to || today();
  if (req.query.from) return { from: req.query.from, to };
  const period = req.query.period || 'daily';
  const days = { daily: 0, weekly: 6, monthly: 29 }[period];
  if (days === undefined) throw badRequest('period must be daily, weekly or monthly');
  const d = new Date(`${to}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return { from: d.toISOString().slice(0, 10), to, period };
}

// -------------------------------------------------------------- Sales
router.get('/sales', async (req, res, next) => {
  try {
    const { from, to } = range(req);
    const totals = await get(
      `SELECT COUNT(*) AS receipts, COALESCE(SUM(amount_paid), 0) AS gross
         FROM payments WHERE verified = 1 AND substr(created_at, 1, 10) BETWEEN ? AND ?`,
      [from, to]
    );
    const byDay = await all(
      `SELECT substr(created_at, 1, 10) AS day, COUNT(*) AS receipts, COALESCE(SUM(amount_paid),0) AS total
         FROM payments WHERE verified = 1 AND substr(created_at, 1, 10) BETWEEN ? AND ?
        GROUP BY day ORDER BY day`,
      [from, to]
    );
    const byMethod = await all(
      `SELECT method, COUNT(*) AS receipts, COALESCE(SUM(amount_paid),0) AS total
         FROM payments WHERE verified = 1 AND substr(created_at, 1, 10) BETWEEN ? AND ?
        GROUP BY method ORDER BY total DESC`,
      [from, to]
    );
    res.json({ from, to, currency: config.currency, totals, byDay, byMethod });
  } catch (e) { next(e); }
});

// ----------------------------------------------------- Best sellers
router.get('/best-sellers', async (req, res, next) => {
  try {
    const { from, to } = range(req);
    res.json({
      from, to,
      products: await all(
        `SELECT i.product_id, i.product_name, i.unit,
                SUM(i.quantity) AS qty_sold,
                SUM(i.line_total) AS revenue,
                COUNT(DISTINCT o.id) AS orders
           FROM order_items i JOIN orders o ON o.id = i.order_id
          WHERE o.status IN ('payment_verified','released')
            AND substr(o.created_at, 1, 10) BETWEEN ? AND ?
          GROUP BY i.product_id ORDER BY qty_sold DESC LIMIT 50`,
        [from, to]
      ),
    });
  } catch (e) { next(e); }
});

// ----------------------------------------------- Orders per stage
router.get('/orders-by-stage', async (req, res, next) => {
  try {
    const { from, to } = range(req);
    res.json({
      from, to,
      stages: await all(
        `SELECT status, COUNT(*) AS orders, COALESCE(SUM(total),0) AS value
           FROM orders WHERE substr(created_at, 1, 10) BETWEEN ? AND ?
          GROUP BY status`,
        [from, to]
      ),
    });
  } catch (e) { next(e); }
});

// ------------------------------------------------- Stock movement
router.get('/stock-movement', async (req, res, next) => {
  try {
    const { from, to } = range(req);
    res.json({
      from, to,
      movements: await all(
        `SELECT p.code, p.name, p.unit, p.stock_available, p.reorder_level,
                COALESCE(SUM(CASE WHEN m.movement = 'goods_received' THEN m.quantity END), 0) AS received,
                COALESCE(SUM(CASE WHEN m.movement = 'release' THEN -m.quantity END), 0)       AS released,
                COALESCE(SUM(CASE WHEN m.movement = 'adjustment' THEN m.quantity END), 0)     AS adjusted
           FROM products p
           LEFT JOIN stock_movements m
             ON m.product_id = p.id AND substr(m.created_at, 1, 10) BETWEEN ? AND ?
          WHERE p.active = 1
          GROUP BY p.id ORDER BY released DESC`,
        [from, to]
      ),
    });
  } catch (e) { next(e); }
});

// ------------------------------------------------- Staff activity
router.get('/staff-activity', async (req, res, next) => {
  try {
    const { from, to } = range(req);
    res.json({
      from, to,
      staff: await all(
        `SELECT u.full_name, u.role, e.action, COUNT(*) AS count
           FROM order_events e JOIN users u ON u.id = e.handled_by
          WHERE substr(e.created_at, 1, 10) BETWEEN ? AND ? AND u.role != 'customer'
          GROUP BY u.id, e.action ORDER BY u.full_name`,
        [from, to]
      ),
    });
  } catch (e) { next(e); }
});

// ------------------------------------------------------------ Export
/**
 * CSV export for Excel. The web panel turns the same JSON into a PDF,
 * so one query backs both export formats.
 */
router.get('/export/:report.csv', async (req, res, next) => {
  try {
    const { from, to } = range(req);
    const queries = {
      sales: {
        sql: `SELECT p.receipt_no AS "Receipt", o.order_no AS "Order", u.full_name AS "Customer",
                     c.company_name AS "Company", p.method AS "Method", p.amount_paid AS "Amount",
                     p.cashier_name AS "Cashier", p.verifier_name AS "Verified By", p.created_at AS "Date"
                FROM payments p JOIN orders o ON o.id = p.order_id
                JOIN users u ON u.id = o.customer_id
                LEFT JOIN companies c ON c.id = o.company_id
               WHERE substr(p.created_at, 1, 10) BETWEEN ? AND ? ORDER BY p.created_at`,
      },
      orders: {
        sql: `SELECT o.order_no AS "Order", u.full_name AS "Ordered By", c.company_name AS "Company",
                     o.status AS "Status", o.total AS "Total", o.fulfilment AS "Fulfilment", o.created_at AS "Date"
                FROM orders o JOIN users u ON u.id = o.customer_id
                LEFT JOIN companies c ON c.id = o.company_id
               WHERE substr(o.created_at, 1, 10) BETWEEN ? AND ? ORDER BY o.created_at`,
      },
      'cash-book': {
        sql: `SELECT cb.entry_date AS "Date", cb.details AS "Details", cb.cash_in AS "Cash In",
                     cb.cash_out AS "Cash Out", cb.method AS "Method", u.full_name AS "Recorded By"
                FROM cash_book cb JOIN users u ON u.id = cb.recorded_by
               WHERE cb.entry_date BETWEEN ? AND ? ORDER BY cb.entry_date, cb.created_at`,
      },
      stock: {
        sql: `SELECT p.code AS "Code", p.name AS "Product", p.unit AS "Unit", p.price AS "Price",
                     p.stock_available AS "In Stock", p.reorder_level AS "Reorder Level", p.supplier AS "Supplier"
                FROM products p WHERE p.active = 1 AND ? IS NOT NULL AND ? IS NOT NULL ORDER BY p.name`,
      },
    };

    const q = queries[req.params.report];
    if (!q) throw badRequest('Unknown report');

    const rows = await all(q.sql, [from, to]);
    const headers = rows.length ? Object.keys(rows[0]) : [];
    const escape = (v) => {
      const s = v === null || v === undefined ? '' : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [
      headers.join(','),
      ...rows.map((r) => headers.map((h) => escape(r[h])).join(',')),
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${req.params.report}-${from}_to_${to}.csv"`);
    res.send(csv);
  } catch (e) { next(e); }
});

export default router;
