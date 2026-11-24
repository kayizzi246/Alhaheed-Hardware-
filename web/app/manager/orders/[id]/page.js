'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { api, peek } from '@/lib/api';
import { money, dateTime, statusLabel, methodLabel, list } from '@/lib/format';
import {
  Alert, Button, Card, CardHead, CardTitle, Field, Input, Loading, Modal,
  StatusChip, Table, TableWrap, Td, Th, Tr,
} from '@/components/ui';

/** One order in full: the items, the receipt, and who touched it. */
export default function ManagerOrderDetail() {
  const { id } = useParams();
  const [order, setOrder] = useState(() => peek(`/api/orders/${id}`)?.order ?? null);
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    try {
      setOrder((await api(`/api/orders/${id}`)).order);
      setError('');
    } catch (e) {
      setError(e.message);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function cancel() {
    try {
      await api(`/api/orders/${id}/cancel`, { method: 'POST', body: { reason } });
      setCancelling(false);
      setNotice('Order cancelled. The customer has been texted.');
      load();
    } catch (e) {
      setError(e.message);
      setCancelling(false);
    }
  }

  if (error && !order) return <Alert>{error}</Alert>;
  if (!order) return <Loading>Loading the order…</Loading>;

  const canCancel = !['released', 'cancelled', 'refunded'].includes(order.status);

  return (
    <>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="tnum text-[26px] leading-tight text-ink">Order {order.order_no}</h1>
          <p className="mt-1 text-sm text-ink-muted">{dateTime(order.created_at)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="ghost" size="sm"><Link href="/manager/orders">← All orders</Link></Button>
          {canCancel && (
            <Button variant="danger" size="sm" onClick={() => setCancelling(true)}>Cancel order</Button>
          )}
          <Button size="sm" className="print:hidden" onClick={() => window.print()}>Print</Button>
        </div>
      </header>

      <Alert>{error}</Alert>
      <Alert kind="ok" onDone={() => setNotice('')}>{notice}</Alert>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHead><CardTitle>The order</CardTitle></CardHead>
          <TableWrap>
            <Table>
              <tbody>
                <Row k="Status"><StatusChip status={order.status}>{statusLabel(order.status)}</StatusChip></Row>
                <Row k="Customer">{order.company_name || order.ordered_by_name}</Row>
                {order.company_name && <Row k="Ordered by">{order.ordered_by_name}</Row>}
                <Row k="Phone"><span className="tnum">{order.ordered_by_phone || ''}</span></Row>
                <Row k="Fulfilment">{order.fulfilment === 'delivery' ? 'Delivery' : 'Pick-up'}</Row>
                {order.delivery_address && <Row k="Address">{order.delivery_address}</Row>}
                <Row k="Placed"><span className="tnum">{dateTime(order.created_at)}</span></Row>
                {order.notes && <Row k="Notes">{order.notes}</Row>}
                {order.cancel_reason && <Row k="Cancelled because">{order.cancel_reason}</Row>}
              </tbody>
            </Table>
          </TableWrap>
        </Card>

        {order.payment && (
          <Card>
            <CardHead><CardTitle>Payment</CardTitle></CardHead>
            <TableWrap>
              <Table>
                <tbody>
                  <Row k="Receipt"><span className="tnum font-bold text-ink">{order.payment.receipt_no}</span></Row>
                  <Row k="Method">{methodLabel(order.payment.method)}</Row>
                  {order.payment.transaction_ref && (
                    <Row k="Transaction ref"><span className="tnum">{order.payment.transaction_ref}</span></Row>
                  )}
                  <Row k="Paid"><span className="tnum font-semibold text-ink">{money(order.payment.amount_paid)}</span></Row>
                  <Row k="Taken by">{order.payment.cashier_name}</Row>
                  <Row k="Verified">
                    {order.payment.verified === 1 && <span className="text-ok">Yes, by {order.payment.verifier_name}</span>}
                    {order.payment.verified === 0 && <span className="text-ink-muted">Not yet</span>}
                    {order.payment.verified === -1 && <span className="font-semibold text-bad">Rejected</span>}
                  </Row>
                  {order.payment.verify_remarks && <Row k="Remarks">{order.payment.verify_remarks}</Row>}
                </tbody>
              </Table>
            </TableWrap>
          </Card>
        )}
      </div>

      <Card className="mt-4">
        <CardHead><CardTitle>Items</CardTitle></CardHead>
        <TableWrap>
          <Table>
            <thead>
              <tr>
                <Th>Product</Th><Th num>Qty</Th><Th num>Unit price</Th><Th num>Line total</Th>
              </tr>
            </thead>
            <tbody>
              {list(order.items).map((i) => (
                <Tr key={i.id}>
                  <Td>
                    <span className="font-medium text-ink">{i.product_name}</span>
                    {i.code && <span className="tnum ml-2 text-ink-muted">{i.code}</span>}
                  </Td>
                  <Td num>{i.quantity} {i.unit}</Td>
                  <Td num>{money(i.unit_price)}</Td>
                  <Td num className="font-semibold text-ink">{money(i.line_total)}</Td>
                </Tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-surface-2">
                <Td colSpan={3} className="font-bold text-ink">Total</Td>
                <Td num className="font-display text-[15px] font-extrabold text-ink">{money(order.total)}</Td>
              </tr>
            </tfoot>
          </Table>
        </TableWrap>
      </Card>

      <Card className="mt-4">
        <CardHead><CardTitle>Audit trail</CardTitle></CardHead>
        <TableWrap>
          <Table>
            <thead>
              <tr><Th>When</Th><Th>Desk</Th><Th>What</Th><Th>Who</Th><Th>Notes</Th></tr>
            </thead>
            <tbody>
              {list(order.events).map((e) => (
                <Tr key={e.id}>
                  <Td className="tnum whitespace-nowrap text-ink-muted">{dateTime(e.created_at)}</Td>
                  <Td className="capitalize text-ink-muted">{e.stage}</Td>
                  <Td className="font-medium capitalize text-ink">{String(e.action).replace(/_/g, ' ')}</Td>
                  <Td>{e.handler_name || ''}</Td>
                  <Td className="text-ink-muted">{e.notes || ''}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </TableWrap>
      </Card>

      {cancelling && (
        <Modal
          title={`Cancel ${order.order_no}?`}
          description="The customer is texted. If money has already been taken, the cashier and accounts will need to sort the refund out between them. The panel cannot move money back on its own."
          onClose={() => setCancelling(false)}
          footer={
            <>
              <Button variant="outline" onClick={() => setCancelling(false)}>Keep it</Button>
              <Button variant="danger" onClick={cancel}>Cancel order</Button>
            </>
          }
        >
          <Field label="Why">
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Goods out of stock, customer changed their mind…"
              autoFocus
            />
          </Field>
        </Modal>
      )}
    </>
  );
}

const Row = ({ k, children }) => (
  <Tr>
    <Th className="w-[150px] border-b border-line bg-transparent normal-case tracking-normal">{k}</Th>
    <Td>{children}</Td>
  </Tr>
);
