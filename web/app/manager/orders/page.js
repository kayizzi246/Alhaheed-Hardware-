'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { money, dateTime, statusLabel } from '@/lib/format';
import { Card, Chip, Alert, Empty } from '@/components/ui';

const STATUSES = [
  ['all', 'All'],
  ['pending_payment', 'At Cashier'],
  ['paid', 'At Accounts'],
  ['payment_verified', 'At Store'],
  ['released', 'Completed'],
  ['cancelled', 'Cancelled'],
  ['rejected', 'Rejected'],
];

/** Every order in the shop, filterable, with a way into each one. */
export default function ManagerOrders() {
  const params = useSearchParams();
  const [status, setStatus] = useState(params.get('status') || 'all');
  const [search, setSearch] = useState('');
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const qs = new URLSearchParams({ limit: '100' });
      if (status !== 'all') qs.set('status', status);
      if (search.trim()) qs.set('search', search.trim());
      const r = await api(`/api/orders?${qs}`);
      setOrders(r.orders);
      setError('');
    } catch (e) { setError(e.message); }
  }, [status, search]);

  // Typing filters as you go, but not on every keystroke — the server
  // does not need to hear about every letter of "cement".
  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  return (
    <>
      <div className="page-head">
        <h1>All orders</h1>
        <div className="filters">
          <div className="field">
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              {STATUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div className="field">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Order no, customer or company"
            />
          </div>
        </div>
      </div>

      <Alert>{error}</Alert>

      <Card>
        {!orders ? (
          <div className="loading">Loading orders…</div>
        ) : orders.length === 0 ? (
          <Empty>No orders match.</Empty>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Order</th><th>Customer</th><th>Status</th>
                <th className="num">Items</th><th className="num">Total</th><th>Placed</th><th />
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td><strong>{o.order_no}</strong></td>
                  <td>{o.company_name || o.ordered_by_name}</td>
                  <td><Chip status={o.status}>{statusLabel(o.status)}</Chip></td>
                  <td className="num">{o.item_count}</td>
                  <td className="num">{money(o.total)}</td>
                  <td>{dateTime(o.created_at)}</td>
                  <td className="num">
                    <Link className="btn btn-ghost" href={`/manager/orders/${o.id}`}>Open</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}
