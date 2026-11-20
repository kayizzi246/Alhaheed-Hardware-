import { all, get, run, tx, nextOrderNo, nextReceiptNo } from '../db/index.js';
import { badRequest, notFound, conflict, forbidden } from '../utils/errors.js';
import { logEvent } from '../utils/audit.js';
import { notifyUser, notifyRole } from '../utils/notify.js';
import { emitToDesks, emitToCompany } from '../realtime.js';
import { formatMoney } from '../utils/money.js';

export const STATUS = {
  PENDING_PAYMENT: 'pending_payment',
  PAID: 'paid',
  PAYMENT_VERIFIED: 'payment_verified',
  RELEASED: 'released',
  CANCELLED: 'cancelled',
  REJECTED: 'rejected',
  REFUNDED: 'refunded',
};

export const STATUS_LABEL = {
  pending_payment: 'Pending Payment',
  paid: 'Paid',
  payment_verified: 'Payment Verified',
  released: 'Released / Completed',
  cancelled: 'Cancelled',
  rejected: 'Payment Rejected',
  refunded: 'Refunded',
};

/** Which desk owns an order in each status. */
const STAGE_FOR_STATUS = {
  pending_payment: 'cashier',
  paid: 'accounts',
  payment_verified: 'store',
  released: 'done',
  cancelled: 'done',
  rejected: 'cashier',
  refunded: 'done',
};

// ---------------------------------------------------------------------
// Reading orders
// ---------------------------------------------------------------------
export async function getOrder(orderId) {
  const order = await get(
    `SELECT o.*, u.full_name AS ordered_by_name, u.phone AS ordered_by_phone,
            c.company_name
       FROM orders o
       JOIN users u ON u.id = o.customer_id
       LEFT JOIN companies c ON c.id = o.company_id
      WHERE o.id = ?`,
    [orderId]
  );
  if (!order) throw notFound('Order not found');
  return await hydrate(order);
}

