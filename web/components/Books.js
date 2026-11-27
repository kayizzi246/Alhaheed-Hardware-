'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { money, list, today } from '@/lib/format';
import { cn } from '@/lib/cn';
import { Icon } from '@/components/icons';
import { CreditAccount } from '@/components/Credit';
import {
  Alert, Button, Card, CardHead, CardTitle, Empty, Field, Input, Loading, Modal, PageHead,
  Segmented, Select, Stat, Table, TableWrap, Td, Th, Tr,
} from '@/components/ui';

/**
 * Debts & books: who owes the shop, whom the shop owes, and the
 * double-entry journal that proves the two add up.
 *
 * Nothing is typed here. Every figure comes from the books the shop
 * already keeps — sales, loan payments, supplier bills and payments, the
 * stock book — so this page can never disagree with them.
 */

const day = (d) => (d ? new Date(`${d.length > 10 ? d : `${d}T00:00:00`}`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
const monthStart = () => `${today().slice(0, 7)}-01`;

const STATUS = {
  paid: ['Paid', 'bg-ok-bg text-ok'],
  part: ['Partly paid', 'bg-info-bg text-info'],
  unpaid: ['Unpaid', 'bg-warn-bg text-warn'],
  overdue: ['Overdue', 'bg-bad-bg text-bad'],
};
function StatusChip({ s }) {
  const [label, tone] = STATUS[s] || [s, 'bg-surface-sunk text-ink-muted'];
  return <span className={cn('whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold', tone)}>{label}</span>;
}

/* ── Columns for each table, shared by the screen, Excel and print ── */
const C = {
  date: (h = 'Date', key = 'date') => ({ h, key, fmt: 'date' }),
  money: (h, key, total = true) => ({ h, key, fmt: 'money', total }),
  text: (h, key, w) => ({ h, key, w }),
  status: { h: 'Status', key: 'status', fmt: 'status', text: (r) => STATUS[r.status]?.[0] || r.status || '' },
};

const REPORTS = {
  debtors: {
    label: 'Customers who owe',
    cols: [C.text('Customer', 'customer', 24), C.text('Phone', 'phone', 15), C.money('Limit', 'limit', false), C.money('Owes', 'owed'), C.money('Late', 'overdue'), C.date('Next due', 'nextDue'), C.date('Last paid', 'lastPaid'), C.status],
    search: (r) => `${r.customer} ${r.phone}`,
    hasStatus: true,
  },
  creditors: {
    label: 'Suppliers we owe',
    cols: [C.text('Supplier', 'supplier', 24), C.money('Billed', 'billed'), C.money('Sent back', 'credits'), C.money('Paid', 'paid'), C.money('We owe', 'owed'), C.money('Late', 'overdue'), C.date('Next due', 'nextDue'), C.status],
    search: (r) => r.supplier,
    hasStatus: true,
  },
  credit_sales: {
    label: 'Sales on loan',
    dated: true,
    cols: [C.date(), C.text('Customer', 'customer', 22), C.text('Order', 'orderNo', 10), C.text('Receipt', 'receipt', 11), C.text('What', 'kind', 10), C.money('Amount', 'amount'), C.money('Paid', 'paid'), C.money('Left', 'left'), C.date('Due', 'due'), C.text('By', 'by', 14), C.status],
    search: (r) => `${r.customer} ${r.orderNo} ${r.receipt}`,
    hasStatus: true,
  },
  collections: {
    label: 'Loan payments in',
    dated: true,
    cols: [C.date(), C.text('Receipt', 'receipt', 11), C.text('Customer', 'customer', 22), C.text('Paid by', 'method', 13), C.text('Transaction', 'ref', 16), C.money('Amount', 'amount'), C.text('Received by', 'by', 15)],
    search: (r) => `${r.customer} ${r.receipt} ${r.ref}`,
  },
  supplier_bills: {
    label: 'Supplier bills',
    dated: true,
    cols: [C.date(), C.text('Supplier', 'supplier', 22), C.text('Invoice', 'invoice', 12), C.text('What', 'kind', 11), C.money('Amount', 'amount'), C.money('Paid', 'paid'), C.money('Left', 'left'), C.date('Due', 'due'), C.text('By', 'by', 14), C.status],
    search: (r) => `${r.supplier} ${r.invoice}`,
    hasStatus: true,
  },
  supplier_payments: {
    label: 'Payments to suppliers',
    dated: true,
    cols: [C.date(), C.text('Supplier', 'supplier', 22), C.text('Invoice', 'invoice', 12), C.text('Paid by', 'method', 13), C.text('Transaction', 'ref', 16), C.money('Amount', 'amount'), C.text('Paid by (staff)', 'by', 15)],
    search: (r) => `${r.supplier} ${r.invoice} ${r.ref}`,
  },
  overdue: {
    label: 'Late debts, both ways',
    cols: [C.text('Who', 'side', 17), C.text('Name', 'name', 26), C.text('Phone', 'phone', 14), C.money('Late', 'overdue'), C.money('Owed in all', 'owed'), { h: 'Days', key: 'days' }],
    search: (r) => `${r.name} ${r.phone}`,
  },
  summary: {
    label: 'Summary by day, week or month',
    dated: true,
    periods: true,
    cols: [C.text('Period', 'period', 12), C.money('Cash sales', 'cashSales'), C.money('Sales on loan', 'creditSales'), C.money('Loan payments in', 'collections'), C.money('Supplier bills', 'supplierBills'), C.money('Paid to suppliers', 'supplierPayments'), C.money('Expenses', 'expenses')],
    search: (r) => r.period,
  },
};

/** A table on screen from the shared columns, with the totals row. */
function DataTable({ cols, rows, onRow }) {
  const totals = cols.map((c) => (c.total ? rows.reduce((n, r) => n + (Number(r[c.key]) || 0), 0) : null));
  return (
    <TableWrap>
      <Table>
        <thead><tr>{cols.map((c) => <Th key={c.h} num={c.fmt === 'money'}>{c.h}</Th>)}</tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <Tr key={i} onClick={onRow ? () => onRow(r) : undefined} className={onRow ? 'cursor-pointer' : ''}>
              {cols.map((c) => (
                <Td key={c.h} num={c.fmt === 'money'} className={cn(c.fmt === 'money' && 'text-ink', c.fmt === 'date' && 'whitespace-nowrap text-[11.5px]')}>
                  {c.fmt === 'status' ? <StatusChip s={r.status} />
                    : c.fmt === 'money' ? (r[c.key] ? money(r[c.key]) : <span className="text-ink-faint">-</span>)
                      : c.fmt === 'date' ? day(r[c.key]) || <span className="text-ink-faint">-</span>
                        : r[c.key] ?? ''}
                </Td>
              ))}
            </Tr>
          ))}
        </tbody>
        {rows.length > 1 && totals.some((t) => t !== null) && (
          <tfoot>
            <tr className="border-t-2 border-line-firm bg-surface-2">
              {cols.map((c, i) => (
                <Td key={c.h} num={c.fmt === 'money'} className="font-bold text-ink">
                  {i === 0 ? `Total (${rows.length})` : totals[i] !== null ? money(totals[i]) : ''}
                </Td>
              ))}
            </tr>
          </tfoot>
        )}
      </Table>
    </TableWrap>
  );
}

