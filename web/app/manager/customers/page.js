'use client';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { money, list } from '@/lib/format';
import { Card, Chip, Alert, Empty, Stat } from '@/components/ui';

/** Who buys here, and how much of it. */
export default function ManagerCustomers() {
  const [customers, setCustomers] = useState(null);
  const [q, setQ] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const qs = q.trim() ? `?q=${encodeURIComponent(q.trim())}` : '';
      setCustomers(list((await api(`/api/manager/customers${qs}`)).customers));
      setError('');
    } catch (e) { setError(e.message); }
  }, [q]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  const list = customers || [];
  const spent = list.reduce((s, c) => s + (c.totalSpent || 0), 0);
  const companies = list.filter((c) => c.accountType !== 'individual').length;

  return (
    <>
      <div className="page-head">
        <h1>Customers</h1>
        <div className="filters">
          <div className="field">
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Name, phone or email"
            />
          </div>
        </div>
      </div>

      <Alert>{error}</Alert>

      <div className="stats">
        <Stat label="Customers" value={list.length} />
        <Stat label="Company accounts" value={companies} />
        <Stat label="Spent with the shop" value={money(spent)} tone="green" />
      </div>

      <Card>
        {!customers ? (
          <div className="loading">Loading customers…</div>
        ) : list.length === 0 ? (
          <Empty>Nobody matches.</Empty>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th><th>Phone</th><th>Account</th>
                <th className="num">Orders</th><th className="num">Spent</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {list
                .slice()
                .sort((a, b) => (b.totalSpent || 0) - (a.totalSpent || 0))
                .map((c) => (
                  <tr key={c.id}>
                    <td>
                      <strong>{c.fullName}</strong>
                      {c.companyName && <div className="page-meta">{c.companyName}</div>}
                    </td>
                    <td>{c.phone || '—'}</td>
                    <td>
                      {c.accountType === 'company_owner' && 'Company owner'}
                      {c.accountType === 'company_staff' && `Company staff${c.staffRole ? ` · ${c.staffRole}` : ''}`}
                      {(!c.accountType || c.accountType === 'individual') && 'Individual'}
                    </td>
                    <td className="num">{c.orderCount}</td>
                    <td className="num">{money(c.totalSpent || 0)}</td>
                    <td>
                      <Chip status={c.status === 'active' ? 'released' : 'cancelled'}>
                        {c.status === 'active' ? 'Active' : 'Suspended'}
                      </Chip>
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
