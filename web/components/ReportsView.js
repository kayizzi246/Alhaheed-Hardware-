'use client';
import { useCallback, useEffect, useState } from 'react';
import { api, downloadCsv, getUser } from '@/lib/api';
import { money, methodLabel, statusLabel, today } from '@/lib/format';
import { Stat, Card, Alert, Empty } from '@/components/ui';

const PERIODS = [
  ['daily', 'Today'],
  ['weekly', 'Last 7 days'],
  ['monthly', 'Last 30 days'],
  ['custom', 'Custom range'],
];

/**
 * Sales, best sellers, stock movement and staff activity.
 * Shared by the Accounts and Manager sides — the API allows both.
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
    } catch (e) { setError(e.message); }
  }, [query]);

  useEffect(() => { load(); }, [load]);

  const exportCsv = (report) => {
    downloadCsv(`/api/reports/export/${report}.csv?${query()}`, `${report}-${today()}.csv`)
      .then(() => setNotice(`${report} exported. Open it in Excel.`))
      .catch((e) => setError(e.message));
  };

  if (!data) return <div className="loading">Building reports…</div>;

  const { sales, best, stock, stage, staff } = data;
  const maxDay = Math.max(1, ...sales.byDay.map((d) => d.total));

  // Group staff activity: one row per person, one column per action.
  const actions = [...new Set(staff.staff.map((s) => s.action))];
  const byPerson = {};
  for (const row of staff.staff) {
    byPerson[row.full_name] ??= { role: row.role, counts: {} };
    byPerson[row.full_name].counts[row.action] = row.count;
  }

  return (
    <>
      <div className="page-head">
        <h1>Reports</h1>
        <div className="btn-row">
          <button className="btn btn-ghost" onClick={() => exportCsv('sales')}>Export sales</button>
          <button className="btn btn-ghost" onClick={() => exportCsv('orders')}>Export orders</button>
          <button className="btn btn-ghost" onClick={() => exportCsv('cash-book')}>Export cash book</button>
          <button className="btn btn-ghost" onClick={() => exportCsv('stock')}>Export stock</button>
          <button className="btn btn-navy no-print" onClick={() => window.print()}>Save as PDF</button>
        </div>
      </div>

      <Alert>{error}</Alert>
      <Alert kind="ok" onDone={() => setNotice('')}>{notice}</Alert>

      <div className="card" style={{ padding: 14 }}>
        <div className="filters">
          <div className="field">
            <label htmlFor="pd">Period</label>
            <select id="pd" value={period} onChange={(e) => setPeriod(e.target.value)}>
              {PERIODS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          {period === 'custom' && (
            <>
              <div className="field">
                <label htmlFor="fr">From</label>
                <input id="fr" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="to">To</label>
                <input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
              </div>
            </>
          )}
          <div className="page-meta" style={{ marginBottom: 4 }}>
            {sales.from} to {sales.to}
          </div>
        </div>
      </div>

      <div className="stats">
        <Stat label="Gross sales (verified)" value={money(sales.totals.gross)} tone="green" />
        <Stat label="Receipts" value={sales.totals.receipts} />
        <Stat
          label="Average receipt"
          value={money(sales.totals.receipts ? Math.round(sales.totals.gross / sales.totals.receipts) : 0)}
        />
        <Stat label="Orders in period" value={stage.stages.reduce((s, x) => s + x.orders, 0)} />
      </div>

      <Card title="Sales by day">
        {sales.byDay.length === 0 ? (
          <Empty>No verified sales in this period.</Empty>
        ) : (
          <div style={{ padding: '18px 16px' }}>
            {sales.byDay.map((d) => (
              <div key={d.day} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 9 }}>
                <span style={{ width: 86, fontSize: 12, color: 'var(--muted)' }}>{d.day.slice(5)}</span>
                <div style={{ flex: 1, background: '#eef2f6', borderRadius: 4, height: 22, overflow: 'hidden' }}>
                  <div style={{
                    width: `${(d.total / maxDay) * 100}%`,
                    background: 'var(--orange)',
                    height: '100%',
                    minWidth: d.total > 0 ? 3 : 0,
                  }} />
                </div>
                <span style={{ width: 70, textAlign: 'right', fontSize: 12, color: 'var(--muted)' }}>
                  {d.receipts} rcpt
                </span>
                <span style={{ width: 130, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                  {money(d.total)}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className="detail-grid">
        <Card title="Payments by method">
          {sales.byMethod.length === 0 ? (
            <Empty>Nothing collected in this period.</Empty>
          ) : (
            <table>
              <thead>
                <tr><th>Method</th><th className="num">Receipts</th><th className="num">Total</th></tr>
              </thead>
              <tbody>
                {sales.byMethod.map((m) => (
                  <tr key={m.method}>
                    <td>{methodLabel(m.method)}</td>
                    <td className="num">{m.receipts}</td>
                    <td className="num"><strong>{money(m.total)}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card title="Orders by stage">
          {stage.stages.length === 0 ? (
            <Empty>No orders in this period.</Empty>
          ) : (
            <table>
              <thead>
                <tr><th>Stage</th><th className="num">Orders</th><th className="num">Value</th></tr>
              </thead>
              <tbody>
                {stage.stages.map((s) => (
                  <tr key={s.status}>
                    <td>{statusLabel(s.status)}</td>
                    <td className="num">{s.orders}</td>
                    <td className="num">{money(s.value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>

      <Card title="Best selling items">
        {best.products.length === 0 ? (
          <Empty>No items sold in this period.</Empty>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Product</th><th className="num">Quantity sold</th>
                <th className="num">Orders</th><th className="num">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {best.products.slice(0, 15).map((p) => (
                <tr key={p.product_id}>
                  <td>{p.product_name}</td>
                  <td className="num">{p.qty_sold} {p.unit}</td>
                  <td className="num">{p.orders}</td>
                  <td className="num"><strong>{money(p.revenue)}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card title="Stock movement">
        <table>
          <thead>
            <tr>
              <th>Product</th><th className="num">Received</th><th className="num">Released</th>
              <th className="num">Adjusted</th><th className="num">In stock</th><th />
            </tr>
          </thead>
          <tbody>
            {stock.movements.slice(0, 25).map((m) => (
              <tr key={m.code}>
                <td>{m.name}<div className="sub">{m.code}</div></td>
                <td className="num">{m.received}</td>
                <td className="num">{m.released}</td>
                <td className="num">{m.adjusted}</td>
                <td className="num"><strong>{m.stock_available}</strong> {m.unit}</td>
                <td>{m.stock_available <= m.reorder_level && <span className="chip rejected">Low</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {isManager && (
        <Card title="Staff activity">
          {Object.keys(byPerson).length === 0 ? (
            <Empty>No staff activity in this period.</Empty>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Staff</th><th>Role</th>
                  {actions.map((a) => (
                    <th key={a} className="num" style={{ textTransform: 'capitalize' }}>
                      {a.replace(/_/g, ' ')}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.entries(byPerson).map(([name, row]) => (
                  <tr key={name}>
                    <td><strong>{name}</strong></td>
                    <td style={{ textTransform: 'capitalize' }}>{row.role}</td>
                    {actions.map((a) => (
                      <td key={a} className="num">{row.counts[a] || '—'}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}
    </>
  );
}