export async function getOrderByNo(orderNo) {
  const row = await get('SELECT id FROM orders WHERE order_no = ?', [orderNo.replace(/^#/, '')]);
  if (!row) throw notFound('Order not found');
  return await getOrder(row.id);
}

async function hydrate(order) {
  order.items = await all(
    'SELECT * FROM order_items WHERE order_id = ? ORDER BY id',
    [order.id]
  );
  order.payment = await get(
    'SELECT * FROM payments WHERE order_id = ? ORDER BY id DESC LIMIT 1',
    [order.id]
  ) || null;
  order.events = await all(
    'SELECT * FROM order_events WHERE order_id = ? ORDER BY id',
    [order.id]
  );
  order.status_label = STATUS_LABEL[order.status] || order.status;
  return order;
}

/** Orders sitting in one desk's queue. */
export async function queueFor(stage, { limit = 100 } = {}) {
  const statusByStage = {
    cashier: [STATUS.PENDING_PAYMENT],
    accounts: [STATUS.PAID],
    store: [STATUS.PAYMENT_VERIFIED],
  };
  const statuses = statusByStage[stage];
  if (!statuses) throw badRequest('Unknown desk');
  const placeholders = statuses.map(() => '?').join(',');
  return (await all(
    `SELECT o.*, u.full_name AS ordered_by_name, u.phone AS ordered_by_phone,
            c.company_name,
            (SELECT COUNT(*) FROM order_items i WHERE i.order_id = o.id) AS item_count
       FROM orders o
       JOIN users u ON u.id = o.customer_id
       LEFT JOIN companies c ON c.id = o.company_id
      WHERE o.status IN (${placeholders})
      ORDER BY o.created_at ASC
      LIMIT ?`,
    [...statuses, limit]
  )).map((o) => ({ ...o, status_label: STATUS_LABEL[o.status] }));
}

/** Orders a given customer is allowed to see. */
export async function ordersForCustomer(user, { scope = 'mine', limit = 100 } = {}) {
  // A company owner may ask for every order placed under the company account.
  const companyWide = scope === 'company' && user.account_type === 'company_owner' && user.company_id;
  const where = companyWide ? 'o.company_id = ?' : 'o.customer_id = ?';
  const param = companyWide ? user.company_id : user.id;

  return (await all(
    `SELECT o.*, u.full_name AS ordered_by_name, c.company_name,
            (SELECT COUNT(*) FROM order_items i WHERE i.order_id = o.id) AS item_count
       FROM orders o
       JOIN users u ON u.id = o.customer_id
       LEFT JOIN companies c ON c.id = o.company_id
      WHERE ${where}
      ORDER BY o.created_at DESC
      LIMIT ?`,
    [param, limit]
  )).map((o) => ({ ...o, status_label: STATUS_LABEL[o.status] }));
}

/** Can this user see this order? */
export function assertCanView(user, order) {
  if (['cashier', 'accounts', 'store', 'manager'].includes(user.role)) return;
  if (order.customer_id === user.id) return;
  if (
    user.account_type === 'company_owner' &&
    user.company_id &&
    order.company_id === user.company_id
  ) return;
  throw forbidden('This order belongs to another customer');
}

// ---------------------------------------------------------------------
// 1. Customer places the order
// ---------------------------------------------------------------------
export async function placeOrder(user, { items, fulfilment = 'pickup', deliveryAddress, notes, deliveryFee = 0, source = 'app', externalRef = null }) {
  if (!Array.isArray(items) || items.length === 0) throw badRequest('Your cart is empty');
  if (fulfilment === 'delivery' && !deliveryAddress) {
    throw badRequest('A delivery address is required for delivery orders');
  }

  return await tx(async () => {
    // Every line is checked against stock before any of them is written,
    // so an order that cannot be filled is refused whole rather than
    // half-created.
    const lines = [];
    for (const { productId, quantity } of items) {
      const product = await get('SELECT * FROM products WHERE id = ? AND active = 1', [productId]);
      if (!product) throw badRequest(`Product ${productId} is not available`);
      const qty = Math.trunc(Number(quantity));
      if (!Number.isFinite(qty) || qty < 1) throw badRequest(`Invalid quantity for ${product.name}`);
      if (qty > product.stock_available) {
        throw conflict(`Only ${product.stock_available} ${product.unit} of ${product.name} left in stock`);
      }
      lines.push({
        product,
        quantity: qty,
        unit_price: product.price,
        line_total: product.price * qty,
      });
    }

    const subtotal = lines.reduce((s, l) => s + l.line_total, 0);
    const fee = fulfilment === 'delivery' ? Math.max(0, Math.trunc(Number(deliveryFee) || 0)) : 0;
    const total = subtotal + fee;

    // A company may cap what each of its staff can spend on one order.
    if (user.account_type === 'company_staff' && user.spending_limit != null) {
      if (total > user.spending_limit) {
        throw forbidden(
          `This order is ${formatMoney(total)} but your spending limit is ${formatMoney(user.spending_limit)}`
        );
      }
    }

    const orderNo = await nextOrderNo();
    const res = await run(
      `INSERT INTO orders
         (order_no, customer_id, company_id, status, current_stage,
          subtotal, delivery_fee, total, fulfilment, delivery_address, notes,
          source, external_ref)
       VALUES (?, ?, ?, ?, 'cashier', ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        orderNo,
        user.id,
        user.company_id || null,
        STATUS.PENDING_PAYMENT,
        subtotal,
        fee,
        total,
        fulfilment,
        deliveryAddress || null,
        notes || null,
        source,
        externalRef,
      ]
    );
    const orderId = Number(res.lastInsertRowid);

    for (const l of lines) {
      await run(
        `INSERT INTO order_items
           (order_id, product_id, product_name, unit, quantity, unit_price, line_total)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [orderId, l.product.id, l.product.name, l.product.unit, l.quantity, l.unit_price, l.line_total]
      );
    }

    await logEvent({
      orderId,
      stage: 'customer',
      action: 'placed',
      toStatus: STATUS.PENDING_PAYMENT,
      user,
      notes: `${lines.length} item(s), ${formatMoney(total)}`,
    });

    const order = await getOrder(orderId);

    await notifyRole('cashier', {
      title: `New order #${orderNo}`,
      body: `${user.full_name} · ${formatMoney(total)} waiting for payment`,
      orderId,
    });
    await notifyUser(user.id, {
      title: `Order #${orderNo} placed`,
      body: 'Please pay at the cashier desk to continue.',
      orderId,
    });
    emitToDesks('order:new', order);
    emitToCompany(user.company_id, 'order:updated', order);

    return order;
  });
}

// ---------------------------------------------------------------------
// 2. Cashier receives payment
// ---------------------------------------------------------------------
export async function receivePayment(cashier, orderId, { method, amountPaid, transactionRef }) {
  const order = await getOrder(orderId);
  if (order.status !== STATUS.PENDING_PAYMENT && order.status !== STATUS.REJECTED) {
    throw conflict(`Order #${order.order_no} is already ${STATUS_LABEL[order.status]}`);
  }
  if (!['cash', 'mobile_money', 'card'].includes(method)) throw badRequest('Unknown payment method');

  const paid = Math.trunc(Number(amountPaid));
  if (!Number.isFinite(paid) || paid < order.total) {
    throw badRequest(`Amount paid must be at least ${formatMoney(order.total)}`);
  }
  if (method !== 'cash' && !transactionRef) {
    throw badRequest('A transaction reference is required for mobile money and card payments');
  }

  return await tx(async () => {
    const receiptNo = await nextReceiptNo();
    await run(
      `INSERT INTO payments
         (order_id, receipt_no, amount_due, amount_paid, method, transaction_ref, cashier_id, cashier_name)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [orderId, receiptNo, order.total, paid, method, transactionRef || null, cashier.id, cashier.full_name]
    );

    await run(
      `UPDATE orders SET status = ?, current_stage = 'accounts', updated_at = now_text() WHERE id = ?`,
      [STATUS.PAID, orderId]
    );

    await logEvent({
      orderId,
      stage: 'cashier',
      action: 'payment_received',
      fromStatus: order.status,
      toStatus: STATUS.PAID,
      user: cashier,
      notes: `${receiptNo} · ${method} · ${formatMoney(paid)}`,
    });

    const updated = await getOrder(orderId);

    await notifyUser(order.customer_id, {
      title: `Payment received for #${order.order_no}`,
      body: `Receipt ${receiptNo} · ${formatMoney(paid)}. Accounts is verifying your payment.`,
      orderId,
    });
    await notifyRole('accounts', {
      title: `#${order.order_no} awaiting verification`,
      body: `${formatMoney(paid)} by ${method.replace('_', ' ')} · receipt ${receiptNo}`,
      orderId,
    });
    emitToDesks('order:updated', updated);
    emitToCompany(order.company_id, 'order:updated', updated);

    return updated;
  });
}

// ---------------------------------------------------------------------
// 3. Accounts verifies the payment
// ---------------------------------------------------------------------
export async function verifyPayment(accountant, orderId, { approve, remarks }) {
  const order = await getOrder(orderId);
  if (order.status !== STATUS.PAID) {
    throw conflict(`Order #${order.order_no} is not waiting for verification`);
  }
  const payment = order.payment;
  if (!payment) throw conflict('No payment recorded against this order');

  return await tx(async () => {
    const newStatus = approve ? STATUS.PAYMENT_VERIFIED : STATUS.REJECTED;

    await run(
      `UPDATE payments
          SET verified = ?, verified_by = ?, verifier_name = ?,
              verified_at = now_text(), verify_remarks = ?
        WHERE id = ?`,
      [approve ? 1 : -1, accountant.id, accountant.full_name, remarks || null, payment.id]
    );

    await run(
      `UPDATE orders SET status = ?, current_stage = ?, updated_at = now_text() WHERE id = ?`,
      [newStatus, approve ? 'store' : 'cashier', orderId]
    );

    // A verified payment is money in the shop: record it in the cash book.
    if (approve) {
      await run(
        `INSERT INTO cash_book (details, cash_in, method, order_id, payment_id, recorded_by)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          `${payment.receipt_no} · Order #${order.order_no}`,
          payment.amount_paid,
          payment.method,
          orderId,
          payment.id,
          accountant.id,
        ]
      );
    }

    await logEvent({
      orderId,
      stage: 'accounts',
      action: approve ? 'verified' : 'rejected',
      fromStatus: STATUS.PAID,
      toStatus: newStatus,
      user: accountant,
      notes: remarks || null,
    });

    const updated = await getOrder(orderId);

    await notifyUser(order.customer_id, {
      title: approve
        ? `Payment verified for #${order.order_no}`
        : `Payment query on #${order.order_no}`,
      body: approve
        ? 'The store is now preparing your goods.'
        : remarks || 'Please see the cashier desk.',
      orderId,
    });
    if (approve) {
      await notifyRole('store', {
        title: `#${order.order_no} approved for release`,
        body: `${order.items.length} item(s) to pick and pack`,
        orderId,
      });
    } else {
      await notifyRole('cashier', {
        title: `#${order.order_no} rejected by Accounts`,
        body: remarks || 'Payment could not be verified',
        orderId,
      });
    }
    emitToDesks('order:updated', updated);
    emitToCompany(order.company_id, 'order:updated', updated);

    return updated;
  });
}

