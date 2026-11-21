'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { money, dateTime, statusLabel, list } from '@/lib/format';
import {
  Alert, Button, Card, Empty, Input, Loading, PageHead, Select,
  StatusChip, Table, TableWrap, Td, Th, Tr,
} from '@/components/ui';

const STATUSES = [
  ['all', 'All'],
  ['pending_payment', 'At Cashier'],
  ['paid', 'At Accounts'],
  ['payment_verified', 'At Store'],
  ['released', 'Completed'],
  ['cancelled', 'Cancelled'],
  ['rejected', 'Rejected'],
];

/**
 * Every order in the shop, filterable, with a way into each one.
 *
 * The Suspense wrapper is not decoration. `useSearchParams` has to sit
 * behind one, or Next renders the page once with no search params at
 * all on its way to the browser — and a link carrying `?status=paid`
 * lands on a screen that throws before it has drawn anything.
 */
export default function ManagerOrdersPage() {
  return (
    <Suspense fallback={<Loading>Loading orders…</Loading>}>
      <ManagerOrders />
    </Suspense>
  );
}

function ManagerOrders() {
  const params = useSearchParams();
  const [status, setStatus] = useState(() => {
    const asked = params?.get('status');
    // Only a filter this screen actually has. A link with a status
    // nobody recognises shows everything rather than nothing.
    return STATUSES.some(([v]) => v === asked) ? asked : 'all';
  });
  const [search, setSearch] = useState('');
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const qs = new URLSearchParams({ limit: '100' });
      if (status !== 'all') qs.set('status', status);
      if (search.trim()) qs.set('search', search.trim());
      const r = await api(`/api/orders?${qs}`);
      // Always an array. A server that answers with something else —
      // an older plugin, a login page where JSON was expected — must
      // leave this screen saying "no orders", not throwing on .map and
      // taking the whole panel down with it.
      setOrders(list(r?.orders));
      setError('');
    } catch (e) {
      setOrders([]);
      setError(e.message);
    }
  }, [status, search]);

  // Typing filters as you go, but not on every keystroke — the server
  // does not need to hear about every letter of "cement".
  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  return (
    <>
      <PageHead title="All orders" sub={orders ? `${orders.length} shown` : null}>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-[170px]">
          {STATUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </Select>
        <Input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Order no, customer or company"
          className="w-[260px]"
        />
      </PageHead>

      <Alert>{error}</Alert>

      <Card>
        {!orders ? (
          <Loading>Loading orders…</Loading>
        ) : orders.length === 0 ? (
          <Empty title="No orders match">
            Try a different status, or clear the search box.
          </Empty>
        ) : (
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>Order</Th><Th>Customer</Th><Th>Status</Th>
                  <Th num>Items</Th><Th num>Total</Th><Th>Placed</Th><Th />
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <Tr key={o.id}>
                    <Td className="tnum font-bold text-ink">{o.order_no}</Td>
                    <Td className="font-medium text-ink">{o.company_name || o.ordered_by_name}</Td>
                    <Td><StatusChip status={o.status}>{statusLabel(o.status)}</StatusChip></Td>
                    <Td num>{o.item_count}</Td>
                    <Td num className="font-semibold text-ink">{money(o.total)}</Td>
                    <Td className="tnum whitespace-nowrap text-ink-muted">{dateTime(o.created_at)}</Td>
                    <Td className="text-right">
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/manager/orders/${o.id}`}>Open</Link>
                      </Button>
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
