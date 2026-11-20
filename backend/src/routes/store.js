import { Router } from 'express';
import { z } from 'zod';
import { all, get, run, tx } from '../db/index.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { releaseOrder, queueFor } from '../services/orders.js';
import { notFound, badRequest } from '../utils/errors.js';

const router = Router();
router.use(authenticate, requireRole('store', 'manager'));

/** Approved orders waiting to be picked, packed and released. */
router.get('/queue', async (_req, res) => {
  // Each order's items are a query of their own, so they are fetched
  // together rather than one after another down the list.
  const orders = await Promise.all(
    (await queueFor('store')).map(async (o) => ({
      ...o,
      items: await all(
        'SELECT * FROM order_items WHERE order_id = ? ORDER BY id', [o.id]),
    }))
  );
  const releasedToday = (await get(
    `SELECT COUNT(*) AS n FROM orders WHERE status = 'released' AND substr(updated_at, 1, 10) = today_text()`
  )).n;
  const lowStock = await all(
    `SELECT id, code, name, unit, stock_available, reorder_level
       FROM products WHERE active = 1 AND stock_available <= reorder_level
      ORDER BY stock_available ASC`
  );
  res.json({
    orders,
    summary: { toPick: orders.length, releasedToday, lowStock: lowStock.length },
    lowStock,
  });
});

/** Release goods: stock drops and the order completes. */
router.post(
  '/orders/:id/release',
  validate(z.object({
    collectedBy: z.string().optional().nullable(),
    deliveryStatus: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
  })),
  async (req, res, next) => {
    try {
      res.json({ order: await releaseOrder(req.user, Number(req.params.id), req.body) });
    } catch (e) { next(e); }
  }
);

// ------------------------------------------------------------- Stock
router.get('/stock', async (req, res) => {
  const { low, search } = req.query;
  const where = ['p.active = 1'], params = [];
  if (low === '1') where.push('p.stock_available <= p.reorder_level');
  if (search) { where.push('(p.name ILIKE ? OR p.code ILIKE ?)'); params.push(`%${search}%`, `%${search}%`); }
  res.json({
    stock: await all(
      `SELECT p.*, c.name AS category_name
         FROM products p LEFT JOIN categories c ON c.id = p.category_id
        WHERE ${where.join(' AND ')} ORDER BY p.name`,
      params
    ),
  });
});

/** Goods received from a supplier. */
router.post(
  '/stock/receive',
  validate(z.object({
    productId: z.number().int().positive(),
    quantity: z.number().int().positive(),
    supplier: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
  })),
  async (req, res, next) => {
    try {
      const { productId, quantity, supplier, notes } = req.body;
      const product = await get('SELECT * FROM products WHERE id = ?', [productId]);
      if (!product) throw notFound('Product not found');

      const updated = await tx(async () => {
        const before = product.stock_available;
        const after = before + quantity;
        await run(`UPDATE products SET stock_available = ?, supplier = COALESCE(?, supplier), updated_at = now_text() WHERE id = ?`,
          [after, supplier || null, productId]);
        await run(
          `INSERT INTO stock_movements
             (product_id, movement, quantity, stock_before, stock_after, supplier, reason, handled_by)
           VALUES (?, 'goods_received', ?, ?, ?, ?, ?, ?)`,
          [productId, quantity, before, after, supplier || null, notes || 'Goods received', req.user.id]
        );
        return await get('SELECT * FROM products WHERE id = ?', [productId]);
      });
      res.json({ product: updated });
    } catch (e) { next(e); }
  }
);

/** Stock adjustment (damage, stock count correction...). */
router.post(
  '/stock/adjust',
  validate(z.object({
    productId: z.number().int().positive(),
    quantity: z.number().int(),          // signed
    reason: z.string().min(2),
  })),
  async (req, res, next) => {
    try {
      const { productId, quantity, reason } = req.body;
      if (quantity === 0) throw badRequest('Adjustment cannot be zero');
      const product = await get('SELECT * FROM products WHERE id = ?', [productId]);
      if (!product) throw notFound('Product not found');
      const after = product.stock_available + quantity;
      if (after < 0) throw badRequest('That adjustment would take stock below zero');

      const updated = await tx(async () => {
        await run(`UPDATE products SET stock_available = ?, updated_at = now_text() WHERE id = ?`, [after, productId]);
        await run(
          `INSERT INTO stock_movements
             (product_id, movement, quantity, stock_before, stock_after, reason, handled_by)
           VALUES (?, 'adjustment', ?, ?, ?, ?, ?)`,
          [productId, quantity, product.stock_available, after, reason, req.user.id]
        );
        return await get('SELECT * FROM products WHERE id = ?', [productId]);
      });
      res.json({ product: updated });
    } catch (e) { next(e); }
  }
);

router.get('/stock/movements', async (req, res) => {
  const { productId, from, to, limit = 200 } = req.query;
  const where = [], params = [];
  if (productId) { where.push('m.product_id = ?'); params.push(Number(productId)); }
  if (from) { where.push('substr(m.created_at, 1, 10) >= ?'); params.push(from); }
  if (to) { where.push('substr(m.created_at, 1, 10) <= ?'); params.push(to); }
  res.json({
    movements: await all(
      `SELECT m.*, p.name AS product_name, p.code, p.unit, u.full_name AS handled_by_name, o.order_no
         FROM stock_movements m
         JOIN products p ON p.id = m.product_id
         JOIN users u ON u.id = m.handled_by
         LEFT JOIN orders o ON o.id = m.order_id
        ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
        ORDER BY m.created_at DESC LIMIT ?`,
      [...params, Number(limit)]
    ),
  });
});

export default router;