// ---------------------------------------------------------------------
// 4. Store Manager releases the goods (and stock drops)
// ---------------------------------------------------------------------
export async function releaseOrder(storeManager, orderId, { collectedBy, deliveryStatus, notes }) {
  const order = await getOrder(orderId);
  if (order.status !== STATUS.PAYMENT_VERIFIED) {
    throw conflict(`Order #${order.order_no} has not been verified by Accounts yet`);
  }

  return await tx(async () => {
    for (const item of order.items) {
      const product = await get('SELECT * FROM products WHERE id = ?', [item.product_id]);
      if (!product) throw conflict(`Product ${item.product_name} no longer exists`);
      if (product.stock_available < item.quantity) {
        throw conflict(
          `Not enough ${product.name} in stock: ${product.stock_available} left, ${item.quantity} needed`
        );
      }
      const before = product.stock_available;
      const after = before - item.quantity;

      await run(`UPDATE products SET stock_available = ?, updated_at = now_text() WHERE id = ?`, [after, product.id]);
      await run('UPDATE order_items SET qty_released = ? WHERE id = ?', [item.quantity, item.id]);
      await run(
        `INSERT INTO stock_movements
           (product_id, movement, quantity, stock_before, stock_after, order_id, handled_by, reason)
         VALUES (?, 'release', ?, ?, ?, ?, ?, ?)`,
        [product.id, -item.quantity, before, after, orderId, storeManager.id, `Released on order #${order.order_no}`]
      );

      if (after <= product.reorder_level) {
        await notifyRole('manager', {
          title: `Low stock: ${product.name}`,
          body: `${after} ${product.unit} left · reorder level ${product.reorder_level}`,
        });
        await notifyRole('store', {
          title: `Low stock: ${product.name}`,
          body: `${after} ${product.unit} left · reorder level ${product.reorder_level}`,
        });
      }
    }

    await run(
      `UPDATE orders SET status = ?, current_stage = 'done', updated_at = now_text() WHERE id = ?`,
      [STATUS.RELEASED, orderId]
    );

    await logEvent({
      orderId,
      stage: 'store',
      action: 'released',
      fromStatus: STATUS.PAYMENT_VERIFIED,
      toStatus: STATUS.RELEASED,
      user: storeManager,
      notes: [collectedBy && `Collected by ${collectedBy}`, deliveryStatus, notes]
        .filter(Boolean)
        .join(' · ') || null,
    });

    const updated = await getOrder(orderId);

    await notifyUser(order.customer_id, {
      title: `Order #${order.order_no} released`,
      body: order.fulfilment === 'delivery'
        ? 'Your goods are on the way.'
        : 'Your goods are ready and have been released.',
      orderId,
    });
    emitToDesks('order:updated', updated);
    emitToCompany(order.company_id, 'order:updated', updated);

    return updated;
  });
}

