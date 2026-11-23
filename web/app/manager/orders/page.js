'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { api, peek } from '@/lib/api';
import { money, dateTime, statusLabel, methodLabel, list } from '@/lib/format';
import {
  Alert, Button, Card, Empty, Input, Loading, Modal, PageHead, Select,
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
  const [orders, setOrders] = useState(() => {
    const r = peek(`/api/orders?limit=100${status !== 'all' ? `&status=${status}` : ''}`);
    return r ? list(r.orders) : null;
  });
  const [openId, setOpenId] = useState(null);
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
          <>
          {/* On a phone: one tap-able row per order, everything that
              matters in view, no sideways scrolling to find "Open". */}
          <ul className="divide-y divide-line md:hidden">
            {orders.map((o) => (
              <li key={o.id}>
                <button
                  type="button"
                  onClick={() => setOpenId(o.id)}
                  className="block w-full px-4 py-3 text-left active:bg-surface-2"
                >
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="tnum text-[15px] font-bold text-ink">{o.order_no}</span>
                    <span className="tnum text-[15px] font-bold text-ink">{money(o.total)}</span>
                  </span>
                  <span className="mt-1 flex items-center justify-between gap-3">
                    <span className="min-w-0 truncate text-[13.5px] text-ink-2">{o.company_name || o.ordered_by_name}</span>
                    <StatusChip status={o.status}>{statusLabel(o.status)}</StatusChip>
                  </span>
                  <span className="tnum mt-1 block text-xs text-ink-muted">
                    {o.item_count} {o.item_count === 1 ? 'item' : 'items'} · {dateTime(o.created_at)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <TableWrap className="hidden md:block">
            <Table>
              <thead>
                <tr>
                  <Th>Order</Th><Th>Customer</Th><Th>Status</Th>
                  <Th num>Items</Th><Th num>Total</Th><Th>Placed</Th><Th />
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  // The whole row opens the order, not only the small
                  // button at the end of it.
                  <Tr key={o.id} onClick={() => setOpenId(o.id)} className="cursor-pointer">

                    <Td className="tnum font-bold text-ink">{o.order_no}</Td>
                    <Td className="font-medium text-ink">{o.company_name || o.ordered_by_name}</Td>
                    <Td><StatusChip status={o.status}>{statusLabel(o.status)}</StatusChip></Td>
                    <Td num>{o.item_count}</Td>
                    <Td num className="font-semibold text-ink">{money(o.total)}</Td>
                    <Td className="tnum whitespace-nowrap text-ink-muted">{dateTime(o.created_at)}</Td>
                    <Td className="text-right">
                      <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); setOpenId(o.id); }}>
                        Open
                      </Button>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
          </>
        )}
      </Card>

      {openId && (
        <OrderDialog id={openId} onClose={() => setOpenId(null)} onChanged={load} />
      )}
    </>
  );
}

/**
 * One order, over the list rather than instead of it.
 *
 * The detail used to be its own page, which meant going back to find
 * where you were in a list of a hundred — losing the scroll position,
 * the filter and the search each time. A manager checking three orders
 * in a row was navigating six times.
 *
 * The page still exists and still works: a link to an order from the
 * alerts panel or the audit trail has to land somewhere.
 */
function OrderDialog({ id, onClose, onChanged }) {
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    api(`/api/orders/${id}`)
      .then((r) => { if (alive) setOrder(r.order); })
      .catch((e) => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, [id]);

  const items = list(order?.items);

  return (
    <Modal
      title={order ? `Order ${order.order_no}` : 'Order'}
      description={order ? `${order.company_name || order.ordered_by_name} · ${dateTime(order.created_at)}` : null}
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Close</Button>
          {order && (
            <Button asChild>
              <Link href={`/manager/orders/${order.id}`}>Open the full record</Link>
            </Button>
          )}
        </>
      }
    >
      {error && <Alert>{error}</Alert>}
      {!order && !error && <Loading>Fetching the order…</Loading>}

      {order && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <StatusChip status={order.status}>{statusLabel(order.status)}</StatusChip>
            <span className="text-[13px] text-ink-muted">
              {order.fulfilment === 'delivery' ? 'For delivery' : 'For collection'}
              {order.ordered_by_phone ? ` · ${order.ordered_by_phone}` : ''}
            </span>
            <span className="tnum ml-auto font-display text-[20px] font-extrabold text-ink">
              {money(order.total)}
            </span>
          </div>

          {items.length > 0 && (
            <TableWrap className="rounded-sm border border-line">
              <Table className="text-[13px]">
                <thead>
                  <tr><Th>Item</Th><Th num>Qty</Th><Th num>Total</Th></tr>
                </thead>
                <tbody>
                  {items.map((i) => (
                    <Tr key={i.id}>
                      <Td>
                        <span className="text-ink">{i.product_name}</span>
                        {i.code && <span className="tnum ml-2 text-ink-muted">{i.code}</span>}
                      </Td>
                      <Td num>{i.quantity} {i.unit}</Td>
                      <Td num className="font-semibold text-ink">{money(i.line_total)}</Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          )}

          {order.delivery_address && (
            <p className="rounded-sm border border-line bg-surface-2 px-3.5 py-2.5 text-[13px]">
              <span className="font-semibold text-ink">Deliver to:</span>{' '}
              <span className="text-ink-2">{order.delivery_address}</span>
            </p>
          )}

          {order.payment && (
            <p className="text-[13px] text-ink-muted">
              <span className="font-semibold text-ink">{order.payment.receipt_no}</span>
              {' · '}{methodLabel(order.payment.method)}
              {' · '}taken by {order.payment.cashier_name}
              {order.payment.verified === 1 && <span className="text-ok"> · verified</span>}
              {order.payment.verified === -1 && <span className="text-bad"> · rejected</span>}
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}
