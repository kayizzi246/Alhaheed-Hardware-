'use client';

import { useCallback, useState } from 'react';
import { api, getUser } from '@/lib/api';
import { usePoll } from '@/lib/live';
import { money, shortMoney, methodLabel, time, list } from '@/lib/format';
import {
  Alert, Button, Card, CardHead, CardTitle, Empty, Field, Fresh, Loading, Modal,
  PageHead, Stat, Stats, Table, TableWrap, Td, Textarea, Th, Tr,
} from '@/components/ui';
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
  const [data, setData] = useState(null);
  const [rejecting, setRejecting] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    try {
      setData(await api('/api/accounts/queue'));
      setError('');
    } catch (e) {
      setData({ orders: [], summary: {} });
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
          ? `${order.order_no} verified — the store can pack it now.`
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

  if (!data) return <Loading>Loading payments to verify…</Loading>;

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
        <Stat label="Awaiting verification" value={s.awaiting ?? 0} lead={orders.length > 0} note={orders.length ? 'oldest first' : 'all checked'} />
        <Stat label="Verified today" value={s.verified_today ?? 0} />
        <Stat label="Cash in today" value={shortMoney(s.cash_in)} note={money(s.cash_in)} tone="ok" />
        <Stat label="Cash out today" value={shortMoney(s.cash_out)} note={money(s.cash_out)} tone="bad" />
      </Stats>

      <Card className="mb-4">
        <CardHead>
          <CardTitle>Payments awaiting verification</CardTitle>
          <span className="text-[12.5px] text-ink-muted">
            {orders.length === 0 ? 'nothing waiting' : `${orders.length} to check`}
          </span>
        </CardHead>

        {orders.length === 0 ? (
          <Empty title="Nothing to check">
            Every payment the cashiers have taken has been verified.
          </Empty>
        ) : (
          <TableWrap>
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
                        <span className="block text-xs text-ink-muted">Ordered by {o.ordered_by_name}</span>
                      )}
                    </Td>
                    <Td>{methodLabel(o.method)}</Td>
                    <Td className="text-ink-muted">{o.transaction_ref || '—'}</Td>
                    <Td num className="font-semibold text-ink">{money(o.amount_paid)}</Td>
                    <Td>
                      {o.cashier_name}
                      <span className="tnum block text-xs text-ink-muted">{time(o.created_at)}</span>
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
        )}
      </Card>

      <Card>
        <CardHead><CardTitle>Cash book — today</CardTitle></CardHead>
        <CashBookTable />
      </Card>

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
        hint='The cashier reads this. Be specific — "no MM message found", "UGX 5,000 short".'
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
