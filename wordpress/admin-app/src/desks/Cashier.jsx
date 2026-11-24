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
import { CheckCircle2, ImageUp, Receipt } from 'lucide-react';
import { api, upload, money, shortMoney, at, methodLabel, CONFIG } from '@/lib/api';
import { readPaymentText, normaliseRef } from '@/lib/txref';
import { readImageText, shrinkImage } from '@/lib/ocr';
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
                        <Td>{r.company_name || r.customer_name || ''}</Td>
                        <Td>{methodLabel(r.method)}</Td>
                        <Td className="text-muted-foreground">{r.transaction_ref || ''}</Td>
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

  // The screenshot, and what was read off it.
  const [proof, setProof] = React.useState(null);
  const [preview, setPreview] = React.useState('');
  const [reading, setReading] = React.useState(null);
  const [found, setFound] = React.useState(null);
  const [refFrom, setRefFrom] = React.useState('typed');
  const [dupe, setDupe] = React.useState(null);
  const [big, setBig] = React.useState(false);

  // A new order resets the form and pre-fills the amount.
  React.useEffect(() => {
    if (order) {
      setMethod('cash');
      setAmount(String(order.total ?? ''));
      setRef('');
      setLocal('');
      setProof(null);
      setPreview('');
      setFound(null);
      setRefFrom('typed');
      setDupe(null);
    }
  }, [order && order.id]);

  React.useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const needsRef = method !== 'cash';

  // Already paid for another order? Asked while it can still be fixed.
  React.useEffect(() => {
    const value = normaliseRef(ref);
    if (!order || !needsRef || value.length < 6) { setDupe(null); return undefined; }
    let live = true;
    const t = setTimeout(() => {
      api(`/cashier/check-ref?ref=${encodeURIComponent(value)}&order=${order.id}`)
        .then((r) => { if (live) setDupe(r.used ? r : null); })
        .catch(() => {});
    }, 350);
    return () => { live = false; clearTimeout(t); };
  }, [ref, needsRef, order && order.id]);

  if (!order) return null;

  const short = Number(amount || 0) < Number(order.total || 0);

  const attach = async (file) => {
    if (!file) return;
    setLocal('');
    setFound(null);
    try {
      const small = await shrinkImage(file);
      setProof(small);
      setPreview(URL.createObjectURL(small));
      setReading({ stage: 'preparing', progress: 0 });
      const result = readPaymentText(await readImageText(small, (stage, progress) => setReading({ stage, progress })));
      setFound(result.ref || result.amount ? result : { failed: true });
      setBig(true);
      if (result.ref && (!ref || refFrom !== 'typed')) { setRef(result.ref); setRefFrom('picture'); }
    } catch {
      setFound({ failed: true });
    } finally {
      setReading(null);
    }
  };

  const removeProof = () => {
    setProof(null);
    setPreview('');
    setFound(null);
    if (refFrom === 'picture') { setRef(''); setRefFrom('typed'); }
  };

  const onPaste = (e) => {
    const text = e.clipboardData.getData('text');
    if (text.length < 30) return;
    const result = readPaymentText(text);
    if (result.ref) {
      e.preventDefault();
      setRef(result.ref);
      setRefFrom('pasted');
      setFound(result);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setLocal('');
    try {
      const transactionRef = needsRef ? normaliseRef(ref) : (ref.trim() || '');
      if (needsRef && proof) {
        const form = new FormData();
        form.append('method', method);
        form.append('amountPaid', String(Math.trunc(Number(amount))));
        form.append('transactionRef', transactionRef);
        form.append('proof', proof, proof.name || 'proof.jpg');
        await upload(`/cashier/orders/${order.id}/payment`, form);
      } else {
        await api(`/cashier/orders/${order.id}/payment`, {
          method: 'POST',
          body: { method, amountPaid: Number(amount), transactionRef: transactionRef || null },
        });
      }
      onDone(`${order.order_no} paid. ${money(amount)}. It is with Accounts now.`);
    } catch (err) {
      setLocal(err.message);
      onError('');
    } finally {
      setBusy(false);
    }
  };

  const mismatch = found && !found.failed && found.amount && needsRef && found.amount !== Math.trunc(Number(amount || 0));

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        title={`Take payment: ${order.order_no}`}
        description={`${order.ordered_by_name || 'Walk-in'} · ${order.item_count} ${order.item_count === 1 ? 'item' : 'items'} · due ${money(order.total)}`}
      >
        <form onSubmit={submit}>
          <DialogBody className="space-y-4">
            {local && <Alert>{local}</Alert>}

            <Field label="How did they pay?">
              <Segmented name="Payment method" value={method} onChange={setMethod} options={METHODS} />
            </Field>

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

            {needsRef && (
              <Field
                label="Proof of payment"
                hint={proof ? null : 'A screenshot or photo of the message. The transaction ID is read off it for you.'}
              >
                {!proof ? (
                  <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-input bg-card px-4 py-4 text-[13.5px] font-semibold text-primary transition-colors hover:border-primary hover:bg-accent">
                    <input
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={(e) => { attach(e.target.files && e.target.files[0]); e.target.value = ''; }}
                    />
                    <ImageUp className="size-4" /> Attach the screenshot
                  </label>
                ) : (
                  <div className="flex items-center gap-3 rounded-md border bg-card p-2.5">
                    <button type="button" onClick={() => setBig((b) => !b)} title={big ? 'Hide the picture' : 'Show the picture'} className="shrink-0">
                      <img src={preview} alt="Payment screenshot" className="h-16 w-12 rounded border object-cover object-center" />
                    </button>
                    <div className="min-w-0 flex-1 text-[13px] text-muted-foreground">
                      {reading ? (
                        <>
                          <span className="block font-medium text-foreground">
                            {reading.stage === 'preparing' ? 'Getting the reader ready…' : 'Reading the transaction ID…'}
                          </span>
                          <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-muted">
                            <span className="block h-full rounded-full bg-primary transition-[width] duration-200" style={{ width: `${Math.round((reading.progress || 0) * 100)}%` }} />
                          </span>
                        </>
                      ) : found && found.ref ? (
                        <>Read <strong className="tnum text-foreground">{found.ref}</strong>{found.network ? ` · ${found.network}` : ''}. Check it matches the picture.</>
                      ) : found ? (
                        'Could not read an ID off this picture. Type it in below. The picture is kept as the record.'
                      ) : 'Attached.'}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <Button type="button" variant="ghost" size="sm" onClick={() => setBig((b) => !b)} disabled={!!reading}>
                        {big ? 'Hide picture' : 'Show picture'}
                      </Button>
                      <Button type="button" variant="ghost" size="sm" onClick={removeProof} disabled={!!reading}>Remove</Button>
                    </div>
                  </div>
                )}
              </Field>
            )}

            {needsRef && proof && big && (
              <div className="max-h-[320px] overflow-auto rounded-md border bg-muted">
                <img src={preview} alt="Payment screenshot, full width" className="block w-full" />
              </div>
            )}

            <Field
              label={method === 'cash' ? 'Reference (optional)' : 'Transaction ID'}
              hint={
                dupe ? null
                  : refFrom === 'picture' ? 'Filled in from the picture. Correct it if it is wrong.'
                    : refFrom === 'pasted' ? 'Taken from the message you pasted.'
                      : method === 'mobile_money' ? 'From the MTN or Airtel message. You can paste the whole message here.'
                        : method === 'card' ? 'The RRN or reference on the card slip.' : null
              }
            >
              <Input
                value={ref}
                onChange={(e) => { setRef(e.target.value); setRefFrom('typed'); }}
                onPaste={onPaste}
                placeholder={method === 'cash' ? 'Optional' : method === 'card' ? '432118765123' : '12345678901 or MP261123.1401.A77821'}
                required={needsRef}
                autoComplete="off"
                spellCheck={false}
                className={needsRef ? 'tnum uppercase tracking-wide' : undefined}
              />
              {dupe && (
                <p className="mt-1 text-[12px] font-medium text-destructive">
                  Already used. It paid for order {dupe.orderNo} (receipt {dupe.receiptNo}).
                </p>
              )}
            </Field>

            {mismatch && (
              <Alert tone="warning">
                The message says {money(found.amount)}, but {money(Math.trunc(Number(amount || 0)))} is entered as received. Check before recording.
              </Alert>
            )}
          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={busy || !!reading || (needsRef && (!normaliseRef(ref) || !!dupe))}>
              {busy ? 'Saving…' : `Record ${money(amount || 0)}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
