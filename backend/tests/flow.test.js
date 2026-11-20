/**
 * End-to-end test of the order flow:
 * Customer -> Cashier -> Accounts -> Store, plus stock and audit trail.
 * Runs against a throwaway database file.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

// A throwaway database of its own. With no DATABASE_URL the API runs
// PGlite — PostgreSQL compiled to WebAssembly, in this process — so the
// suite exercises the same engine the shop runs on, with no server to
// install and nothing left behind.
process.env.PG_DATA_DIR = `./data/test-${Date.now()}`;
delete process.env.DATABASE_URL;
process.env.JWT_SECRET = 'test-secret';
process.env.OTP_DEV_MODE = 'true';

const { config } = await import('../src/config.js');
const { createApp } = await import('../src/app.js');
const { close: closeDb } = await import('../src/db/index.js');

let server, base;

before(async () => {
  // Seed the fresh test database.
  await import('../src/db/seed.js');
  server = http.createServer(await createApp());
  await new Promise((r) => server.listen(0, r));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((r) => server.close(r));
  // Close the handle first: Windows keeps open database files locked.
  try { await closeDb(); } catch {}
  try { fs.rmSync(config.dataDir, { recursive: true, force: true }); } catch {}
});

async function api(method, url, { token, body } = {}) {
  const res = await fetch(base + url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  return { status: res.status, body: json };
}

const staffLogin = async (identifier, password) => {
  const r = await api('POST', '/api/auth/staff/login', { body: { identifier, password } });
  assert.equal(r.status, 200, `login failed for ${identifier}: ${JSON.stringify(r.body)}`);
  return r.body.token;
};

const customerLogin = async (phone) => {
  await api('POST', '/api/auth/otp/request', { body: { phone } });
  const r = await api('POST', '/api/auth/otp/verify', { body: { phone, code: '123456' } });
  assert.equal(r.status, 200, `otp login failed: ${JSON.stringify(r.body)}`);
  return r.body.token;
};

test('health check responds', async () => {
  const r = await api('GET', '/api/health');
  assert.equal(r.status, 200);
  assert.equal(r.body.ok, true);
});

test('an order moves Customer -> Cashier -> Accounts -> Store and reduces stock', async () => {
  const customer = await customerLogin('+256770111001');
  const cashier = await staffLogin('cashier@alhadeed.ug', 'cashier123');
  const accounts = await staffLogin('accounts@alhadeed.ug', 'accounts123');
  const store = await staffLogin('store@alhadeed.ug', 'store123');

  // Pick a product and remember its stock
  const list = await api('GET', '/api/products?search=Hima', { token: customer });
  const product = list.body.products[0];
  assert.ok(product, 'expected a product');
  const stockBefore = product.stock_available;

  // 1. Customer places the order
  const placed = await api('POST', '/api/orders', {
    token: customer,
    body: { items: [{ productId: product.id, quantity: 3 }], fulfilment: 'pickup' },
  });
  assert.equal(placed.status, 201, JSON.stringify(placed.body));
  const order = placed.body.order;
  assert.equal(order.status, 'pending_payment');
  assert.equal(order.total, product.price * 3);

  // It shows up in the cashier queue
  const queue = await api('GET', '/api/cashier/queue', { token: cashier });
  assert.ok(queue.body.orders.some((o) => o.id === order.id), 'order not in cashier queue');

  // 2. Cashier takes payment
  const paid = await api('POST', `/api/cashier/orders/${order.id}/payment`, {
    token: cashier,
    body: { method: 'cash', amountPaid: order.total },
  });
  assert.equal(paid.status, 200, JSON.stringify(paid.body));
  assert.equal(paid.body.order.status, 'paid');
  assert.match(paid.body.receipt.receipt_no, /^R-\d{5}$/);

  // 3. Accounts verifies
  const verified = await api('POST', `/api/accounts/orders/${order.id}/verify`, {
    token: accounts,
    body: { approve: true },
  });
  assert.equal(verified.status, 200, JSON.stringify(verified.body));
  assert.equal(verified.body.order.status, 'payment_verified');

  // The verified payment lands in the cash book
  const cashBook = await api('GET', '/api/accounts/cash-book', { token: accounts });
  assert.ok(
    cashBook.body.entries.some((e) => e.order_id === order.id),
    'verified payment missing from cash book'
  );

  // 4. Store releases the goods
  const released = await api('POST', `/api/store/orders/${order.id}/release`, {
    token: store,
    body: { collectedBy: 'Mukasa Joseph' },
  });
  assert.equal(released.status, 200, JSON.stringify(released.body));
  assert.equal(released.body.order.status, 'released');

  // Stock dropped by exactly the quantity released
  const after = await api('GET', `/api/products/${product.id}`, { token: store });
  assert.equal(after.body.product.stock_available, stockBefore - 3);

  // Audit trail recorded every desk
  const tracked = await api('GET', `/api/orders/${order.id}/track`, { token: customer });
  const actions = tracked.body.order.events.map((e) => e.action);
  assert.deepEqual(actions, ['placed', 'payment_received', 'verified', 'released']);
  assert.ok(tracked.body.progress.every((s) => s.done), 'all progress steps should be done');
});

test('a desk cannot act out of turn', async () => {
  const customer = await customerLogin('+256770111002');
  const store = await staffLogin('store@alhadeed.ug', 'store123');

  const list = await api('GET', '/api/products?search=Shovel', { token: customer });
  const placed = await api('POST', '/api/orders', {
    token: customer,
    body: { items: [{ productId: list.body.products[0].id, quantity: 1 }] },
  });
  const order = placed.body.order;

  // Store cannot release an order that was never paid for
  const early = await api('POST', `/api/store/orders/${order.id}/release`, { token: store, body: {} });
  assert.equal(early.status, 409, JSON.stringify(early.body));
});

test('roles are isolated: a cashier cannot open the manager dashboard', async () => {
  const cashier = await staffLogin('cashier@alhadeed.ug', 'cashier123');
  const r = await api('GET', '/api/manager/dashboard', { token: cashier });
  assert.equal(r.status, 403);
});

test('a customer cannot see another customer order', async () => {
  const a = await customerLogin('+256770111001');
  const b = await customerLogin('+256770111002');

  const list = await api('GET', '/api/products?search=Hammer', { token: a });
  const placed = await api('POST', '/api/orders', {
    token: a, body: { items: [{ productId: list.body.products[0].id, quantity: 1 }] },
  });
  const r = await api('GET', `/api/orders/${placed.body.order.id}`, { token: b });
  assert.equal(r.status, 403);
});

test('a company owner sees every order placed by company staff', async () => {
  const sarah = await customerLogin('+256770222002');   // company staff
  const owner = await customerLogin('+256770222001');   // company owner

  const list = await api('GET', '/api/products?search=Tororo', { token: sarah });
  const placed = await api('POST', '/api/orders', {
    token: sarah, body: { items: [{ productId: list.body.products[0].id, quantity: 2 }] },
  });
  assert.equal(placed.status, 201, JSON.stringify(placed.body));

  const companyOrders = await api('GET', '/api/company/orders', { token: owner });
  assert.equal(companyOrders.status, 200);
  const found = companyOrders.body.orders.find((o) => o.id === placed.body.order.id);
  assert.ok(found, 'owner should see the staff order');
  assert.equal(found.ordered_by_name, 'Sarah Namuli');

  // And the owner can open it directly
  const direct = await api('GET', `/api/orders/${placed.body.order.id}`, { token: owner });
  assert.equal(direct.status, 200);
});

test('a company staff spending limit is enforced', async () => {
  const peter = await customerLogin('+256770222003');   // limit UGX 1,000,000

  const list = await api('GET', '/api/products?search=Twin%20Cable', { token: peter });
  const cable = list.body.products[0];                   // UGX 245,000 per roll
  const r = await api('POST', '/api/orders', {
    token: peter,
    body: { items: [{ productId: cable.id, quantity: 10 }] },   // 2,450,000 > limit
  });
  assert.equal(r.status, 403, JSON.stringify(r.body));
  assert.match(r.body.error, /spending limit/i);
});

test('an order cannot exceed available stock', async () => {
  const customer = await customerLogin('+256770111001');
  const list = await api('GET', '/api/products?search=Wall%20Paint', { token: customer });
  const paint = list.body.products[0];
  const r = await api('POST', '/api/orders', {
    token: customer,
    body: { items: [{ productId: paint.id, quantity: paint.stock_available + 50 }] },
  });
  assert.equal(r.status, 409, JSON.stringify(r.body));
  assert.match(r.body.error, /left in stock/i);
});

test('accounts can reject a payment and it goes back to the cashier', async () => {
  const customer = await customerLogin('+256770111001');
  const cashier = await staffLogin('cashier@alhadeed.ug', 'cashier123');
  const accounts = await staffLogin('accounts@alhadeed.ug', 'accounts123');

  const list = await api('GET', '/api/products?search=Ridge', { token: customer });
  const placed = await api('POST', '/api/orders', {
    token: customer, body: { items: [{ productId: list.body.products[0].id, quantity: 2 }] },
  });
  const id = placed.body.order.id;

  await api('POST', `/api/cashier/orders/${id}/payment`, {
    token: cashier,
    body: { method: 'mobile_money', amountPaid: placed.body.order.total, transactionRef: 'MP-TEST-1' },
  });
  const rejected = await api('POST', `/api/accounts/orders/${id}/verify`, {
    token: accounts, body: { approve: false, remarks: 'No matching mobile money entry' },
  });
  assert.equal(rejected.status, 200, JSON.stringify(rejected.body));
  assert.equal(rejected.body.order.status, 'rejected');
  assert.equal(rejected.body.order.current_stage, 'cashier');
});

test('mobile money payment requires a transaction reference', async () => {
  const customer = await customerLogin('+256770111001');
  const cashier = await staffLogin('cashier@alhadeed.ug', 'cashier123');
  const list = await api('GET', '/api/products?search=LED', { token: customer });
  const placed = await api('POST', '/api/orders', {
    token: customer, body: { items: [{ productId: list.body.products[0].id, quantity: 1 }] },
  });
  const r = await api('POST', `/api/cashier/orders/${placed.body.order.id}/payment`, {
    token: cashier,
    body: { method: 'mobile_money', amountPaid: placed.body.order.total },
  });
  assert.equal(r.status, 400);
  assert.match(r.body.error, /transaction reference/i);
});

test('goods received increases stock and is recorded as a movement', async () => {
  const store = await staffLogin('store@alhadeed.ug', 'store123');
  const stock = await api('GET', '/api/store/stock?search=Binding', { token: store });
  const item = stock.body.stock[0];

  const r = await api('POST', '/api/store/stock/receive', {
    token: store,
    body: { productId: item.id, quantity: 10, supplier: 'Roofings Uganda', notes: 'LPO 4521' },
  });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.product.stock_available, item.stock_available + 10);

  const moves = await api('GET', `/api/store/stock/movements?productId=${item.id}`, { token: store });
  assert.equal(moves.body.movements[0].movement, 'goods_received');
});

test('manager dashboard and CSV export work', async () => {
  const manager = await staffLogin('manager@alhadeed.ug', 'manager123');

  const dash = await api('GET', '/api/manager/dashboard', { token: manager });
  assert.equal(dash.status, 200);
  assert.ok(typeof dash.body.salesToday === 'number');
  assert.ok(dash.body.byStage);

  const res = await fetch(`${base}/api/reports/export/sales.csv?period=monthly`, {
    headers: { Authorization: `Bearer ${manager}` },
  });
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /text\/csv/);
  const csv = await res.text();
  assert.match(csv.split('\n')[0], /Receipt,Order,Customer/);
});

test('notifications reach the customer at each status change', async () => {
  const customer = await customerLogin('+256770111002');
  const cashier = await staffLogin('cashier@alhadeed.ug', 'cashier123');

  const list = await api('GET', '/api/products?search=Socket', { token: customer });
  const placed = await api('POST', '/api/orders', {
    token: customer, body: { items: [{ productId: list.body.products[0].id, quantity: 2 }] },
  });
  await api('POST', `/api/cashier/orders/${placed.body.order.id}/payment`, {
    token: cashier, body: { method: 'cash', amountPaid: placed.body.order.total },
  });

  const notes = await api('GET', '/api/notifications', { token: customer });
  const titles = notes.body.notifications.map((n) => n.title);
  assert.ok(titles.some((t) => /placed/i.test(t)), 'missing order placed notification');
  assert.ok(titles.some((t) => /Payment received/i.test(t)), 'missing payment notification');
});

test('unauthenticated requests are rejected', async () => {
  const r = await api('GET', '/api/orders/mine');
  assert.equal(r.status, 401);
});

// ── Sign-in by SMS, and what the number says about who you are ────────

test('a phone number is matched whichever way it is typed', async () => {
  // 0770111001, 770111001 and +256770111001 are one number. Someone who
  // asks for a code one way must be able to verify it another.
  for (const form of ['0770111001', '770111001', '+256770111001']) {
    const r = await api('POST', '/api/auth/otp/request', { body: { phone: form } });
    assert.equal(r.status, 200, `${form} was not accepted`);
    assert.equal(r.body.phone, '+256770111001', `${form} normalised wrongly`);
  }

  const verified = await api('POST', '/api/auth/otp/verify', {
    body: { phone: '0770111001', code: '123456' },
  });
  assert.equal(verified.status, 200);
  assert.equal(verified.body.user.phone, '+256770111001');
});

test('the login code goes out over the SMS gateway', async () => {
  const { sendSms, otpMessage, normalisePhone } = await import('../src/utils/sms.js');

  assert.equal(normalisePhone('0772 123 456'), '+256772123456');
  assert.equal(normalisePhone('256772123456'), '+256772123456');

  const sent = await sendSms('0772123456', otpMessage('445566'));
  assert.equal(sent.ok, true);
  assert.equal(sent.to, '+256772123456');
  assert.match(otpMessage('445566'), /^445566 is your .* code\./);

  // An unreachable gateway must report the failure, never throw: a login
  // request has to answer either way.
  const { config } = await import('../src/config.js');
  const was = config.sms.provider;
  config.sms.provider = 'generic';
  config.sms.url = 'http://127.0.0.1:1/nowhere';
  const failed = await sendSms('+256772123456', 'test');
  config.sms.provider = was;
  assert.equal(failed.ok, false);
  assert.ok(failed.error, 'a failure should say why');
});

test('the number says which desk it belongs to, so the app opens the right side', async () => {
  const desks = {
    '+256700000004': 'manager',
    '+256700000001': 'cashier',
    '+256700000002': 'accounts',
    '+256700000003': 'store',
    '+256770111001': 'customer',
  };

  for (const [phone, role] of Object.entries(desks)) {
    const asked = await api('POST', '/api/auth/otp/request', { body: { phone } });
    assert.equal(asked.status, 200, `${phone} could not ask for a code`);
    assert.equal(asked.body.role, role, `${phone} reported the wrong desk`);

    const verified = await api('POST', '/api/auth/otp/verify', {
      body: { phone, code: '123456' },
    });
    assert.equal(verified.status, 200, `${phone} could not verify`);
    assert.equal(verified.body.user.role, role);
  }
});

test('an unregistered number is turned away before any code is sent', async () => {
  const r = await api('POST', '/api/auth/otp/request', {
    body: { phone: '+256700999999' },
  });
  assert.equal(r.status, 400);
  assert.match(r.body.error, /not registered/i);
});

// ── Ordering without an account: the customer's actual path ───────────

test('the catalogue is public — no account needed to browse', async () => {
  const products = await api('GET', '/api/products');
  assert.equal(products.status, 200);
  assert.ok(products.body.products.length > 0, 'no products listed');

  const cats = await api('GET', '/api/products/categories');
  assert.equal(cats.status, 200);
  assert.ok(cats.body.categories.length > 0);

  // Changing a product still needs the manager.
  const blocked = await api('POST', '/api/products', {
    body: { code: 'X', name: 'Sneaky', price: 1 },
  });
  assert.equal(blocked.status, 401);
});

test('a first-time customer orders with a phone number and gets an SMS', async () => {
  const products = await api('GET', '/api/products');
  const p = products.body.products.find((x) => x.stock_available > 2);

  const placed = await api('POST', '/api/orders/guest', {
    body: {
      phone: '0712000111',
      fullName: 'Brenda Auma',
      items: [{ productId: p.id, quantity: 2 }],
      delivery: 'shop_delivery',
      location: 'Plot 24 Bukoto, behind the fuel station',
    },
  });

  assert.equal(placed.status, 201, JSON.stringify(placed.body));
  assert.equal(placed.body.order.status, 'pending_payment');
  assert.equal(placed.body.order.fulfilment, 'delivery');
  assert.equal(placed.body.order.delivery_fee, 0, 'shop delivery is free');
  assert.equal(placed.body.smsSent, true, 'the confirmation SMS did not go');
  assert.ok(placed.body.token, 'no session came back for the order history');
  assert.equal(placed.body.user.phone, '+256712000111');

  // ...and it is in that number's history straight away.
  const history = await api('GET', '/api/orders/mine', { token: placed.body.token });
  assert.equal(history.status, 200);
  assert.equal(history.body.orders.length, 1);
  assert.equal(history.body.orders[0].order_no, placed.body.order.order_no);

  // ...and it is sitting on the cashier's queue like any other order.
  const cashier = await staffLogin('cashier@alhadeed.ug', 'cashier123');
  const queue = await api('GET', '/api/cashier/queue', { token: cashier });
  assert.ok(
    queue.body.orders.some((o) => o.order_no === placed.body.order.order_no),
    'a guest order never reached the cashier'
  );
});

test('ordering twice from one number builds one history, not two accounts', async () => {
  const products = await api('GET', '/api/products');
  const p = products.body.products.find((x) => x.stock_available > 3);

  const first = await api('POST', '/api/orders/guest', {
    body: {
      phone: '0712000222', fullName: 'Moses Opio',
      items: [{ productId: p.id, quantity: 1 }], delivery: 'pickup',
    },
  });
  // The same number typed a different way is the same person.
  const second = await api('POST', '/api/orders/guest', {
    body: {
      phone: '+256712000222', fullName: 'Moses Opio',
      items: [{ productId: p.id, quantity: 1 }],
      delivery: 'own_transport', location: 'Ntinda site',
    },
  });

  assert.equal(first.body.user.id, second.body.user.id, 'two accounts were made');

  const history = await api('GET', '/api/orders/mine', { token: second.body.token });
  assert.equal(history.body.orders.length, 2);

  // A customer's own transporter collects, so it is not a delivery.
  assert.equal(second.body.order.fulfilment, 'pickup');
  assert.match(second.body.order.notes, /own delivery man/i);
});

test('shop delivery without an address is refused', async () => {
  const products = await api('GET', '/api/products');
  const p = products.body.products.find((x) => x.stock_available > 0);

  const r = await api('POST', '/api/orders/guest', {
    body: {
      phone: '0712000333', fullName: 'Grace N',
      items: [{ productId: p.id, quantity: 1 }],
      delivery: 'shop_delivery', location: '   ',
    },
  });
  assert.equal(r.status, 400);
  assert.match(r.body.error, /where to deliver/i);
});

test('a staff number cannot be used to place a customer order', async () => {
  const products = await api('GET', '/api/products');
  const p = products.body.products.find((x) => x.stock_available > 0);

  const r = await api('POST', '/api/orders/guest', {
    body: {
      phone: '+256700000004', fullName: 'Hassan Ali',
      items: [{ productId: p.id, quantity: 1 }], delivery: 'pickup',
    },
  });
  assert.equal(r.status, 400);
  assert.match(r.body.error, /staff account/i);
});
