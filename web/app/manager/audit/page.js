'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { dateTime, list } from '@/lib/format';
import { Card, Alert, Empty } from '@/components/ui';

const ACTION_LABEL = {
  placed: 'Order placed',
  payment_received: 'Payment taken',
  verified: 'Payment verified',
  rejected: 'Payment rejected',
  released: 'Goods released',
  cancelled: 'Order cancelled',
  refunded: 'Refunded',
};

/**
 * Every move anybody made, newest first.
 *
 * This is the answer to "who did that, and when" — the question that
 * only gets asked when something has gone wrong, and the one a shop
 * cannot answer from memory.
 */
export default function ManagerAudit() {
  const [events, setEvents] = useState(null);
  const [who, setWho] = useState('all');
  const [what, setWhat] = useState('all');
  const [error, setError] = useState('');

  useEffect(() => {
    api('/api/manager/audit?limit=300')
      .then((r) => setEvents(list(r.events)))
      .catch((e) => setError(e.message));
  }, []);

  const people = useMemo(
    () => [...new Set((events || []).map((e) => e.handler_name).filter(Boolean))],
    [events]
  );
  const actions = useMemo(
    () => [...new Set((events || []).map((e) => e.action))],
    [events]
  );

  const shown = (events || []).filter(
    (e) => (who === 'all' || e.handler_name === who) && (what === 'all' || e.action === what)
  );

  return (
    <>
      <div className="page-head">
        <h1>Audit trail</h1>
        <div className="filters">
          <div className="field">
            <select value={who} onChange={(e) => setWho(e.target.value)}>
              <option value="all">Everyone</option>
              {people.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div className="field">
            <select value={what} onChange={(e) => setWhat(e.target.value)}>
              <option value="all">Every action</option>
              {actions.map((a) => (
                <option key={a} value={a}>{ACTION_LABEL[a] || a}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <Alert>{error}</Alert>

      <Card>
        {!events ? (
          <div className="loading">Loading the trail…</div>
        ) : shown.length === 0 ? (
          <Empty>Nothing recorded for that filter.</Empty>
        ) : (
          <table>
            <thead>
              <tr><th>When</th><th>Order</th><th>Desk</th><th>What happened</th><th>Who</th><th>Notes</th></tr>
            </thead>
            <tbody>
              {shown.map((e) => (
                <tr key={e.id}>
                  <td>{dateTime(e.created_at)}</td>
                  <td>
                    {e.order_no ? (
                      <Link href={`/manager/orders/${e.order_id}`}><strong>{e.order_no}</strong></Link>
                    ) : '—'}
                  </td>
                  <td>{e.stage}</td>
                  <td>{ACTION_LABEL[e.action] || String(e.action).replace(/_/g, ' ')}</td>
                  <td>{e.handler_name || '—'}</td>
                  <td>{e.notes || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <div className="page-meta">
        Showing {shown.length} of the most recent 300 events.
      </div>
    </>
  );
}
