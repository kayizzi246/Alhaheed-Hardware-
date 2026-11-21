'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { list } from '@/lib/format';
import {
  Alert, Card, CardHead, CardTitle, Chip, Empty, Loading, PageHead,
  Stat, Stats, Table, TableWrap, Td, Th, Tr,
} from '@/components/ui';

const ROLE_LABEL = {
  cashier: 'Cashier',
  accounts: 'Accounts',
  store: 'Store Manager',
  manager: 'Manager',
};

const REACH = [
  ['Cashier', 'The payment queue, receipts, the cash book (read-only), end of day'],
  ['Accounts', 'Verifying payments, the cash book, reconciliation, reports'],
  ['Store Manager', 'Approved orders, the pick list, releasing goods — on the app'],
  ['Manager', 'Everything, plus products, staff, customers and the audit trail'],
];

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
      .then((r) => setStaff(list(r.staff)))
      .catch((e) => { setStaff([]); setError(e.message); });
  }, []);

  const count = (role) => (staff || []).filter((s) => s.role === role).length;

  return (
    <>
      <PageHead
        title="Staff"
        sub="Added in WordPress under Users → Add New, with the matching role."
      />

      <Alert>{error}</Alert>

      <Stats>
        {Object.keys(ROLE_LABEL).map((r) => (
          <Stat key={r} label={ROLE_LABEL[r]} value={count(r)} />
        ))}
      </Stats>

      <Card className="mb-4">
        <CardHead><CardTitle>Everyone with a desk</CardTitle></CardHead>
        {!staff ? (
          <Loading>Loading staff…</Loading>
        ) : staff.length === 0 ? (
          <Empty title="No staff accounts yet">
            Add them in WordPress under Users → Add New.
          </Empty>
        ) : (
          <TableWrap>
            <Table>
              <thead>
                <tr><Th>Name</Th><Th>Desk</Th><Th>Phone</Th><Th>Email</Th><Th>Status</Th></tr>
              </thead>
              <tbody>
                {staff.map((s) => (
                  <Tr key={s.id}>
                    <Td className="font-semibold text-ink">{s.fullName}</Td>
                    <Td>{ROLE_LABEL[s.role] || s.role}</Td>
                    <Td className="tnum">{s.phone || '—'}</Td>
                    <Td>{s.email || '—'}</Td>
                    <Td>
                      <Chip tone={s.status === 'active' ? 'good' : 'grey'}>
                        {s.status === 'active' ? 'Active' : 'Suspended'}
                      </Chip>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </Card>

      <Card>
        <CardHead><CardTitle>What each desk can reach</CardTitle></CardHead>
        <TableWrap>
          <Table>
            <tbody>
              {REACH.map(([desk, what]) => (
                <Tr key={desk}>
                  <Td className="w-[150px] align-top font-semibold text-ink">{desk}</Td>
                  <Td>{what}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </TableWrap>
      </Card>
    </>
  );
}
