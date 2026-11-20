import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  placeOrder, getOrder, getOrderByNo, ordersForCustomer,
  assertCanView, cancelOrder, queueFor, STATUS_LABEL,
} from '../services/orders.js';
import { all, get, run } from '../db/index.js';
import { signToken } from '../utils/tokens.js';
import { sendSms, orderPlacedMessage, normalisePhone } from '../utils/sms.js';
import { badRequest, unauthorized } from '../utils/errors.js';

const router = Router();

// ---------------------------------------------------------------------
// Ordering without signing in first
//
// The customer browses, picks what they want, and only then gives a
// phone number, a name and where the goods should go. Nobody is asked to
// make an account before they know what the shop sells.
//
// The phone number is the account: if it is already known the order is
// filed against that customer, and if it is new a customer record is
// created. Either way a confirmation SMS goes out and the order appears
// in that number's history.
// ---------------------------------------------------------------------
const guestSchema = z.object({
  phone: z.string().min(9),
  fullName: z.string().min(2),
  items: z.array(z.object({
    productId: z.number().int().positive(),
    quantity: z.number().int().positive(),
  })).min(1),
  // 'shop_delivery' — the shop's truck takes it, free of charge.
  // 'own_transport' — the customer is sending their own delivery man.
  // 'pickup'        — they are coming for it themselves.
  delivery: z.enum(['shop_delivery', 'own_transport', 'pickup']),
  location: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

router.post('/guest', validate(guestSchema), async (req, res, next) => {
  try {
    const b = req.body;
    const phone = normalisePhone(b.phone);

    if (b.delivery === 'shop_delivery' && !String(b.location || '').trim()) {
      throw badRequest('Tell us where to deliver, so the driver can find you');
    }

    let user = await get('SELECT * FROM users WHERE phone = ?', [phone]);
    if (user && user.role !== 'customer') {
      throw badRequest(
        'That number belongs to a staff account. Use a customer number to order.'
      );
    }
    if (user && user.status !== 'active') {
      throw unauthorized('This account has been suspended');
    }

    if (!user) {
      const created = await run(
        `INSERT INTO users (full_name, phone, role, account_type)
         VALUES (?, ?, 'customer', 'individual')`,
        [b.fullName.trim(), phone]
      );
      user = await get('SELECT * FROM users WHERE id = ?', [Number(created.lastInsertRowid)]);
    }

    // Only the shop's own delivery needs an address on the order; a
    // customer's own transporter collects from the counter.
    const order = await placeOrder(user, {
      items: b.items,
      fulfilment: b.delivery === 'shop_delivery' ? 'delivery' : 'pickup',
      deliveryAddress: b.delivery === 'shop_delivery' ? b.location.trim() : null,
      deliveryFee: 0,
      notes: [
        b.delivery === 'own_transport'
          ? `Collected from the shop by the customer's own delivery man${
              b.location ? ` — going to ${b.location.trim()}` : ''}`
          : b.delivery === 'pickup'
            ? 'Customer is collecting from the shop'
            : 'Shop delivery — free',
        b.notes?.trim(),
      ].filter(Boolean).join('. '),
    });

    const sms = await sendSms(phone, orderPlacedMessage(order));

    res.status(201).json({
      order,
      // The phone has just been used to place an order from this device,
      // so the same device gets a session for it and the order shows up
      // in the history immediately.
      token: signToken(user),
      user: {
        id: user.id,
        fullName: user.full_name,
        phone: user.phone,
        role: user.role,
        accountType: user.account_type,
      },
      smsSent: sms.ok,
    });
  } catch (e) { next(e); }
});

router.use(authenticate);

const placeSchema = z.object({
  items: z.array(z.object({
    productId: z.number().int().positive(),
    quantity: z.number().int().positive(),
  })).min(1),
  fulfilment: z.enum(['pickup', 'delivery']).default('pickup'),
  deliveryAddress: z.string().optional().nullable(),
  deliveryFee: z.number().int().nonnegative().optional(),
  notes: z.string().optional().nullable(),
});

/** Customer places an order (individual, or company staff on the company's behalf). */
router.post('/', requireRole('customer'), validate(placeSchema), async (req, res, next) => {
  try {
    res.status(201).json({ order: await placeOrder(req.user, req.body) });
  } catch (e) { next(e); }
});

/** My orders. ?scope=company lets a company owner see every staff order. */
router.get('/mine', requireRole('customer'), async (req, res, next) => {
  try {
    res.json({ orders: await ordersForCustomer(req.user, { scope: req.query.scope || 'mine' }) });
  } catch (e) { next(e); }
});

/** Staff view of the whole order register, with filters. */
router.get('/', requireRole('cashier', 'accounts', 'store', 'manager'), async (req, res, next) => {
  try {
    const { status, stage, from, to, q, limit = 200 } = req.query;
    const where = [], params = [];
    if (status) { where.push('o.status = ?'); params.push(status); }
    if (stage) { where.push('o.current_stage = ?'); params.push(stage); }
    if (from) { where.push('substr(o.created_at, 1, 10) >= ?'); params.push(from); }
    if (to) { where.push('substr(o.created_at, 1, 10) <= ?'); params.push(to); }
    if (q) {
      where.push('(o.order_no ILIKE ? OR u.full_name ILIKE ? OR c.company_name ILIKE ?)');
      const like = `%${q}%`;
      params.push(like, like, like);
    }
    const orders = (await all(
      `SELECT o.*, u.full_name AS ordered_by_name, u.phone AS ordered_by_phone, c.company_name,
              (SELECT COUNT(*) FROM order_items i WHERE i.order_id = o.id) AS item_count
         FROM orders o
         JOIN users u ON u.id = o.customer_id
         LEFT JOIN companies c ON c.id = o.company_id
        ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
        ORDER BY o.created_at DESC
        LIMIT ?`,
      [...params, Number(limit)]
    )).map((o) => ({ ...o, status_label: STATUS_LABEL[o.status] }));
    res.json({ orders });
  } catch (e) { next(e); }
});

/** The queue for one desk. */
router.get('/queue/:stage', requireRole('cashier', 'accounts', 'store', 'manager'), async (req, res, next) => {
  try {
    res.json({ orders: await queueFor(req.params.stage) });
  } catch (e) { next(e); }
});

router.get('/by-no/:orderNo', async (req, res, next) => {
  try {
    const order = await getOrderByNo(req.params.orderNo);
    await assertCanView(req.user, order);
    res.json({ order });
  } catch (e) { next(e); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const order = await getOrder(Number(req.params.id));
    await assertCanView(req.user, order);
    res.json({ order });
  } catch (e) { next(e); }
});

/** Live tracking: the audit trail the customer sees as a progress list. */
router.get('/:id/track', async (req, res, next) => {
  try {
    const order = await getOrder(Number(req.params.id));
    await assertCanView(req.user, order);
    const steps = [
      { key: 'placed',   label: 'Order placed' },
      { key: 'paid',     label: 'Paid at Cashier' },
      { key: 'verified', label: 'Accounts verifying payment' },
      { key: 'store',    label: 'Store preparing goods' },
      { key: 'released', label: 'Ready / Released' },
    ];
    const reached = {
      placed: !!order.events.find((e) => e.action === 'placed'),
      paid: ['paid', 'payment_verified', 'released'].includes(order.status),
      verified: ['payment_verified', 'released'].includes(order.status),
      store: ['payment_verified', 'released'].includes(order.status),
      released: order.status === 'released',
    };
    res.json({
      order,
      progress: steps.map((s) => ({
        ...s,
        done: reached[s.key],
        at: order.events.find((e) =>
          (s.key === 'placed' && e.action === 'placed') ||
          (s.key === 'paid' && e.action === 'payment_received') ||
          (s.key === 'verified' && e.action === 'verified') ||
          (s.key === 'released' && e.action === 'released'))?.created_at || null,
      })),
    });
  } catch (e) { next(e); }
});

router.post('/:id/cancel', validate(z.object({ reason: z.string().optional() })), async (req, res, next) => {
  try {
    res.json({ order: await cancelOrder(req.user, Number(req.params.id), req.body.reason) });
  } catch (e) { next(e); }
});

export default router;
