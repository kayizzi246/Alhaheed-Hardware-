'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { money, shortMoney } from '@/lib/format';
import { Card, Alert } from '@/components/ui';

/**
 * The manager's dashboard.
 *
 * It answers three questions, in the order a manager asks them:
 *
 *   1. How much have we taken today?        — one number, big
 *   2. Where is the work stuck?             — the pipeline, tappable
 *   3. Is anything about to run out?        — low stock
 *
 * Everything else is supporting detail and sits below the fold. The
 * seven-day chart is there to answer "is today normal?", which is the
 * only reason to look at last week while standing in the shop.
 *
 * Nothing on this page animates on its own. It reloads every twenty
 * seconds, and a screen that re-animates every twenty seconds is one
 * people stop reading.
 */
export default function ManagerDashboard() {
  const [d, setD] = useState(null);
  const [error, setError] = useState('');
  const [at, setAt] = useState(null);

  const load = useCallback(async () => {
    try {
      setD(await api('/api/manager/dashboard'));
      setAt(new Date());
      setError('');
    } catch (e) { setError(e.message); }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 20000);
    return () => clearInterval(t);
  }, [load]);

  if (error && !d) return <Alert>{error}</Alert>;
  if (!d) return <DashboardSkeleton />;

  const today = d.salesToday;
  const days = d.last7Days || [];
  // "Is today normal?" needs something to compare against, and the
  // average of the days before it is a fairer mark than yesterday —
  // one quiet Sunday should not make Monday look like a triumph.
  const previous = days.slice(0, -1);
  const average = previous.length
    ? Math.round(previous.reduce((s, x) => s + x.total, 0) / previous.length)
    : 0;
  const delta = average ? Math.round(((today - average) / average) * 100) : null;

  const methods = [
    { key: 'cash', label: 'Cash', value: d.byMethod.cash, tone: 'a' },
    { key: 'mobile_money', label: 'Mobile Money', value: d.byMethod.mobile_money, tone: 'b' },
    { key: 'card', label: 'Card', value: d.byMethod.card, tone: 'c' },
  ];
  const methodTotal = methods.reduce((s, m) => s + m.value, 0);

  const stages = [
    { key: 'cashier', label: 'At the cashier', status: 'pending_payment', hint: 'waiting to pay' },
    { key: 'accounts', label: 'At accounts', status: 'paid', hint: 'to verify' },
    { key: 'store', label: 'At the store', status: 'payment_verified', hint: 'to pick & release' },
    { key: 'done', label: 'Completed', status: 'released', hint: 'released today' },
  ];
  const waiting = d.byStage.cashier + d.byStage.accounts + d.byStage.store;

  return (
    <>
      <div className="page-head">
        <h1>Dashboard</h1>
        <div className="page-meta">
          {at && <>Updated {at.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} · refreshes itself</>}
        </div>
      </div>

      <Alert>{error}</Alert>

      {/* 1 ─ How much have we taken today? */}
      <section className="hero">
        <div className="hero-main">
          <span className="hero-label">Sales today</span>
          <strong className="hero-value">{money(today)}</strong>
          <span className="hero-sub">
            {d.ordersToday} {d.ordersToday === 1 ? 'order' : 'orders'}
            {delta !== null && (
              <>
                {' · '}
                <span className={delta >= 0 ? 'delta up' : 'delta down'}>
                  {delta >= 0 ? '▲' : '▼'} {Math.abs(delta)}%
                </span>
                {' vs the daily average'}
              </>
            )}
          </span>
        </div>

        {/* The payment mix, as one bar. Three numbers that add to the
            total are a composition, not three separate facts. */}
        <div className="hero-side">
          <span className="hero-label">How it was paid</span>
          {methodTotal === 0 ? (
            <p className="hero-none">Nothing taken yet today.</p>
          ) : (
            <>
              <div className="mix" role="img"
                aria-label={methods.map((m) => `${m.label} ${money(m.value)}`).join(', ')}>
                {methods.filter((m) => m.value > 0).map((m) => (
                  <span
                    key={m.key}
                    className={`mix-part mix-${m.tone}`}
                    style={{ flexGrow: m.value }}
                  />
                ))}
              </div>
              <ul className="mix-key">
                {methods.map((m) => (
                  <li key={m.key}>
                    <span className={`dot mix-${m.tone}`} />
                    <span className="mix-name">{m.label}</span>
                    <span className="mix-val">{money(m.value)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </section>

      {/* 2 ─ Where is the work stuck? */}
      <div className="section-head">
        <h2>Where the work is</h2>
        <span className="page-meta">
          {waiting === 0 ? 'Every order is done.' : `${waiting} still moving through the shop`}
        </span>
      </div>

      <div className="pipeline">
        {stages.map((s, i) => {
          const n = d.byStage[s.key] ?? 0;
          return (
            <Link
              key={s.key}
              href={`/manager/orders?status=${s.status}`}
              className={`pipe ${n > 0 && s.key !== 'done' ? 'pipe-busy' : ''}`}
            >
              <span className="pipe-step">{i + 1}</span>
              <strong className="pipe-count">{n}</strong>
              <span className="pipe-label">{s.label}</span>
              <span className="pipe-hint">{s.hint}</span>
            </Link>
          );
        })}
      </div>

      {/* 3 ─ Is anything about to run out? */}
      {d.lowStock.length > 0 && (
        <Card
          title={`Low stock — ${d.lowStock.length} ${d.lowStock.length === 1 ? 'product' : 'products'}`}
          action={<Link className="btn btn-ghost btn-sm" href="/manager/products">Open products</Link>}
        >
          <table>
            <thead>
              <tr><th>Product</th><th>Code</th><th className="num">Left</th><th className="num">Reorder at</th></tr>
            </thead>
            <tbody>
              {d.lowStock.map((p) => (
                <tr key={p.id}>
                  <td><strong>{p.name}</strong></td>
                  <td><code>{p.code}</code></td>
                  <td className="num">
                    <span className={p.stock_available === 0 ? 'out' : 'low'}>
                      {p.stock_available} {p.unit}
                    </span>
                  </td>
                  <td className="num">{p.reorder_level}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {/* Supporting ─ is today normal? */}
      <Card title="Sales — last 7 days">
        <SevenDays days={days} average={average} />
      </Card>
    </>
  );
}

/**
 * Seven bars, one series.
 *
 * No legend: the title names the series. The day sits under every bar
 * and the amount is written beside the one you are looking at, so the
 * chart never depends on colour alone to be read — the orange does not
 * carry 3:1 against this surface, and labels are the relief for that.
 */
function SevenDays({ days, average }) {
  const [picked, setPicked] = useState(null);

  if (days.length === 0) {
    return <div className="empty">No verified sales in the last week.</div>;
  }

  const max = Math.max(1, ...days.map((d) => d.total));
  const active = picked ?? days.length - 1;
  const chosen = days[active];

  const label = (iso) => {
    const d = new Date(iso + 'T00:00:00');
    return Number.isNaN(d.getTime()) ? String(iso).slice(5)
      : d.toLocaleDateString('en-GB', { weekday: 'short' });
  };

  return (
    <div className="chart">
      <div className="chart-read">
        <strong>{money(chosen.total)}</strong>
        <span>
          {label(chosen.day)} {String(chosen.day).slice(5)} ·{' '}
          {chosen.receipts} {chosen.receipts === 1 ? 'receipt' : 'receipts'}
        </span>
      </div>

      <div className="bars">
        {average > 0 && (
          <div className="avg-line" style={{ bottom: `${(average / max) * 100}%` }}>
            <span>avg {shortMoney(average)}</span>
          </div>
        )}

        {days.map((d, i) => (
          <button
            key={d.day}
            type="button"
            className={`bar-col ${i === active ? 'on' : ''}`}
            onClick={() => setPicked(i)}
            aria-label={`${d.day}: ${money(d.total)}`}
          >
            {/* A floor of 3px so a zero day is still visibly a day. */}
            <span className="bar" style={{ height: `${3 + (d.total / max) * 97}%` }} />
            <span className="bar-day">{label(d.day)}</span>
          </button>
        ))}
      </div>

      <p className="chart-note">Verified sales only. Tap a day to read it.</p>
    </div>
  );
}

/** The shape of the page, while it loads. Less jarring than a spinner. */
function DashboardSkeleton() {
  return (
    <>
      <div className="page-head"><h1>Dashboard</h1></div>
      <div className="hero skel-block" style={{ height: 136 }} />
      <div className="pipeline">
        {[0, 1, 2, 3].map((i) => <div key={i} className="pipe skel-block" style={{ height: 104 }} />)}
      </div>
      <div className="skel-block" style={{ height: 240, borderRadius: 'var(--radius)' }} />
    </>
  );
}
