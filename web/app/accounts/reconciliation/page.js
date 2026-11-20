'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { money, today, methodLabel } from '@/lib/format';
import { Stat, Card, Alert, Empty } from '@/components/ui';

/** Daily reconciliation: what was collected against what the cash book shows. */
export default function ReconciliationPage() {
  const [date, setDate] = useState(today());
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api(`/api/accounts/reconciliation?date=${date}`).then(setData).catch((e) => setError(e.message));
  }, [date]);

  const collected = data?.byMethod.reduce((s, m) => s + m.collected, 0) || 0;
  const verified = data?.byMethod.reduce((s, m) => s + m.verified, 0) || 0;
  const pending = data?.byMethod.reduce((s, m) => s + m.pending, 0) || 0;

  return (
    <>
      <div className="page-head">
        <h1>Reconciliation</h1>
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
            <Stat label="Collected" value={money(collected)} />
            <Stat label="Verified" value={money(verified)} tone="green" />
            <Stat label="Still pending" value={money(pending)} />
            <Stat
              label="Cash book difference"
              value={money(Math.abs(data.difference))}
              tone={data.difference === 0 ? 'green' : 'red'}
            />
          </div>

          <Card title="By payment method">
            {data.byMethod.length === 0 ? (
              <Empty>No payments were taken on this date.</Empty>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Method</th><th className="num">Receipts</th><th className="num">Collected</th>
                    <th className="num">Verified</th><th className="num">Pending</th><th className="num">Rejected</th>
                  </tr>
                </thead>
                <tbody>
                  {data.byMethod.map((m) => (
                    <tr key={m.method}>
                      <td>{methodLabel(m.method)}</td>
                      <td className="num">{m.count}</td>
                      <td className="num">{money(m.collected)}</td>
                      <td className="num" style={{ color: 'var(--green)' }}>{money(m.verified)}</td>
                      <td className="num">{money(m.pending)}</td>
                      <td className="num" style={{ color: 'var(--red)' }}>{money(m.rejected)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>

          <Card title="Against the cash book">
            <table>
              <tbody>
                <tr><td>Verified payments</td><td className="num">{money(verified)}</td></tr>
                <tr><td>Cash book: cash in</td><td className="num">{money(data.cashBook.cash_in)}</td></tr>
                <tr><td>Cash book: cash out</td><td className="num">{money(data.cashBook.cash_out)}</td></tr>
                <tr>
                  <td><strong>Difference</strong></td>
                  <td className="num">
                    <strong style={{ color: data.difference === 0 ? 'var(--green)' : 'var(--red)' }}>
                      {money(data.difference)}
                    </strong>
                  </td>
                </tr>
              </tbody>
            </table>
            {data.difference !== 0 && (
              <div style={{ padding: '12px 16px', fontSize: 12.5, color: 'var(--muted)' }}>
                A difference here usually means a manual cash book entry (such as an opening
                balance or an expense) that is not tied to a customer payment. Check the
                cash book for the day.
              </div>
            )}
          </Card>
        </>
      )}
    </>
  );
}
