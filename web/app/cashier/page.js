'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api, getUser, peek } from '@/lib/api';
import ReceivePayment from '@/components/ReceivePayment';
import { usePoll } from '@/lib/live';
import { money, shortMoney, time, methodLabel, list } from '@/lib/format';
import { cn } from '@/lib/cn';
import { Icon } from '@/components/icons';
import {
  Alert, Button, Card, CardBody, CardHead, CardTitle, Chip, Empty, Field, Fresh,
  Input, Loading, Modal, PageHead, Segmented, Stat, Stats, StatusChip, LoadFailed } from '@/components/ui';

/**
 * The cashier's desk.
 *
 * One job: take the money for the order in front of you and hand over a
 * receipt. Everything else on the screen answers "what is in my till
 * today?" at the end of the shift.
 *
 * Orders arrive from the customer's phone, so the queue re-checks
 * itself rather than waiting to be reloaded.
 */
export default function CashierQueue() {
  const [data, setData] = useState(() => peek('/api/cashier/queue'));
  const [recent, setRecent] = useState(() => list(peek('/api/cashier/receipts')?.receipts).slice(0, 8));
  const [paying, setPaying] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    try {
      const [queue, receipts] = await Promise.all([
        api('/api/cashier/queue'),
        api('/api/cashier/receipts'),
      ]);
      setData(queue);
      setRecent(list(receipts.receipts).slice(0, 8));
      setError('');
    } catch (e) {
      // On failure, keep what was on screen; the error says it is stale.
      setError(e.message);
    }
  }, []);

  const { at, failing } = usePoll(load, 10000);

  // Never "queue is clear" because the queue could not be fetched.
  if (!data) return error ? <LoadFailed onRetry={load}>{error}</LoadFailed> : <Loading>Loading the payment queue…</Loading>;

  const user = getUser();
  const s = data.summary || {};
  const orders = list(data.orders);

  return (
    <>
      <PageHead
        title="Payment queue"
        sub={`${user?.fullName ?? ''} · ${new Date().toLocaleDateString('en-GB', {
          weekday: 'long', day: 'numeric', month: 'long',
        })}`}
      >
        <Fresh at={at} failing={failing} />
        {/* Somebody at the counter rather than on the app. */}
        <Button asChild><Link href="/cashier/sale">New sale</Link></Button>
      </PageHead>

      <Alert>{error}</Alert>
      <Alert kind="ok" onDone={() => setNotice('')}>{notice}</Alert>

      <Stats>
        {/* Blue when somebody is waiting to pay — the one thing on this
            screen that needs the cashier now. */}
        <Stat
          label="Waiting for payment"
          value={s.waiting ?? 0}
          lead={orders.length > 0}
          note={orders.length ? 'oldest first' : 'queue is clear'}
          icon={Icon.clock()}
          tone={orders.length ? 'warn' : 'ok'}
        />
        <Stat label="Paid today" value={s.paid_today ?? 0} note="receipts issued" icon={Icon.receipt()} href="/cashier/receipts" />
        <Stat label="Cash received" value={shortMoney(s.cash_today)} note={money(s.cash_today)} icon={Icon.cash()} tone="ok" href="/cashier/cash-book" />
        <Stat label="Mobile Money received" value={shortMoney(s.momo_today)} note={money(s.momo_today)} icon={Icon.phone()} href="/cashier/receipts" />
      </Stats>

      <Card className="mb-4">
        <CardHead>
          <CardTitle>Waiting for payment</CardTitle>
          <span className="text-[12px] text-ink-muted">
            {orders.length === 0 ? 'nothing waiting' : `${orders.length} in the queue`}
          </span>
        </CardHead>

        {orders.length === 0 ? (
          <Empty title="Nothing waiting">
            Every order has been paid for. New ones arrive here on their own.
          </Empty>
        ) : (
          <ul className="divide-y divide-line">
            {orders.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-4 sm:px-5">
                {/* Wide enough before it wraps that the customer's name is
                    never squeezed down to one letter on a phone. */}
                <div className="min-w-[13rem] flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {/* The order number is read across a desk, so it is
                        the biggest thing in the row after the amount. */}
                    <span className="tnum font-display text-[14.5px] font-bold text-ink">{o.order_no}</span>
                    <StatusChip status={o.status}>Pending</StatusChip>
                  </div>
                  <p className="mt-0.5 truncate text-[13px] font-medium text-ink-2">
                    {o.company_name || o.ordered_by_name}
                    {o.company_name && (
                      <em className="not-italic text-ink-muted"> · ordered by {o.ordered_by_name}</em>
                    )}
                  </p>
                  <p className="mt-0.5 text-[12px] text-ink-muted">
                    {o.item_count} {o.item_count === 1 ? 'item' : 'items'} · {time(o.created_at)}
                    {o.fulfilment === 'delivery' && ' · delivery'}
                  </p>
                </div>

                <div className="flex w-full shrink-0 items-center justify-between gap-3 sm:w-auto sm:justify-end">
                  <span className="tnum font-display text-[15px] font-bold text-ink">{money(o.total)}</span>
                  <Button onClick={() => setPaying(o)}>Receive payment</Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHead>
          <CardTitle>Receipts issued today</CardTitle>
          <Button asChild variant="ghost" size="sm"><Link href="/cashier/receipts">All receipts</Link></Button>
        </CardHead>

        {recent.length === 0 ? (
          <Empty title="No receipts yet">The first payment you take today will show here.</Empty>
        ) : (
          <ul className="divide-y divide-line">
            {recent.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 sm:px-6 py-3 text-[12.5px]">
                <span className="tnum font-bold text-ink">{r.order_no}</span>
                <span className="min-w-0 flex-1 truncate text-ink-muted">
                  {r.receipt_no} · {methodLabel(r.method)}
                </span>
                <span className="tnum font-semibold text-ink">{money(r.amount_paid)}</span>
                {r.verified === 1 ? (
                  <Chip tone="good">Verified</Chip>
                ) : r.verified === -1 ? (
                  <Chip tone="bad">Rejected</Chip>
                ) : (
                  <Chip tone="info">With accounts</Chip>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {paying && (
        <ReceivePayment
          order={paying}
          onClose={() => setPaying(null)}
          onDone={(receiptNo) => {
            setPaying(null);
            setNotice(`Payment recorded. Receipt ${receiptNo} sent to Accounts.`);
            load();
          }}
        />
      )}
    </>
  );
}
