/**
 * Seed the database with staff logins, a hardware catalogue and
 * demo orders sitting at each desk, so every screen has something to show.
 */
import bcrypt from 'bcryptjs';
import { migrate, all, get, run, nextOrderNo, nextReceiptNo, close } from './index.js';
import { config } from '../config.js';

await migrate();

if ((await get('SELECT COUNT(*) AS n FROM products')).n > 0) {
  console.log('Database already has data - nothing seeded. Run `npm run db:reset` to start fresh.');
  process.exit(0);
}

const hash = (p) => bcrypt.hashSync(p, 10);

// ----------------------------------------------------------- Categories
const categories = ['Cement', 'Iron & Steel', 'Roofing', 'Paints', 'Plumbing', 'Electricals', 'Tools'];
const catId = {};
for (const name of categories) {
  const r = await run('INSERT INTO categories (name) VALUES (?)', [name]);
  catId[name] = Number(r.lastInsertRowid);
}

// ------------------------------------------------------------- Products
const products = [
  ['AH-CEM-001', 'Hima Cement 50kg',       'Cement',      'bag',    34000, 420, 50, 'Hima Cement Ltd'],
  ['AH-CEM-002', 'Tororo Cement 50kg',     'Cement',      'bag',    33000, 310, 50, 'Tororo Cement'],
  ['AH-IRN-001', 'Iron Bar Y12 (12m)',     'Iron & Steel','length', 42000,  18, 50, 'Steel Rolling Mills'],
  ['AH-IRN-002', 'Iron Bar Y16 (12m)',     'Iron & Steel','length', 72000,  44, 20, 'Steel Rolling Mills'],
  ['AH-IRN-003', 'Binding Wire 25kg',      'Iron & Steel','roll',   165000, 12, 5,  'Roofings Uganda'],
  ['AH-ROF-001', 'Iron Sheet 28G (3m)',    'Roofing',     'pc',     38500,  96, 30, 'Roofings Uganda'],
  ['AH-ROF-002', 'Iron Sheet 30G (3m)',    'Roofing',     'pc',     31000, 140, 30, 'Roofings Uganda'],
  ['AH-ROF-003', 'Ridge Cap 2m',           'Roofing',     'pc',     22000,  60, 20, 'Roofings Uganda'],
  ['AH-PNT-001', 'Wall Paint 20L (Silk)',  'Paints',      'tin',    185000,  4, 10, 'Plascon'],
  ['AH-PNT-002', 'Undercoat 4L',           'Paints',      'tin',    48000,  26, 10, 'Plascon'],
  ['AH-PLM-001', 'PVC Pipe 4" (6m)',       'Plumbing',    'length', 27000,  72, 20, 'Nice House of Plastics'],
  ['AH-PLM-002', 'PVC Pipe 2" (6m)',       'Plumbing',    'length', 15500,  88, 20, 'Nice House of Plastics'],
  ['AH-PLM-003', 'Gate Valve 1"',          'Plumbing',    'pc',     26000,  40, 10, 'Crestanks'],
  ['AH-ELE-001', 'Twin Cable 2.5mm (90m)', 'Electricals', 'roll',   245000, 15, 5,  'Cable Corp'],
  ['AH-ELE-002', 'Socket Outlet 13A',      'Electricals', 'pc',      9500, 210, 50, 'Cable Corp'],
  ['AH-ELE-003', 'LED Bulb 12W',           'Electricals', 'pc',      7000, 180, 40, 'Cable Corp'],
  ['AH-TLS-001', 'Wire Nails 4" (per kg)', 'Tools',       'kg',      7500, 320, 80, 'Uganda Nails'],
  ['AH-TLS-002', 'Wheelbarrow Heavy Duty', 'Tools',       'pc',    195000,  14, 5,  'Mukwano'],
  ['AH-TLS-003', 'Shovel',                 'Tools',       'pc',     28000,  48, 15, 'Mukwano'],
  ['AH-TLS-004', 'Hammer 2lb',             'Tools',       'pc',     23000,  36, 10, 'Mukwano'],
];
for (const [code, name, cat, unit, price, stock, reorder, supplier] of products) {
  await run(
    `INSERT INTO products (code, name, category_id, unit, price, stock_available, reorder_level, supplier, description)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [code, name, catId[cat], unit, price, stock, reorder, supplier, `${name} - ${cat}`]
  );
}

// ---------------------------------------------------------------- Staff
const staff = [
  ['Aisha Nakato',   '+256700000001', 'cashier@alhadeed.ug',  'cashier',  'cashier123'],
  ['David Mugisha',  '+256700000002', 'accounts@alhadeed.ug', 'accounts', 'accounts123'],
  ['Musa Kateregga', '+256700000003', 'store@alhadeed.ug',    'store',    'store123'],
  ['Hassan Ali',     '+256700000004', 'manager@alhadeed.ug',  'manager',  'manager123'],
];
const staffId = {};
for (const [name, phone, email, role, password] of staff) {
  const r = await run(
    `INSERT INTO users (full_name, phone, email, password_hash, role, account_type)
     VALUES (?, ?, ?, ?, ?, 'staff')`,
    [name, phone, email, hash(password), role]
  );
  staffId[role] = Number(r.lastInsertRowid);
}

// ------------------------------------------------------------ Customers
// Individual customers
const individuals = [
  ['Mukasa Joseph', '+256770111001', 'mukasa@example.com'],
  ['Nakato Grace',  '+256770111002', 'grace@example.com'],
];
const custId = {};
for (const [name, phone, email] of individuals) {
  const r = await run(
    `INSERT INTO users (full_name, phone, email, role, account_type) VALUES (?, ?, ?, 'customer', 'individual')`,
    [name, phone, email]
  );
  custId[name] = Number(r.lastInsertRowid);
}

// A company customer with its own staff
const companyRow = await run(
  `INSERT INTO companies (company_name, tin, contact_person, phone, email, address)
   VALUES (?, ?, ?, ?, ?, ?)`,
  ['Kampala Construction Ltd', '1000234567', 'John Okello', '+256770222001',
   'info@kampalaconstruction.ug', 'Plot 14, Old Kampala, Kampala']
);
const companyId = Number(companyRow.lastInsertRowid);

const ownerRow = await run(
  `INSERT INTO users (full_name, phone, email, role, account_type, company_id, tin)
   VALUES (?, ?, ?, 'customer', 'company_owner', ?, ?)`,
  ['John Okello', '+256770222001', 'john@kampalaconstruction.ug', companyId, '1000234567']
);
const ownerId = Number(ownerRow.lastInsertRowid);

const companyStaff = [
  ['Sarah Namuli', '+256770222002', 'Cashier',         5000000],
  ['Peter Ssali',  '+256770222003', 'Buyer',           1000000],
  ['Moses Kigozi', '+256770222004', 'Site Supervisor', 2000000],
];
const compStaffId = {};
for (const [name, phone, staffRole, limit] of companyStaff) {
  const r = await run(
    `INSERT INTO users (full_name, phone, role, account_type, company_id, staff_role, spending_limit, added_by)
     VALUES (?, ?, 'customer', 'company_staff', ?, ?, ?, ?)`,
    [name, phone, companyId, staffRole, limit, ownerId]
  );
  compStaffId[name] = Number(r.lastInsertRowid);
}

// --------------------------------------------------------- Demo orders
const productByCode = async (code) =>
  get('SELECT * FROM products WHERE code = ?', [code]);

async function createOrder({ customerId, companyId: coId, lines, fulfilment = 'pickup', address }) {
  const items = await Promise.all(
    lines.map(async ([code, qty]) => {
      const p = await productByCode(code);
      return { p, qty, total: p.price * qty };
    })
  );
  const subtotal = items.reduce((s, i) => s + i.total, 0);
  const orderNo = await nextOrderNo();
  const r = await run(
    `INSERT INTO orders (order_no, customer_id, company_id, subtotal, total, fulfilment, delivery_address)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [orderNo, customerId, coId || null, subtotal, subtotal, fulfilment, address || null]
  );
  const orderId = Number(r.lastInsertRowid);
  for (const i of items) {
    await run(
      `INSERT INTO order_items (order_id, product_id, product_name, unit, quantity, unit_price, line_total)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [orderId, i.p.id, i.p.name, i.p.unit, i.qty, i.p.price, i.total]
    );
  }
  const customer = await get('SELECT * FROM users WHERE id = ?', [customerId]);
  await run(
    `INSERT INTO order_events (order_id, stage, action, to_status, handled_by, handler_name, notes)
     VALUES (?, 'customer', 'placed', 'pending_payment', ?, ?, ?)`,
    [orderId, customerId, customer.full_name, `${items.length} item(s)`]
  );
  return { orderId, orderNo, total: subtotal };
}

async function payOrder(orderId, method, ref) {
  const order = await get('SELECT * FROM orders WHERE id = ?', [orderId]);
  const receiptNo = await nextReceiptNo();
  await run(
    `INSERT INTO payments (order_id, receipt_no, amount_due, amount_paid, method, transaction_ref, cashier_id, cashier_name)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'Aisha Nakato')`,
    [orderId, receiptNo, order.total, order.total, method, ref || null, staffId.cashier]
  );
  await run(`UPDATE orders SET status = 'paid', current_stage = 'accounts' WHERE id = ?`, [orderId]);
  await run(
    `INSERT INTO order_events (order_id, stage, action, from_status, to_status, handled_by, handler_name, notes)
     VALUES (?, 'cashier', 'payment_received', 'pending_payment', 'paid', ?, 'Aisha Nakato', ?)`,
    [orderId, staffId.cashier, `${receiptNo} - ${method}`]
  );
  return receiptNo;
}

async function verifyOrder(orderId) {
  const payment = await get('SELECT * FROM payments WHERE order_id = ? ORDER BY id DESC LIMIT 1', [orderId]);
  const order = await get('SELECT * FROM orders WHERE id = ?', [orderId]);
  await run(
    `UPDATE payments SET verified = 1, verified_by = ?, verifier_name = 'David Mugisha', verified_at = now_text()
      WHERE id = ?`,
    [staffId.accounts, payment.id]
  );
  await run(`UPDATE orders SET status = 'payment_verified', current_stage = 'store' WHERE id = ?`, [orderId]);
  await run(
    `INSERT INTO cash_book (details, cash_in, method, order_id, payment_id, recorded_by)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [`${payment.receipt_no} - Order #${order.order_no}`, payment.amount_paid, payment.method,
     orderId, payment.id, staffId.accounts]
  );
  await run(
    `INSERT INTO order_events (order_id, stage, action, from_status, to_status, handled_by, handler_name)
     VALUES (?, 'accounts', 'verified', 'paid', 'payment_verified', ?, 'David Mugisha')`,
    [orderId, staffId.accounts]
  );
}

