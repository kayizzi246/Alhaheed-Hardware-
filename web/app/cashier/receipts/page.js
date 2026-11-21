'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { money, dateTime, today, methodLabel, list } from '@/lib/format';
import {
  Alert, Button, Card, CardHead, CardTitle, Checkbox, Empty, Input, Loading,
  Modal, PageHead, Table, TableWrap, Td, Th, Tr,
} from '@/components/ui';

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
      setError('');
    } catch (e) {
      setReceipts([]);
      setError(e.message);
    }
  }, [date, mine]);

  useEffect(() => { load(); }, [load]);

  const total = receipts.reduce((s, r) => s + r.amount_paid, 0);

  return (
    <>
      <PageHead
        title="Receipts"
        sub={`${receipts.length} ${receipts.length === 1 ? 'receipt' : 'receipts'} · ${money(total)}`}
      >
        <Input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="tnum w-[170px]"
        />
        <Checkbox label="Only mine" checked={mine} onChange={(e) => setMine(e.target.checked)} />
      </PageHead>

      <Alert>{error}</Alert>

      <Card>
        <CardHead>
          <CardTitle>Issued receipts</CardTitle>
          <span className="tnum text-[12.5px] text-ink-muted">{money(total)}</span>
        </CardHead>

        {receipts.length === 0 ? (
          <Empty title="No receipts for this date">
            Pick another day, or untick &ldquo;only mine&rdquo; to see the whole shop.
          </Empty>
        ) : (
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>Receipt</Th><Th>Order</Th><Th>Customer</Th><Th>Method</Th>
                  <Th>Reference</Th><Th num>Amount</Th><Th>Time</Th><Th />
                </tr>
              </thead>
              <tbody>
                {receipts.map((r) => (
                  <Tr key={r.id}>
                    <Td className="tnum font-bold text-ink">{r.receipt_no}</Td>
                    <Td className="tnum">{r.order_no}</Td>
                    <Td>{r.company_name || r.customer_name}</Td>
                    <Td>{methodLabel(r.method)}</Td>
                    <Td className="text-ink-muted">{r.transaction_ref || '—'}</Td>
                    <Td num className="font-semibold text-ink">{money(r.amount_paid)}</Td>
                    <Td className="tnum whitespace-nowrap text-ink-muted">{dateTime(r.created_at)}</Td>
                    <Td className="text-right">
                      <Button variant="outline" size="sm" onClick={() => setOpen(r.receipt_no)}>View</Button>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </Card>

      {open && <ReceiptModal receiptNo={open} onClose={() => setOpen(null)} />}
    </>
  );
}

function ReceiptModal({ receiptNo, onClose }) {
  const [receipt, setReceipt] = useState(null);

  useEffect(() => {
    api(`/api/cashier/receipts/${receiptNo}`)
      .then((r) => setReceipt(r.receipt))
      .catch(() => {});
  }, [receiptNo]);

  if (!receipt) {
    return (
      <Modal title="Receipt" onClose={onClose}>
        <Loading>Fetching the receipt…</Loading>
      </Modal>
    );
  }

  return (
    <Modal
      title={`Receipt ${receipt.receiptNo}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button onClick={() => window.print()}>Print</Button>
        </>
      }
    >
      <div id="printable-receipt" className="text-[12.5px]">
        <div className="mb-4 text-center">
          <div className="font-display text-base font-bold text-ink">{receipt.shop}</div>
          <div className="text-xs text-ink-muted">Kampala, Uganda</div>
        </div>

        <dl className="mb-4 grid gap-1">
          <Row k="Receipt no." v={receipt.receiptNo} />
          <Row k="Order no." v={receipt.orderNo} />
          <Row k="Customer" v={receipt.customer} />
          {receipt.customer !== receipt.orderedBy && <Row k="Ordered by" v={receipt.orderedBy} />}
          <Row k="Date" v={dateTime(receipt.dateTime)} />
          <Row k="Cashier" v={receipt.cashier} />
        </dl>

        <TableWrap>
          <Table className="text-[12.5px]">
            <thead>
              <tr><Th>Item</Th><Th num>Qty</Th><Th num>Total</Th></tr>
            </thead>
            <tbody>
              {list(receipt.items).map((i) => (
                <Tr key={i.id}>
                  <Td>
                    <span className="text-ink">{i.product_name}</span>
                    <span className="block text-xs text-ink-muted">
                      {money(i.unit_price)} / {i.unit}
                    </span>
                  </Td>
                  <Td num>{i.quantity}</Td>
                  <Td num>{money(i.line_total)}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </TableWrap>

        <dl className="mt-4 grid gap-1 text-[13px]">
          <Row k="Subtotal" v={money(receipt.subtotal)} />
          {receipt.deliveryFee > 0 && <Row k="Delivery" v={money(receipt.deliveryFee)} />}
          <Row k="Total" v={<strong className="font-bold text-ink">{money(receipt.total)}</strong>} />
          <Row k={`Paid (${methodLabel(receipt.method)})`} v={money(receipt.amountPaid)} />
          {receipt.change > 0 && <Row k="Change" v={money(receipt.change)} />}
          {receipt.transactionRef && <Row k="Reference" v={receipt.transactionRef} />}
        </dl>

        <p className="mt-5 text-center text-[11.5px] text-ink-muted">
          Thank you for your business.
        </p>
      </div>
    </Modal>
  );
}

const Row = ({ k, v }) => (
  <div className="flex justify-between gap-3">
    <dt className="text-ink-muted">{k}</dt>
    <dd className="tnum m-0 text-ink">{v}</dd>
  </div>
);
