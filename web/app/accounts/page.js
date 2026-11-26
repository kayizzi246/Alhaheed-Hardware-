'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, getUser, peek } from '@/lib/api';
import { usePoll } from '@/lib/live';
import { money, shortMoney, methodLabel, time, list } from '@/lib/format';
import {
  Alert, Button, Card, CardHead, CardTitle, Empty, Field, Fresh, Loading, Modal,
  PageHead, Stat, Stats, Table, TableWrap, Td, Textarea, Th, Tr, LoadFailed } from '@/components/ui';
import { Icon } from '@/components/icons';
import CashBookTable from '@/components/CashBookTable';

/**
 * The accounts desk.
 *
 * Check that each payment the cashier recorded actually arrived — in
 * the drawer, or as a mobile-money message — then send the order on to
 * the store. Approving is the common case, so it is the primary
 * button; rejecting asks for a reason, because a cashier told only
 * "rejected" has nothing to act on.
 */
export default function VerifyPayments() {
  const [data, setData] = useState(() => peek('/api/accounts/queue'));
  const [rejecting, setRejecting] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [viewing, setViewing] = useState(null);

  const load = useCallback(async () => {
    try {
      setData(await api('/api/accounts/queue'));
      setError('');
    } catch (e) {
      // On failure, keep what was on screen; the error says it is stale.
      setError(e.message);
    }
  }, []);

  // Payments arrive from the cashier, so the queue re-checks itself.
  const { at, failing } = usePoll(load, 10000);

  async function verify(order, approve, remarks) {
    setBusyId(order.id);
    setError('');
    try {
      await api(`/api/accounts/orders/${order.id}/verify`, {
        method: 'POST',
        body: { approve, remarks: remarks || null },
      });
      setNotice(
        approve
          ? `${order.order_no} verified. The store can pack it now.`
          : `${order.order_no} sent back to the cashier.`
      );
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
      setRejecting(null);
    }
  }

  if (!data) return error ? <LoadFailed onRetry={load}>{error}</LoadFailed> : <Loading>Loading payments to verify…</Loading>;

  const user = getUser();
  const s = data.summary || {};
  const orders = list(data.orders);

  return (
    <>
      <PageHead
        title="Verify payments"
        sub={`${user?.fullName ?? ''} · ${new Date().toLocaleDateString('en-GB', {
          weekday: 'long', day: 'numeric', month: 'long',
        })}`}
      >
        <Fresh at={at} failing={failing} />
      </PageHead>

      <Alert>{error}</Alert>
      <Alert kind="ok" onDone={() => setNotice('')}>{notice}</Alert>

      <Stats>
        <Stat
          label="Awaiting verification"
          value={s.awaiting ?? 0}
          lead={orders.length > 0}
          note={orders.length ? 'oldest first' : 'all checked'}
          icon={Icon.queue()}
          tone={orders.length ? 'warn' : 'ok'}
        />
        <Stat label="Verified today" value={s.verified_today ?? 0} note="sent on to the store" icon={Icon.check()} tone="ok" />
        <Stat label="Cash in today" value={shortMoney(s.cash_in)} note={money(s.cash_in)} icon={Icon.cash()} tone="ok" href="/accounts/cash-book" />
        <Stat label="Cash out today" value={shortMoney(s.cash_out)} note={money(s.cash_out)} icon={Icon.cash()} tone="bad" href="/accounts/cash-book" />
      </Stats>

      <Card className="mb-4">
        <CardHead>
          <CardTitle>Payments awaiting verification</CardTitle>
          <span className="text-[12px] text-ink-muted">
            {orders.length === 0 ? 'nothing waiting' : `${orders.length} to check`}
          </span>
        </CardHead>

        {orders.length === 0 ? (
          <Empty title="Nothing to check">
            Every payment the cashiers have taken has been verified.
          </Empty>
        ) : (
          <>
          {/* On a phone, one card per payment with its buttons in reach.
              The table put Verify past the right edge of the screen. */}
          <ul className="divide-y divide-line md:hidden">
            {orders.map((o) => (
              <li key={o.id} className="px-4 py-3.5">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="tnum text-[13.5px] font-bold text-ink">{o.order_no}</span>
                  <span className="tnum text-[13.5px] font-bold text-ink">{money(o.amount_paid)}</span>
                </div>
                <p className="mt-0.5 text-[12.5px] font-medium text-ink">{o.company_name || o.ordered_by_name}</p>
                <p className="mt-1 text-[12px] text-ink-muted">
                  {methodLabel(o.method)}
                  {o.transaction_ref ? <> · <span className="tnum">{o.transaction_ref}</span></> : null}
                </p>
                <p className="text-[12px] text-ink-muted">
                  <span className="tnum">{o.receipt_no}</span> · {o.cashier_name} · <span className="tnum">{time(o.created_at)}</span>
                </p>
                {o.has_proof && (
                  <button type="button" onClick={() => setViewing(o)} className="mt-1.5 text-[12px] font-semibold text-brand">
                    See the screenshot
                  </button>
                )}
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Button variant="danger" disabled={busyId === o.id} onClick={() => setRejecting(o)}>Reject</Button>
                  <Button variant="good" disabled={busyId === o.id} onClick={() => verify(o, true)}>Verify</Button>
                </div>
              </li>
            ))}
          </ul>
          <TableWrap className="hidden md:block">
            <Table>
              <thead>
                <tr>
                  <Th>Order</Th><Th>Receipt</Th><Th>Customer</Th><Th>Method</Th>
                  <Th>Reference</Th><Th num>Amount</Th><Th>Cashier</Th><Th />
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <Tr key={o.id}>
                    <Td className="tnum font-bold text-ink">{o.order_no}</Td>
                    <Td className="tnum">{o.receipt_no}</Td>
                    <Td>
                      <span className="font-medium text-ink">{o.company_name || o.ordered_by_name}</span>
                      {o.company_name && (
                        <span className="block text-[11.5px] text-ink-muted">Ordered by {o.ordered_by_name}</span>
                      )}
                    </Td>
                    <Td>{methodLabel(o.method)}</Td>
                    <Td>
                      <span className="tnum block text-ink-muted">{o.transaction_ref || ''}</span>
                      {o.has_proof ? (
                        <button
                          type="button"
                          onClick={() => setViewing(o)}
                          className="mt-0.5 text-[11.5px] font-semibold text-brand hover:underline"
                        >
                          See the screenshot
                        </button>
                      ) : o.method !== 'cash' ? (
                        <span className="mt-0.5 block text-[11.5px] text-ink-faint">no screenshot</span>
                      ) : null}
                    </Td>
                    <Td num className="font-semibold text-ink">{money(o.amount_paid)}</Td>
                    <Td>
                      {o.cashier_name}
                      <span className="tnum block text-[11.5px] text-ink-muted">{time(o.created_at)}</span>
                    </Td>
                    <Td>
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="danger"
                          size="sm"
                          disabled={busyId === o.id}
                          onClick={() => setRejecting(o)}
                        >
                          Reject
                        </Button>
                        <Button
                          variant="good"
                          size="sm"
                          disabled={busyId === o.id}
                          onClick={() => verify(o, true)}
                        >
                          Verify
                        </Button>
                      </div>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
          </>
        )}
      </Card>

      <Card>
        <CardHead><CardTitle>Cash book today</CardTitle></CardHead>
        <CashBookTable />
      </Card>

      {viewing && (
        <ProofModal
          order={viewing}
          onClose={() => setViewing(null)}
          onVerify={() => { const o = viewing; setViewing(null); verify(o, true); }}
          onReject={() => { const o = viewing; setViewing(null); setRejecting(o); }}
        />
      )}

      {rejecting && (
        <RejectModal
          order={rejecting}
          busy={busyId === rejecting.id}
          onClose={() => setRejecting(null)}
          onConfirm={(remarks) => verify(rejecting, false, remarks)}
        />
      )}
    </>
  );
}

