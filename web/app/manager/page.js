'use client';
import { useCallback, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { money, shortMoney, time, statusLabel } from '@/lib/format';
import { Chip, Alert } from '@/components/ui';
import { usePoll, freshness } from '@/lib/live';

/**
 * The manager's console.
 *
 * Dense on purpose. A manager standing in the shop wants the whole
 * position in one look, not six clicks, so everything that fits above
 * the fold is there: what we took, where it is stuck, what sells, and
 * what just happened.
 *
 * It reads from three endpoints in parallel. If one of them fails the
 * other two still draw, because a dashboard that goes blank because a
 * single report timed out is worse than one that is partly complete
 * and says so.
 *
 * On colour: the chrome is the shop's red and orange. The three
 * payment slices are orange, red and plum — a third warm hue would sit
 * on top of the other two for anyone with the commonest form of colour
 * blindness, so the third one steps out of the family. Every figure is
 * written beside its colour regardless.
 */
export default function ManagerConsole() {
  const [d, setD] = useState(null);
  const [best, setBest] = useState(null);
  const [recent, setRecent] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const [dash, sellers, orders] = await Promise.allSettled([
      api('/api/manager/dashboard'),
      api('/api/reports/best-sellers?period=weekly'),
      api('/api/orders?limit=7'),
    ]);

    if (dash.status === 'fulfilled') setD(dash.value);
    if (sellers.status === 'fulfilled') setBest(sellers.value.products.slice(0, 5));
    if (orders.status === 'fulfilled') setRecent(orders.value.orders.slice(0, 7));

    const failed = [dash, sellers, orders].filter((r) => r.status === 'rejected');
    setError(failed.length === 3 ? failed[0].reason.message : '');
    if (dash.status === 'rejected') throw dash.reason;   // lets the poll back off
  }, []);

  const { at, failing } = usePoll(load, 20000);

  if (error && !d) return <Alert>{error}</Alert>;
  if (!d) return <ConsoleSkeleton />;

  const days = d.last7Days || [];
  const earlier = days.slice(0, -1);
  const average = earlier.length
    ? Math.round(earlier.reduce((s, x) => s + x.total, 0) / earlier.length)
    : 0;
  const delta = average ? Math.round(((d.salesToday - average) / average) * 100) : null;

  const waiting = d.byStage.cashier + d.byStage.accounts + d.byStage.store;
  const avgOrder = d.ordersToday ? Math.round(d.salesToday / d.ordersToday) : 0;

  return (
    <>
      <div className="console-head">
        <div>
          <h1>The shop today</h1>
          <p className="page-meta">
            Everything moving through the counter, {new Date().toLocaleDateString('en-GB',
              { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <div className="console-tools">
          <span className={`fresh ${failing ? 'stale' : ''}`}>{freshness(at, failing)}</span>
          <Link className="btn btn-ghost btn-sm" href="/manager/reports">Reports</Link>
          <Link className="btn btn-primary btn-sm" href="/manager/orders">All orders</Link>
        </div>
      </div>

      <Alert>{error}</Alert>

      {/* ── The row of figures ─────────────────────────────────────── */}
      <div className="kpis">
        <Kpi label="Sales today" value={money(d.salesToday)} delta={delta} note="vs daily average" big />
        <Kpi label="Orders today" value={String(d.ordersToday)} note={`${waiting} still open`} />
        <Kpi label="Average order" value={money(avgOrder)} note="per order today" />
        <Kpi label="Waiting on a desk" value={String(waiting)} note="cashier, accounts, store" tone={waiting ? 'warn' : ''} />
        <Kpi label="Low on stock" value={String(d.lowStock.length)} note="at or below reorder" tone={d.lowStock.length ? 'bad' : ''} />
      </div>

      {/* ── Trajectory and funnel ──────────────────────────────────── */}
      <div className="grid-2">
        <Panel title="Takings — last 7 days" note="Verified sales only">
          <Trajectory days={days} average={average} />
        </Panel>

        <Panel title="Where orders are" note="Every open order, by desk">
          <Funnel byStage={d.byStage} />
        </Panel>
      </div>

      {/* ── Mix, sellers, and what just happened ───────────────────── */}
      <div className="grid-3">
        <Panel title="How today was paid">
          <Mix byMethod={d.byMethod} />
        </Panel>

        <Panel title="Best sellers" note="This week, by revenue">
          <Sellers rows={best} />
        </Panel>

        <Panel title="Latest orders" link={{ href: '/manager/orders', label: 'All orders' }}>
          <Latest rows={recent} />
        </Panel>
      </div>

      {d.lowStock.length > 0 && (
        <Panel
          title={`Running low — ${d.lowStock.length} ${d.lowStock.length === 1 ? 'product' : 'products'}`}
          link={{ href: '/manager/products', label: 'Open products' }}
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
        </Panel>
      )}
    </>
  );
}

/* ── Pieces ───────────────────────────────────────────────────────── */

function Kpi({ label, value, delta, note, tone, big }) {
  return (
    <div className={`kpi ${big ? 'kpi-lead' : ''} ${tone ? `kpi-${tone}` : ''}`}>
      <span className="kpi-label">{label}</span>
      <strong className="kpi-value">{value}</strong>
      <span className="kpi-foot">
        {delta !== null && delta !== undefined && (
          <span className={`tag ${delta >= 0 ? 'up' : 'down'}`}>
            {delta >= 0 ? '▲' : '▼'} {Math.abs(delta)}%
          </span>
        )}
        {note}
      </span>
    </div>
  );
}

function Panel({ title, note, link, children }) {
  return (
    <section className="panel">
      <header className="panel-head">
        <div>
          <h2>{title}</h2>
          {note && <span>{note}</span>}
        </div>
        {link && <Link className="panel-link" href={link.href}>{link.label} →</Link>}
      </header>
      <div className="panel-body">{children}</div>
    </section>
  );
}

/** Seven bars. One series, so no legend — the title names it. */
function Trajectory({ days, average }) {
  const [picked, setPicked] = useState(null);
  if (!days.length) return <p className="none">No verified sales in the last week.</p>;

  const max = Math.max(1, ...days.map((d) => d.total));
  const active = picked ?? days.length - 1;
  const chosen = days[active];
  const dayName = (iso) => {
    const d = new Date(iso + 'T00:00:00');
    return Number.isNaN(d.getTime()) ? String(iso).slice(5)
      : d.toLocaleDateString('en-GB', { weekday: 'short' });
  };

  return (
    <>
      <div className="read">
        <strong>{money(chosen.total)}</strong>
        <span>{dayName(chosen.day)} {String(chosen.day).slice(5)} · {chosen.receipts} receipts</span>
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
            <span className="bar" style={{ height: `${3 + (d.total / max) * 97}%` }} />
            <span className="bar-day">{dayName(d.day)}</span>
          </button>
        ))}
      </div>
    </>
  );
}

