'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { money, list, methodLabel } from '@/lib/format';
import { Button, Card, CardHead, CardTitle } from '@/components/ui';

/**
 * The same PDFs the customer gets: order summary, a receipt for every
 * recorded payment, and the loan statement. Each opens from a link that
 * works for ten minutes.
 */
async function open(type, id, download) {
  const r = await api(`/api/docs/link?type=${type}&id=${encodeURIComponent(id)}`);
  window.open(download ? `${r.url}&download=1` : r.url, '_blank', 'noopener');
}

export default function DocButtons({ orderId }) {
  const [d, setD] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => { api(`/api/orders/${orderId}/documents`).then(setD).catch(() => {}); }, [orderId]);
  if (!d) return null;
  const go = (type, id, download) => open(type, id, download).catch((e) => setError(e.message));
  const Row = ({ title, note, type, id }) => (
    <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-2.5 last:border-0">
      <div className="min-w-0 flex-1">
        <b className="block text-[12.5px] text-ink">{title}</b>
        <span className="text-[11.5px] text-ink-muted">{note}</span>
      </div>
      <Button size="sm" variant="outline" onClick={() => go(type, id, false)}>Print</Button>
      <Button size="sm" onClick={() => go(type, id, true)}>Download PDF</Button>
    </div>
  );
  return (
    <Card className="mb-3">
      <CardHead><CardTitle>Documents</CardTitle><span className="text-[11.5px] text-ink-muted">the same PDFs the customer gets</span></CardHead>
      {error && <p className="px-4 py-2 text-[11.5px] text-bad">{error}</p>}
      <Row title="Order summary" note="Items, prices, discounts, delivery, total, status" type="order" id={orderId} />
      {list(d.receipts).map((r) => (
        <Row key={r.receiptNo} title={`Payment receipt ${r.receiptNo}`} note={`${money(r.amount)} · ${methodLabel(r.method)} · ${r.kind === 'loan' ? 'paid on the loan' : 'paid for the order'}`} type="receipt" id={r.receiptNo} />
      ))}
      {!list(d.receipts).length && <p className="border-b border-line px-4 py-2.5 text-[11.5px] text-ink-muted">No payment recorded yet, so no receipt.</p>}
      {d.statement && <Row title="Account statement" note="The customer's loan: bought, paid, owed, due dates" type="statement" id={d.statement} />}
    </Card>
  );
}
