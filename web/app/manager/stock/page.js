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
        <PageHead title="Stock control" />
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
    <>
      <PageHead title="Stock control" sub="Worked out from every purchase, sale and count in the stock book." />
      <Alert>{error}</Alert>

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

      <Card>
        <CardHead>
          <CardTitle>Reorder now</CardTitle>
          <span className="text-[12.5px] text-ink-muted">
            {list(data.reorder).length} items{s.reorderCost ? ` · ${money(s.reorderCost)} to order` : ''}
          </span>
        </CardHead>
        {!list(data.reorder).length ? (
          <Empty title="Nothing to reorder">Every item has more than 15 days of stock and is above its target.</Empty>
        ) : (
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>Item</Th><Th num>In stock</Th><Th num>Sells a day</Th><Th num>Days left</Th>
                  <Th num>Target</Th><Th num>Order</Th><Th num>Order cost</Th>
                </tr>
              </thead>
              <tbody>
                {list(data.reorder).map((i) => (
                  <Tr key={i.id}>
                    <Td><Item i={i} /></Td>
                    <Td num className={cn('font-semibold', i.book <= 0 ? 'text-bad' : 'text-ink')}>{i.book} {i.unit}</Td>
                    <Td num>{i.avgDaily || ''}</Td>
                    <Td num className={cn(i.daysOfStock !== null && i.daysOfStock < 15 && 'font-semibold text-bad')}>
                      {i.daysOfStock === null ? '' : i.daysOfStock}
                    </Td>
                    <Td num className="text-ink-muted">{i.minLevel || 'Not set'}</Td>
                    <Td num className="font-bold text-ink">{i.suggestedQty || ''}</Td>
                    <Td num>{i.orderCost ? money(i.orderCost) : i.cost ? '' : <span className="text-ink-muted">No buy price</span>}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </Card>

      <Card>
        <CardHead>
          <CardTitle>Sales and purchases, by month</CardTitle>
          <span className="text-[12.5px] text-ink-muted">without VAT</span>
        </CardHead>
        <div className="p-4 sm:p-6"><MonthChart months={list(data.months)} /></div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHead>
            <CardTitle>Slow and dead stock</CardTitle>
            <span className="text-[12.5px] text-ink-muted">{money(s.slowValue)} at cost</span>
          </CardHead>
          <div className="border-b border-line px-4 py-3 sm:px-6">
            <Segmented
              label="Show"
              value={slowShow}
              onChange={setSlowShow}
              options={[
                { value: 'all', label: 'Both' },
                { value: 'dead', label: 'No sale in 180 days' },
                { value: 'slow', label: 'Over 180 days of stock' },
              ]}
            />
          </div>
          {!slow.length ? (
            <Empty title="Nothing sitting still">Everything on the shelf has sold in the last six months.</Empty>
          ) : (
            <TableWrap>
              <Table>
                <thead><tr><Th>Item</Th><Th num>Qty</Th><Th num>Value</Th><Th>Last sale</Th></tr></thead>
                <tbody>
                  {slow.map((i) => (
                    <Tr key={i.id}>
                      <Td>
                        <Item i={i} />
                        <Chip tone={i.dead ? 'bad' : 'pending'}>{i.dead ? 'Dead' : `${Math.round(i.daysOfStock)} days of stock`}</Chip>
                      </Td>
                      <Td num>{i.book} {i.unit}</Td>
                      <Td num className="font-semibold text-ink">{money(i.value)}</Td>
                      <Td className="tnum whitespace-nowrap text-ink-muted">{i.lastSale || 'Never'}</Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          )}
        </Card>

        <Card>
          <CardHead>
            <CardTitle>Below zero</CardTitle>
            <span className="text-[12.5px] text-ink-muted">sold before the purchase was recorded</span>
          </CardHead>
          {!list(data.negative).length ? (
            <Empty title="Nothing below zero">Every item has at least as much bought as sold.</Empty>
          ) : (
            <TableWrap>
              <Table>
                <thead><tr><Th>Item</Th><Th num>Book stock</Th><Th>Last sale</Th></tr></thead>
                <tbody>
                  {list(data.negative).map((i) => (
                    <Tr key={i.id}>
                      <Td><Item i={i} /></Td>
                      <Td num className="font-bold text-bad">{i.book} {i.unit}</Td>
                      <Td className="tnum text-ink-muted">{i.lastSale || ''}</Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          )}
          {list(data.drift).length > 0 && (
            <p className="border-t border-line px-4 py-3 text-[12.5px] text-ink-muted sm:px-6">
              {list(data.drift).length} {list(data.drift).length === 1 ? 'item has' : 'items have'} a shelf count that differs from the book.
              A <Link href="/manager/stock-take" className="font-semibold text-brand underline">stock-take</Link> settles it.
            </p>
          )}
        </Card>
      </div>
    </>
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
  const H = 180;
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-4 text-[12.5px] text-ink-2">
        <span className="inline-flex items-center gap-1.5"><i className="inline-block size-3 rounded-sm bg-fill" />Sales</span>
        <span className="inline-flex items-center gap-1.5"><i className="inline-block size-3 rounded-sm bg-ink-faint/60" />Purchases</span>
      </div>
      <div className="overflow-x-auto">
        <div className="flex min-w-[560px] items-end gap-2" style={{ height: H + 40 }} role="img" aria-label="Sales and purchases for the last twelve months">
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
