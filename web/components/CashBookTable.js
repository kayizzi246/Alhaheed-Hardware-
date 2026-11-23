'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { money, time, list } from '@/lib/format';
import { Empty, Loading, Table, TableWrap, Td, Th, Tr } from '@/components/ui';

/**
 * The day's cash book, with a running balance.
 *
 * Payments the cashiers take are written here automatically; anything
 * else — a float, a bank deposit, transport, a supplier paid out of
 * the drawer — is added by hand on the cash book page.
 */
export default function CashBookTable({ date }) {
  const [book, setBook] = useState(null);

  useEffect(() => {
    api(`/api/accounts/cash-book${date ? `?date=${date}` : ''}`)
      .then(setBook)
      .catch(() => setBook({ entries: [], opening: 0, closing: 0 }));
  }, [date]);

  if (!book) return <Loading>Loading the cash book…</Loading>;

  const entries = list(book.entries);
  const totalIn = entries.reduce((n, e) => n + Number(e.cash_in || 0), 0);
  const totalOut = entries.reduce((n, e) => n + Number(e.cash_out || 0), 0);

  if (!entries.length) {
    return (
      <Empty title="Nothing booked yet">
        Payments the cashiers take are written here automatically.
      </Empty>
    );
  }

  return (
    <TableWrap>
      <Table>
        <thead>
          <tr>
            <Th>Details</Th><Th num>Cash in</Th><Th num>Cash out</Th><Th num>Balance</Th>
          </tr>
        </thead>
        <tbody>
          <Tr>
            <Td className="text-ink-muted">Opening balance</Td>
            <Td num /><Td num />
            <Td num className="font-semibold text-ink">{money(book.opening)}</Td>
          </Tr>

          {entries.map((e) => (
            <Tr key={e.id}>
              <Td>
                <span className="tnum text-ink-muted">{time(e.created_at)}</span>
                <span className="mx-1.5 text-ink-faint">·</span>
                <span className="text-ink">{e.details}</span>
                {e.recorded_by_name && (
                  <span className="block text-xs text-ink-muted">{e.recorded_by_name}</span>
                )}
              </Td>
              <Td num className={e.cash_in ? 'font-semibold text-ok' : 'text-ink-faint'}>
                {e.cash_in ? Number(e.cash_in).toLocaleString('en-UG') : ''}
              </Td>
              <Td num className={e.cash_out ? 'font-semibold text-bad' : 'text-ink-faint'}>
                {e.cash_out ? Number(e.cash_out).toLocaleString('en-UG') : ''}
              </Td>
              <Td num className="text-ink">{Number(e.balance ?? 0).toLocaleString('en-UG')}</Td>
            </Tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-surface-2">
            <Td className="font-bold text-ink">Closing balance</Td>
            <Td num className="font-bold text-ok">{totalIn.toLocaleString('en-UG')}</Td>
            <Td num className="font-bold text-bad">{totalOut.toLocaleString('en-UG')}</Td>
            <Td num className="font-display text-[15px] font-extrabold text-ink">{money(book.closing)}</Td>
          </tr>
        </tfoot>
      </Table>
    </TableWrap>
  );
}
