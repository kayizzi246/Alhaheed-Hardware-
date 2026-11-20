'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { money, time } from '@/lib/format';
import { Empty } from './ui';

/** The day's cash book with a running balance, as on Fig 9. */
export default function CashBookTable({ date }) {
  const [book, setBook] = useState(null);

  useEffect(() => {
    api(`/api/accounts/cash-book${date ? `?date=${date}` : ''}`).then(setBook).catch(() => {});
  }, [date]);

  if (!book) return <div className="loading">Loading cash book…</div>;

  return (
    <table>
      <thead>
        <tr>
          <th>Details</th>
          <th className="num">Cash In</th>
          <th className="num">Cash Out</th>
          <th className="num">Balance</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Opening balance</td>
          <td className="num" />
          <td className="num" />
          <td className="num"><strong>{money(book.opening)}</strong></td>
        </tr>
        {book.entries.map((e) => (
          <tr key={e.id}>
            <td>
              {time(e.created_at)} &middot; {e.details}
              <div className="sub">{e.recorded_by_name}</div>
            </td>
            <td className="num" style={{ color: 'var(--green)' }}>
              {e.cash_in ? Number(e.cash_in).toLocaleString('en-UG') : ''}
            </td>
            <td className="num" style={{ color: 'var(--red)' }}>
              {e.cash_out ? Number(e.cash_out).toLocaleString('en-UG') : ''}
            </td>
            <td className="num">{Number(e.balance).toLocaleString('en-UG')}</td>
          </tr>
        ))}
        <tr>
          <td><strong>Closing balance</strong></td>
          <td className="num"><strong>{Number(book.totalIn).toLocaleString('en-UG')}</strong></td>
          <td className="num"><strong>{Number(book.totalOut).toLocaleString('en-UG')}</strong></td>
          <td className="num"><strong>{money(book.closing)}</strong></td>
        </tr>
      </tbody>
    </table>
  );
}
