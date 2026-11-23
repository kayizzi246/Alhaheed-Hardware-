'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api, getUser } from '@/lib/api';
import { usePoll } from '@/lib/live';
import { money, shortMoney, time, methodLabel, list } from '@/lib/format';
import { cn } from '@/lib/cn';
import {
  Alert, Button, Card, CardBody, CardHead, CardTitle, Chip, Empty, Field, Fresh,
  Input, Loading, Modal, PageHead, Segmented, Stat, Stats, StatusChip,
} from '@/components/ui';

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
  const [data, setData] = useState(null);
  const [recent, setRecent] = useState([]);
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
      // An empty shape, not null: null leaves the screen on "Loading"
      // for ever with the error nowhere to be seen.
      setData({ orders: [], summary: {} });
      setError(e.message);
    }
  }, []);

  const { at, failing } = usePoll(load, 10000);

  if (!data) return <Loading>Loading the payment queue…</Loading>;

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
      </PageHead>

      <Alert>{error}</Alert>
      <Alert kind="ok" onDone={() => setNotice('')}>{notice}</Alert>

      <Stats>
        <Stat label="Waiting for payment" value={s.waiting ?? 0} lead={orders.length > 0} note={orders.length ? 'oldest first' : 'queue is clear'} />
        <Stat label="Paid today" value={s.paid_today ?? 0} />
        <Stat label="Cash received" value={shortMoney(s.cash_today)} note={money(s.cash_today)} tone="ok" />
        <Stat label="Mobile Money received" value={shortMoney(s.momo_today)} note={money(s.momo_today)} />
      </Stats>

      <Card className="mb-4">
        <CardHead>
          <CardTitle>Waiting for payment</CardTitle>
          <span className="text-[12.5px] text-ink-muted">
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
              <li key={o.id} className="flex flex-wrap items-center gap-x-4 gap-y-3 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {/* The order number is read across a desk, so it is
                        the biggest thing in the row after the amount. */}
                    <span className="tnum font-display text-[16px] font-bold text-ink">{o.order_no}</span>
                    <StatusChip status={o.status}>Pending</StatusChip>
                  </div>
                  <p className="mt-0.5 truncate text-sm font-medium text-ink-2">
                    {o.company_name || o.ordered_by_name}
                    {o.company_name && (
                      <em className="not-italic text-ink-muted"> · ordered by {o.ordered_by_name}</em>
                    )}
                  </p>
                  <p className="mt-0.5 text-[12.5px] text-ink-muted">
                    {o.item_count} {o.item_count === 1 ? 'item' : 'items'} · {time(o.created_at)}
                    {o.fulfilment === 'delivery' && ' · delivery'}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-3">
                  <span className="tnum font-display text-[17px] font-bold text-ink">{money(o.total)}</span>
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
              <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-5 py-3 text-[13.5px]">
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

const METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'mobile_money', label: 'Mobile Money' },
  { value: 'card', label: 'Card' },
];

function ReceivePayment({ order, onClose, onDone }) {
  const [method, setMethod] = useState('cash');
  const [amount, setAmount] = useState(String(order.total));
  const [ref, setRef] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const paid = Number(amount || 0);
  const change = paid - order.total;

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await api(`/api/cashier/orders/${order.id}/payment`, {
        method: 'POST',
        body: { method, amountPaid: Math.trunc(paid), transactionRef: ref || null },
      });
      onDone(res.receipt.receipt_no);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <Modal
      title={`Receive payment — ${order.order_no}`}
      description={`${order.company_name || order.ordered_by_name} · ${order.item_count} ${
        order.item_count === 1 ? 'item' : 'items'
      }`}
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="pay" disabled={busy || paid < order.total}>
            {busy ? 'Recording…' : 'Confirm & send to Accounts'}
          </Button>
        </>
      }
    >
      <form id="pay" onSubmit={submit} className="space-y-4">
        <Alert>{error}</Alert>

        <div className="rounded-sm border border-line bg-surface-2 px-4 py-3">
          <span className="block text-[11px] font-bold uppercase tracking-[.07em] text-ink-muted">
            Amount due
          </span>
          <strong className="tnum mt-1 block font-display text-[26px] font-extrabold leading-none text-ink">
            {money(order.total)}
          </strong>
        </div>

        <Field label="How did they pay?">
          <Segmented label="Payment method" value={method} onChange={setMethod} options={METHODS} />
        </Field>

        <Field
          label="Amount received"
          hint={change > 0 ? `Change to give: ${money(change)}` : null}
        >
          <Input
            type="number"
            min={order.total}
            inputMode="numeric"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            onFocus={(e) => e.target.select()}
            autoFocus
            required
            className="tnum text-[17px] font-semibold"
          />
        </Field>

        {method !== 'cash' && (
          <Field
            label="Transaction reference"
            hint={method === 'mobile_money' ? 'The code from the MTN or Airtel message' : null}
          >
            <Input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="MP2611190934" required />
          </Field>
        )}
      </form>
    </Modal>
  );
}
