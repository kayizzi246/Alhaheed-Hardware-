'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api, peek } from '@/lib/api';
import { money, shortMoney, list } from '@/lib/format';
import { cn } from '@/lib/cn';
import {
  Alert, Card, CardHead, CardTitle, Chip, Empty, Loading, LoadFailed, PageHead, Segmented,
  Stat, Stats, Table, TableWrap, Td, Th, Tr } from '@/components/ui';
import { Icon } from '@/components/icons';

const monthName = (m) => {
  if (!m) return '';
  const [y, mo] = m.split('-').map(Number);
  return new Date(y, mo - 1, 1).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
};

const days = (d) => (d === null || d === undefined ? 'Not selling' : d > 365 ? 'Over a year' : `${d} days`);

/**
 * Stock control at a glance.
 *
 * Every figure is the stock book added up as it stands now: what is
 * on the shelf and what it is worth, what to order before it runs out,
 * what is sitting there not selling, what has gone below zero, and
 * whether the shop is still making its margin.
 */
export default function StockControl() {
  const [data, setData] = useState(() => peek('/api/manager/stock/control'));
  const [error, setError] = useState('');
  const [slowShow, setSlowShow] = useState('all');
  const [slowAll, setSlowAll] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await api('/api/manager/stock/control'));
      setError('');
    } catch (e) {
      setError(e.message);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  if (!data) {
    return (
      <>
        <PageHead title="Stock" />
        <Card>{error ? <LoadFailed onRetry={load}>{error}</LoadFailed> : <Loading>Adding up the stock book…</Loading>}</Card>
      </>
    );
  }

  const s = data.summary;
  const m = data.margin;
  const slow = list(data.slow).filter((i) => slowShow === 'all' || (slowShow === 'dead' ? i.dead : i.slow && !i.dead));
  const delta = m.thisMonth.margin !== null && m.lastMonth?.margin !== null && m.lastMonth?.margin !== undefined
    ? Math.round((m.thisMonth.margin - m.lastMonth.margin) * 10) / 10
    : null;

  return (
    <div className="space-y-5">
      <PageHead title="Stock" sub="Your stock, what to buy, and what is lost." />
      <Alert>{error}</Alert>

      <Card>
        <CardHead>
          <CardTitle>Check these</CardTitle>
          <span className="text-[12.5px] text-ink-muted">{list(data.todo).length ? `${list(data.todo).length} things` : 'all clear'}</span>
        </CardHead>
        {!list(data.todo).length ? (
          <p className="px-4 py-5 text-[14px] text-ok sm:px-6">Nothing needs you. Every item is accounted for, nothing is below zero and the margin is on track.</p>
        ) : (
          <ul className="divide-y divide-line">
            {list(data.todo).map((t, n) => (
              <li key={n}>
                <a href={t.link} className="flex items-start gap-3 px-4 py-3 text-[14px] text-ink hover:bg-surface-2 sm:px-6">
                  <span aria-hidden="true" className={cn('mt-1.5 size-2.5 shrink-0 rounded-full', t.level === 'bad' ? 'bg-bad' : t.level === 'warn' ? 'bg-warn' : 'bg-info')} />
                  <span className="min-w-0 flex-1">{t.text}</span>
                  <span aria-hidden="true" className="text-ink-faint">›</span>
                </a>
              </li>
            ))}
          </ul>
        )}
        <details className="border-t border-line px-4 py-3 text-[13px] text-ink-2 sm:px-6">
          <summary className="cursor-pointer font-semibold text-ink">How stock is counted</summary>
          <ul className="mt-2 list-disc space-y-1 pl-5 leading-relaxed">
            <li><b>Stock = bought − sold.</b> The system adds it up. Nobody types it.</li>
            <li>Goods come in only with a <b>delivery note (FDN)</b>. Goods go out only as a <b>sale</b>, a <b>loss with a reason</b>, or a <b>count</b>.</li>
            <li>Nobody can sell more than the stock, or below the buy price. Only you can allow it, with a reason.</li>
            <li>The system puts the buy price on every sale. Nobody types it.</li>
            <li>Only you can change stock, prices or delete things. Everything is saved in History.</li>
            <li>Count your stock <b>every month</b>. Anything missing shows below as lost.</li>
          </ul>
        </details>
      </Card>

      {m.alert.raised && (
        <div className="rounded-sm border border-bad/25 bg-bad-bg px-4 py-3 text-[13.5px] text-bad">
          <b>Margin is falling.</b> This month is {m.alert.current}%, against a six-month average of {m.alert.average}%.{' '}
          <Link href="/manager/margins" className="font-semibold underline">See the sales below cost</Link>
        </div>
      )}

      <Stats>
        <Stat label="Stock value at cost" value={money(s.stockValue)} icon={Icon.box()} hero />
        <Stat label="In stock" value={`${s.inStock} of ${s.items}`} note={`${s.outOfStock} out of stock`} icon={Icon.check()} tone="ok" />
        <Stat label="Days of stock" value={days(s.daysOfStock)} note="at the last 90 days' sales" icon={Icon.clock()} tone="neutral" />
        <Stat
          label={`Margin, ${monthName(m.thisMonth.month)}`}
          value={m.thisMonth.margin === null ? 'No sales yet' : `${m.thisMonth.margin}%`}
          note={m.lastMonth ? `${monthName(m.lastMonth.month)}: ${m.lastMonth.margin === null ? 'no sales' : `${m.lastMonth.margin}%`}` : ''}
          delta={delta}
          icon={Icon.chart()}
          tone={m.alert.raised ? 'bad' : 'ok'}
        />
      </Stats>

      {list(data.unreleased).length > 0 && (
        <Card id="unreleased">
          <CardHead>
            <CardTitle>Paid, not given to the customer</CardTitle>
            <Count n={list(data.unreleased).length} tone="bad" />
          </CardHead>
          <TableWrap>
            <Table>
              <thead><tr><Th>Order</Th><Th>Customer</Th><Th num>Total</Th><Th num>Waiting</Th></tr></thead>
              <tbody>
                {list(data.unreleased).map((o) => (
                  <Tr key={o.id}>
                    <Td><Link href={`/manager/orders/${o.id}`} className="tnum font-semibold text-brand hover:underline">{o.orderNo}</Link></Td>
                    <Td className="text-ink">{o.customer}</Td>
                    <Td num className="font-semibold text-ink">{money(o.total)}</Td>
                    <Td num className={cn(o.days >= 3 ? 'font-semibold text-bad' : 'text-ink-2')}>{o.days === null ? '' : `${o.days} ${o.days === 1 ? 'day' : 'days'}`}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        </Card>
      )}

      <div className="grid items-start gap-5 xl:grid-cols-2">
        <Card id="reorder">
          <CardHead>
            <CardTitle>Buy again</CardTitle>
            {list(data.reorder).length > 0
              ? <span className="text-[13px] font-semibold text-ink">{money(s.reorderCost)}</span>
              : <Count n={0} />}
          </CardHead>
          {!list(data.reorder).length ? (
            <AllClear>Nothing to buy now.</AllClear>
          ) : (
            <TableWrap>
              <Table>
                <thead><tr><Th>Item</Th><Th num>Have</Th><Th num>Days left</Th><Th num>Buy</Th></tr></thead>
                <tbody>
                  {list(data.reorder).map((i) => (
                    <Tr key={i.id}>
                      <Td><Item i={i} /></Td>
                      <Td num className={cn('font-semibold', i.book <= 0 ? 'text-bad' : 'text-ink')}>{i.book} {i.unit}</Td>
                      <Td num className={cn(i.daysOfStock !== null && i.daysOfStock < 15 ? 'font-semibold text-bad' : 'text-ink-2')}>
                        {i.daysOfStock === null ? '–' : i.daysOfStock}
                      </Td>
                      <Td num className="font-bold text-ink">{i.suggestedQty || '–'}</Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          )}
        </Card>

        <Card id="negative">
          <CardHead>
            <CardTitle>Below zero</CardTitle>
            <Count n={list(data.negative).length} tone="bad" />
          </CardHead>
          {!list(data.negative).length ? (
            <AllClear>No item is below zero.</AllClear>
          ) : (
            <TableWrap>
              <Table>
                <thead><tr><Th>Item</Th><Th num>Stock</Th><Th>Last sale</Th></tr></thead>
                <tbody>
                  {list(data.negative).map((i) => (
                    <Tr key={i.id}>
                      <Td><Item i={i} /></Td>
                      <Td num className="font-bold text-bad">{i.book} {i.unit}</Td>
                      <Td className="tnum text-ink-2">{i.lastSale || ''}</Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          )}
        </Card>

        <Card>
          <CardHead>
            <CardTitle>Not selling</CardTitle>
            {list(data.slow).length > 0
              ? <span className="text-[13px] font-semibold text-ink">{money(s.slowValue)}</span>
              : <Count n={0} />}
          </CardHead>
          {!list(data.slow).length ? (
            <AllClear>Everything is selling.</AllClear>
          ) : (
            <>
              <div className="border-b border-line px-4 py-3 sm:px-6">
                <Segmented
                  label="Show"
                  value={slowShow}
                  onChange={setSlowShow}
                  options={[
                    { value: 'all', label: 'All' },
                    { value: 'dead', label: 'No sale 6 months' },
                    { value: 'slow', label: 'Too much stock' },
                  ]}
                />
              </div>
              <TableWrap>
                <Table>
                  <thead><tr><Th>Item</Th><Th num>Have</Th><Th num>Value</Th><Th>Last sale</Th></tr></thead>
                  <tbody>
                    {(slowAll ? slow : slow.slice(0, 8)).map((i) => (
                      <Tr key={i.id}>
                        <Td><Item i={i} /></Td>
                        <Td num className="text-ink">{i.book} {i.unit}</Td>
                        <Td num className="font-semibold text-ink">{i.value ? money(i.value) : <span className="font-normal text-ink-muted">–</span>}</Td>
                        <Td className="tnum whitespace-nowrap text-ink-2">{i.lastSale || 'Never'}</Td>
                      </Tr>
                    ))}
                  </tbody>
                </Table>
              </TableWrap>
              {slow.length > 8 && (
                <button type="button" onClick={() => setSlowAll((v) => !v)} className="w-full border-t border-line px-4 py-3 text-[13px] font-semibold text-brand hover:bg-surface-2">
                  {slowAll ? 'Show less' : `Show all ${slow.length}`}
                </button>
              )}
            </>
          )}
        </Card>

        <Card id="losses">
          <CardHead>
            <CardTitle>Lost stock</CardTitle>
            {list(data.losses?.lines).length > 0
              ? <span className="text-[13px] font-semibold text-bad">{money(data.losses.monthValue)} this month</span>
              : <Count n={0} />}
          </CardHead>
          {!list(data.losses?.lines).length ? (
            <AllClear>Nothing lost in 90 days.</AllClear>
          ) : (
            <TableWrap>
              <Table>
                <thead><tr><Th>Date</Th><Th>Item</Th><Th num>Qty</Th><Th num>Value</Th><Th>By</Th></tr></thead>
                <tbody>
                  {list(data.losses.lines).map((l) => (
                    <Tr key={l.id}>
                      <Td className="tnum whitespace-nowrap text-ink-2">{l.date}</Td>
                      <Td>
                        <span className="block font-semibold text-ink">{l.name}</span>
                        <span className="block text-xs text-ink-muted">{[l.what, l.note].filter(Boolean).join(' · ')}</span>
                      </Td>
                      <Td num className="text-ink">{l.qty}</Td>
                      <Td num className="font-semibold text-bad">{l.value ? money(l.value) : ''}</Td>
                      <Td className="whitespace-nowrap text-ink-2">{l.by}</Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          )}
        </Card>

        <Card id="overrides">
          <CardHead>
            <CardTitle>Rules you allowed to break</CardTitle>
            <Count n={list(data.overrides).length} tone="warn" />
          </CardHead>
          {!list(data.overrides).length ? (
            <AllClear>No rules broken in 30 days.</AllClear>
          ) : (
            <ul className="divide-y divide-line">
              {list(data.overrides).map((o) => (
                <li key={o.id} className="px-4 py-3 text-[13.5px] sm:px-6">
                  <p className="font-semibold text-ink">{o.rule === 'below_cost' ? 'Sold below buy price' : 'Sold more than the stock'}</p>
                  <p className="text-ink-2">{o.detail}</p>
                  <p className="text-ink-2">Why: &ldquo;{o.reason}&rdquo;</p>
                  <p className="text-xs text-ink-muted">{o.user_name} · {o.created_at?.slice(0, 16)}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHead>
            <CardTitle>Sold and bought</CardTitle>
            <span className="text-[12.5px] text-ink-muted">each month, without VAT</span>
          </CardHead>
          <div className="px-4 pb-4 pt-3 sm:px-6"><MonthChart months={list(data.months).slice(-6)} /></div>
        </Card>
      </div>
    </div>
  );
}

/** A small count beside a card's title: grey when nothing, coloured when something. */
function Count({ n, tone = 'bad' }) {
  return (
    <span
      className={cn(
        'tnum grid h-6 min-w-6 place-items-center rounded-full px-2 text-[12px] font-bold',
        !n ? 'bg-surface-sunk text-ink-muted' : tone === 'warn' ? 'bg-warn-bg text-warn' : 'bg-bad-bg text-bad'
      )}
    >
      {n}
    </span>
  );
}

/** One green line instead of a big empty box. */
function AllClear({ children }) {
  return (
    <p className="flex items-center gap-2.5 px-4 py-4 text-[14px] font-medium text-ok sm:px-6">
      <svg viewBox="0 0 20 20" aria-hidden="true" className="size-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="10" cy="10" r="8" />
        <path d="M6.5 10.2l2.3 2.3 4.7-5" />
      </svg>
      {children}
    </p>
  );
}


function Item({ i }) {
  return (
    <span className="block min-w-0">
      <span className="block font-semibold text-ink">{i.name}</span>
      <span className="block text-xs text-ink-muted">{[i.code, i.category].filter(Boolean).join(' · ')}</span>
    </span>
  );
}

/** Two bars a month: what was sold, and what was bought in. */
function MonthChart({ months }) {
  const max = Math.max(1, ...months.flatMap((m) => [m.sales, m.purchases]));
  const H = 120;
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-4 text-[12.5px] text-ink-2">
        <span className="inline-flex items-center gap-1.5"><i className="inline-block size-3 rounded-sm bg-fill" />Sales</span>
        <span className="inline-flex items-center gap-1.5"><i className="inline-block size-3 rounded-sm bg-ink-faint/60" />Purchases</span>
      </div>
      <div className="overflow-x-auto">
        <div className="flex min-w-[320px] items-end gap-3" style={{ height: H + 40 }} role="img" aria-label="Sold and bought for the last six months">
          {months.map((m) => (
            <div key={m.month} className="flex flex-1 flex-col items-center gap-1">
              <div className="flex w-full items-end justify-center gap-[3px]" style={{ height: H }}>
                <div
                  className="w-[42%] rounded-t-[3px] bg-fill"
                  style={{ height: Math.max(m.sales ? 2 : 0, (m.sales / max) * H) }}
                  title={`${monthName(m.month)} sales ${money(m.sales)}`}
                />
                <div
                  className="w-[42%] rounded-t-[3px] bg-ink-faint/60"
                  style={{ height: Math.max(m.purchases ? 2 : 0, (m.purchases / max) * H) }}
                  title={`${monthName(m.month)} purchases ${money(m.purchases)}`}
                />
              </div>
              <span className="text-[11px] text-ink-muted">{monthName(m.month).split(' ')[0]}</span>
              <span className="tnum text-[10.5px] text-ink-faint">{m.sales ? shortMoney(m.sales) : ''}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
