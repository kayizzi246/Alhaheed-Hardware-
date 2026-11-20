'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Card, Chip, Alert, Empty, Stat } from '@/components/ui';

const ROLE_LABEL = {
  cashier: 'Cashier',
  accounts: 'Accounts',
  store: 'Store Manager',
  manager: 'Manager',
};

/**
 * Who works here and at which desk.
 *
 * Staff accounts are WordPress users, so they are created there —
 * Users → Add New, with the right role. This screen is the register:
 * who exists, what they can reach, and whether they are still active.
 */
export default function ManagerStaff() {
  const [staff, setStaff] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/api/manager/staff')
      .then((r) => setStaff(r.staff))
      .catch((e) => setError(e.message));
  }, []);

  const count = (role) => (staff || []).filter((s) => s.role === role).length;

  return (
    <>
      <div className="page-head">
        <h1>Staff</h1>
        <div className="page-meta">
          Added in WordPress under Users → Add New, with the matching role.
        </div>
      </div>

      <Alert>{error}</Alert>

      <div className="stats">
        {Object.keys(ROLE_LABEL).map((r) => (
          <Stat key={r} label={ROLE_LABEL[r]} value={count(r)} />
        ))}
      </div>

      <Card title="Everyone with a desk">
        {!staff ? (
          <div className="loading">Loading staff…</div>
        ) : staff.length === 0 ? (
          <Empty>No staff accounts yet.</Empty>
        ) : (
          <table>
            <thead>
              <tr><th>Name</th><th>Desk</th><th>Phone</th><th>Email</th><th>Status</th></tr>
            </thead>
            <tbody>
              {staff.map((s) => (
                <tr key={s.id}>
                  <td><strong>{s.fullName}</strong></td>
                  <td>{ROLE_LABEL[s.role] || s.role}</td>
                  <td>{s.phone || '—'}</td>
                  <td>{s.email || '—'}</td>
                  <td>
                    <Chip status={s.status === 'active' ? 'released' : 'cancelled'}>
                      {s.status === 'active' ? 'Active' : 'Suspended'}
                    </Chip>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card title="What each desk can reach">
        <table>
          <tbody>
            <tr><th>Cashier</th><td>The payment queue, receipts, the cash book (read-only), end of day</td></tr>
            <tr><th>Accounts</th><td>Verifying payments, the cash book, reconciliation, reports</td></tr>
            <tr><th>Store Manager</th><td>Approved orders, the pick list, releasing goods — on the app</td></tr>
            <tr><th>Manager</th><td>Everything, plus products, staff, customers and the audit trail</td></tr>
          </tbody>
        </table>
      </Card>
    </>
  );
}