/** Excel and Print (which also saves as PDF) for any table here. */
function SaveButtons({ title, cols, rows, file }) {
  const [busy, setBusy] = useState(false);
  async function excel() {
    setBusy(true);
    try {
      const { exportBooksSheet } = await import('@/lib/exports');
      await exportBooksSheet({ title, sheet: title.slice(0, 30), columns: cols, rows, file: `${file}.xlsx` });
    } finally {
      setBusy(false);
    }
  }
  function print() {
    const esc = (v) => String(v ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
    const cell = (c, r) => (c.fmt === 'status' ? STATUS[r.status]?.[0] || '' : c.fmt === 'money' ? (r[c.key] ? Number(r[c.key]).toLocaleString('en-UG') : '-') : c.fmt === 'date' ? day(r[c.key]) : r[c.key] ?? '');
    const totals = cols.map((c) => (c.total ? rows.reduce((n, r) => n + (Number(r[c.key]) || 0), 0).toLocaleString('en-UG') : ''));
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>
      body{font:12px Calibri,Arial,sans-serif;margin:24px;color:#000}h1{font-size:17px;margin:0}p{margin:2px 0 14px;color:#444}
      table{border-collapse:collapse;width:100%}th{background:#92D050;font-weight:700;text-align:left;padding:6px;border:1px solid #bfbfbf}
      td{padding:5px 6px;border:1px solid #d9d9d9}td.n,th.n{text-align:right;font-variant-numeric:tabular-nums}tfoot td{font-weight:700;background:#f2f2f2}
      @page{size:A4 landscape;margin:12mm}</style></head><body>
      <h1>Al Hadeed Hardware · ${esc(title)}</h1><p>Printed ${esc(day(today()))} · all amounts in UGX</p>
      <table><thead><tr>${cols.map((c) => `<th class="${c.fmt === 'money' ? 'n' : ''}">${esc(c.h)}</th>`).join('')}</tr></thead>
      <tbody>${rows.map((r) => `<tr>${cols.map((c) => `<td class="${c.fmt === 'money' ? 'n' : ''}">${esc(cell(c, r))}</td>`).join('')}</tr>`).join('')}</tbody>
      ${rows.length ? `<tfoot><tr>${cols.map((c, i) => `<td class="${c.fmt === 'money' ? 'n' : ''}">${i === 0 ? `Total (${rows.length})` : esc(totals[i])}</td>`).join('')}</tr></tfoot>` : ''}
      </table><script>window.onload=()=>window.print()</script></body></html>`);
    w.document.close();
  }
  return (
    <div className="flex gap-2">
      <Button size="sm" variant="outline" disabled={busy || !rows.length} onClick={excel}>{busy ? 'Saving…' : 'Excel'}</Button>
      <Button size="sm" variant="outline" disabled={!rows.length} onClick={print}>Print / PDF</Button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────

export default function Books() {
  const [tab, setTab] = useState('overview');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [customer, setCustomer] = useState(null);
  const [supplier, setSupplier] = useState(null);

  const load = useCallback(async () => {
    try {
      setData(await api('/api/manager/books'));
      setError('');
    } catch (e) {
      setError(/no route/i.test(e.message) ? 'This page needs the new plugin. Upload the zip to the website first.' : e.message);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <>
      <PageHead title="Debts & books" sub="Who owes the shop, whom the shop owes, and the books behind it." />
      <Alert>{error}</Alert>
      {note && <Alert kind="ok" onDone={() => setNote('')}>{note}</Alert>}

      <div className="mb-3 overflow-x-auto">
        <Segmented
          label="Part"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'overview', label: 'Overview' },
            { value: 'debtors', label: 'Customers owe us' },
            { value: 'creditors', label: 'We owe suppliers' },
            { value: 'reports', label: 'Reports' },
            { value: 'journal', label: 'Journal' },
          ]}
        />
      </div>

      {tab === 'overview' && (data ? <Overview d={data} onCustomer={setCustomer} onSupplier={setSupplier} /> : !error && <Card><Loading>Adding up the books…</Loading></Card>)}
      {tab === 'debtors' && <ReportView type="debtors" onRow={(r) => setCustomer(r.customerId)} />}
      {tab === 'creditors' && <ReportView type="creditors" onRow={(r) => setSupplier(r.supplier)} />}
      {tab === 'reports' && <Reports />}
      {tab === 'journal' && <Journal />}

      {customer && (
        <CreditAccount
          customerId={customer}
          onClose={() => setCustomer(null)}
          onChanged={(msg) => { if (msg) setNote(msg); load(); }}
        />
      )}
      {supplier && <SupplierStatement name={supplier} onClose={() => setSupplier(null)} />}
    </>
  );
}

function Overview({ d, onCustomer, onSupplier }) {
  const t = d.today;
  const c = d.check;
  const agingTotal = Object.values(d.aging || {}).reduce((n, v) => n + v, 0);
  return (
    <>
      <div className="mb-3 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <Stat hero label="Customers owe us" value={money(d.receivable)} note={`${d.debtors} ${d.debtors === 1 ? 'customer' : 'customers'}${d.advances ? ` · ${money(d.advances)} paid ahead` : ''}`} icon={Icon.people()} />
        <Stat label="We owe suppliers" value={money(d.payable)} note={`${d.creditors} ${d.creditors === 1 ? 'supplier' : 'suppliers'}`} icon={Icon.mail()} />
        <Stat label="Late from customers" value={money(d.overdueIn)} note={`${list(d.overdueCustomers).length} past their days`} tone={d.overdueIn ? 'bad' : 'ok'} icon={Icon.clock()} />
        <Stat label="Late to suppliers" value={money(d.overdueOut)} note="bills past their due date" tone={d.overdueOut ? 'bad' : 'ok'} icon={Icon.clock()} />
      </div>
      <div className="mb-3 grid grid-cols-2 gap-2.5 lg:grid-cols-5">
        <Stat label="Sold on loan today" value={money(t.creditSales)} icon={Icon.receipt()} />
        <Stat label="Loan payments in today" value={money(t.collections)} tone="ok" icon={Icon.check()} />
        <Stat label="Cash sales today" value={money(t.cashSales)} icon={Icon.cash()} />
        <Stat label="Supplier bills today" value={money(t.supplierBills)} icon={Icon.box()} />
        <Stat label="Paid to suppliers today" value={money(t.supplierPayments)} tone="warn" icon={Icon.cash()} />
      </div>

      <div className="mb-3 grid gap-3 xl:grid-cols-[1fr_1fr]">
        <Card>
          <CardHead><CardTitle>Late customers</CardTitle><span className="text-[11.5px] text-ink-muted">tap one to see the statement</span></CardHead>
          {!list(d.overdueCustomers).length ? <Empty title="Nobody is late">Every customer is within their days.</Empty> : (
            <TableWrap className="max-h-[300px] overflow-y-auto">
              <Table>
                <thead><tr><Th>Customer</Th><Th num>Late</Th><Th num>Owes</Th><Th>Oldest</Th></tr></thead>
                <tbody>
                  {d.overdueCustomers.map((a) => (
                    <Tr key={a.customerId} onClick={() => onCustomer(a.customerId)} className="cursor-pointer">
                      <Td><b className="block text-ink">{a.name}</b><span className="text-[11.5px] text-ink-muted">{a.phone}</span></Td>
                      <Td num className="font-bold text-bad">{money(a.overdue)}</Td>
                      <Td num className="text-ink">{money(a.owed)}</Td>
                      <Td className="whitespace-nowrap text-[11.5px]">{a.oldestDays} days</Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          )}
        </Card>
        <Card>
          <CardHead><CardTitle>Supplier bills to pay soon</CardTitle><Link href="/manager/purchasing" className="text-[11.5px] font-semibold text-brand hover:underline">Pay in Buying</Link></CardHead>
          {!list(d.upcoming).length ? <Empty title="Nothing due in the next 14 days" /> : (
            <TableWrap className="max-h-[300px] overflow-y-auto">
              <Table>
                <thead><tr><Th>Supplier</Th><Th>Invoice</Th><Th>Due</Th><Th num>Left to pay</Th></tr></thead>
                <tbody>
                  {d.upcoming.map((b) => (
                    <Tr key={b.id} onClick={() => onSupplier(b.supplier)} className="cursor-pointer">
                      <Td className="font-semibold text-ink">{b.supplier}</Td>
                      <Td className="text-[11.5px]">{b.invoice}</Td>
                      <Td className={cn('whitespace-nowrap text-[11.5px]', b.late && 'font-bold text-bad')}>{b.late ? `Late · ${day(b.due)}` : day(b.due)}</Td>
                      <Td num className="font-bold text-ink">{money(b.owed)}</Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          )}
        </Card>
      </div>

      <div className="grid gap-3 xl:grid-cols-[1fr_1fr]">
        <Card>
          <CardHead><CardTitle>How old the customer debt is</CardTitle></CardHead>
          <div className="space-y-3 p-3">
            {!agingTotal ? <p className="text-[12px] text-ink-muted">Nothing owed.</p> : (
              <>
                <div className="flex h-3 overflow-hidden rounded-full bg-line">
                  {[['current', '#92D050'], ['d30', '#c9a227'], ['d60', '#e08a1e'], ['d90', '#d9622b'], ['over90', '#b42318']].map(([k, col]) => (d.aging[k] > 0 ? <span key={k} style={{ flexGrow: d.aging[k], background: col }} /> : null))}
                </div>
                <div className="grid grid-cols-5 gap-2 text-[11.5px]">
                  {[['current', 'Up to 7 days'], ['d30', '8 to 30'], ['d60', '31 to 60'], ['d90', '61 to 90'], ['over90', 'Over 90']].map(([k, l]) => (
                    <div key={k}><span className="block text-ink-muted">{l}</span><b className="tnum text-ink">{money(d.aging[k])}</b></div>
                  ))}
                </div>
              </>
            )}
            <div>
              <p className="mb-1.5 text-[11.5px] font-semibold text-ink-2">Who owes most</p>
              {list(d.topDebtors).map((a) => (
                <button key={a.customerId} type="button" onClick={() => onCustomer(a.customerId)} className="flex w-full items-center justify-between border-b border-line py-1.5 text-left text-[12px] last:border-0 hover:text-brand">
                  <span className="text-ink">{a.name}</span><b className="tnum text-ink">{money(a.owed)}</b>
                </button>
              ))}
            </div>
          </div>
        </Card>
        <Card>
          <CardHead>
            <CardTitle>The books add up</CardTitle>
            <span className={cn('rounded-full px-2.5 py-0.5 text-[11px] font-bold', c.balanced ? 'bg-ok-bg text-ok' : 'bg-bad-bg text-bad')}>
              {c.balanced ? 'Balanced' : 'Not balanced'}
            </span>
          </CardHead>
          <div className="space-y-1.5 p-3 text-[12px]">
            <Check k="All debits" v={money(c.debit)} />
            <Check k="All credits" v={money(c.credit)} ok={c.debit === c.credit} />
            <Check k="Customers owe (books / loan list)" v={`${money(c.receivableBooks)} / ${money(c.receivableList)}`} ok={c.receivableBooks === c.receivableList} />
            <Check k="We owe suppliers (books / bills)" v={`${money(c.payableBooks)} / ${money(c.payableList)}`} ok={c.payableBooks === c.payableList} />
            <div className="my-2 border-t border-line" />
            <Check k="Cash in the books" v={money(c.cash)} />
            <Check k="Mobile money" v={money(c.mobile)} />
            <Check k="Bank" v={money(c.bank)} />
            <Check k="Stock at cost" v={money(c.stock)} />
            <p className="pt-2 text-[11.5px] text-ink-muted">{c.entries.toLocaleString()} journal entries, written from the shop&apos;s own books. Nothing is typed twice.</p>
          </div>
        </Card>
      </div>
    </>
  );
}

const Check = ({ k, v, ok }) => (
  <div className="flex items-center justify-between gap-3">
    <span className="text-ink-2">{k}</span>
    <span className="tnum flex items-center gap-1.5 font-semibold text-ink">
      {v}
      {ok !== undefined && <span className={cn('grid size-4 place-items-center rounded-full text-[10px] text-white', ok ? 'bg-ok' : 'bg-bad')}>{ok ? '✓' : '!'}</span>}
    </span>
  </div>
);

/** One report: filters, the table, and Excel / Print. */
function ReportView({ type, onRow, from, to, period }) {
  const def = REPORTS[type];
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('all');
  const [q, setQ] = useState('');

  useEffect(() => {
    let live = true;
    setRows(null);
    const qs = new URLSearchParams({ type, from: from || monthStart(), to: to || today(), period: period || 'day' });
    api(`/api/manager/books/report?${qs}`)
      .then((r) => { if (live) { setRows(list(r.rows)); setError(''); } })
      .catch((e) => { if (live) setError(e.message); });
    return () => { live = false; };
  }, [type, from, to, period]);

  const shown = useMemo(() => list(rows).filter((r) => {
    if (def.hasStatus && status !== 'all' && r.status !== status) return false;
    const t = q.trim().toLowerCase();
    return !t || def.search(r).toLowerCase().includes(t);
  }), [rows, status, q, def]);

  const counts = useMemo(() => {
    const n = { all: list(rows).length };
    for (const r of list(rows)) n[r.status] = (n[r.status] || 0) + 1;
    return n;
  }, [rows]);

  return (
    <Card>
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-2.5">
        {def.hasStatus && (
          <Segmented
            label="Status"
            value={status}
            onChange={setStatus}
            options={[['all', 'All'], ['overdue', 'Overdue'], ['unpaid', 'Unpaid'], ['part', 'Partly paid'], ['paid', 'Paid']].map(([v, l]) => ({ value: v, label: `${l} (${counts[v] || 0})` }))}
          />
        )}
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" className="w-[200px]" />
        <div className="ml-auto">
          <SaveButtons title={`${def.label}${def.dated ? `, ${day(from || monthStart())} to ${day(to || today())}` : `, ${day(today())}`}`} cols={def.cols} rows={shown} file={`${type.replace(/_/g, '-')}-${today()}`} />
        </div>
      </div>
      <Alert>{error}</Alert>
      {!rows && !error ? <Loading /> : !shown.length ? <Empty title="Nothing here">{list(rows).length ? 'Try another filter.' : 'Nothing in this period.'}</Empty> : (
        <DataTable cols={def.cols} rows={shown} onRow={onRow} />
      )}
    </Card>
  );
}

function Reports() {
  const [type, setType] = useState('credit_sales');
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(today());
  const [period, setPeriod] = useState('day');
  const def = REPORTS[type];
  return (
    <>
      <Card className="mb-3">
        <div className="grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Report">
            <Select value={type} onChange={(e) => setType(e.target.value)}>
              {Object.entries(REPORTS).map(([k, r]) => <option key={k} value={k}>{r.label}</option>)}
            </Select>
          </Field>
          <Field label="From"><Input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} disabled={!def.dated} /></Field>
          <Field label="To"><Input type="date" value={to} min={from} max={today()} onChange={(e) => setTo(e.target.value)} disabled={!def.dated} /></Field>
          {def.periods ? (
            <Field label="Add up by">
              <Segmented label="Period" value={period} onChange={setPeriod} options={[{ value: 'day', label: 'Day' }, { value: 'week', label: 'Week' }, { value: 'month', label: 'Month' }]} />
            </Field>
          ) : (
            <div className="self-end pb-1 text-[11.5px] text-ink-muted">{def.dated ? '' : 'Shows how things stand today.'}</div>
          )}
        </div>
      </Card>
      <ReportView key={type} type={type} from={from} to={to} period={period} />
    </>
  );
}

const SOURCE = { cash: 'Cash book', loan: 'Loan book', bill: 'Supplier bill', billpay: 'Supplier payment', stock: 'Stock book', void: 'Undone' };

function Journal() {
  const [view, setView] = useState('entries');
  const [from, setFrom] = useState(() => new Date(Date.now() - 6 * 86400e3).toISOString().slice(0, 10));
  const [to, setTo] = useState(today());
  const [account, setAccount] = useState('');
  const [d, setD] = useState(null);
  const [tb, setTb] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    setD(null);
    api(`/api/manager/books/journal?${new URLSearchParams({ from, to, account })}`)
      .then((r) => { if (live) setD(r); })
      .catch((e) => { if (live) setError(e.message); });
    api(`/api/manager/books/trial-balance?to=${to}`).then((r) => { if (live) setTb(r); }).catch(() => {});
    return () => { live = false; };
  }, [from, to, account]);

  // One row per line, for Excel and print.
  const flat = useMemo(() => list(d?.entries).flatMap((e) => e.lines.map((l, i) => ({
    no: i === 0 ? e.id : '', date: i === 0 ? e.date : '', memo: i === 0 ? e.memo : '', source: i === 0 ? SOURCE[e.source] || e.source : '',
    account: `${l.account} ${l.name}`, debit: l.debit, credit: l.credit, by: i === 0 ? e.by : '',
  }))), [d]);
  const flatCols = [{ h: 'No', key: 'no', w: 7 }, C.date(), C.text('What', 'memo', 40), C.text('From', 'source', 14), C.text('Account', 'account', 30), C.money('Debit', 'debit'), C.money('Credit', 'credit'), C.text('By', 'by', 14)];
  const tbCols = [C.text('Code', 'code', 8), C.text('Account', 'name', 32), C.text('Type', 'type', 11), C.money('Debit', 'debit'), C.money('Credit', 'credit')];

  return (
    <>
      <Card className="mb-3">
        <div className="flex flex-wrap items-end gap-3 p-3">
          <Segmented label="Show" value={view} onChange={setView} options={[{ value: 'entries', label: 'Entries' }, { value: 'trial', label: 'Trial balance' }]} />
          {view === 'entries' && (
            <>
              <Field label="From"><Input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} /></Field>
              <Field label="To"><Input type="date" value={to} min={from} max={today()} onChange={(e) => setTo(e.target.value)} /></Field>
              <Field label="Account">
                <Select value={account} onChange={(e) => setAccount(e.target.value)}>
                  <option value="">Every account</option>
                  {list(d?.accounts).map((a) => <option key={a.code} value={a.code}>{a.code} {a.name}</option>)}
                </Select>
              </Field>
            </>
          )}
          {view === 'trial' && <Field label="Up to"><Input type="date" value={to} max={today()} onChange={(e) => setTo(e.target.value)} /></Field>}
          <div className="ml-auto">
            {view === 'entries'
              ? <SaveButtons title={`Journal, ${day(from)} to ${day(to)}`} cols={flatCols} rows={flat} file={`journal-${from}-to-${to}`} />
              : <SaveButtons title={`Trial balance at ${day(to)}`} cols={tbCols} rows={list(tb?.accounts).filter((a) => a.debit || a.credit)} file={`trial-balance-${to}`} />}
          </div>
        </div>
      </Card>
      <Alert>{error}</Alert>

      {view === 'trial' && tb && (
        <Card>
          <CardHead>
            <CardTitle>Trial balance at {day(tb.to)}</CardTitle>
            <span className={cn('rounded-full px-2.5 py-0.5 text-[11px] font-bold', tb.balanced ? 'bg-ok-bg text-ok' : 'bg-bad-bg text-bad')}>{tb.balanced ? 'Debits equal credits' : 'Does not balance'}</span>
          </CardHead>
          <DataTable cols={tbCols} rows={list(tb.accounts).filter((a) => a.debit || a.credit)} />
        </Card>
      )}

      {view === 'entries' && (!d ? <Card><Loading /></Card> : !d.entries.length ? <Card><Empty title="No entries in these days" /></Card> : (
        <div className="space-y-2">
          {d.entries.map((e) => (
            <Card key={e.id} className={cn(e.voided && 'opacity-60')}>
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-line px-4 py-2">
                <span className="tnum text-[11.5px] text-ink-muted">#{e.id}</span>
                <span className="text-[11.5px] text-ink-muted">{day(e.date)}</span>
                <b className="min-w-0 flex-1 text-[12.5px] text-ink">{e.memo}</b>
                <span className="rounded-full bg-surface-sunk px-2 py-0.5 text-[10.5px] font-semibold text-ink-muted">{SOURCE[e.source] || e.source}</span>
                {e.voided && <span className="rounded-full bg-bad-bg px-2 py-0.5 text-[10.5px] font-bold text-bad">Undone later</span>}
                {e.by && <span className="text-[11.5px] text-ink-muted">by {e.by}</span>}
              </div>
              <div className="px-4 py-1.5">
                {e.lines.map((l, i) => (
                  <div key={i} className="grid grid-cols-[1fr_120px_120px] gap-3 py-0.5 text-[12px]">
                    <span className={cn('text-ink-2', l.credit && 'pl-6')}>{l.account} · {l.name}</span>
                    <span className="tnum text-right text-ink">{l.debit ? money(l.debit) : ''}</span>
                    <span className="tnum text-right text-ink">{l.credit ? money(l.credit) : ''}</span>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      ))}
    </>
  );
}

function SupplierStatement({ name, onClose }) {
  const [d, setD] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    api(`/api/manager/books/supplier?name=${encodeURIComponent(name)}`).then(setD).catch((e) => setError(e.message));
  }, [name]);
  const a = d?.account;
  const cols = [C.date(), C.text('What', 'what', 26), C.text('Invoice / Ref', 'ref', 18), C.money('Billed', 'billed'), C.money('Paid', 'paid'), C.money('Balance', 'balance', false), C.date('Due', 'due'), C.text('By', 'by', 14)];
  return (
    <Modal
      wide
      title={name}
      description="Every bill, goods sent back and payment, with what is owed after each."
      onClose={onClose}
      footer={<><SaveButtons title={`${name} statement`} cols={cols} rows={list(d?.lines)} file={`${name.replace(/\W+/g, '-')}-statement-${today()}`} /><Button onClick={onClose}>Close</Button></>}
    >
      <Alert>{error}</Alert>
      {!d && !error && <Loading />}
      {a && (
        <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="We owe" value={money(a.owed)} tone={a.owed > 0 ? 'warn' : 'ok'} />
          <Stat label="Late" value={money(a.overdue)} tone={a.overdue ? 'bad' : 'ok'} />
          <Stat label="Billed in all" value={money(a.billed)} />
          <Stat label="Paid in all" value={money(a.paid)} tone="ok" />
        </div>
      )}
      {d && (!d.lines.length ? <Empty title="Nothing yet" /> : <DataTable cols={cols} rows={d.lines} />)}
    </Modal>
  );
}