// ---------------------------------------------------------------------
// Cancellation (customer before payment, manager at any stage)
// ---------------------------------------------------------------------
export async function cancelOrder(user, orderId, reason) {
  const order = await getOrder(orderId);
  if ([STATUS.RELEASED, STATUS.CANCELLED, STATUS.REFUNDED].includes(order.status)) {
    throw conflict(`Order #${order.order_no} can no longer be cancelled`);
  }
  const isManager = user.role === 'manager';
  if (!isManager) {
    await assertCanView(user, order);
    if (order.status !== STATUS.PENDING_PAYMENT) {
      throw forbidden('Once payment is received only the manager can cancel this order');
    }
  }

  return await tx(async () => {
    await run(
      `UPDATE orders SET status = ?, current_stage = 'done', cancel_reason = ?, updated_at = now_text()
        WHERE id = ?`,
      [STATUS.CANCELLED, reason || null, orderId]
    );
    await logEvent({
      orderId,
      stage: isManager ? 'manager' : 'customer',
      action: 'cancelled',
      fromStatus: order.status,
      toStatus: STATUS.CANCELLED,
      user,
      notes: reason || null,
    });

    const updated = await getOrder(orderId);
    await notifyUser(order.customer_id, {
      title: `Order #${order.order_no} cancelled`,
      body: reason || 'The order was cancelled.',
      orderId,
    });
    emitToDesks('order:updated', updated);
    emitToCompany(order.company_id, 'order:updated', updated);
    return updated;
  });
}
