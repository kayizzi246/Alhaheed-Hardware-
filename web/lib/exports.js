/**
 * What goes in each export. Only a manager can make one: the server
 * hands the data over to a manager alone, and writes down that it did.
 */
import { api } from '@/lib/api';
import { list, methodLabel, statusLabel, today } from '@/lib/format';
import { buildCatalogue, buildReport, saveBook } from '@/lib/workbook';

const KIND = { expense: 'Expense', stock_use: 'Stock used in the shop', float: 'Cash float', advance: 'Staff advance' };
const SPEND = { raised: 'Waiting for the manager', approved: 'Approved, not yet paid', declined: 'Declined', paid: 'Paid' };
const DESK = { cashier: 'Cashier', accounts: 'Accounts', store: 'Store', manager: 'Manager' };
const words = (s) => String(s || '').replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
const slug = (s) => String(s || 'shop').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '');
const day = (s) => new Date(`${s}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const span = (from, to) => (from === to ? day(from) : `${day(from)} to ${day(to)}`);

const spendRow = (e) => ({ ...e, kind: KIND[e.kind] || e.kind, status: SPEND[e.status] || e.status, method: e.method ? methodLabel(e.method) : '' });

/** An order's money counts unless the order fell through. */
const DEAD = ['cancelled', 'rejected', 'refunded'];

export function reportSpec(d) {
  const t = d.totals;
  const orders = list(d.orders);
  const alive = orders.filter((o) => !DEAD.includes(o.status));
  const share = (n) => (t.gross ? n / t.gross : 0);

  return {
    meta: { shop: d.shop, title: d.title, period: d.label || span(d.from, d.to), by: d.by },
    figures: [
      { title: 'Money in', rows: [
        ['Sales (verified payments)', t.gross, 'money', true],
        ['Receipts', t.receipts, 'int'],
        ['Average receipt', t.average, 'money'],
      ] },
      { title: 'Money out and result', rows: [
        ['Internal spending paid', t.expenses, 'money'],
        ...list(d.spentBy).map((m) => [`   ${methodLabel(m.method)}`, m.total, 'money']),
        ['Sales less internal spending', t.net, 'money', true],
      ] },
      { title: 'Cash book', rows: [
        ['Opening balance', t.opening, 'money'],
        ['Cash in', t.cash_in, 'money'],
        ['Cash out', t.cash_out, 'money'],
        ['Closing balance', t.closing, 'money', true],
      ] },
      { title: 'Orders', rows: [
        ['Orders placed', orders.length, 'int'],
        ['Of these, cancelled, rejected or refunded', orders.length - alive.length, 'int'],
        ['Value of the rest', alive.reduce((n, o) => n + o.total, 0), 'money', true],
      ] },
    ],
    sheets: [
      { name: 'Sales by day', about: 'Verified payments, one line a day', rows: list(d.byDay), columns: [
        { h: 'Day', key: 'day', type: 'date', width: 18, bold: true },
        { h: 'Receipts', key: 'receipts', type: 'int', width: 14, total: true },
        { h: 'Total (UGX)', key: 'total', type: 'money', width: 20, total: true },
      ] },
      { name: 'Payment methods', about: 'How customers paid', rows: list(d.byMethod).map((m) => ({ ...m, method: methodLabel(m.method), share: share(m.total) })), columns: [
        { h: 'Method', key: 'method', width: 22, bold: true },
        { h: 'Receipts', key: 'receipts', type: 'int', width: 14, total: true },
        { h: 'Total (UGX)', key: 'total', type: 'money', width: 20, total: true },
        { h: 'Share', key: 'share', type: 'pct', width: 12 },
      ] },
      { name: 'Receipts', about: 'Every payment taken, checked or not', rows: list(d.receipts).map((p) => ({ ...p, method: methodLabel(p.method), state: p.verified ? 'Verified' : 'Not verified' })), columns: [
        { h: 'Receipt', key: 'receipt_no', width: 13, bold: true },
        { h: 'Taken', key: 'created_at', type: 'datetime', width: 20 },
        { h: 'Order', key: 'order_no', width: 12 },
        { h: 'Customer', key: 'customer', width: 28 },
        { h: 'Method', key: 'method', width: 16 },
        { h: 'Transaction ID', key: 'transaction_ref', width: 22 },
        { h: 'Cashier', key: 'cashier', width: 20 },
        { h: 'Accounts', key: 'state', width: 14 },
        { h: 'Amount (UGX)', key: 'amount', type: 'money', width: 17, total: true },
      ] },
      { name: 'Orders', about: 'Every order placed, newest first', rows: orders.map((o) => ({ ...o, status: statusLabel(o.status) })), columns: [
        { h: 'Order', key: 'order_no', width: 12, bold: true },
        { h: 'Placed', key: 'placed', type: 'datetime', width: 20 },
        { h: 'Customer', key: 'customer', width: 30 },
        { h: 'Phone', key: 'phone', width: 18 },
        { h: 'Stage', key: 'status', width: 15 },
        { h: 'Goes by', key: 'fulfilment', width: 14 },
        { h: 'Items', key: 'items', type: 'int', width: 10, total: true },
        { h: 'Total (UGX)', key: 'total', type: 'money', width: 17, total: true },
      ] },
      { name: 'Items ordered', about: 'Most ordered first, paid for or not; cancelled and rejected left out', rows: list(d.products), columns: [
        { h: 'Product', key: 'name', width: 40, bold: true },
        { h: 'Quantity', key: 'qty', type: 'int', width: 14, total: true },
        { h: 'Value (UGX)', key: 'revenue', type: 'money', width: 20, total: true },
      ] },
      { name: 'Cash book', about: 'Money in and out, with the balance after each line', rows: list(d.book).map((b) => ({ ...b, method: methodLabel(b.method) })), columns: [
        { h: 'Date', key: 'entry_date', type: 'date', width: 16, bold: true },
        { h: 'Details', key: 'details', width: 50, wrap: true },
        { h: 'Method', key: 'method', width: 20 },
        { h: 'Cash in (UGX)', key: 'cash_in', type: 'money', width: 18, total: true },
        { h: 'Cash out (UGX)', key: 'cash_out', type: 'money', width: 18, total: true },
        { h: 'Balance (UGX)', key: 'balance', type: 'money', width: 18 },
      ] },
      { name: 'Spending by method', about: 'How internal spending was paid', rows: list(d.spentBy).map((m) => ({ ...m, method: methodLabel(m.method), share: t.expenses ? m.total / t.expenses : 0 })), columns: [
        { h: 'Method', key: 'method', width: 24, bold: true },
        { h: 'Payments', key: 'payments', type: 'int', width: 14, total: true },
        { h: 'Total (UGX)', key: 'total', type: 'money', width: 20, total: true },
        { h: 'Share', key: 'share', type: 'pct', width: 12 },
      ] },
      { name: 'Internal spending', about: 'Every expense paid in the period: who was paid, how, and the transaction ID', rows: list(d.expenses).filter((e) => e.counts).map(spendRow), columns: [
        { h: 'Ref', key: 'ref', width: 13, bold: true },
        { h: 'Paid on', key: 'paid', type: 'datetime', width: 20 },
        { h: 'What for', key: 'details', width: 36, wrap: true },
        { h: 'Kind', key: 'kind', width: 24 },
        { h: 'Paid to', key: 'payee', width: 26 },
        { h: 'Method', key: 'method', width: 20 },
        { h: 'Number / account', key: 'number', width: 24 },
        { h: 'Transaction ID', key: 'pay_ref', width: 22 },
        { h: 'Approved by', key: 'decided_by', width: 18 },
        { h: 'Paid by', key: 'paid_by', width: 18 },
        { h: 'Amount (UGX)', key: 'amount', type: 'money', width: 17, total: true },
      ] },
      { name: 'Spending not paid', about: 'Asked for but waiting, declined, or paid outside the period', rows: list(d.expenses).filter((e) => !e.counts).map(spendRow), columns: [
        { h: 'Ref', key: 'ref', width: 13, bold: true },
        { h: 'Raised', key: 'raised', type: 'datetime', width: 20 },
        { h: 'What for', key: 'details', width: 36, wrap: true },
        { h: 'Kind', key: 'kind', width: 24 },
        { h: 'Paid to', key: 'payee', width: 26 },
        { h: 'Method', key: 'method', width: 20 },
        { h: 'Raised by', key: 'raised_by', width: 20 },
        { h: 'Status', key: 'status', width: 24 },
        { h: 'Amount (UGX)', key: 'amount', type: 'money', width: 17, total: true },
      ] },
      { name: 'Stock', about: 'What left the shelf in the period and what is there now', rows: list(d.stock), columns: [
        { h: 'Code', key: 'code', width: 16, bold: true },
        { h: 'Product', key: 'name', width: 38 },
        { h: 'Unit', key: 'unit', width: 11 },
        { h: 'Released', key: 'released', type: 'int', width: 13 },
        { h: 'In stock now', key: 'stock_available', type: 'int', width: 15 },
      ] },
      { name: 'Staff activity', about: 'Who did what, one line per action', rows: list(d.staff).flatMap((s) =>
        Object.entries(s.actions || {}).map(([action, count]) => ({ name: s.name, desk: DESK[s.desk] || s.desk, action: words(action), count }))), columns: [
        { h: 'Staff', key: 'name', width: 26, bold: true },
        { h: 'Desk', key: 'desk', width: 16 },
        { h: 'Action', key: 'action', width: 30 },
        { h: 'Times', key: 'count', type: 'int', width: 12, total: true },
      ] },
    ],
  };
}

/** `body` is { month } for the monthly report, or { period } / { from, to }. */
export async function exportReport(body) {
  const d = await api('/api/manager/export', { method: 'POST', body: { report: body.month ? 'monthly' : 'business', ...body } });
  const name = `${slug(d.shop)}-${body.month ? `monthly-report-${body.month}` : `report-${d.from}-to-${d.to}`}.xlsx`;
  await saveBook(buildReport(reportSpec(d)), name);
  return name;
}

export async function exportProducts() {
  const d = await api('/api/manager/export', { method: 'POST', body: { report: 'products' } });
  const products = list(d.products);
  await saveBook(buildCatalogue(products, d.shop), `${slug(d.shop)}-products-${today()}.xlsx`);
  return products.length;
}

/** The ALH Tracker file: Purchase, Sell Detail, stock balance and Code. */
export async function exportTracker({ from, to }) {
  const qs = new URLSearchParams({ from, to });
  const d = await api(`/api/manager/stock/tracker?${qs}`);
  const { buildTracker } = await import('@/lib/workbook');
  const name = `ALH-Tracker-${d.from}-to-${d.to}.xlsx`;
  await saveBook(buildTracker(d), name);
  return name;
}
