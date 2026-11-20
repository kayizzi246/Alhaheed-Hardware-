'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { money, shortMoney } from '@/lib/format';
import { Stat, Card, Alert, Empty } from '@/components/ui';

/**
 * The manager's overview.
 *
 * Sales today is the headline because it is the number the shop is
 * asked for; everything below it exists to answer "and where is the
 * work stuck?". The stage counts link straight into the order register
 * filtered to that stage, because the next question after a number
 * that looks wrong is always "which ones?".
 */
export default function ManagerDashboard() {
  const [d, setD] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try { setD(await api('/api/manager/dashboard')); setError(''); }
    catch (e) { setError(e.message); }
  }, []);

  useEffect(() => {
    load();
    // The desks move orders all day; a dashboard that needs reloading
    // by hand is one nobody trusts.
    const t = setInterval(load, 20000);
    return () => clearInterval(t);
  }, [load]);

  if (error && !d) return <Alert>{error}</Alert>;
  if (!d) return <div className="loading">Loading the shop…</div>;

  const maxDay = Math.max(1, ...d.last7Days.map((x) => x.total));

  return (
    <>
      <div className="page-head">
        <h1>Dashboard</h1>
        <div className="page-meta">Updates on its own every 20 seconds</div>
      </div>

      <Alert>{error}</Alert>

      <div className="stats">
        <Stat label="Sales today" value={money(d.salesToday)} tone="green" />
        <Stat label="Orders today" value={d.ordersToday} />
        <Stat label="Cash" value={money(d.byMethod.cash)} />
        <Stat label="Mobile Money" value={money(d.byMethod.mobile_money)} />
        <Stat label="Card" value={money(d.byMethod.card)} />
        <Stat
          label="Low stock"
          value={d.lowStock.length}
          tone={d.lowStock.length ? 'red' : undefined}
        />
      </div>

      <Card title="Orders by stage">
        <div className="stats" style={{ padding: 14 }}>
          {[
            ['cashier', 'At Cashier', 'pending_payment'],
            ['accounts', 'At Accounts', 'paid'],
            ['store', 'At Store', 'payment_verified'],
            ['done', 'Completed', 'released'],
          ].map(([key, label, status]) => (
            <Link
              key={key}
              href={`/manager/orders?status=${status}`}
              style={{ textDecoration: 'none', flex: '1 1 150px' }}
            >
              <Stat label={label} value={d.byStage[key] ?? 0} />
            </Link>
          ))}
        </div>
      </Card>

      <Card title="Sales — last 7 days">
        {d.last7Days.length === 0 ? (
          <Empty>No verified sales in the last week.</Empty>
        ) : (
          <div style={{ padding: '18px 16px' }}>
            {d.last7Days.map((x) => (
              <div
                key={x.day}
                style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 9 }}
              >
                <span style={{ width: 86, fontSize: 12, color: 'var(--muted)' }}>
                  {String(x.day).slice(5)}
                </span>
                <div style={{ flex: 1, background: '#eef2f6', borderRadius: 4, height: 22, overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${(x.total / maxDay) * 100}%`,
                      background: 'var(--orange)',
                      height: '100%',
                      minWidth: x.total > 0 ? 3 : 0,
                    }}
                  />
                </div>
                <span style={{ width: 130, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                  {money(x.total)}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {d.lowStock.length > 0 && (
        <Card title="Low stock">
          <table>
            <thead>
              <tr><th>Product</th><th>Code</th><th className="num">In stock</th><th className="num">Reorder at</th></tr>
            </thead>
            <tbody>
              {d.lowStock.map((p) => (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td><code>{p.code}</code></td>
                  <td className="num" style={{ color: p.stock_available === 0 ? 'var(--red)' : 'var(--orange)' }}>
                    <strong>{p.stock_available}</strong> {p.unit}
                  </td>
                  <td className="num">{p.reorder_level}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <div className="page-meta" style={{ marginTop: 10 }}>
        Takings today: {shortMoney(d.salesToday)} across {d.ordersToday} orders.
      </div>
    </>
  );
}