/**
 * The pipeline as a funnel, which is what it is: every order enters at
 * the cashier and leaves from the store, and the width of each bar is
 * how many are sitting there now.
 */
function Funnel({ byStage }) {
  const steps = [
    { key: 'cashier', label: 'At the cashier', hint: 'waiting to pay', status: 'pending_payment' },
    { key: 'accounts', label: 'At accounts', hint: 'payment being checked', status: 'paid' },
    { key: 'store', label: 'At the store', hint: 'being picked', status: 'payment_verified' },
    { key: 'done', label: 'Released', hint: 'with the customer', status: 'released' },
  ];
  const max = Math.max(1, ...steps.map((s) => byStage[s.key] ?? 0));

  return (
    <ol className="funnel">
      {steps.map((s, i) => {
        const n = byStage[s.key] ?? 0;
        return (
          <li key={s.key}>
            <Link href={`/manager/orders?status=${s.status}`}>
              <span className="fn-n">{i + 1}</span>
              <span className="fn-text">
                <b>{s.label}</b>
                <em>{s.hint}</em>
              </span>
              <span className="fn-track">
                <span className={`fn-fill ${n > 0 && s.key !== 'done' ? 'busy' : ''}`}
                  style={{ width: `${Math.max(3, (n / max) * 100)}%` }} />
              </span>
              <span className="fn-count">{n}</span>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}

/** Three figures that add up to the total, so one bar and a key. */
function Mix({ byMethod }) {
  const parts = [
    { key: 'cash', label: 'Cash', value: byMethod.cash, tone: 'a' },
    { key: 'mobile_money', label: 'Mobile Money', value: byMethod.mobile_money, tone: 'b' },
    { key: 'card', label: 'Card', value: byMethod.card, tone: 'c' },
  ];
  const total = parts.reduce((s, p) => s + p.value, 0);
  if (!total) return <p className="none">Nothing taken yet today.</p>;

  return (
    <>
      <div className="mix" role="img" aria-label={parts.map((p) => `${p.label} ${money(p.value)}`).join(', ')}>
        {parts.filter((p) => p.value > 0).map((p) => (
          <span key={p.key} className={`mix-part mix-${p.tone}`} style={{ flexGrow: p.value }} />
        ))}
      </div>
      <ul className="mix-key">
        {parts.map((p) => (
          <li key={p.key}>
            <span className={`dot mix-${p.tone}`} />
            <span className="mix-name">{p.label}</span>
            <span className="mix-pct">{Math.round((p.value / total) * 100)}%</span>
            <span className="mix-val">{money(p.value)}</span>
          </li>
        ))}
      </ul>
    </>
  );
}

function Sellers({ rows }) {
  if (!rows) return <p className="none">Loading…</p>;
  if (!rows.length) return <p className="none">Nothing sold this week yet.</p>;
  const max = Math.max(...rows.map((r) => r.revenue), 1);

  return (
    <ul className="ranked">
      {rows.map((r) => (
        <li key={r.product_id}>
          <span className="rk-name" title={r.product_name}>{r.product_name}</span>
          <span className="rk-track">
            <span className="rk-fill" style={{ width: `${(r.revenue / max) * 100}%` }} />
          </span>
          <span className="rk-qty">{r.qty_sold} {r.unit}</span>
          <span className="rk-val">{shortMoney(r.revenue)}</span>
        </li>
      ))}
    </ul>
  );
}

function Latest({ rows }) {
  if (!rows) return <p className="none">Loading…</p>;
  if (!rows.length) return <p className="none">No orders yet.</p>;

  return (
    <ul className="feed">
      {rows.map((o) => (
        <li key={o.id}>
          <Link href={`/manager/orders/${o.id}`}>
            <span className="fd-no">{o.order_no}</span>
            <span className="fd-who">{o.company_name || o.ordered_by_name}</span>
            <Chip status={o.status}>{statusLabel(o.status)}</Chip>
            <span className="fd-amt">{money(o.total)}</span>
            <span className="fd-at">{time(o.created_at)}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function ConsoleSkeleton() {
  return (
    <>
      <div className="console-head"><h1>The shop today</h1></div>
      <div className="kpis">
        {[0, 1, 2, 3, 4].map((i) => <div key={i} className="kpi skel-block" style={{ height: 96 }} />)}
      </div>
      <div className="grid-2">
        <div className="skel-block" style={{ height: 250 }} />
        <div className="skel-block" style={{ height: 250 }} />
      </div>
    </>
  );
}
