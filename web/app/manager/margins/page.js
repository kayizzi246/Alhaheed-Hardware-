'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { money, list } from '@/lib/format';
import { cn } from '@/lib/cn';
import {
  Alert, Card, CardHead, CardTitle, Empty, Field, Input, Loading, LoadFailed, PageHead,
  Table, TableWrap, Td, Th, Tr } from '@/components/ui';

const monthName = (m) => {
  const [y, mo] = m.split('-').map(Number);
  return new Date(y, mo - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
};

/**
 * Is the shop still making money on what it sells?
 *
 * Month by month, without VAT on either side: sales, what the goods
 * cost, the profit, the margin and the zakat on it. A sale counts in
 * the month the goods left the store, at the purchase cost of the day
 * it was sold. Below that, every line sold under cost in the chosen
 * month, item by item, with the order numbers to look them up.
 */
export default function Margins() {
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(null);

  const load = useCallback(async () => {
    try {
      setData(await api(`/api/manager/stock/margins?month=${month}`));
      setError('');
    } catch (e) {
      setError(e.message);
    }
  }, [month]);
  useEffect(() => { load(); }, [load]);

  const months = list(data?.months).slice().reverse();
  const a = data?.alert;
  const below = list(data?.belowCost);

  return (
    <>
      <PageHead
        title="Margins & zakat"
        sub={data ? (data.vatIncluded ? 'Worked out without the 18% VAT, on sales and on cost alike.' : 'Prices are set without VAT, so nothing is taken off.') : ''}
      />
      <Alert>{error}</Alert>

      {a?.raised && (
        <div className="rounded-sm border border-bad/25 bg-bad-bg px-4 py-3 text-[13.5px] text-bad">
          <b>This month&rsquo;s margin is {a.current}%</b>, two points or more under the six-month average of {a.average}%.
          Selling prices may not have gone up with buying prices.
        </div>
      )}

      <Card>
        <CardHead>
          <CardTitle>Month by month</CardTitle>
          <span className="text-[12.5px] text-ink-muted">zakat is 2.5% of each month&rsquo;s profit</span>
        </CardHead>
        {!data ? (
          error ? <LoadFailed onRetry={load}>{error}</LoadFailed> : <Loading>Adding up the months…</Loading>
        ) : (
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>Month</Th><Th num>Sales</Th><Th num>Cost of sales</Th><Th num>Gross profit</Th>
                  <Th num>Margin</Th><Th num>Below cost</Th><Th num>Zakat</Th><Th num>Purchases</Th>
                </tr>
              </thead>
              <tbody>
                {months.map((m) => (
                  <Tr key={m.month} onClick={() => setMonth(m.month)} className={cn('cursor-pointer', m.month === month && 'bg-brand-soft/60')}>
                    <Td className="whitespace-nowrap font-semibold text-ink">{monthName(m.month)}</Td>
                    <Td num>{money(m.sales)}</Td>
                    <Td num className="text-ink-2">{money(m.cost)}</Td>
                    <Td num className={cn('font-semibold', m.profit < 0 ? 'text-bad' : 'text-ink')}>{money(m.profit)}</Td>
                    <Td num className={cn('font-bold', m.margin === null ? 'text-ink-faint' : a?.average !== null && m.margin <= (a?.average ?? 0) - 2 ? 'text-bad' : 'text-ink')}>
                      {m.margin === null ? '' : `${m.margin}%`}
                    </Td>
                    <Td num className={cn(m.belowCost && 'font-semibold text-bad')}>{m.belowCost || ''}</Td>
                    <Td num className="font-semibold text-ink">{m.zakat ? money(m.zakat) : ''}</Td>
                    <Td num className="text-ink-2">{m.purchases ? money(m.purchases) : ''}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </Card>

      <Card>
        <CardHead>
          <CardTitle>Sold below cost</CardTitle>
          <Field label="Month" className="w-[180px]">
            <Input type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} />
          </Field>
        </CardHead>
        {!data ? (
          <Loading>Looking…</Loading>
        ) : !below.length ? (
          <Empty title={`Nothing below cost in ${monthName(month)}`}>Every line sold at or above the latest buy price.</Empty>
        ) : (
          <TableWrap>
            <Table>
              <thead>
                <tr><Th>Item</Th><Th num>Lines</Th><Th num>Qty</Th><Th num>Sold for</Th><Th num>Cost</Th><Th num>Lost</Th></tr>
              </thead>
              <tbody>
                {below.map((g) => (
                  <FragmentRows key={g.productId} g={g} open={open === g.productId} onToggle={() => setOpen(open === g.productId ? null : g.productId)} />
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </Card>
    </>
  );
}

function FragmentRows({ g, open, onToggle }) {
  return (
    <>
      <Tr onClick={onToggle} className="cursor-pointer">
        <Td>
          <span className="block font-semibold text-ink">{g.name}</span>
          <span className="block text-xs text-ink-muted">{g.code} · {open ? 'hide the sales' : 'show the sales'}</span>
        </Td>
        <Td num>{g.lines}</Td>
        <Td num>{g.qty}</Td>
        <Td num>{money(g.sales)}</Td>
        <Td num className="text-ink-2">{money(g.cost)}</Td>
        <Td num className="font-bold text-bad">{money(g.loss)}</Td>
      </Tr>
      {open && list(g.refs).map((r, i) => (
        <tr key={i} className="bg-surface-2 text-[12.5px]">
          <Td className="pl-8 text-ink-2">{r.ref} · {r.day}</Td>
          <Td num />
          <Td num>{r.qty}</Td>
          <Td num>{money(r.price)} each</Td>
          <Td num className="text-ink-2">{money(r.cost)} each</Td>
          <Td num className="text-bad">{money((r.cost - r.price) * r.qty)}</Td>
        </tr>
      ))}
    </>
  );
}
