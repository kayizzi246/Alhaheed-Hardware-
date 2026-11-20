import { Router } from 'express';
import { z } from 'zod';
import { all, get, run, tx } from '../db/index.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { notFound } from '../utils/errors.js';

const router = Router();

// ------------------------------------------------- Catalogue (public)
//
// Reading the catalogue needs no account. A customer opens the app and
// sees what the shop sells straight away; the phone number is only asked
// for at the point of ordering. Everything that *changes* a product sits
// below `router.use(authenticate)` further down.
router.get('/categories', async (_req, res) => {
  res.json({
    categories: await all(`SELECT c.*, (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id AND p.active = 1) AS product_count
                       FROM categories c ORDER BY c.name`),
  });
});

/** GET /api/products?search=cement&category=3&minPrice=&maxPrice=&inStock=1 */
router.get('/', async (req, res) => {
  const { search, category, minPrice, maxPrice, inStock } = req.query;
  const where = ['p.active = 1'];
  const params = [];

  if (search) {
    where.push('(p.name ILIKE ? OR p.code ILIKE ? OR p.description ILIKE ?)');
    const like = `%${search}%`;
    params.push(like, like, like);
  }
  if (category && category !== 'all') { where.push('p.category_id = ?'); params.push(Number(category)); }
  if (minPrice) { where.push('p.price >= ?'); params.push(Number(minPrice)); }
  if (maxPrice) { where.push('p.price <= ?'); params.push(Number(maxPrice)); }
  if (inStock === '1') where.push('p.stock_available > 0');

  const products = await all(
    `SELECT p.*, c.name AS category_name
       FROM products p LEFT JOIN categories c ON c.id = p.category_id
      WHERE ${where.join(' AND ')}
      ORDER BY p.name
      LIMIT 500`,
    params
  );
  res.json({ products });
});

router.get('/:id', async (req, res, next) => {
  try {
    const p = await get(
      `SELECT p.*, c.name AS category_name
         FROM products p LEFT JOIN categories c ON c.id = p.category_id
        WHERE p.id = ?`,
      [Number(req.params.id)]
    );
    if (!p) throw notFound('Product not found');
    res.json({ product: p });
  } catch (e) { next(e); }
});

// Everything past this line needs an account.
router.use(authenticate);

// ------------------------------------------------- Manage (manager only)
const productSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(2),
  categoryId: z.number().int().nullable().optional(),
  description: z.string().optional().nullable(),
  unit: z.string().min(1).default('pc'),
  price: z.number().int().nonnegative(),
  picture: z.string().optional().nullable(),
  stockAvailable: z.number().int().nonnegative().default(0),
  reorderLevel: z.number().int().nonnegative().default(0),
  supplier: z.string().optional().nullable(),
  remarks: z.string().optional().nullable(),
});

router.post('/', requireRole('manager'), validate(productSchema), async (req, res, next) => {
  try {
    const b = req.body;
    const r = await run(
      `INSERT INTO products
         (code, name, category_id, description, unit, price, picture, stock_available, reorder_level, supplier, remarks)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [b.code, b.name, b.categoryId || null, b.description || null, b.unit, b.price,
       b.picture || null, b.stockAvailable, b.reorderLevel, b.supplier || null, b.remarks || null]
    );
    res.status(201).json({ product: await get('SELECT * FROM products WHERE id = ?', [Number(r.lastInsertRowid)]) });
  } catch (e) { next(e); }
});

router.patch('/:id', requireRole('manager'), validate(productSchema.partial()), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const existing = await get('SELECT * FROM products WHERE id = ?', [id]);
    if (!existing) throw notFound('Product not found');
    const b = req.body;

    await tx(async () => {
      // Price changes are kept as history for the manager's reports.
      if (b.price != null && b.price !== existing.price) {
        await run(
          'INSERT INTO price_changes (product_id, old_price, new_price, changed_by) VALUES (?, ?, ?, ?)',
          [id, existing.price, b.price, req.user.id]
        );
      }
      const map = {
        code: 'code', name: 'name', categoryId: 'category_id', description: 'description',
        unit: 'unit', price: 'price', picture: 'picture', reorderLevel: 'reorder_level',
        supplier: 'supplier', remarks: 'remarks',
      };
      const sets = [], params = [];
      for (const [key, col] of Object.entries(map)) {
        if (b[key] !== undefined) { sets.push(`${col} = ?`); params.push(b[key]); }
      }
      if (sets.length) {
        await run(`UPDATE products SET ${sets.join(', ')}, updated_at = now_text() WHERE id = ?`, [...params, id]);
      }
    });

    res.json({ product: await get('SELECT * FROM products WHERE id = ?', [id]) });
  } catch (e) { next(e); }
});

router.delete('/:id', requireRole('manager'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!await get('SELECT id FROM products WHERE id = ?', [id])) throw notFound('Product not found');
    // Products are retired, never deleted: old orders still reference them.
    await run('UPDATE products SET active = 0 WHERE id = ?', [id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.post('/categories', requireRole('manager'), validate(z.object({ name: z.string().min(2) })), async (req, res, next) => {
  try {
    const r = await run('INSERT INTO categories (name) VALUES (?)', [req.body.name]);
    res.status(201).json({ category: await get('SELECT * FROM categories WHERE id = ?', [Number(r.lastInsertRowid)]) });
  } catch (e) { next(e); }
});

export default router;
