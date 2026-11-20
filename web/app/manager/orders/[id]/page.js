'use client';
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { money, dateTime, statusLabel, methodLabel } from '@/lib/format';
import { Card, Chip, Alert, Modal } from '@/components/ui';

/** One order in full: the items, the receipt, and who touched it. */
export default function ManagerOrderDetail() {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    try { setOrder((await api(`/api/orders/${id}`)).order); setError(''); }
    catch (e) { setError(e.message); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function cancel() {
    try {
      await api(`/api/orders/${id}/cancel`, { method: 'POST', body: { reason } });
      setCancelling(false);
      setNotice('Order cancelled. The customer has been texted.');
      load();
    } catch (e) { setError(e.message); setCancelling(false); }
  }

  if (error && !order) return <Alert>{error}</Alert>;
  if (!order) return <div className="loading">Loading order…</div>;

  const canCancel = !['released', 'cancelled', 'refunded'].includes(order.status);

  return (
    <>
      <div className="page-head">
        <h1>Order {order.order_no}</h1>
        <div className="btn-row">
          <Link href="/manager/orders" className="btn btn-ghost">← All orders</Link>
          {canCancel && (
            <button className="btn btn-danger" onClick={() => setCancelling(true)}>Cancel order</button>
          )}
          <button className="btn btn-navy no-print" onClick={() => window.print()}>Print</button>
        </div>
      </div>

      <Alert>{error}</Alert>
      <Alert kind="ok" onDone={() => setNotice('')}>{notice}</Alert>

      <Card title="The order">
        <table>
          <tbody>
            <tr><th>Status</th><td><Chip status={order.status}>{statusLabel(order.status)}</Chip></td></tr>
            <tr><th>Customer</th><td>{order.company_name || order.ordered_by_name}</td></tr>
            {order.company_name && <tr><th>Ordered by</th><td>{order.ordered_by_name}</td></tr>}
            <tr><th>Phone</th><td>{order.ordered_by_phone || '—'}</td></tr>
            <tr><th>Fulfilment</th><td>{order.fulfilment === 'delivery' ? 'Delivery' : 'Pick-up'}</td></tr>
            {order.delivery_address && <tr><th>Address</th><td>{order.delivery_address}</td></tr>}
            <tr><th>Placed</th><td>{dateTime(order.created_at)}</td></tr>
            {order.notes && <tr><th>Notes</th><td>{order.notes}</td></tr>}
            {order.cancel_reason && <tr><th>Cancelled because</th><td>{order.cancel_reason}</td></tr>}
          </tbody>
        </table>
      </Card>

      <Card title="Items">
        <table>
          <thead>
            <tr><th>Product</th><th className="num">Qty</th><th className="num">Unit price</th><th className="num">Line total</th></tr>
          </thead>
          <tbody>
            {order.items.map((i) => (
              <tr key={i.id}>
                <td>{i.product_name} {i.code && <code>{i.code}</code>}</td>
                <td className="num">{i.quantity} {i.unit}</td>
                <td className="num">{money(i.unit_price)}</td>
                <td className="num">{money(i.line_total)}</td>
              </tr>
            ))}
            <tr>
              <td colSpan={3}><strong>Total</strong></td>
              <td className="num"><strong>{money(order.total)}</strong></td>
            </tr>
          </tbody>
        </table>
      </Card>

      {order.payment && (
        <Card title="Payment">
          <table>
            <tbody>
              <tr><th>Receipt</th><td><strong>{order.payment.receipt_no}</strong></td></tr>
              <tr><th>Method</th><td>{methodLabel(order.payment.method)}</td></tr>
              {order.payment.transaction_ref && (
                <tr><th>Transaction ref</th><td><code>{order.payment.transaction_ref}</code></td></tr>
              )}
              <tr><th>Paid</th><td>{money(order.payment.amount_paid)}</td></tr>
              <tr><th>Taken by</th><td>{order.payment.cashier_name}</td></tr>
              <tr>
                <th>Verified</th>
                <td>
                  {order.payment.verified === 1 && <>Yes, by {order.payment.verifier_name}</>}
                  {order.payment.verified === 0 && 'Not yet'}
                  {order.payment.verified === -1 && <span style={{ color: 'var(--red)' }}>Rejected</span>}
                </td>
              </tr>
              {order.payment.verify_remarks && (
                <tr><th>Remarks</th><td>{order.payment.verify_remarks}</td></tr>
              )}
            </tbody>
          </table>
        </Card>
      )}

      <Card title="Audit trail">
        <table>
          <thead>
            <tr><th>When</th><th>Desk</th><th>What</th><th>Who</th><th>Notes</th></tr>
          </thead>
          <tbody>
            {order.events.map((e) => (
              <tr key={e.id}>
                <td>{dateTime(e.created_at)}</td>
                <td>{e.stage}</td>
                <td>{String(e.action).replace(/_/g, ' ')}</td>
                <td>{e.handler_name || '—'}</td>
                <td>{e.notes || ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Modal open={cancelling} title={`Cancel ${order.order_no}?`} onClose={() => setCancelling(false)}>
        <p>
          The customer is texted. If money has already been taken, the cashier
          and accounts will need to sort the refund out between them — the app
          cannot move money back on its own.
        </p>
        <div className="field">
          <label htmlFor="why">Why</label>
          <input
            id="why"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Goods out of stock, customer changed their mind…"
          />
        </div>
        <div className="btn-row">
          <button className="btn btn-ghost" onClick={() => setCancelling(false)}>Keep it</button>
          <button className="btn btn-danger" onClick={cancel}>Cancel order</button>
        </div>
      </Modal>
    </>
  );
}
