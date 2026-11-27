'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { money, methodLabel, statusLabel, list, dateTime } from '@/lib/format';
import {
  Alert, Button, Card, CardBody, CardHead, CardNote, CardTitle, Empty, Field,
  Loading, PageHead, Select, Stat, Stats, Table, TableWrap, Td, Th, Tr,
} from '@/components/ui';
import { Icon } from '@/components/icons';

const KIND_LABEL = {
  expense: 'Expense',
  stock_use: 'Stock used in the shop',
  float: 'Cash float',
  advance: 'Staff advance',
};

/** How many order rows the screen draws before it defers to the export. */
const SHOWN = 50;

const SPEND_STATUS = {
  raised: 'Waiting for the manager',
  approved: 'Approved, not yet paid',
  declined: 'Declined',
  paid: 'Paid',
};

/**
 * One month, the whole shop.
 *
 * The other reports answer a question — what sold, who did what, how
 * much is in the drawer. This one is the month closed off: the figure
 * that goes to the accountant, with every row behind it in the same
 * file. That is why it exports as a workbook rather than a CSV. A
 * single CSV would force takings, spending and the cash book into one
 * grid and lose the thing that makes the report trustworthy — being
 * able to add a column up and get the headline back.
 */
export default function MonthlyReport() {
  const [months, setMonths] = useState([]);
  const [month, setMonth] = useState('');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  // The month list first, so the picker only offers months the shop
  // actually traded.
  useEffect(() => {
    api('/api/reports/months')
      .then((r) => {
        const got = list(r.months);
        setMonths(got);
        setMonth((m) => m || got[0]?.month || '');
      })
      .catch((e) => setError(e.message));
  }, []);

  const load = useCallback(async () => {
    if (!month) return;
    setBusy(true);
    try {
      setData(await api(`/api/reports/monthly?month=${month}`));
      setError('');
    } catch (e) {
      // An empty shape rather than null: the screen draws "nothing
      // this month" and the error, instead of sitting on the loader
      // forever.
      setData(null);
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }, [month]);

  useEffect(() => { load(); }, [load]);

  /**
   * The spreadsheet library is ~140kB and only matters to the person
   * who clicks Export, so it is fetched on the click rather than on
   * every page view. Reading the report on a phone over Kampala mobile
   * data should not pay for a feature most visits never use.
   */
  async function exportWorkbook() {
    if (!data) return;
    try {
      const { exportReport } = await import('@/lib/exports');
      const name = await exportReport({ month: data.month });
      setNotice(`${name} saved. Open it in Excel.`);
    } catch (e) {
      setError(`The file could not be made: ${e.message}`);
    }
  }

  if (!data && !error) return <Loading>Building the monthly report…</Loading>;

  const t = data?.totals || {};
  const byDay = list(data?.byDay);
  const maxDay = Math.max(1, ...byDay.map((d) => d.total));
  const orders = list(data?.orders);
  const spend = list(data?.expenses);
  const paidSpend = spend.filter((e) => (e.counts === undefined ? e.status === 'paid' : e.counts));
  const openSpend = spend.filter((e) => e.status === 'raised' || e.status === 'approved');

  return (
    <>
      <PageHead
        title="Monthly report"
        sub={data ? `${data.shop} · ${data.from} to ${data.to}` : 'Pick a month'}
      >
        <Button variant="outline" size="sm" disabled={!data} onClick={exportWorkbook}>
          Export to Excel
        </Button>
        <Button size="sm" className="print:hidden" disabled={!data} onClick={() => window.print()}>
          Save as PDF
        </Button>
      </PageHead>

      <Alert>{error}</Alert>
      <Alert kind="ok" onDone={() => setNotice('')}>{notice}</Alert>

      <Card className="mb-4 print:hidden">
        <CardBody className="flex flex-wrap items-end gap-3">
          <Field label="Month">
            <Select
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="w-[220px]"
            >
              {months.map((m) => (
                <option key={m.month} value={m.month}>{m.label}</option>
              ))}
            </Select>
          </Field>
          <Button variant="outline" className="h-11" disabled={busy} onClick={load}>
            {busy ? 'Loading…' : 'Refresh'}
          </Button>
        </CardBody>
      </Card>

      {!data ? (
        <Empty title="Nothing to show">Pick a month, or try again.</Empty>
      ) : (
        <>
          <Stats>
            <Stat label="Gross sales" icon={Icon.cash()} value={money(t.gross)} note={`${t.receipts} verified receipts`} lead />
            <Stat label="Internal spending" icon={Icon.cash()} value={money(t.expenses)} note="paid out this month" tone="bad" />
            <Stat label="Sales less spending" icon={Icon.chart()} value={money(t.net)} note="what the month left behind" tone="ok" />
            <Stat label="Orders placed" icon={Icon.receipt()} value={t.orders} note={`average receipt ${money(t.average)}`} />
          </Stats>

          <div className="mb-4 grid gap-3 xl:grid-cols-2">
            <Card>
              <CardHead><CardTitle>Cash book for the month</CardTitle></CardHead>
              <TableWrap>
                <Table>
                  <tbody>
                    <Tr>
                      <Td className="text-ink-muted">Opening balance</Td>
                      <Td num className="font-semibold text-ink">{money(t.opening)}</Td>
                    </Tr>
                    <Tr>
                      <Td className="text-ink-muted">Cash in</Td>
                      <Td num className="font-semibold text-ink">{money(t.cash_in)}</Td>
                    </Tr>
                    <Tr>
                      <Td className="text-ink-muted">Cash out</Td>
                      <Td num className="font-semibold text-ink">{money(t.cash_out)}</Td>
                    </Tr>
                    <Tr>
                      <Td className="font-semibold text-ink">Closing balance</Td>
                      <Td num className="font-bold text-ink">{money(t.closing)}</Td>
                    </Tr>
                  </tbody>
                </Table>
              </TableWrap>
              <CardNote>
                Cash in counts every entry in the book. Gross sales counts only
                payments Accounts has verified, so the two are not the same
                figure and are not meant to match.
              </CardNote>
            </Card>

            <Card>
              <CardHead><CardTitle>Payments by method</CardTitle></CardHead>
              {list(data.byMethod).length === 0 ? (
                <Empty title="Nothing collected this month" />
              ) : (
                <TableWrap>
                  <Table>
                    <thead>
                      <tr><Th>Method</Th><Th num>Receipts</Th><Th num>Total</Th></tr>
                    </thead>
                    <tbody>
                      {list(data.byMethod).map((m) => (
                        <Tr key={m.method}>
                          <Td className="font-medium text-ink">{methodLabel(m.method)}</Td>
                          <Td num>{m.receipts}</Td>
                          <Td num className="font-semibold text-ink">{money(m.total)}</Td>
                        </Tr>
                      ))}
                    </tbody>
                  </Table>
                </TableWrap>
              )}
            </Card>
          </div>

          <Card className="mb-4">
            <CardHead>
              <CardTitle>Takings by day</CardTitle>
              <span className="text-[11.5px] text-ink-muted">
                {byDay.length} {byDay.length === 1 ? 'day' : 'days'} with money in
              </span>
            </CardHead>
            {byDay.length === 0 ? (
              <Empty title="No verified payments this month" />
            ) : (
              <CardBody className="space-y-2.5">
                {byDay.map((d) => (
                  <div key={d.day} className="flex items-center gap-3">
                    <span className="tnum w-[70px] shrink-0 text-[11.5px] text-ink-muted">{d.day.slice(5)}</span>
                    <div className="h-5 flex-1 overflow-hidden rounded-sm bg-surface-sunk">
                      <div
                        className="h-full rounded-sm bg-brand"
                        style={{ width: `${(d.total / maxDay) * 100}%`, minWidth: d.total > 0 ? 3 : 0 }}
                      />
                    </div>
                    <span className="tnum w-[64px] shrink-0 text-right text-[11.5px] text-ink-muted">
                      {d.receipts} rcpt
                    </span>
                    <span className="tnum w-[120px] shrink-0 text-right text-[12.5px] font-semibold text-ink">
                      {money(d.total)}
                    </span>
                  </div>
                ))}
              </CardBody>
            )}
          </Card>

          <Card className="mb-4">
            <CardHead>
              <CardTitle>Internal spending</CardTitle>
              <span className="text-[11.5px] text-ink-muted">
                {money(t.expenses)} paid
                {openSpend.length > 0 && ` · ${openSpend.length} still open`}
              </span>
            </CardHead>
            {spend.length === 0 ? (
              <Empty title="Nothing spent internally this month" />
            ) : (
              <TableWrap>
                <Table>
                  <thead>
                    <tr>
                      <Th>Ref</Th><Th>What for</Th><Th>Payment</Th><Th>Paid</Th>
                      <Th num>Amount</Th><Th>Status</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {spend.map((e) => (
                      <Tr key={e.ref}>
                        <Td className="tnum font-bold text-ink">{e.ref}</Td>
                        <Td>
                          <span className="font-medium text-ink">{e.details}</span>
                          <span className="block text-[11.5px] text-ink-muted">{KIND_LABEL[e.kind] || e.kind}</span>
                        </Td>
                        <Td>
                          <span className="block font-medium text-ink">{methodLabel(e.method)}</span>
                          {e.payee && <span className="block text-[11.5px] text-ink-2">{e.payee}</span>}
                          {(e.number || e.pay_ref) && (
                            <span className="block break-words text-[11.5px] text-ink-muted">
                              {[e.number, e.pay_ref && `ID ${e.pay_ref}`].filter(Boolean).join(' · ')}
                            </span>
                          )}
                        </Td>
                        <Td className="tnum whitespace-nowrap text-ink-muted">
                          {dateTime(e.paid)}
                          {e.paid_by && <span className="block text-[11.5px]">{e.paid_by}</span>}
                        </Td>
                        <Td num className="font-semibold text-ink">{money(e.amount)}</Td>
                        <Td
                          className={
                            e.status === 'paid' ? 'text-ink-muted'
                              : e.status === 'declined' ? 'text-bad'
                                : 'font-medium text-ink'
                          }
                        >
                          {SPEND_STATUS[e.status] || e.status}
                        </Td>
                      </Tr>
                    ))}
                  </tbody>
                </Table>
              </TableWrap>
            )}
            {list(data.spentBy).length > 0 && (
              <div className="border-t border-line px-4 py-4 sm:px-4">
                <p className="text-[11.5px] font-semibold text-ink-2">How it was paid</p>
                <dl className="mt-3 grid gap-x-8 gap-y-2 sm:grid-cols-2 xl:grid-cols-3">
                  {list(data.spentBy).map((m) => (
                    <div key={m.method} className="flex items-baseline justify-between gap-3">
                      <dt className="text-[12px] text-ink-2">
                        {methodLabel(m.method)} <span className="text-ink-muted">({m.payments})</span>
                      </dt>
                      <dd className="tnum text-[12.5px] font-semibold text-ink">{money(m.total)}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}
            <CardNote className="px-4 pb-5 sm:px-4">
              Only the {paidSpend.length} paid {paidSpend.length === 1 ? 'row counts' : 'rows count'} towards
              the month&apos;s spending. Requests waiting on approval are shown so
              nothing is forgotten, not because they have cost anything yet.
            </CardNote>
          </Card>

          <div className="mb-4 grid gap-3 xl:grid-cols-2">
            <Card>
              <CardHead><CardTitle>Best selling items</CardTitle></CardHead>
              {list(data.products).length === 0 ? (
                <Empty title="Nothing sold this month" />
              ) : (
                <TableWrap>
                  <Table>
                    <thead>
                      <tr><Th>Product</Th><Th num>Qty</Th><Th num>Revenue</Th></tr>
                    </thead>
                    <tbody>
                      {list(data.products).slice(0, 15).map((p) => (
                        <Tr key={p.name}>
                          <Td className="font-medium text-ink">{p.name}</Td>
                          <Td num>{p.qty}</Td>
                          <Td num className="font-semibold text-ink">{money(p.revenue)}</Td>
                        </Tr>
                      ))}
                    </tbody>
                  </Table>
                </TableWrap>
              )}
            </Card>

            <Card>
              <CardHead><CardTitle>Orders by stage</CardTitle></CardHead>
              {Object.keys(data.byStatus || {}).length === 0 ? (
                <Empty title="No orders this month" />
              ) : (
                <TableWrap>
                  <Table>
                    <thead>
                      <tr><Th>Stage</Th><Th num>Orders</Th></tr>
                    </thead>
                    <tbody>
                      {Object.entries(data.byStatus).map(([status, n]) => (
                        <Tr key={status}>
                          <Td className="font-medium text-ink">{statusLabel(status)}</Td>
                          <Td num className="font-semibold text-ink">{n}</Td>
                        </Tr>
                      ))}
                    </tbody>
                  </Table>
                </TableWrap>
              )}
            </Card>
          </div>

          <Card className="mb-4">
            <CardHead>
              <CardTitle>Every order this month</CardTitle>
              <span className="text-[11.5px] text-ink-muted">
                {orders.length} {orders.length === 1 ? 'order' : 'orders'}
                {orders.length > SHOWN && ` · first ${SHOWN} shown`}
              </span>
            </CardHead>
            {orders.length === 0 ? (
              <Empty title="No orders this month" />
            ) : (
              <TableWrap>
                <Table>
                  <thead>
                    <tr>
                      <Th>Order</Th><Th>Customer</Th><Th>Stage</Th>
                      <Th num>Items</Th><Th num>Total</Th><Th>Placed</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.slice(0, SHOWN).map((o) => (
                      <Tr key={o.order_no}>
                        <Td className="tnum font-bold text-ink">{o.order_no}</Td>
                        <Td className="font-medium text-ink">{o.customer}</Td>
                        <Td className="text-ink-muted">{statusLabel(o.status)}</Td>
                        <Td num>{o.items}</Td>
                        <Td num className="font-semibold text-ink">{money(o.total)}</Td>
                        <Td className="tnum text-ink-muted">{o.placed}</Td>
                      </Tr>
                    ))}
                  </tbody>
                </Table>
              </TableWrap>
            )}
            {orders.length > SHOWN && (
              <CardNote>
                A long month does not belong on one screen. Export to Excel for
                all {orders.length}.
              </CardNote>
            )}
          </Card>

          <Card>
            <CardHead>
              <CardTitle>Who did the work</CardTitle>
              <span className="text-[11.5px] text-ink-muted">{data.staff.length} on the floor</span>
            </CardHead>
            {list(data.staff).length === 0 ? (
              <Empty title="No recorded staff activity this month" />
            ) : (
              <TableWrap>
                <Table>
                  <thead>
                    <tr><Th>Staff</Th><Th>Desk</Th><Th num>Actions</Th><Th>What they did</Th></tr>
                  </thead>
                  <tbody>
                    {list(data.staff).map((s) => (
                      <Tr key={s.name}>
                        <Td className="font-semibold text-ink">{s.name}</Td>
                        <Td className="capitalize text-ink-muted">{s.desk}</Td>
                        <Td num className="font-semibold text-ink">{s.total}</Td>
                        <Td className="text-ink-muted">
                          {Object.entries(s.actions || {})
                            .map(([a, n]) => `${a.replace(/_/g, ' ')} ${n}`)
                            .join(' · ')}
                        </Td>
                      </Tr>
                    ))}
                  </tbody>
                </Table>
              </TableWrap>
            )}
          </Card>
        </>
      )}
    </>
  );
}
