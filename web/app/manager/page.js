'use client';

import { useCallback, useState } from 'react';
import { ApprovalsCard } from '@/components/Approvals';
import Link from 'next/link';
import { api, peek } from '@/lib/api';
import { money, shortMoney, time, statusLabel, list } from '@/lib/format';
import { cn } from '@/lib/cn';
import {
  Alert, Button, Card, CardBody, CardHead, CardNote, CardTitle,
  Fresh, Skeleton, StatusChip, Table, TableWrap, Td, Th, Tr } from '@/components/ui';
import { usePoll } from '@/lib/live';
import { Icon } from '@/components/icons';
import { useDismissed } from '@/lib/dismissed';
import { RemoveLine } from '@/components/RemoveLine';

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
  // Started from what this screen showed last time, if anything, so
  // coming back to it is instant; the fresh figures replace it a
  // moment later.
  const [d, setD] = useState(() => peek('/api/manager/dashboard'));
  const [best, setBest] = useState(() => {
    const r = peek('/api/reports/best-sellers?period=weekly');
    return r ? list(r.products).slice(0, 5) : null;
  });
  const [recent, setRecent] = useState(() => {
    const r = peek('/api/orders?limit=7');
    return r ? list(r.orders).slice(0, 7) : null;
  });
  const [error, setError] = useState('');
  const [todo, setTodo] = useState(() => peek('/api/manager/stock/control')?.todo || null);
  const [credit, setCredit] = useState(() => peek('/api/credit') || null);
  const { hide, visible } = useDismissed();

  const load = useCallback(async () => {
    const [dash, sellers, orders, stock, owed] = await Promise.allSettled([
      api('/api/manager/dashboard'),
      api('/api/reports/best-sellers?period=weekly'),
      api('/api/orders?limit=7'),
      api('/api/manager/stock/control'),
      api('/api/credit'),
    ]);
    if (stock.status === 'fulfilled') setTodo(list(stock.value.todo));
    if (owed.status === 'fulfilled') setCredit(owed.value);

    if (dash.status === 'fulfilled') setD(dash.value);
    if (sellers.status === 'fulfilled') setBest(list(sellers.value.products).slice(0, 5));
    if (orders.status === 'fulfilled') setRecent(list(orders.value.orders).slice(0, 7));

    const failed = [dash, sellers, orders].filter((r) => r.status === 'rejected');
    setError(failed.length === 3 ? failed[0].reason.message : '');
    if (dash.status === 'rejected') throw dash.reason; // lets the poll back off
  }, []);

  const { at, failing } = usePoll(load, 20000);

  if (error && !d) return <Alert>{error}</Alert>;
  if (!d) return <ConsoleSkeleton />;

  const days = list(d.last7Days);
  const earlier = days.slice(0, -1);
  const average = earlier.length
    ? Math.round(earlier.reduce((s, x) => s + x.total, 0) / earlier.length)
    : 0;
  const delta = average ? Math.round(((d.salesToday - average) / average) * 100) : null;

  const stage = d.byStage || {};
  const waiting = (stage.cashier || 0) + (stage.accounts || 0) + (stage.store || 0);
  const avgOrder = d.ordersToday ? Math.round(d.salesToday / d.ordersToday) : 0;
  const low = list(d.lowStock);
  const shown = visible(todo);

  return (
    <>
      <header className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[17px] leading-tight text-ink">Today</h1>
          <p className="text-[11.5px] text-ink-muted">
            {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Fresh at={at} failing={failing} />
          <Button asChild variant="outline" size="sm"><Link href="/manager/reports">Reports</Link></Button>
          <Button asChild size="sm"><Link href="/manager/orders">All orders</Link></Button>
        </div>
      </header>

      {/* The owner's short list: what is wrong, in plain words. */}
      {shown.length > 0 && (
        <section className="mb-3 overflow-hidden rounded-xl border border-line bg-surface">
          <div className="flex items-center justify-between gap-3 border-b border-line px-3.5 py-2">
            <h2 className="flex items-center gap-2 text-[12px] font-bold text-ink">
              Check these
              <span className="tnum rounded-full bg-bad-bg px-2 py-px text-[11.5px] font-bold text-bad">{shown.length}</span>
            </h2>
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => hide(shown.map((t) => t.text))} className="text-[11.5px] font-semibold text-ink-muted hover:text-bad hover:underline">Remove all</button>
              <Link href="/manager/stock" className="text-[11.5px] font-semibold text-brand hover:underline">See all</Link>
            </div>
          </div>
          <ul className="divide-y divide-line">
            {shown.slice(0, 5).map((t) => (
              <li key={t.text} className="flex items-stretch">
                <Link href={t.link.startsWith('#') ? `/manager/stock${t.link}` : t.link} className="flex min-w-0 flex-1 items-center gap-2.5 px-3.5 py-1.5 text-[11.5px] text-ink hover:bg-surface-2">
                  <span aria-hidden="true" className={cn('grid size-5 shrink-0 place-items-center rounded-md text-[11px] font-extrabold', t.level === 'bad' ? 'bg-bad-bg text-bad' : t.level === 'warn' ? 'bg-warn-bg text-warn' : 'bg-info-bg text-info')}>
                    {t.level === 'bad' ? '!' : 'i'}
                  </span>
                  <span className="min-w-0 flex-1">{t.text}</span>
                  <span aria-hidden="true" className="text-ink-faint">›</span>
                </Link>
                <RemoveLine onClick={() => hide([t.text])} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <Alert>{error}</Alert>

      {/* ── The row of figures ─────────────────────────────────────── */}
      {/* Two across on a phone, the day's sales across the top. One per
          row put five tiles between the manager and everything else. */}
      <div className="mb-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-5">
        <Tile hero icon={Icon.cash()} label="Sales today" value={money(d.salesToday)} note={delta === null ? (d.salesToday ? 'first sales this week' : 'nothing yet') : `${delta >= 0 ? '↑' : '↓'} ${Math.abs(delta)}% vs average`} href="/manager/reports" />
        <Tile icon={Icon.receipt()} label="Orders today" value={String(d.ordersToday)} note={waiting ? `${waiting} still open` : 'all done'} href="/manager/orders" />
        <Tile icon={Icon.chart()} label="Average order" value={money(avgOrder)} note="today" />
        <Tile icon={Icon.clock()} label="Waiting" value={String(waiting)} note="cashier, accounts, store" tone={waiting ? 'warn' : 'ok'} href="/manager/orders" />
        <Tile icon={Icon.box()} label="Low on stock" value={String(low.length)} note={low.length ? 'buy soon' : 'all stocked'} tone={low.length ? 'bad' : 'ok'} href="/manager/stock" />
      </div>

      <ApprovalsCard />
      {credit?.summary && <CreditCard c={credit} />}

      {/* ── Trajectory and funnel ──────────────────────────────────── */}
      <div className="mb-3 grid gap-3 xl:grid-cols-2">
        {/* Said plainly, because beside "Sales today" a chart reading
            UGX 0 for today looks like a fault: it only counts a payment
            once Accounts has checked it. */}
        <Panel title="Checked money, last 7 days">

          <Trajectory days={days} average={average} />
        </Panel>

        <Panel title="Where orders are">
          <Funnel byStage={stage} />
        </Panel>
      </div>

      {/* ── Mix, sellers, and what just happened ───────────────────── */}
      <div className="mb-3 grid gap-3 xl:grid-cols-3">
        <Panel title="How today was paid">
          <Mix byMethod={d.byMethod || {}} />
        </Panel>

        <Panel title="Best sellers this week">
          <Sellers rows={best} />
        </Panel>

        <Panel title="Latest orders" link={{ href: '/manager/orders', label: 'All orders' }}>
          <Latest rows={recent} />
        </Panel>
      </div>

      {low.length > 0 && (
        <Panel
          title={`Running low: ${low.length} ${low.length === 1 ? 'product' : 'products'}`}
          link={{ href: '/manager/products', label: 'Open products' }}
          flush
        >
          <TableWrap>
            <Table>
              <thead>
                <tr><Th>Product</Th><Th>Code</Th><Th num>Left</Th><Th num>Reorder at</Th></tr>
              </thead>
              <tbody>
                {low.map((p) => (
                  <Tr key={p.id}>
                    <Td className="font-semibold text-ink">{p.name}</Td>
                    <Td className="tnum text-ink-muted">{p.code}</Td>
                    <Td num className={p.stock_available === 0 ? 'font-bold text-bad' : 'font-semibold text-warn'}>
                      {p.stock_available} {p.unit}
                    </Td>
                    <Td num className="text-ink-muted">{p.reorder_level}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        </Panel>
      )}
    </>
  );
}

/* ── Pieces ───────────────────────────────────────────────────────── */

/** Customers who owe the shop: the money out on credit at a glance. */
function CreditCard({ c }) {
  const s = c.summary;
  const top = list(c.accounts).filter((a) => a.owed > 0).slice(0, 4);
  const max = Math.max(1, ...top.map((a) => a.owed));
  const fig = (label, value, tone) => (
    <div className="min-w-0">
      <span className="block text-[11.5px] font-semibold text-ink-muted">{label}</span>
      <b className={cn('tnum block truncate text-[15px] font-extrabold', tone || 'text-ink')}>{value}</b>
    </div>
  );
  return (
    <section className="mb-3 overflow-hidden rounded-xl border border-line bg-surface">
      <div className="flex items-center justify-between border-b border-line px-3.5 py-2">
        <h2 className="text-[13px] font-bold text-ink">Credit customers</h2>
        <Link href="/manager/credit" className="text-[12px] font-semibold text-brand-dark hover:underline">Open credit →</Link>
      </div>
      <div className="grid gap-3 p-3.5 lg:grid-cols-[1.1fr_1fr]">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {fig('Owed to the shop', money(s.owed))}
          {fig('Late', money(s.overdue), s.overdue ? 'text-bad' : 'text-ok')}
          {fig('On credit today', money(s.soldToday))}
          {fig('Paid in today', money(s.paidToday), 'text-ok')}
          <p className="col-span-2 text-[11.5px] text-ink-muted sm:col-span-4">
            {s.owing} owe · {s.overdueCount} late · {s.nearLimit} near their limit · {s.onHold} stopped
          </p>
        </div>
        <ul className="space-y-1.5">
          {!top.length && <li className="text-[12px] text-ink-muted">Nobody owes the shop.</li>}
          {top.map((a) => (
            <li key={a.customerId} className="flex items-center gap-2.5 text-[12px]">
              <span className="w-[110px] shrink-0 truncate text-ink-2">{a.name}</span>
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-sunk">
                <span className={cn('block h-full rounded-full', a.overdue ? 'bg-bad' : 'bg-fill')} style={{ width: `${(a.owed / max) * 100}%` }} />
              </span>
              <span className="tnum w-[92px] shrink-0 text-right font-semibold text-ink">{shortMoney(a.owed)}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** One small figure. Small on purpose: the whole day fits on one screen. */
function Tile({ label, value, note, hero, tone, href, icon }) {
  const chip = hero
    ? 'bg-on-fill/10 text-on-fill'
    : tone === 'bad' ? 'bg-bad-bg text-bad' : tone === 'warn' ? 'bg-warn-bg text-warn' : tone === 'ok' ? 'bg-ok-bg text-ok' : 'bg-brand-soft text-brand';
  const body = (
    <>
      <span className="flex items-center justify-between gap-2">
        <span className={cn('text-[11.5px] font-semibold', hero ? 'text-on-fill/80' : 'text-ink-muted')}>{label}</span>
        {icon && <span className={cn('grid size-7 shrink-0 place-items-center rounded-lg [&>svg]:size-4', chip)}>{icon}</span>}
      </span>
      <span className={cn('tnum mt-1 block truncate font-display text-[18px] font-extrabold leading-tight tracking-tight', hero ? 'text-on-fill' : tone === 'bad' ? 'text-bad' : tone === 'warn' ? 'text-warn' : 'text-ink')}>{value}</span>
      {note && <span className={cn('mt-0.5 block truncate text-[11.5px]', hero ? 'text-on-fill/75' : 'text-ink-muted')}>{note}</span>}
    </>
  );
  const cls = cn(
    'block rounded-xl border px-3.5 py-3 transition-[background-color,transform] duration-150 active:scale-[0.98]',
    hero ? 'border-transparent bg-fill hover:bg-[#86c445]' : 'border-line bg-surface hover:border-line-firm hover:bg-surface-2'
  );
  return href ? <Link href={href} className={cls}>{body}</Link> : <div className={cls}>{body}</div>;
}


function Panel({ title, note, link, flush, children }) {
  return (
    <Card>
      <CardHead className="items-center px-3.5 py-2 sm:px-3.5">
        <div className="min-w-0">
          <CardTitle className="text-[12px]">{title}</CardTitle>
          {note && <CardNote className="text-[11.5px]">{note}</CardNote>}
        </div>
        {link && (
          <Link
            href={link.href}
            className="whitespace-nowrap text-[11.5px] font-semibold text-brand-dark underline-offset-2 hover:underline"
          >
            {link.label} →
          </Link>
        )}
      </CardHead>
      {flush ? children : <CardBody className="p-3.5 sm:p-3.5">{children}</CardBody>}
    </Card>
  );
}

const None = ({ children }) => (
  <p className="py-4 text-center text-[11.5px] text-ink-muted">{children}</p>
);

/** How tall the tallest bar is. A definite height, so a % resolves. */
const TRACK = 90;

/** Seven bars. One series, so no legend — the title names it. */
function Trajectory({ days, average }) {
  const [picked, setPicked] = useState(null);
  const [hover, setHover] = useState(null);
  if (!days.length) return <None>No verified sales in the last week.</None>;

  const max = Math.max(1, ...days.map((d) => d.total));
  const active = hover ?? picked ?? days.length - 1;
  const chosen = days[active];
  const dayName = (iso) => {
    const d = new Date(iso + 'T00:00:00');
    return Number.isNaN(d.getTime())
      ? String(iso).slice(5)
      : d.toLocaleDateString('en-GB', { weekday: 'short' });
  };

  return (
    <>
      <div className="mb-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <strong className="tnum font-display text-[15px] font-extrabold leading-none text-ink">
          {money(chosen.total)}
        </strong>
        <span className="text-[11.5px] text-ink-muted">
          {dayName(chosen.day)} {String(chosen.day).slice(5)} · {chosen.receipts} verified{' '}
          {chosen.receipts === 1 ? 'receipt' : 'receipts'}
        </span>
      </div>

      <div className="relative flex items-end gap-2">
        {average > 0 && (
          // The line sits in its own track, which stops above the day
          // names. Measured against the whole chart it came out 22px
          // low every time and printed "avg UGX 121K" across "Sun".
          <div className="pointer-events-none absolute inset-x-0 top-0" style={{ height: TRACK }}>
            <div
              className="absolute inset-x-0 border-t border-dashed border-line-firm"
              style={{ bottom: `${(average / max) * 100}%` }}
            >
              <span className="absolute -top-[9px] left-0 bg-surface pr-1.5 text-[10.5px] text-ink-faint">
                avg {shortMoney(average)}
              </span>
            </div>
          </div>
        )}

        {days.map((d, i) => (
          <button
            key={d.day}
            type="button"
            onClick={() => setPicked(i)}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
            onFocus={() => setHover(i)}
            onBlur={() => setHover(null)}
            aria-label={`${d.day}: ${money(d.total)}`}
            className="group flex min-w-0 flex-1 flex-col items-stretch gap-1.5"
          >
            <span className="flex items-end" style={{ height: TRACK }}>
              <span
                className={cn(
                  'w-full rounded-md transition-[height,background-color] duration-200 ease-out',
                  i === active ? 'bg-fill' : 'bg-fill/35 group-hover:bg-fill/60'
                )}
                style={{ height: Math.max(4, Math.round((d.total / max) * TRACK)) }}
              />
            </span>
            <span className={cn('text-center text-[11px]', i === active ? 'font-semibold text-ink' : 'text-ink-muted')}>
              {dayName(d.day)}
            </span>
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
    <ol className="space-y-1">
      {steps.map((s, i) => {
        const n = byStage[s.key] ?? 0;
        const busy = n > 0 && s.key !== 'done';
        return (
          <li key={s.key}>
            <Link
              href={`/manager/orders?status=${s.status}`}
              className="flex items-center gap-2.5 rounded-lg px-1.5 py-1 transition-colors duration-150 hover:bg-surface-2"
            >
              <span className={cn('tnum grid size-6 shrink-0 place-items-center rounded-lg text-[11.5px] font-bold', busy ? 'bg-brand-soft text-brand' : 'bg-surface-sunk text-ink-muted')}>
                {i + 1}
              </span>
              <span className="w-[104px] shrink-0">
                <b className="block text-[11.5px] font-semibold text-ink">{s.label}</b>
              </span>
              <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface-sunk">
                <span
                  className={cn(
                    'block h-full rounded-full transition-[width] duration-500 ease-[cubic-bezier(0.23,1,0.32,1)]',
                    busy
                      ? 'bg-[linear-gradient(90deg,rgb(var(--brand)/0.65),rgb(var(--brand)))]'
                      : 'bg-[linear-gradient(90deg,rgb(var(--green)/0.65),rgb(var(--green)))]'
                  )}
                  style={{ width: `${Math.max(3, (n / max) * 100)}%` }}
                />
              </span>
              <span className="tnum w-7 shrink-0 text-right text-[12.5px] font-bold text-ink">{n}</span>
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
    { key: 'cash', label: 'Cash', value: byMethod.cash || 0, colour: 'var(--cat-a)' },
    { key: 'mobile_money', label: 'Mobile Money', value: byMethod.mobile_money || 0, colour: 'var(--cat-b)' },
    { key: 'card', label: 'Card', value: byMethod.card || 0, colour: 'var(--cat-c)' },
  ];
  const total = parts.reduce((s, p) => s + p.value, 0);
  if (!total) return <None>Nothing taken yet today.</None>;

  return (
    <>
      <div
        role="img"
        aria-label={parts.map((p) => `${p.label} ${money(p.value)}`).join(', ')}
        className="flex h-3 gap-[3px]"
      >
        {parts.filter((p) => p.value > 0).map((p) => (
          <span key={p.key} className="rounded-full" style={{ flexGrow: p.value, background: p.colour }} />
        ))}
      </div>

      <ul className="mt-2.5 space-y-1.5">
        {parts.map((p) => (
          <li key={p.key} className="flex items-center gap-2.5 text-[12px]">
            <span className="size-2.5 shrink-0 rounded-full ring-2 ring-surface" style={{ background: p.colour, boxShadow: `0 0 0 3px color-mix(in srgb, ${p.colour} 22%, transparent)` }} />
            <span className="flex-1 text-ink-2">{p.label}</span>
            <span className="tnum text-ink-muted">{Math.round((p.value / total) * 100)}%</span>
            <span className="tnum w-[104px] text-right font-semibold text-ink">{money(p.value)}</span>
          </li>
        ))}
      </ul>
    </>
  );
}

function Sellers({ rows }) {
  if (!rows) return <None>Loading…</None>;
  if (!rows.length) return <None>Nothing sold this week yet.</None>;
  const max = Math.max(...rows.map((r) => r.revenue), 1);

  return (
    <ul className="space-y-1.5">
      {rows.map((r) => (
        <li key={r.product_id} className="flex items-center gap-2.5 text-[11.5px]">
          <span className="w-[116px] shrink-0 truncate text-ink-2" title={r.product_name}>
            {r.product_name}
          </span>
          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-sunk">
            <span className="block h-full rounded-full bg-brand" style={{ width: `${(r.revenue / max) * 100}%` }} />
          </span>
          <span className="tnum w-14 shrink-0 text-right text-ink-muted">{r.qty_sold} {r.unit}</span>
          <span className="tnum w-[70px] shrink-0 text-right font-semibold text-ink">{shortMoney(r.revenue)}</span>
        </li>
      ))}
    </ul>
  );
}

function Latest({ rows }) {
  if (!rows) return <None>Loading…</None>;
  if (!rows.length) return <None>No orders yet.</None>;

  return (
    <ul className="-my-1 divide-y divide-line">
      {rows.slice(0, 5).map((o) => (
        <li key={o.id}>
          <Link
            href={`/manager/orders/${o.id}`}
            className="block rounded-lg px-2 py-1.5 text-[11.5px] transition-colors duration-150 hover:bg-surface-2"
          >
            <span className="flex items-baseline justify-between gap-3">
              <span className="tnum font-bold text-ink">{o.order_no}</span>
              <span className="tnum font-semibold text-ink">{money(o.total)}</span>
            </span>
            <span className="mt-0.5 flex items-center justify-between gap-3">
              <span className="min-w-0 truncate text-[11.5px] text-ink-muted">
                {o.company_name || o.ordered_by_name} · {time(o.created_at)}
              </span>
              <StatusChip status={o.status}>{statusLabel(o.status)}</StatusChip>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function ConsoleSkeleton() {
  return (
    <>
      <h1 className="mb-4 text-[20px] text-ink">The shop today</h1>
      <div className="mb-4 grid grid-cols-2 gap-3 lg:gap-3 xl:grid-cols-5">
        {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className={i === 0 ? 'col-span-2 h-[150px] rounded-2xl sm:col-span-1' : 'h-[150px] rounded-2xl'} />)}
      </div>
      <div className="grid gap-3 xl:grid-cols-2">
        <Skeleton className="h-[250px]" />
        <Skeleton className="h-[250px]" />
      </div>
    </>
  );
}
