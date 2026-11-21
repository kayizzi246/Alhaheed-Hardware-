'use client';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { money, dateTime, today, methodLabel, list } from '@/lib/format';
import { Card, Empty, Alert, Modal } from '@/components/ui';

/** Receipts issued at this desk, with a printable view. */
export default function ReceiptsPage() {
  const [date, setDate] = useState(today());
  const [mine, setMine] = useState(true);
  const [receipts, setReceipts] = useState([]);
  const [open, setOpen] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const r = await api(`/api/cashier/receipts?date=${date}&mine=${mine ? 1 : 0}`);
      setReceipts(list(r.receipts));
    } catch (e) { setError(e.message); }
  }, [date, mine]);

  useEffect(() => { load(); }, [load]);

  const total = receipts.reduce((s, r) => s + r.amount_paid, 0);

  return (
    <>
      <div className="page-head">
        <h1>Receipts</h1>
        <div className="page-meta">{receipts.length} receipt(s) &middot; {money(total)}</div>
      </div>

      <Alert>{error}</Alert>

      <Card
        title="Issued receipts"
        action={
          <div className="filters">
            <div className="field">
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <label style={{ display: 'flex', gap: 6, alignItems: 'center', margin: 0 }}>
              <input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)}
                     style={{ width: 'auto' }} />
              Only mine
            </label>
          </div>
        }
      >
        {receipts.length === 0 ? (
          <Empty>No receipts for this date.</Empty>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Receipt</th><th>Order</th><th>Customer</th><th>Method</th>
                <th>Reference</th><th className="num">Amount</th><th>Time</th><th />
              </tr>
            </thead>
            <tbody>
              {receipts.map((r) => (
                <tr key={r.id}>
                  <td className="order-no">{r.receipt_no}</td>
                  <td>#{r.order_no}</td>
                  <td>{r.company_name || r.customer_name}</td>
                  <td>{methodLabel(r.method)}</td>
                  <td>{r.transaction_ref || '—'}</td>
                  <td className="num">{money(r.amount_paid)}</td>
                  <td>{dateTime(r.created_at)}</td>
                  <td>
                    <button className="btn btn-ghost btn-sm" onClick={() => setOpen(r.receipt_no)}>
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {open && <ReceiptModal receiptNo={open} onClose={() => setOpen(null)} />}
    </>
  );
}

function ReceiptModal({ receiptNo, onClose }) {
  const [receipt, setReceipt] = useState(null);

  useEffect(() => {
    api(`/api/cashier/receipts/${receiptNo}`).then((r) => setReceipt(r.receipt)).catch(() => {});
  }, [receiptNo]);

  if (!receipt) return <Modal title="Receipt" onClose={onClose}>Loading…</Modal>;

  return (
    <Modal
      title={`Receipt ${receipt.receiptNo}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>Close</button>
          <button className="btn btn-navy" onClick={() => window.print()}>Print</button>
        </>
      }
    >
      <div id="printable-receipt">
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>{receipt.shop}</div>
          <div className="sub">Kampala, Uganda</div>
        </div>

        <div style={{ display: 'grid', gap: 4, fontSize: 12.5, marginBottom: 14 }}>
          <Row k="Receipt No." v={receipt.receiptNo} />
          <Row k="Order No." v={`#${receipt.orderNo}`} />
          <Row k="Customer" v={receipt.customer} />
          {receipt.customer !== receipt.orderedBy && <Row k="Ordered by" v={receipt.orderedBy} />}
          <Row k="Date" v={dateTime(receipt.dateTime)} />
          <Row k="Cashier" v={receipt.cashier} />
        </div>

        <table style={{ fontSize: 12.5 }}>
          <thead>
            <tr><th>Item</th><th className="num">Qty</th><th className="num">Total</th></tr>
          </thead>
          <tbody>
            {receipt.items.map((i) => (
              <tr key={i.id}>
                <td>{i.product_name}<div className="sub">{money(i.unit_price)} / {i.unit}</div></td>
                <td className="num">{i.quantity}</td>
                <td className="num">{money(i.line_total)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ marginTop: 14, display: 'grid', gap: 4, fontSize: 13 }}>
          <Row k="Subtotal" v={money(receipt.subtotal)} />
          {receipt.deliveryFee > 0 && <Row k="Delivery" v={money(receipt.deliveryFee)} />}
          <Row k="Total" v={<strong>{money(receipt.total)}</strong>} />
          <Row k={`Paid (${methodLabel(receipt.method)})`} v={money(receipt.amountPaid)} />
          {receipt.change > 0 && <Row k="Change" v={money(receipt.change)} />}
          {receipt.transactionRef && <Row k="Reference" v={receipt.transactionRef} />}
        </div>

        <div style={{ textAlign: 'center', marginTop: 18, fontSize: 11.5, color: 'var(--muted)' }}>
          Thank you for your business.
        </div>
      </div>
    </Modal>
  );
}

const Row = ({ k, v }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
    <span style={{ color: 'var(--muted)' }}>{k}</span>
    <span>{v}</span>
  </div>
);
