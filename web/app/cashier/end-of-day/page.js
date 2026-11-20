'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { money, today } from '@/lib/format';
import { Stat, Card, Alert } from '@/components/ui';

/** What this cashier took in today, for handing over the till. */
export default function EndOfDayPage() {
  const [date, setDate] = useState(today());
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api(`/api/cashier/end-of-day?date=${date}`).then(setData).catch((e) => setError(e.message));
  }, [date]);

  return (
    <>
      <div className="page-head">
        <h1>End of Day</h1>
        <div className="filters">
          <div className="field">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>
      </div>

      <Alert>{error}</Alert>

      {data && (
        <>
          <div className="stats">
            <Stat label="Receipts issued" value={data.receipts} />
            <Stat label="Total collected" value={money(data.total)} tone="green" />
            <Stat label="Cash" value={money(data.cash)} />
            <Stat label="Mobile Money" value={money(data.mobile_money)} />
          </div>

          <Card title="Hand-over summary">
            <table>
              <tbody>
                <tr><td>Cashier</td><td className="num">{data.cashier}</td></tr>
                <tr><td>Date</td><td className="num">{data.date}</td></tr>
                <tr><td>Cash in the till</td><td className="num"><strong>{money(data.cash)}</strong></td></tr>
                <tr><td>Mobile Money</td><td className="num">{money(data.mobile_money)}</td></tr>
                <tr><td>Card</td><td className="num">{money(data.card)}</td></tr>
                <tr><td><strong>Total</strong></td><td className="num"><strong>{money(data.total)}</strong></td></tr>
              </tbody>
            </table>
          </Card>

          <button className="btn btn-navy no-print" onClick={() => window.print()}>
            Print hand-over sheet
          </button>
        </>
      )}
    </>
  );
}
