/**
 * The accounts desk.
 *
 * Two jobs. Check that each payment the cashier recorded actually
 * arrived — in the drawer, or as a mobile-money message — and keep the
 * day's cash book.
 *
 * Approving is the common case, so it is the primary button. Rejecting
 * asks for a reason, because a rejection sends the order back to the
 * cashier and a cashier told only "rejected" has nothing to act on.
 */
import * as React from 'react';
import { CheckCircle2, BookOpen } from 'lucide-react';
import { api, money, shortMoney, at, methodLabel, CONFIG } from '@/lib/api';
import { usePoll } from '@/lib/usePoll';
import {
  Alert, Button, Card, CardBody, CardHeader, CardTitle, Dialog, DialogBody, DialogContent,
  DialogFooter, Empty, Field, Input, Segmented, Skeleton, Table, Tabs, TabsContent, TabsList,
  TabsTrigger, Td, Th,
} from '@/ui';
import { Head, OrderRow, Queue, Tiles } from '@/ui/bits';

export default function Accounts() {
  const [queue, setQueue] = React.useState(null);
  const [book, setBook] = React.useState(null);
  const [ruling, setRuling] = React.useState(null); // { order, approve }
  const [note, setNote] = React.useState('');
  const [error, setError] = React.useState('');

  const load = React.useCallback(async () => {
    const [q, b] = await Promise.all([
      api('/accounts/queue'),
      api('/accounts/cash-book').catch(() => null),
    ]);
    setQueue(q);
    setBook(b);
  }, []);

  const poll = usePoll(load, 10000);
  const s = (queue && queue.summary) || {};
  const orders = (queue && queue.orders) || [];

  return (
    <>
      <Head
        title="Accounts"
        sub={`${CONFIG.user.name} · verify what came in, keep the book`}
        fresh={{ at: poll.at, failing: poll.failing }}
      />

      <Tiles
        loading={!poll.ready}
        items={[
          { label: 'Awaiting check', value: s.awaiting ?? 0, lead: true, note: orders.length ? 'oldest first' : 'all checked' },
          { label: 'Verified today', value: s.verified_today ?? 0 },
          { label: 'Cash in', value: shortMoney(s.cash_in), note: money(s.cash_in) },
          { label: 'Cash out', value: shortMoney(s.cash_out), note: money(s.cash_out) },
        ]}
      />

      {note && <Alert tone="success">{note}</Alert>}
      {error && <Alert>{error}</Alert>}

      <Tabs defaultValue="queue">
        <TabsList className="mb-4">
          <TabsTrigger value="queue">To verify{orders.length ? ` · ${orders.length}` : ''}</TabsTrigger>
          <TabsTrigger value="book">Cash book</TabsTrigger>
        </TabsList>

        <TabsContent value="queue">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Payments to check</CardTitle>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Open a row to see what was bought and what the cashier recorded.
                </p>
              </div>
            </CardHeader>
            {!poll.ready ? (
              <CardBody className="space-y-2">
                <Skeleton className="h-16" /><Skeleton className="h-16" />
              </CardBody>
            ) : orders.length === 0 ? (
              <Empty icon={CheckCircle2} title="Nothing to check">
                Every payment the cashiers have taken has been verified.
              </Empty>
            ) : (
              <Queue>
                {orders.map((o) => (
                  <OrderRow
                    key={o.id}
                    order={o}
                    actions={
                      <>
                        <Button variant="destructive" onClick={() => { setRuling({ order: o, approve: false }); setNote(''); }}>
                          Reject
                        </Button>
                        <Button variant="success" onClick={() => { setRuling({ order: o, approve: true }); setNote(''); }}>
                          Verify
                        </Button>
                      </>
                    }
                  />
                ))}
              </Queue>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="book">
          <CashBook book={book} onSaved={(msg) => { setNote(msg); poll.refresh(); }} />
        </TabsContent>
      </Tabs>

      <Ruling
        ruling={ruling}
        onClose={() => setRuling(null)}
        onDone={(msg) => { setRuling(null); setNote(msg); poll.refresh(); }}
      />
    </>
  );
}

/* ── Verify or reject ────────────────────────────────────────────── */

function Ruling({ ruling, onClose, onDone }) {
  const [remarks, setRemarks] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [local, setLocal] = React.useState('');

  React.useEffect(() => { setRemarks(''); setLocal(''); }, [ruling && ruling.order.id, ruling && ruling.approve]);

  if (!ruling) return null;
  const { order, approve } = ruling;

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      await api(`/accounts/orders/${order.id}/verify`, {
        method: 'POST',
        body: { approve, remarks: remarks || null },
      });
      onDone(
        approve
          ? `${order.order_no} verified — the store can pack it now.`
          : `${order.order_no} sent back to the cashier.`
      );
    } catch (err) {
      setLocal(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        title={approve ? `Verify ${order.order_no}` : `Send ${order.order_no} back`}
        description={
          approve
            ? `${money(order.total)} from ${order.ordered_by_name || 'a walk-in customer'}. Confirm the money is in the drawer or in the mobile-money account before you verify.`
            : 'The cashier will see this order again, with your reason. The customer is told it is being looked at.'
        }
      >
        <form onSubmit={submit}>
          <DialogBody className="space-y-4">
            {local && <Alert>{local}</Alert>}
            <Field
              label={approve ? 'Remarks (optional)' : 'Why is it going back?'}
              hint={approve ? 'Anything worth remembering about this payment.' : 'The cashier reads this. Be specific — "no MM message found", "UGX 5,000 short".'}
            >
              <Input
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                required={!approve}
                autoFocus
                placeholder={approve ? '—' : 'No mobile-money message for this reference'}
              />
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" variant={approve ? 'success' : 'destructive'} disabled={busy}>
              {busy ? 'Saving…' : approve ? 'Verify payment' : 'Send back'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ── The day's cash book ─────────────────────────────────────────── */

const SIDES = [
  { value: 'in', label: 'Money in' },
  { value: 'out', label: 'Money out' },
];

function CashBook({ book, onSaved }) {
  const [side, setSide] = React.useState('in');
  const [details, setDetails] = React.useState('');
  const [amount, setAmount] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [local, setLocal] = React.useState('');

  const add = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setLocal('');
    try {
      await api('/accounts/cash-book', {
        method: 'POST',
        body: {
          details,
          cashIn: side === 'in' ? Number(amount) : 0,
          cashOut: side === 'out' ? Number(amount) : 0,
        },
      });
      setDetails('');
      setAmount('');
      onSaved('Entry added to the cash book.');
    } catch (err) {
      setLocal(err.message);
    } finally {
      setBusy(false);
    }
  };

  const entries = (book && book.entries) || [];

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Cash book — {book ? book.date : 'today'}</CardTitle>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Opened at {money(book ? book.opening : 0)} · stands at {money(book ? book.closing : 0)}
            </p>
          </div>
        </CardHeader>
        {entries.length === 0 ? (
          <Empty icon={BookOpen} title="No entries yet">
            Payments the cashiers take are written here automatically. Add anything else by hand —
            float, bank deposits, transport, a supplier paid from the drawer.
          </Empty>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <thead>
                <tr><Th>Time</Th><Th>Details</Th><Th right>In</Th><Th right>Out</Th><Th right>Balance</Th></tr>
              </thead>
              <tbody>
                {entries.map((r) => (
                  <tr key={r.id}>
                    <Td className="text-muted-foreground">{at(r.created_at)}</Td>
                    <Td>{r.details}{r.method ? <span className="ml-2 text-muted-foreground">{methodLabel(r.method)}</span> : null}</Td>
                    <Td right className={r.cash_in ? 'font-semibold text-success' : 'text-muted-foreground'}>
                      {r.cash_in ? money(r.cash_in) : '—'}
                    </Td>
                    <Td right className={r.cash_out ? 'font-semibold text-destructive' : 'text-muted-foreground'}>
                      {r.cash_out ? money(r.cash_out) : '—'}
                    </Td>
                    <Td right className="font-semibold">{money(r.balance)}</Td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-muted/50">
                  <Td colSpan={4} className="font-semibold">Closing balance</Td>
                  <Td right className="text-[15px] font-bold">{money(book ? book.closing : 0)}</Td>
                </tr>
              </tfoot>
            </Table>
          </div>
        )}
      </Card>

      <Card className="h-fit">
        <CardHeader><CardTitle>Add an entry</CardTitle></CardHeader>
        <form onSubmit={add}>
          <CardBody className="space-y-4">
            {local && <Alert>{local}</Alert>}
            <Segmented name="Direction" value={side} onChange={setSide} options={SIDES} />
            <Field label="What is it for?">
              <Input
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                required
                placeholder={side === 'in' ? 'Opening float' : 'Deposited at Stanbic'}
              />
            </Field>
            <Field label={`Amount (${CONFIG.shop.currency})`}>
              <Input
                type="number" min="1" step="1" inputMode="numeric"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                className="tnum font-semibold"
              />
            </Field>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? 'Saving…' : 'Add to the book'}
            </Button>
          </CardBody>
        </form>
      </Card>
    </div>
  );
}
