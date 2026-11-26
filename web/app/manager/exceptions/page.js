'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { money, list, today } from '@/lib/format';
import { cn } from '@/lib/cn';
import {
  Alert, Card, CardHead, CardTitle, Empty, Field, Input, Loading, LoadFailed, PageHead,
  Table, TableWrap, Td, Th, Tr } from '@/components/ui';

const back = (days) => new Date(Date.now() - days * 864e5).toISOString().slice(0, 10);
const DESK = { cashier: 'Cashier', accounts: 'Accounts', store: 'Store', manager: 'Manager', customer: 'Customer', left: 'Left' };

/**
 * Who did what out of the ordinary.
 *
 * One person's cancellations, rejected payments, overrides, write-offs,
 * price changes and till differences, beside everyone else's. A single
 * record rarely says much; a pattern across weeks does.
 */
export default function Exceptions() {
  const [from, setFrom] = useState(back(30));
  const [to, setTo] = useState(today());
  const [people, setPeople] = useState(null);
  const [tills, setTills] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const [p, t] = await Promise.all([
        api(`/api/manager/exceptions?from=${from}&to=${to}`),
        api(`/api/manager/tills?from=${from}&to=${to}`),
      ]);
      setPeople(list(p.people));
      setTills(t);
      setError('');
    } catch (e) {
      setError(e.message);
    }
  }, [from, to]);
  useEffect(() => { load(); }, [load]);

  const cell = (n, bad) => <Td num className={cn(n ? (bad ? 'font-bold text-bad' : 'font-semibold text-ink') : 'text-ink-faint')}>{n || '·'}</Td>;

  return (
    <>
      <PageHead title="Staff checks" sub="What each person did that you should check.">
        <Field label="From"><Input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} /></Field>
        <Field label="To"><Input type="date" value={to} min={from} max={today()} onChange={(e) => setTo(e.target.value)} /></Field>
      </PageHead>
      <Alert>{error}</Alert>

      <Card>
        <CardHead><CardTitle>By person</CardTitle><span className="text-[12px] text-ink-muted">most to look at first</span></CardHead>
        {!people ? (
          error ? <LoadFailed onRetry={load}>{error}</LoadFailed> : <Loading>Adding it up…</Loading>
        ) : !people.length ? (
          <Empty title="Nothing unusual">No cancellations, overrides, write-offs or till differences in these dates.</Empty>
        ) : (
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>Person</Th><Th num>Cancelled</Th><Th num>Bad payments</Th><Th num>Rule broken</Th>
                  <Th num>Stock lost</Th><Th num>Value lost</Th><Th num>Price changes</Th><Th num>Deleted</Th><Th num>Cash missing</Th><Th num>Cash extra</Th>
                </tr>
              </thead>
              <tbody>
                {people.map((p) => (
                  <Tr key={p.userId}>
                    <Td><span className="block font-semibold text-ink">{p.name}</span><span className="block text-[11.5px] text-ink-muted">{DESK[p.desk] || ''}</span></Td>
                    {cell(p.cancelled)}
                    {cell(p.rejected, true)}
                    {cell(p.overrides, true)}
                    {cell(p.writeOffs)}
                    <Td num className={cn(p.writeOffValue ? 'font-semibold text-bad' : 'text-ink-faint')}>{p.writeOffValue ? money(p.writeOffValue) : '·'}</Td>
                    {cell(p.priceChanges)}
                    {cell(p.deleted)}
                    <Td num className={cn(p.tillShort < 0 ? 'font-bold text-bad' : 'text-ink-faint')}>{p.tillShort < 0 ? money(-p.tillShort) : '·'}</Td>
                    <Td num className={cn(p.tillOver > 0 ? 'font-semibold text-warn' : 'text-ink-faint')}>{p.tillOver > 0 ? money(p.tillOver) : '·'}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}
        <p className="border-t border-line px-4 py-3 text-[12px] text-ink-muted sm:px-6">
          Too much cash in the till is also a problem. It can mean a sale had no receipt.
        </p>
      </Card>

      {tills && list(tills.notClosed).length > 0 && (
        <Card>
          <CardHead><CardTitle>Days the cash was not counted</CardTitle></CardHead>
          <TableWrap>
            <Table>
              <thead><tr><Th>Date</Th><Th>Cashier</Th><Th num>Cash the book expected</Th></tr></thead>
              <tbody>
                {tills.notClosed.map((n, i) => (
                  <Tr key={i}><Td className="tnum">{n.date}</Td><Td className="font-semibold text-ink">{n.cashier}</Td><Td num className="font-semibold text-bad">{money(n.expected)}</Td></Tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        </Card>
      )}

      <Card>
        <CardHead>
          <CardTitle>Cash counts</CardTitle>
          {tills && <span className="text-[12px] text-ink-muted">short {money(-tills.short)} · over {money(tills.over)}</span>}
        </CardHead>
        {!tills ? (
          <Loading>Loading…</Loading>
        ) : !list(tills.closes).length ? (
          <Empty title="No closings in these dates">Cashiers close the till on their End of day page.</Empty>
        ) : (
          <TableWrap>
            <Table>
              <thead><tr><Th>Date</Th><Th>Cashier</Th><Th num>Expected</Th><Th num>Counted</Th><Th num>Difference</Th><Th>Why</Th></tr></thead>
              <tbody>
                {tills.closes.map((c) => (
                  <Tr key={c.id}>
                    <Td className="tnum">{c.date}</Td>
                    <Td className="font-semibold text-ink">{c.cashier}</Td>
                    <Td num>{money(c.expected)}</Td>
                    <Td num>{money(c.counted)}</Td>
                    <Td num className={cn('font-bold', c.overShort < 0 ? 'text-bad' : c.overShort > 0 ? 'text-warn' : 'text-ok')}>
                      {c.overShort === 0 ? 'Exact' : c.overShort < 0 ? `Short ${money(-c.overShort)}` : `Over ${money(c.overShort)}`}
                    </Td>
                    <Td className="text-ink-2">{c.note}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </Card>
    </>
  );
}
