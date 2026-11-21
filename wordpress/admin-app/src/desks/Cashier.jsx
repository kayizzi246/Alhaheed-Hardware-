/**
 * The cashier's desk.
 *
 * One job: take the money for the order in front of you and hand over a
 * receipt. Everything else on the screen exists to answer "what is in
 * my till today?" at the end of the shift.
 *
 * The amount is filled in for them and selected, because the amount is
 * almost always the total — but it is still an input, because sometimes
 * it is not, and a cashier who cannot type what actually changed hands
 * will write it on paper instead.
 */
import * as React from 'react';
import { CheckCircle2, Receipt } from 'lucide-react';
import { api, money, shortMoney, at, methodLabel, CONFIG } from '@/lib/api';
import { usePoll } from '@/lib/usePoll';
import {
  Alert, Button, Card, CardBody, CardHeader, CardTitle, Dialog, DialogBody, DialogContent,
  DialogFooter, Empty, Field, Input, Segmented, Skeleton, Table, Tabs, TabsContent, TabsList,
  TabsTrigger, Td, Th,
} from '@/ui';
import { Head, OrderRow, Queue, Tiles } from '@/ui/bits';

const METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'mobile_money', label: 'Mobile Money' },
  { value: 'card', label: 'Card' },
];

export default function Cashier() {
  const [queue, setQueue] = React.useState(null);
  const [receipts, setReceipts] = React.useState(null);
  const [taking, setTaking] = React.useState(null); // the order being paid for
  const [error, setError] = React.useState('');
  const [done, setDone] = React.useState('');

  const load = React.useCallback(async () => {
    const [q, r] = await Promise.all([
      api('/cashier/queue'),
      api('/cashier/receipts?mine=1').catch(() => ({ receipts: [] })),
    ]);
    setQueue(q);
    setReceipts(r.receipts || []);
  }, []);

  const poll = usePoll(load, 10000);
  const s = (queue && queue.summary) || {};
  const orders = (queue && queue.orders) || [];

  return (
    <>
      <Head
        title="Cashier"
        sub={`${CONFIG.user.name} · take payment, issue the receipt`}
        fresh={{ at: poll.at, failing: poll.failing }}
      />

      <Tiles
        loading={!poll.ready}
        items={[
          { label: 'Waiting to pay', value: s.waiting ?? 0, lead: true, note: orders.length ? 'oldest first' : 'queue is clear' },
          { label: 'Receipts today', value: s.paid_today ?? 0 },
          { label: 'Cash taken', value: shortMoney(s.cash_today), note: money(s.cash_today) },
          { label: 'Mobile Money', value: shortMoney(s.momo_today), note: money(s.momo_today) },
        ]}
      />

      {done && <Alert tone="success">{done}</Alert>}
      {error && <Alert>{error}</Alert>}

      <Tabs defaultValue="queue">
        <TabsList className="mb-4">
          <TabsTrigger value="queue">Queue{orders.length ? ` · ${orders.length}` : ''}</TabsTrigger>
          <TabsTrigger value="till">My till today</TabsTrigger>
        </TabsList>

        <TabsContent value="queue">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Orders waiting for payment</CardTitle>
              </div>
            </CardHeader>
            {!poll.ready ? (
              <CardBody className="space-y-2">
                <Skeleton className="h-16" /><Skeleton className="h-16" /><Skeleton className="h-16" />
              </CardBody>
            ) : orders.length === 0 ? (
              <Empty icon={CheckCircle2} title="Nothing waiting">
                Every order that has come in has been paid for. New ones appear here on their own.
              </Empty>
            ) : (
              <Queue>
                {orders.map((o) => (
                  <OrderRow
                    key={o.id}
                    order={o}
                    actions={
                      <Button onClick={() => { setTaking(o); setError(''); setDone(''); }}>
                        Take payment
                      </Button>
                    }
                  />
                ))}
              </Queue>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="till">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Receipts I issued today</CardTitle>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Count this against the drawer before you hand over.
                </p>
              </div>
            </CardHeader>
            {!receipts || receipts.length === 0 ? (
              <Empty icon={Receipt} title="No receipts yet">
                The first payment you take today will show here.
              </Empty>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <thead>
                    <tr>
                      <Th>Receipt</Th><Th>Order</Th><Th>Customer</Th><Th>Method</Th>
                      <Th>Reference</Th><Th right>Amount</Th><Th right>Time</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {receipts.map((r) => (
                      <tr key={r.id}>
                        <Td className="tnum font-semibold">{r.receipt_no}</Td>
                        <Td className="tnum">{r.order_no}</Td>
                        <Td>{r.company_name || r.customer_name || '—'}</Td>
                        <Td>{methodLabel(r.method)}</Td>
                        <Td className="text-muted-foreground">{r.transaction_ref || '—'}</Td>
                        <Td right className="font-semibold">{money(r.amount_paid)}</Td>
                        <Td right className="text-muted-foreground">{at(r.created_at)}</Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      <TakePayment
        order={taking}
        onClose={() => setTaking(null)}
        onDone={(msg) => { setTaking(null); setDone(msg); poll.refresh(); }}
        onError={setError}
      />
    </>
  );
}

function TakePayment({ order, onClose, onDone, onError }) {
  const [method, setMethod] = React.useState('cash');
  const [amount, setAmount] = React.useState('');
  const [ref, setRef] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [local, setLocal] = React.useState('');

  // A new order resets the form and pre-fills the amount.
  React.useEffect(() => {
    if (order) {
      setMethod('cash');
      setAmount(String(order.total ?? ''));
      setRef('');
      setLocal('');
    }
  }, [order && order.id]);

  if (!order) return null;

  const short = Number(amount || 0) < Number(order.total || 0);

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setLocal('');
    try {
      await api(`/cashier/orders/${order.id}/payment`, {
        method: 'POST',
        body: { method, amountPaid: Number(amount), transactionRef: ref || null },
      });
      onDone(`${order.order_no} paid — ${money(amount)}. It is with Accounts now.`);
    } catch (err) {
      setLocal(err.message);
      onError('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        title={`Take payment — ${order.order_no}`}
        description={`${order.ordered_by_name || 'Walk-in'} · ${order.item_count} ${order.item_count === 1 ? 'item' : 'items'} · due ${money(order.total)}`}
      >
        <form onSubmit={submit}>
          <DialogBody className="space-y-4">
            {local && <Alert>{local}</Alert>}

            <Field label="How did they pay?">
              <Segmented name="Payment method" value={method} onChange={setMethod} options={METHODS} />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Amount received"
                hint={short ? `${money(Number(order.total) - Number(amount || 0))} short of the total` : null}
              >
                <Input
                  type="number"
                  min="0"
                  step="1"
                  inputMode="numeric"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  onFocus={(e) => e.target.select()}
                  autoFocus
                  required
                  className="tnum text-[17px] font-semibold"
                />
              </Field>

              <Field
                label={method === 'cash' ? 'Reference (optional)' : 'Transaction reference'}
                hint={method === 'mobile_money' ? 'The code from the MTN or Airtel message' : null}
              >
                <Input
                  value={ref}
                  onChange={(e) => setRef(e.target.value)}
                  placeholder={method === 'cash' ? '—' : 'e.g. MP2611.1431.A12345'}
                  required={method !== 'cash'}
                />
              </Field>
            </div>
          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={busy}>
              {busy ? 'Saving…' : `Record ${money(amount || 0)}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
