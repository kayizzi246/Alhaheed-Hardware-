/**
 * The manager's console.
 *
 * Not a desk — nothing queues here. It answers four questions, in the
 * order a shop owner asks them: what came in today, where is work
 * stuck, what are people paying with, and what is about to run out.
 *
 * The charts are drawn by hand rather than pulled from a library,
 * because three small charts do not justify 90KB over a Kampala
 * connection, and because a bar is a div.
 *
 * The three series colours are not three shades of the brand. Two warm
 * hues an orange apart are the same colour to a reader with the common
 * form of colour blindness, so the third steps out of the family —
 * checked rather than assumed.
 */
import * as React from 'react';
import { PackageX, TrendingUp } from 'lucide-react';
import { api, money, shortMoney, CONFIG } from '@/lib/api';
import { usePoll } from '@/lib/usePoll';
import {
  Badge, Card, CardBody, CardHeader, CardNote, CardTitle, Empty, Skeleton, Table, Td, Th,
} from '@/ui';
import { Head, Tiles } from '@/ui/bits';

const STAGES = [
  ['cashier', 'With the cashier', 'Waiting to pay'],
  ['accounts', 'With accounts', 'Payment being checked'],
  ['store', 'With the store', 'Paid, waiting to be packed'],
  ['done', 'Released', 'Gone out the door'],
];

const SERIES = [
  ['cash', 'Cash', 'var(--ah-cat-a)'],
  ['mobile_money', 'Mobile Money', 'var(--ah-cat-b)'],
  ['card', 'Card', 'var(--ah-cat-c)'],
];

export default function Manager() {
  const [data, setData] = React.useState(null);

  const load = React.useCallback(async () => {
    setData(await api('/manager/dashboard'));
  }, []);

  const poll = usePoll(load, 15000);
  const d = data || {};
  const stages = d.byStage || {};
  const inFlight = (stages.cashier || 0) + (stages.accounts || 0) + (stages.store || 0);

  return (
    <>
      <Head
        title={CONFIG.shop.name}
        sub={`${CONFIG.user.name} · the whole shop, today`}
        fresh={{ at: poll.at, failing: poll.failing }}
      />

      <Tiles
        loading={!poll.ready}
        items={[
          { label: 'Taken today', value: shortMoney(d.salesToday), lead: true, note: money(d.salesToday) },
          { label: 'Orders today', value: d.ordersToday ?? 0 },
          { label: 'In the system', value: inFlight, note: 'not yet out the door' },
          { label: 'Running low', value: (d.lowStock || []).length, note: 'at or below reorder level' },
        ]}
      />

      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <Trajectory days={d.last7Days} ready={poll.ready} />
        <Mix byMethod={d.byMethod} ready={poll.ready} />
        <Funnel stages={stages} ready={poll.ready} />
        <LowStock items={d.lowStock} ready={poll.ready} />
      </div>
    </>
  );
}

/* ── Seven days ──────────────────────────────────────────────────── */

/** How tall the tallest bar is, in pixels. */
const TRACK = 150;