async function releaseOrderSeed(orderId) {
  const items = await all('SELECT * FROM order_items WHERE order_id = ?', [orderId]);
  for (const item of items) {
    const p = await get('SELECT * FROM products WHERE id = ?', [item.product_id]);
    const after = p.stock_available - item.quantity;
    await run('UPDATE products SET stock_available = ? WHERE id = ?', [after, p.id]);
    await run('UPDATE order_items SET qty_released = quantity WHERE id = ?', [item.id]);
    await run(
      `INSERT INTO stock_movements (product_id, movement, quantity, stock_before, stock_after, order_id, handled_by, reason)
       VALUES (?, 'release', ?, ?, ?, ?, ?, 'Released to customer')`,
      [p.id, -item.quantity, p.stock_available, after, orderId, staffId.store]
    );
  }
  await run(`UPDATE orders SET status = 'released', current_stage = 'done' WHERE id = ?`, [orderId]);
  await run(
    `INSERT INTO order_events (order_id, stage, action, from_status, to_status, handled_by, handler_name)
     VALUES (?, 'store', 'released', 'payment_verified', 'released', ?, 'Musa Kateregga')`,
    [orderId, staffId.store]
  );
}

// Opening cash float
await run(
  `INSERT INTO cash_book (details, cash_in, recorded_by) VALUES ('Opening balance', 1500000, ?)`,
  [staffId.accounts]
);