function RejectModal({ order, onClose, onConfirm, busy }) {
  const [remarks, setRemarks] = useState('');

  return (
    <Modal
      title={`Send ${order.order_no} back`}
      description="The order goes back to the cashier and the customer is told it is being looked at."
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            variant="danger"
            disabled={busy || remarks.trim().length < 3}
            onClick={() => onConfirm(remarks)}
          >
            {busy ? 'Sending back…' : 'Reject & send back'}
          </Button>
        </>
      }
    >
      <Field
        label="Why is it going back?"
        hint='The cashier reads this. Be specific: "no MM message found", "UGX 5,000 short".'
      >
        <Textarea
          rows={3}
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          placeholder="No matching entry on the mobile money statement"
          autoFocus
        />
      </Field>
    </Modal>
  );
}

/**
 * The screenshot behind a payment, beside the figures it should show.
 *
 * Accounts compares three things: the amount, the reference, and the
 * picture. They sit together here so nobody verifies from memory of
 * what was on another screen. The picture is fetched with the desk's
 * token — it is not on a public URL, because it carries the customer's
 * name and number.
 */
function ProofModal({ order, onClose, onVerify, onReject }) {
  const [src, setSrc] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let url = '';
    let live = true;
    api(`/api/payments/${order.payment_id}/proof`, { raw: true })
      .then(async (res) => {
        if (!res.ok) throw new Error(res.status === 404 ? 'The picture is missing.' : 'The picture could not be loaded.');
        url = URL.createObjectURL(await res.blob());
        if (live) setSrc(url);
      })
      .catch((e) => live && setError(e.message));
    return () => { live = false; if (url) URL.revokeObjectURL(url); };
  }, [order.payment_id]);

  return (
    <Modal
      title={`Proof for ${order.order_no}`}
      description={`Receipt ${order.receipt_no} · taken by ${order.cashier_name || 'the cashier'}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="danger" onClick={onReject}>Reject</Button>
          <Button variant="good" onClick={onVerify}>It matches, verify</Button>
        </>
      }
    >
      <dl className="mb-3 grid grid-cols-3 gap-2 rounded-sm border border-line bg-surface-2 px-3 py-2.5 text-[12px]">
        <div>
          <dt className="text-[11px] font-bold uppercase tracking-[.07em] text-ink-muted">Amount</dt>
          <dd className="tnum mt-0.5 font-semibold text-ink">{money(order.amount_paid)}</dd>
        </div>
        <div>
          <dt className="text-[11px] font-bold uppercase tracking-[.07em] text-ink-muted">Method</dt>
          <dd className="mt-0.5 font-semibold text-ink">{methodLabel(order.method)}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-[11px] font-bold uppercase tracking-[.07em] text-ink-muted">Transaction ID</dt>
          <dd className="tnum whitespace-normal mt-0.5 break-all font-semibold text-ink">{order.transaction_ref}</dd>
        </div>
      </dl>
      <Alert>{error}</Alert>
      {!src && !error && <Loading>Loading the picture…</Loading>}
      {src && (
        <a href={src} target="_blank" rel="noreferrer" title="Open full size">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={`Payment screenshot for ${order.order_no}`} className="max-h-[55vh] w-full rounded-sm border border-line object-contain" />
        </a>
      )}
    </Modal>
  );
}
