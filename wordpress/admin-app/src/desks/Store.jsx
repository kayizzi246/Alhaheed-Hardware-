/**
 * The store manager's desk.
 *
 * One job: pick what the paid order says, and release it. Releasing is
 * what reduces stock, so it happens once and only when the goods have
 * actually left the shelf.
 *
 * Every row here starts open. A cashier does not need the item list; a
 * store man needs nothing else, and making him click each row before he
 * can pack is an insult to the work.
 */
import * as React from 'react';
import { PackageCheck } from 'lucide-react';
import { api, money, CONFIG } from '@/lib/api';
import { usePoll } from '@/lib/usePoll';
import {
  Alert, Button, Card, CardBody, CardHeader, CardTitle, Dialog, DialogBody, DialogContent,
  DialogFooter, Empty, Field, Input, Segmented, Skeleton,
} from '@/ui';
import { Head, OrderRow, Queue, Tiles } from '@/ui/bits';

const HANDOVER = [
  { value: 'collected', label: 'Collected at the shop' },
  { value: 'out_for_delivery', label: 'Out for delivery' },
];

export default function Store() {
  const [orders, setOrders] = React.useState(null);
  const [releasing, setReleasing] = React.useState(null);
  const [note, setNote] = React.useState('');

  const load = React.useCallback(async () => {
    const data = await api('/store/queue');
    setOrders(data.orders || []);
  }, []);

  const poll = usePoll(load, 10000);
  const list = orders || [];
  const toDeliver = list.filter((o) => o.fulfilment === 'delivery').length;
  const lines = list.reduce((n, o) => n + Number(o.item_count || 0), 0);
  const value = list.reduce((n, o) => n + Number(o.total || 0), 0);

  return (
    <>
      <Head
        title="Store"
        sub={`${CONFIG.user.name} · pick, pack, release`}
        fresh={{ at: poll.at, failing: poll.failing }}
      />

      <Tiles
        loading={!poll.ready}
        items={[
          { label: 'To pack', value: list.length, lead: true, note: list.length ? 'paid and verified' : 'shelf is clear' },
          { label: 'Items to pick', value: lines },
          { label: 'For delivery', value: toDeliver, note: `${list.length - toDeliver} for collection` },
          { label: 'Value waiting', value: money(value) },
        ]}
      />

      {note && <Alert tone="success">{note}</Alert>}

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Pick list</CardTitle>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Releasing takes the items off the shelf count. Do it when the goods leave, not before.
            </p>
          </div>
        </CardHeader>

        {!poll.ready ? (
          <CardBody className="space-y-2">
            <Skeleton className="h-28" /><Skeleton className="h-28" />
          </CardBody>
        ) : list.length === 0 ? (
          <Empty icon={PackageCheck} title="Nothing to pack">
            Orders arrive here once Accounts has verified the payment.
          </Empty>
        ) : (
          <Queue>
            {list.map((o) => (
              <OrderRow
                key={o.id}
                order={o}
                defaultOpen
                actions={
                  <Button onClick={() => { setReleasing(o); setNote(''); }}>Release</Button>
                }
              />
            ))}
          </Queue>
        )}
      </Card>

      <Release
        order={releasing}
        onClose={() => setReleasing(null)}
        onDone={(msg) => { setReleasing(null); setNote(msg); poll.refresh(); }}
      />
    </>
  );
}

function Release({ order, onClose, onDone }) {
  const [who, setWho] = React.useState('');
  const [how, setHow] = React.useState('collected');
  const [busy, setBusy] = React.useState(false);
  const [local, setLocal] = React.useState('');

  React.useEffect(() => {
    if (order) {
      setWho(order.ordered_by_name || '');
      setHow(order.fulfilment === 'delivery' ? 'out_for_delivery' : 'collected');
      setLocal('');
    }
  }, [order && order.id]);

  if (!order) return null;

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      await api(`/store/orders/${order.id}/release`, {
        method: 'POST',
        body: { collectedBy: who, deliveryStatus: how },
      });
      onDone(`${order.order_no} released. Stock has been reduced and the customer has been texted.`);
    } catch (err) {
      setLocal(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        title={`Release ${order.order_no}`}
        description={`${order.item_count} ${order.item_count === 1 ? 'item' : 'items'} · ${money(order.total)}. This reduces the shelf count and cannot be undone from here.`}
      >
        <form onSubmit={submit}>
          <DialogBody className="space-y-4">
            {local && <Alert>{local}</Alert>}

            <Field label="How is it leaving?">
              <Segmented name="Handover" value={how} onChange={setHow} options={HANDOVER} />
            </Field>

            <Field
              label={how === 'collected' ? 'Who collected it?' : 'Who is taking it out?'}
              hint="The name goes on the record, so a query next week has an answer."
            >
              <Input value={who} onChange={(e) => setWho(e.target.value)} required autoFocus />
            </Field>

            {order.delivery_address && how === 'out_for_delivery' && (
              <p className="rounded-md border border-border bg-muted/50 px-3 py-2.5 text-[13px]">
                <span className="font-semibold">Going to:</span> {order.delivery_address}
              </p>
            )}
          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Release the goods'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