// 1. Waiting at the Cashier
await createOrder({ customerId: custId['Mukasa Joseph'], lines: [['AH-CEM-001', 2], ['AH-TLS-001', 4]] });
await createOrder({
  customerId: compStaffId['Sarah Namuli'], companyId,
  lines: [['AH-CEM-001', 40], ['AH-IRN-001', 10]],
  fulfilment: 'delivery', address: 'Site B, Namugongo Road',
});
await createOrder({ customerId: custId['Nakato Grace'], lines: [['AH-PNT-001', 1]] });

// 2. Paid, waiting at Accounts
const paid1 = await createOrder({ customerId: compStaffId['Sarah Namuli'], companyId, lines: [['AH-ROF-001', 20], ['AH-ROF-003', 6]] });
await payOrder(paid1.orderId, 'mobile_money', 'MP2611190934');
const paid2 = await createOrder({ customerId: custId['Mukasa Joseph'], lines: [['AH-ELE-002', 10], ['AH-ELE-003', 6]] });
await payOrder(paid2.orderId, 'cash');

// 3. Verified, waiting at the Store
const ver1 = await createOrder({ customerId: compStaffId['Peter Ssali'], companyId, lines: [['AH-PLM-001', 8], ['AH-PLM-003', 4]] });
await payOrder(ver1.orderId, 'mobile_money', 'MP2611190920');
await verifyOrder(ver1.orderId);
const ver2 = await createOrder({ customerId: custId['Nakato Grace'], lines: [['AH-TLS-002', 1], ['AH-TLS-003', 2]], fulfilment: 'delivery', address: 'Ntinda, Kampala' });
await payOrder(ver2.orderId, 'card', 'CARD-55120');
await verifyOrder(ver2.orderId);

