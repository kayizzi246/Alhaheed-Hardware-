'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, downloadCsv, getUser } from '@/lib/api';
import { money, methodLabel, statusLabel, today, list } from '@/lib/format';
import {
  Alert, Button, Card, CardBody, CardHead, CardTitle, Chip, Empty, Field,
  Input, Loading, PageHead, Select, Stat, Stats, Table, TableWrap, Td, Th, Tr,
} from '@/components/ui';

const PERIODS = [
  ['daily', 'Today'],
  ['weekly', 'Last 7 days'],
  ['monthly', 'Last 30 days'],
  ['custom', 'Custom range'],
];

const EXPORTS = [
  ['sales', 'Sales'],
  ['orders', 'Orders'],
  ['cash-book', 'Cash book'],
  ['stock', 'Stock'],
];

/**
 * Sales, best sellers, stock movement and staff activity.
 *
 * Shared by the Accounts and Manager sides — the API allows both, and
 * staff activity is the one section a manager sees that accounts does
 * not.
 */
export default function ReportsView() {
  const [period, setPeriod] = useState('weekly');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState(today());
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const user = getUser();
  const isManager = user?.role === 'manager';

  const query = useCallback(() => {
    const p = new URLSearchParams();
    if (period === 'custom') {
      if (from) p.set('from', from);
      if (to) p.set('to', to);
    } else {
      p.set('period', period);
    }
    return p.toString();
  }, [period, from, to]);

  const load = useCallback(async () => {
    try {
      const qs = query();
      const [sales, best, stock, stage, staff] = await Promise.all([
        api(`/api/reports/sales?${qs}`),
        api(`/api/reports/best-sellers?${qs}`),
        api(`/api/reports/stock-movement?${qs}`),
        api(`/api/reports/orders-by-stage?${qs}`),
        api(`/api/reports/staff-activity?${qs}`),
      ]);
      setData({ sales, best, stock, stage, staff });
      setError('');
    } catch (e) {
      // Reports are five calls at once; if any of them fails there is
      // nothing partial worth drawing, so the screen says so instead
      // of sitting on "Building reports…".
      setError(e.message);
      setData(null);
    }
  }, [query]);

  useEffect(() => { load(); }, [load]);

  const exportCsv = (report) => {
    downloadCsv(`/api/reports/export/${report}.csv?${query()}`, `${report}-${today()}.csv`)
      .then(() => setNotice(`${report} exported. Open it in Excel.`))
      .catch((e) => setError(e.message));
  };

  if (!data && !error) return <Loading>Building reports…</Loading>;

  if (!data) {
    return (
      <>
        <PageHead title="Reports" />
        <Alert>{error}</Alert>
        <Button variant="outline" onClick={load}>Try again</Button>
      </>
    );
  }

  const { sales, best, stock, stage, staff } = data;
  const byDay = list(sales.byDay);
  const stages = list(stage.stages);
  const maxDay = Math.max(1, ...byDay.map((d) => d.total));

  // One row per person, one column per action.
  const rows = list(staff.staff);
  const actions = [...new Set(rows.map((s) => s.action))];
  const byPerson = {};
  for (const row of rows) {
    byPerson[row.full_name] ??= { role: row.role, counts: {} };
    byPerson[row.full_name].counts[row.action] = row.count;
  }

  return (
    <>
      <PageHead title="Reports" sub={`${sales.from} to ${sales.to}`}>
        {EXPORTS.map(([key, label]) => (
          <Button key={key} variant="outline" size="sm" onClick={() => exportCsv(key)}>
            {label}
          </Button>
        ))}
        <Button size="sm" className="print:hidden" onClick={() => window.print()}>Save as PDF</Button>
      </PageHead>

      <Alert>{error}</Alert>
      <Alert kind="ok" onDone={() => setNotice('')}>{notice}</Alert>

      <Card className="mb-4">
        <CardBody className="flex flex-wrap items-end gap-3">
          <Field label="Period">
            <Select value={period} onChange={(e) => setPeriod(e.target.value)} className="w-[170px]">
              {PERIODS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </Select>
          </Field>
          {period === 'custom' && (
            <>
              <Field label="From">
                <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="tnum w-[170px]" />
              </Field>
              <Field label="To">
                <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="tnum w-[170px]" />
              </Field>
            </>
          )}
        </CardBody>
      </Card>

      <Stats>
        <Stat label="Gross sales (verified)" value={money(sales.totals.gross)} lead />
        <Stat label="Receipts" value={sales.totals.receipts} />
        <Stat
          label="Average receipt"
          value={money(sales.totals.receipts ? Math.round(sales.totals.gross / sales.totals.receipts) : 0)}
        />
        <Stat label="Orders in period" value={stages.reduce((s, x) => s + x.orders, 0)} />
      </Stats>

      <Card className="mb-4">
        <CardHead><CardTitle>Sales by day</CardTitle></CardHead>
        {byDay.length === 0 ? (
          <Empty title="No verified sales in this period">Try a longer period.</Empty>
        ) : (
          <CardBody className="space-y-2.5">
            {byDay.map((d) => (
              <div key={d.day} className="flex items-center gap-3">
                <span className="tnum w-[70px] shrink-0 text-xs text-ink-muted">{d.day.slice(5)}</span>
                <div className="h-5 flex-1 overflow-hidden rounded-sm bg-surface-sunk">
                  <div
                    className="h-full rounded-sm bg-brand"
                    style={{ width: `${(d.total / maxDay) * 100}%`, minWidth: d.total > 0 ? 3 : 0 }}
                  />
                </div>
                <span className="tnum w-[64px] shrink-0 text-right text-xs text-ink-muted">
                  {d.receipts} rcpt
                </span>
                <span className="tnum w-[120px] shrink-0 text-right text-sm font-semibold text-ink">
                  {money(d.total)}
                </span>
              </div>
            ))}
          </CardBody>
        )}
      </Card>

      <div className="mb-4 grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHead><CardTitle>Payments by method</CardTitle></CardHead>
          {list(sales.byMethod).length === 0 ? (
            <Empty title="Nothing collected in this period" />
          ) : (
            <TableWrap>
              <Table>
                <thead>
                  <tr><Th>Method</Th><Th num>Receipts</Th><Th num>Total</Th></tr>
                </thead>
                <tbody>
                  {list(sales.byMethod).map((m) => (
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

        <Card>
          <CardHead><CardTitle>Orders by stage</CardTitle></CardHead>
          {stages.length === 0 ? (
            <Empty title="No orders in this period" />
          ) : (
            <TableWrap>
              <Table>
                <thead>
                  <tr><Th>Stage</Th><Th num>Orders</Th><Th num>Value</Th></tr>
                </thead>
                <tbody>
                  {stages.map((s) => (
                    <Tr key={s.status}>
                      <Td className="font-medium text-ink">{statusLabel(s.status)}</Td>
                      <Td num>{s.orders}</Td>
                      <Td num>{money(s.value)}</Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          )}
        </Card>
      </div>

      <Card className="mb-4">
        <CardHead><CardTitle>Best selling items</CardTitle></CardHead>
        {list(best.products).length === 0 ? (
          <Empty title="No items sold in this period" />
        ) : (
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>Product</Th><Th num>Quantity sold</Th><Th num>Orders</Th><Th num>Revenue</Th>
                </tr>
              </thead>
              <tbody>
                {list(best.products).slice(0, 15).map((p) => (
                  <Tr key={p.product_id}>
                    <Td className="font-medium text-ink">{p.product_name}</Td>
                    <Td num>{p.qty_sold} {p.unit}</Td>
                    <Td num>{p.orders}</Td>
                    <Td num className="font-semibold text-ink">{money(p.revenue)}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </Card>

      <Card className="mb-4">
        <CardHead><CardTitle>Stock movement</CardTitle></CardHead>
        {list(stock.movements).length === 0 ? (
          <Empty title="Nothing moved in this period" />
        ) : (
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>Product</Th><Th num>Received</Th><Th num>Released</Th>
                  <Th num>Adjusted</Th><Th num>In stock</Th><Th />
                </tr>
              </thead>
              <tbody>
                {list(stock.movements).slice(0, 25).map((m) => (
                  <Tr key={m.code}>
                    <Td>
                      <span className="font-medium text-ink">{m.name}</span>
                      <span className="tnum block text-xs text-ink-muted">{m.code}</span>
                    </Td>
                    <Td num>{m.received}</Td>
                    <Td num>{m.released}</Td>
                    <Td num>{m.adjusted}</Td>
                    <Td num className="font-semibold text-ink">{m.stock_available} {m.unit}</Td>
                    <Td>{m.stock_available <= m.reorder_level && <Chip tone="bad">Low</Chip>}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </Card>

      {isManager && (
        <Card>
          <CardHead><CardTitle>Staff activity</CardTitle></CardHead>
          {Object.keys(byPerson).length === 0 ? (
            <Empty title="No staff activity in this period" />
          ) : (
            <TableWrap>
              <Table>
                <thead>
                  <tr>
                    <Th>Staff</Th><Th>Desk</Th>
                    {actions.map((a) => (
                      <Th key={a} num className="normal-case tracking-normal">
                        {a.replace(/_/g, ' ')}
                      </Th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(byPerson).map(([name, row]) => (
                    <Tr key={name}>
                      <Td className="font-semibold text-ink">{name}</Td>
                      <Td className="capitalize text-ink-muted">{row.role}</Td>
                      {actions.map((a) => (
                        <Td key={a} num className={row.counts[a] ? undefined : 'text-ink-faint'}>
                          {row.counts[a] || '—'}
                        </Td>
                      ))}
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          )}
        </Card>
      )}
    </>
  );
}
