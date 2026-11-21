'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { money, list } from '@/lib/format';
import {
  Alert, Card, Chip, Empty, Input, Loading, PageHead,
  Stat, Stats, Table, TableWrap, Td, Th, Tr,
} from '@/components/ui';

const ACCOUNT_LABEL = (c) => {
  if (c.accountType === 'company_owner') return 'Company owner';
  if (c.accountType === 'company_staff') {
    return `Company staff${c.staffRole ? ` · ${c.staffRole}` : ''}`;
  }
  return 'Individual';
};

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
    } catch (e) {
      setCustomers([]);
      setError(e.message);
    }
  }, [q]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  // Not named `list` — that is the imported helper, and shadowing it
  // here makes every call to it in this file throw.
  const rows = customers || [];
  const spent = rows.reduce((s, c) => s + (c.totalSpent || 0), 0);
  const companies = rows.filter((c) => c.accountType !== 'individual').length;

  return (
    <>
      <PageHead title="Customers">
        <Input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Name, phone or email"
          className="w-[260px]"
        />
      </PageHead>

      <Alert>{error}</Alert>

      <Stats className="xl:grid-cols-3">
        <Stat label="Customers" value={rows.length} />
        <Stat label="Company accounts" value={companies} />
        <Stat label="Spent with the shop" value={money(spent)} tone="ok" />
      </Stats>

      <Card>
        {!customers ? (
          <Loading>Loading customers…</Loading>
        ) : rows.length === 0 ? (
          <Empty title="Nobody matches">Try a different name or number.</Empty>
        ) : (
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>Name</Th><Th>Phone</Th><Th>Account</Th>
                  <Th num>Orders</Th><Th num>Spent</Th><Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {rows
                  .slice()
                  .sort((a, b) => (b.totalSpent || 0) - (a.totalSpent || 0))
                  .map((c) => (
                    <Tr key={c.id}>
                      <Td>
                        <span className="font-semibold text-ink">{c.fullName}</span>
                        {c.companyName && (
                          <span className="block text-xs text-ink-muted">{c.companyName}</span>
                        )}
                      </Td>
                      <Td className="tnum">{c.phone || '—'}</Td>
                      <Td className="text-ink-muted">{ACCOUNT_LABEL(c)}</Td>
                      <Td num>{c.orderCount}</Td>
                      <Td num className="font-semibold text-ink">{money(c.totalSpent || 0)}</Td>
                      <Td>
                        <Chip tone={c.status === 'active' ? 'good' : 'grey'}>
                          {c.status === 'active' ? 'Active' : 'Suspended'}
                        </Chip>
                      </Td>
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