// 4. Completed history
for (const [customerId, coId, lines, method] of [
  [compStaffId['Sarah Namuli'], companyId, [['AH-CEM-001', 25], ['AH-IRN-002', 8]], 'mobile_money'],
  [custId['Mukasa Joseph'], null, [['AH-TLS-004', 2]], 'cash'],
  [compStaffId['Moses Kigozi'], companyId, [['AH-CEM-002', 30]], 'mobile_money'],
  [custId['Nakato Grace'], null, [['AH-PNT-002', 3]], 'cash'],
]) {
  const o = await createOrder({ customerId, companyId: coId, lines });
  await payOrder(o.orderId, method, method === 'cash' ? null : `MP${Math.floor(Math.random() * 1e10)}`);
  await verifyOrder(o.orderId);
  await releaseOrderSeed(o.orderId);
}

// A cash-out entry and a refund request for the manager's dashboard
await run(
  `INSERT INTO cash_book (details, cash_out, method, recorded_by)
   VALUES ('Transport - delivery truck fuel', 120000, 'cash', ?)`,
  [staffId.accounts]
);
const lastReleased = await get(`SELECT id FROM orders WHERE status = 'released' ORDER BY id DESC LIMIT 1`);
await run(
  `INSERT INTO refunds (order_id, amount, reason, requested_by) VALUES (?, ?, ?, ?)`,
  [lastReleased.id, 38500, 'Iron sheet damaged on delivery', staffId.cashier]
);

console.log(`
  Seeded ${config.shopName}

  Staff logins (phone or email + password)
    Cashier        cashier@alhadeed.ug   / cashier123
    Accounts       accounts@alhadeed.ug  / accounts123
    Store Manager  store@alhadeed.ug     / store123
    Manager        manager@alhadeed.ug   / manager123

  Customer logins (phone + OTP, dev code 123456)
    Individual         +256770111001  Mukasa Joseph
    Individual         +256770111002  Nakato Grace
    Company owner      +256770222001  John Okello (Kampala Construction Ltd)
    Company staff      +256770222002  Sarah Namuli (Cashier, limit UGX 5,000,000)
    Company staff      +256770222003  Peter Ssali (Buyer, limit UGX 1,000,000)
    Company staff      +256770222004  Moses Kigozi (Site Supervisor, limit UGX 2,000,000)

  ${(await all('SELECT 1 FROM products')).length} products, ${(await all('SELECT 1 FROM orders')).length} demo orders across all desks.
`);

await close();