function Trajectory({ days, ready }) {
  const rows = days || [];
  const peak = Math.max(1, ...rows.map((r) => Number(r.total || 0)));
  const week = rows.reduce((n, r) => n + Number(r.total || 0), 0);

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Takings, last seven days</CardTitle>
          <CardNote>{money(week)} over the week · verified payments only</CardNote>
        </div>
      </CardHeader>
      <CardBody>
        {!ready ? (
          <Skeleton className="h-[188px]" />
        ) : (
          <div className="flex items-end gap-2">
            {rows.map((r) => {
              // The track is a fixed number of pixels and the bar is a
              // fraction of it, worked out here. A percentage height
              // inside a flex column resolves to nothing, because the
              // parent's height is not definite — which is exactly how
              // a chart ends up as a row of labels with no bars.
              const px = Math.round((Number(r.total || 0) / peak) * TRACK);
              const label = new Date(`${r.day}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'short' });
              return (
                <div key={r.day} className="group flex min-w-0 flex-1 flex-col items-center gap-1.5">
                  <span className="tnum text-[11px] font-semibold text-muted-foreground">
                    {Number(r.total) ? shortMoney(r.total).replace(`${CONFIG.shop.currency} `, '') : ''}
                  </span>
                  <div className="flex w-full items-end" style={{ height: TRACK }}>
                    <div
                      title={`${label}: ${money(r.total)} from ${r.receipts} ${r.receipts === 1 ? 'receipt' : 'receipts'}`}
                      className="w-full rounded-t-[3px] bg-[hsl(var(--ah-cat-a))] transition-[height,opacity] duration-200 group-hover:opacity-85"
                      // A day with nothing still gets a sliver, so the
                      // row reads as seven days rather than four.
                      style={{ height: Math.max(px, Number(r.total) ? 6 : 2) }}
                    />
                  </div>
                  <span className="text-[11px] text-muted-foreground">{label}</span>
                </div>
              );
            })}
          </div>
        )}
      </CardBody>
    </Card>
  );
}

/* ── What they paid with ─────────────────────────────────────────── */

function Mix({ byMethod, ready }) {
  const m = byMethod || {};
  const total = SERIES.reduce((n, [k]) => n + Number(m[k] || 0), 0);

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>How they paid</CardTitle>
          <CardNote>{total ? money(total) : 'Nothing taken yet today'}</CardNote>
        </div>
      </CardHeader>
      <CardBody>
        {!ready ? (
          <Skeleton className="h-[188px]" />
        ) : (
          <>
            <div className="flex h-2.5 overflow-hidden rounded-full bg-muted">
              {SERIES.map(([k, , colour]) => {
                const pct = total ? (Number(m[k] || 0) / total) * 100 : 0;
                return pct > 0 ? (
                  <div key={k} style={{ width: `${pct}%`, background: `hsl(${colour})` }} />
                ) : null;
              })}
            </div>
            <ul className="mt-4 space-y-3">
              {SERIES.map(([k, label, colour]) => {
                const v = Number(m[k] || 0);
                const pct = total ? Math.round((v / total) * 100) : 0;
                return (
                  <li key={k} className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2.5 text-[13.5px]">
                      <span className="size-2.5 rounded-sm" style={{ background: `hsl(${colour})` }} />
                      {label}
                    </span>
                    <span className="tnum text-[13.5px]">
                      <span className="font-semibold">{money(v)}</span>
                      <span className="ml-2 text-muted-foreground">{pct}%</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </CardBody>
    </Card>
  );
}

/* ── Where the work is ───────────────────────────────────────────── */

function Funnel({ stages, ready }) {
  const peak = Math.max(1, ...STAGES.map(([k]) => Number(stages[k] || 0)));

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Where orders are sitting</CardTitle>
          <CardNote>A number that keeps growing is a desk that needs help.</CardNote>
        </div>
      </CardHeader>
      <CardBody className="space-y-3.5">
        {!ready ? (
          <><Skeleton className="h-10" /><Skeleton className="h-10" /><Skeleton className="h-10" /></>
        ) : (
          STAGES.map(([k, label, note]) => {
            const n = Number(stages[k] || 0);
            return (
              <div key={k}>
                <div className="mb-1.5 flex items-baseline justify-between gap-3">
                  <span className="text-[13.5px] font-semibold">{label}</span>
                  <span className="tnum text-[13.5px] font-bold">{n}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className={k === 'done' ? 'h-full rounded-full bg-success' : 'h-full rounded-full bg-primary'}
                    style={{ width: `${Math.max((n / peak) * 100, n ? 3 : 0)}%` }}
                  />
                </div>
                <p className="mt-1 text-[11.5px] text-muted-foreground">{note}</p>
              </div>
            );
          })
        )}
      </CardBody>
    </Card>
  );
}

/* ── What is about to run out ────────────────────────────────────── */

function LowStock({ items, ready }) {
  const rows = items || [];
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Running low</CardTitle>
          <CardNote>At or below the reorder level set on the product.</CardNote>
        </div>
        {rows.length > 0 && <Badge tone="pending">{rows.length}</Badge>}
      </CardHeader>
      {!ready ? (
        <CardBody><Skeleton className="h-[160px]" /></CardBody>
      ) : rows.length === 0 ? (
        <Empty icon={TrendingUp} title="Everything is stocked">
          Nothing has fallen to its reorder level.
        </Empty>
      ) : (
        <div className="max-h-[320px] overflow-auto">
          <Table>
            <thead>
              <tr><Th>Product</Th><Th>Code</Th><Th right>Left</Th><Th right>Reorder at</Th></tr>
            </thead>
            <tbody>
              {rows.slice(0, 40).map((p) => {
                const out = Number(p.stock_available ?? 0) <= 0;
                return (
                  <tr key={p.id}>
                    <Td className="font-medium">
                      {p.name}
                      {out && <PackageX className="ml-2 inline size-3.5 align-[-2px] text-destructive" />}
                    </Td>
                    <Td className="text-muted-foreground">{p.code || p.sku || ''}</Td>
                    <Td right className={out ? 'font-bold text-destructive' : 'font-semibold text-warning'}>
                      {Number(p.stock_available ?? 0)} {p.unit || ''}
                    </Td>
                    <Td right className="text-muted-foreground">{Number(p.reorder_level ?? 0)}</Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </div>
      )}
    </Card>
  );
}
