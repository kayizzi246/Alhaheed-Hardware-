'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import { api, peek } from '@/lib/api';
import { money, shortMoney, time, statusLabel, list } from '@/lib/format';
import { cn } from '@/lib/cn';
import { Icon } from '@/components/icons';
import {
  Alert, Button, Card, CardBody, CardHead, CardNote, CardTitle,
  Fresh, Skeleton, StatusChip, Table, TableWrap, Td, Th, Tr,
} from '@/components/ui';
import { usePoll } from '@/lib/live';

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

  const load = useCallback(async () => {
    const [dash, sellers, orders] = await Promise.allSettled([
      api('/api/manager/dashboard'),
      api('/api/reports/best-sellers?period=weekly'),
      api('/api/orders?limit=7'),
    ]);

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

  return (
    <>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[26px] leading-tight text-ink">The shop today</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Everything moving through the counter,{' '}
            {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Fresh at={at} failing={failing} />
          <Button asChild variant="outline" size="sm"><Link href="/manager/reports">Reports</Link></Button>
          <Button asChild size="sm"><Link href="/manager/orders">All orders</Link></Button>
        </div>
      </header>

      <Alert>{error}</Alert>

      {/* ── The row of figures ─────────────────────────────────────── */}
      {/* Two across on a phone, the day's sales across the top. One per
          row put five tiles between the manager and everything else. */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-5">
        <Kpi
          hero
          label="Sales today"
          value={money(d.salesToday)}
          delta={delta}
          note={delta === null ? (d.salesToday ? 'the first sales this week' : 'nothing taken yet today') : 'vs the daily average'}
          icon={Icon.cash()}
          href="/manager/reports"
          spark={days.map((x) => x.total)}
          className="col-span-2 sm:col-span-1"
        />
        <Kpi
          label="Orders today"
          value={String(d.ordersToday)}
          note={waiting ? `${waiting} still open` : 'all dealt with'}
          icon={Icon.receipt()}
          href="/manager/orders"
        />
        <Kpi
          label="Average order"
          value={money(avgOrder)}
          note="per order today"
          icon={Icon.chart()}
          tone="neutral"
        />
        <Kpi
          label="Waiting on a desk"
          value={String(waiting)}
          note={waiting ? 'at the cashier, accounts or store' : 'nothing waiting'}
          icon={Icon.clock()}
          tone={waiting ? 'warn' : 'ok'}
          href="/manager/orders"
        />
        <Kpi
          label="Low on stock"
          value={String(low.length)}
          note={low.length ? 'at or below the reorder level' : 'everything is stocked'}
          icon={Icon.box()}
          tone={low.length ? 'bad' : 'ok'}
          href="/manager/products"
        />
      </div>

      {/* ── Trajectory and funnel ──────────────────────────────────── */}
      <div className="mb-4 grid gap-4 xl:grid-cols-2">
        {/* Said plainly, because beside "Sales today" a chart reading
            UGX 0 for today looks like a fault: it only counts a payment
            once Accounts has checked it. */}
        <Panel title="Checked takings — last 7 days" note="A payment counts here once Accounts has verified it">

          <Trajectory days={days} average={average} />
        </Panel>

        <Panel title="Where orders are" note="Every open order, by desk">
          <Funnel byStage={stage} />
        </Panel>
      </div>

      {/* ── Mix, sellers, and what just happened ───────────────────── */}
      <div className="mb-4 grid gap-4 xl:grid-cols-3">
        <Panel title="How today was paid">
          <Mix byMethod={d.byMethod || {}} />
        </Panel>

        <Panel title="Best sellers" note="This week, by revenue">
          <Sellers rows={best} />
        </Panel>

        <Panel title="Latest orders" link={{ href: '/manager/orders', label: 'All orders' }}>
          <Latest rows={recent} />
        </Panel>
      </div>

      {low.length > 0 && (
        <Panel
          title={`Running low — ${low.length} ${low.length === 1 ? 'product' : 'products'}`}
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

/**
 * One figure at the top of the dashboard.
 *
 * Read at a glance, then — if it is worth acting on — tapped: each
 * tile that leads somewhere is a link to the screen where you would
 * act on it. The icon's colour carries the state (amber when orders
 * are waiting, red when stock is low, green when all is well) so the
 * number itself stays the one thing to read. The day's sales is the
 * hero, with the week drawn behind it.
 */
const TONES = {
  brand: 'bg-brand-soft text-brand',
  neutral: 'bg-surface-sunk text-ink-muted',
  ok: 'bg-ok-bg text-ok',
  warn: 'bg-warn-bg text-warn',
  bad: 'bg-bad-bg text-bad',
};

function Kpi({ label, value, delta, note, tone = 'brand', icon, href, spark, hero, className }) {
  const Box = href ? Link : 'div';
  return (
    <Box
      {...(href ? { href } : {})}
      className={cn(
        'group relative isolate flex min-w-0 flex-col overflow-hidden rounded-2xl p-4 [container-type:inline-size] sm:p-5',
        'transition-[transform,box-shadow,border-color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)]',
        hero
          ? 'bg-[linear-gradient(135deg,rgb(var(--brand))_0%,rgb(var(--brand-dark))_100%)] text-white shadow-[0_12px_32px_-12px_rgb(var(--brand)/0.55)]'
          : 'border border-line bg-surface shadow-[0_1px_2px_rgb(15_23_42/0.04),0_6px_20px_-12px_rgb(15_23_42/0.12)]',
        href && (hero
          ? 'hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-14px_rgb(var(--brand)/0.65)] active:scale-[0.985]'
          : 'hover:-translate-y-0.5 hover:border-line-firm hover:shadow-[0_2px_4px_rgb(15_23_42/0.05),0_14px_32px_-14px_rgb(15_23_42/0.22)] active:scale-[0.985]'),
        'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-brand/30',
        className
      )}
    >
      {hero && (
        // A soft light in the corner, so the blue has depth rather than
        // being a flat slab.
        <span aria-hidden="true" className="pointer-events-none absolute -right-16 -top-20 -z-10 size-56 rounded-full bg-white/15 blur-3xl" />
      )}

      <div className="flex items-start gap-2.5">
        <span
          className={cn(
            'grid size-9 shrink-0 place-items-center rounded-xl [&>svg]:size-[18px]',
            hero ? 'bg-white/15 text-white ring-1 ring-inset ring-white/20' : TONES[tone]
          )}
        >
          {icon}
        </span>
        <span className={cn('min-w-0 flex-1 pt-[9px] text-[13px] font-semibold leading-tight [overflow-wrap:anywhere]', hero ? 'text-white/85' : 'text-ink-muted')}>
          {label}
        </span>
        {href && (
          <svg
            viewBox="0 0 16 16"
            aria-hidden="true"
            className={cn(
              'mt-[10px] size-4 shrink-0 -translate-x-1 opacity-0 transition-[opacity,transform] duration-200 group-hover:translate-x-0 group-hover:opacity-100',
              hero ? 'text-white/80' : 'text-ink-faint'
            )}
          >
            <path d="M5 11l6-6M6 5h5v5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>

      <strong
        className={cn(
          'tnum mt-4 block font-display font-extrabold leading-none tracking-[-0.03em]',
          String(value).length > 11 ? 'text-[clamp(18px,10.5cqi,30px)]' : 'text-[clamp(24px,15cqi,32px)]',
          hero ? 'text-white' : 'text-ink'
        )}
      >
        {value}
      </strong>

      <span className={cn('mt-3 flex min-w-0 flex-wrap items-center gap-1.5 text-[12.5px]', hero ? 'text-white/80' : 'text-ink-muted')}>
        {delta !== null && delta !== undefined && (
          <span
            className={cn(
              'tnum inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11.5px] font-bold',
              hero
                ? 'bg-white/20 text-white'
                : delta >= 0 ? 'bg-ok-bg text-ok' : 'bg-bad-bg text-bad'
            )}
          >
            <svg viewBox="0 0 12 12" aria-hidden="true" className={cn('size-3', delta < 0 && 'rotate-180')}>
              <path d="M6 2.5v7M3 5.5l3-3 3 3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {Math.abs(delta)}%
          </span>
        )}
        <span className="min-w-0">{note}</span>
      </span>

      {spark && <Sparkline values={spark} />}
    </Box>
  );
}

/**
 * The week, drawn faintly along the bottom of the hero tile. Not for
 * reading values from — the chart below does that — but for seeing at
 * a glance whether today is up or down on the days before it.
 */
function Sparkline({ values }) {
  const max = Math.max(...values, 1);
  const pts = values.map((v, i) => [
    values.length === 1 ? 50 : (i / (values.length - 1)) * 100,
    30 - (v / max) * 24,
  ]);
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
  const [lx, ly] = pts[pts.length - 1];
  return (
    <svg
      viewBox="0 0 100 32"
      preserveAspectRatio="none"
      aria-hidden="true"
      className="pointer-events-none absolute bottom-0 right-0 -z-10 h-[42%] w-[56%]"
    >
      <defs>
        <linearGradient id="kpi-spark" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="white" stopOpacity="0.22" />
          <stop offset="1" stopColor="white" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line} L100,32 L0,32 Z`} fill="url(#kpi-spark)" />
      <path d={line} fill="none" stroke="white" strokeOpacity="0.55" strokeWidth="1.6" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      <circle cx={lx} cy={ly} r="1.6" fill="white" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function Panel({ title, note, link, flush, children }) {
  return (
    <Card>
      <CardHead>
        <div className="min-w-0">
          <CardTitle>{title}</CardTitle>
          {note && <CardNote>{note}</CardNote>}
        </div>
        {link && (
          <Link
            href={link.href}
            className="whitespace-nowrap text-[12.5px] font-semibold text-brand-dark underline-offset-2 hover:underline"
          >
            {link.label} →
          </Link>
        )}
      </CardHead>
      {flush ? children : <CardBody>{children}</CardBody>}
    </Card>
  );
}

const None = ({ children }) => (
  <p className="py-8 text-center text-[13.5px] text-ink-muted">{children}</p>
);

/** How tall the tallest bar is. A definite height, so a % resolves. */
const TRACK = 150;

/** Seven bars. One series, so no legend — the title names it. */
function Trajectory({ days, average }) {
  const [picked, setPicked] = useState(null);
  if (!days.length) return <None>No verified sales in the last week.</None>;

  const max = Math.max(1, ...days.map((d) => d.total));
  const active = picked ?? days.length - 1;
  const chosen = days[active];
  const dayName = (iso) => {
    const d = new Date(iso + 'T00:00:00');
    return Number.isNaN(d.getTime())
      ? String(iso).slice(5)
      : d.toLocaleDateString('en-GB', { weekday: 'short' });
  };

  return (
    <>
      <div className="mb-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <strong className="tnum font-display text-[25px] font-extrabold leading-none text-ink">
          {money(chosen.total)}
        </strong>
        <span className="text-[12.5px] text-ink-muted">
          {dayName(chosen.day)} {String(chosen.day).slice(5)} · {chosen.receipts} verified{' '}
          {chosen.receipts === 1 ? 'receipt' : 'receipts'}
        </span>
      </div>

      <div className="relative flex items-end gap-1.5">
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
            aria-label={`${d.day}: ${money(d.total)}`}
            className="group flex min-w-0 flex-1 flex-col items-stretch gap-1.5"
          >
            <span className="flex items-end" style={{ height: TRACK }}>
              <span
                className={cn(
                  'w-full rounded-t-[3px] transition-[height,background-color] duration-200 ease-out',
                  i === active ? 'bg-brand' : 'bg-brand/35 group-hover:bg-brand/55'
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
              className="flex items-center gap-3 rounded-sm px-2 py-2.5 transition-colors duration-150 hover:bg-surface-2"
            >
              <span className="tnum grid size-6 shrink-0 place-items-center rounded-md bg-surface-sunk text-[11.5px] font-bold text-ink-muted">
                {i + 1}
              </span>
              <span className="w-[128px] shrink-0">
                <b className="block text-[13.5px] font-semibold text-ink">{s.label}</b>
                <em className="block text-[11.5px] not-italic text-ink-muted">{s.hint}</em>
              </span>
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-sunk">
                <span
                  className={cn('block h-full rounded-full', busy ? 'bg-brand' : 'bg-ok')}
                  style={{ width: `${Math.max(3, (n / max) * 100)}%` }}
                />
              </span>
              <span className="tnum w-7 shrink-0 text-right text-sm font-bold text-ink">{n}</span>
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
        className="flex h-2.5 overflow-hidden rounded-full bg-surface-sunk"
      >
        {parts.filter((p) => p.value > 0).map((p) => (
          <span key={p.key} style={{ flexGrow: p.value, background: p.colour }} />
        ))}
      </div>

      <ul className="mt-4 space-y-3">
        {parts.map((p) => (
          <li key={p.key} className="flex items-center gap-2.5 text-[13.5px]">
            <span className="size-2.5 shrink-0 rounded-sm" style={{ background: p.colour }} />
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
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.product_id} className="flex items-center gap-2.5 text-[13px]">
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
    <ul className="-my-1">
      {rows.map((o) => (
        <li key={o.id}>
          <Link
            href={`/manager/orders/${o.id}`}
            className="flex items-center gap-2.5 rounded-sm px-2 py-2 text-[13px] transition-colors duration-150 hover:bg-surface-2"
          >
            {/* One line on a wide screen; on a phone the status drops
                under the name, where it fits instead of pushing the row
                past the edge. */}
            <span className="min-w-0 flex-1 sm:flex sm:items-center sm:gap-2.5">
              <span className="flex min-w-0 items-baseline gap-2.5 sm:flex-1">
                <span className="tnum shrink-0 font-bold text-ink">{o.order_no}</span>
                <span className="min-w-0 truncate text-ink-muted">{o.company_name || o.ordered_by_name}</span>
              </span>
              <span className="mt-1 block sm:mt-0">
                <StatusChip status={o.status}>{statusLabel(o.status)}</StatusChip>
              </span>
            </span>
            <span className="tnum shrink-0 font-semibold text-ink">{money(o.total)}</span>
            <span className="tnum hidden shrink-0 text-ink-faint sm:block">{time(o.created_at)}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function ConsoleSkeleton() {
  return (
    <>
      <h1 className="mb-6 text-[26px] text-ink">The shop today</h1>
      <div className="mb-5 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-5">
        {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className={i === 0 ? 'col-span-2 h-[150px] rounded-2xl sm:col-span-1' : 'h-[150px] rounded-2xl'} />)}
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Skeleton className="h-[250px]" />
        <Skeleton className="h-[250px]" />
      </div>
    </>
  );
}
