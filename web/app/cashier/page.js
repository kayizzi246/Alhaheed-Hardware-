'use client';
import { useCallback, useEffect, useState } from 'react';
import { api, getUser } from '@/lib/api';
import { usePoll } from '@/lib/live';
import { money, shortMoney, time, dateTime } from '@/lib/format';
import { Stat, Card, Chip, Empty, Alert, Modal } from '@/components/ui';
import { freshness } from '@/lib/live';
import Link from 'next/link';

/** Fig 8: Cashier Web Panel - Payment Queue. */
export default function CashierQueue() {
  const [data, setData] = useState(null);
  const [recent, setRecent] = useState([]);
  const [paying, setPaying] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    try {
      const [queue, receipts] = await Promise.all([
        api('/api/cashier/queue'),
        api('/api/cashier/receipts'),
      ]);
      setData(queue);
      setRecent(receipts.receipts.slice(0, 8));
    } catch (e) { setError(e.message); }
  }, []);

  // Orders arrive from the customer app, so the queue re-checks itself.
  const { at, failing } = usePoll(load, 10000);

  if (!data) return <div className="loading">Loading the payment queue…</div>;

  const user = getUser();
  const s = data.summary;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Payment queue</h1>
          <p className="page-meta">
            {user?.fullName} &middot;{' '}
            {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <span className={`fresh ${failing ? 'stale' : ''}`}>{freshness(at, failing)}</span>
      </div>

      <Alert>{error}</Alert>
      <Alert kind="ok" onDone={() => setNotice('')}>{notice}</Alert>

      <div className="stats">
        <Stat label="Waiting for payment" value={s.waiting} />
        <Stat label="Paid today" value={s.paid_today} />
        <Stat label="Cash received" value={shortMoney(s.cash_today)} tone="green" />
        <Stat label="Mobile Money received" value={shortMoney(s.momo_today)} />
      </div>

      <section className="section">
        <div className="section-head">
          <h2>Waiting for payment</h2>
          <span className="page-meta">
            {data.orders.length === 0 ? 'nothing waiting' : `${data.orders.length} in the queue`}
          </span>
        </div>

        {data.orders.length === 0 ? (
          <div className="card"><Empty>Every order has been paid for. New ones arrive here on their own.</Empty></div>
        ) : (
          <ul className="queue">
            {data.orders.map((o) => (
              <li key={o.id} className="qrow">
                <div className="qmain">
                  <div className="qtop">
                    <span className="qno">{o.order_no}</span>
                    <Chip status={o.status}>Pending</Chip>
                  </div>
                  <p className="qwho">
                    {o.company_name || o.ordered_by_name}
                    {o.company_name && <em> · ordered by {o.ordered_by_name}</em>}
                  </p>
                  <p className="qmeta">
                    {o.item_count} {o.item_count === 1 ? 'item' : 'items'} · {time(o.created_at)}
                    {o.fulfilment === 'delivery' && ' · delivery'}
                  </p>
                </div>

                <div className="qside">
                  <span className="qamount">{money(o.total)}</span>
                  <button className="btn btn-primary" onClick={() => setPaying(o)}>
                    Receive payment
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="section">
        <div className="section-head">
          <h2>Receipts issued today</h2>
          <Link className="btn btn-ghost btn-sm" href="/cashier/receipts">All receipts</Link>
        </div>

        <div className="card">
          {recent.length === 0 ? (
            <Empty>No receipts issued today yet.</Empty>
          ) : (
            <ul className="ledger">
              {recent.map((r) => (
                <li key={r.id}>
                  <span className="lno">{r.order_no}</span>
                  <span className="lsub">{r.receipt_no} · {r.method.replace('_', ' ')}</span>
                  <span className="lamt">{money(r.amount_paid)}</span>
                  {r.verified === 1
                    ? <span className="chip approved">Verified</span>
                    : r.verified === -1
                      ? <span className="chip rejected">Rejected</span>
                      : <span className="chip paid">With accounts</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {paying && (
        <ReceivePaymentModal
          order={paying}
          onClose={() => setPaying(null)}
          onDone={(receiptNo) => {
            setPaying(null);
            setNotice(`Payment recorded. Receipt ${receiptNo} sent to Accounts.`);
            load();
          }}
        />
      )}
    </>
  );
}

function ReceivePaymentModal({ order, onClose, onDone }) {
  const [method, setMethod] = useState('cash');
  const [amount, setAmount] = useState(String(order.total));
  const [ref, setRef] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const paid = Number(amount || 0);
  const change = paid - order.total;

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await api(`/api/cashier/orders/${order.id}/payment`, {
        method: 'POST',
        body: {
          method,
          amountPaid: Math.trunc(paid),
          transactionRef: ref || null,
        },
      });
      onDone(res.receipt.receipt_no);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <Modal title={`Receive Payment - #${order.order_no}`} onClose={onClose}>
      <form onSubmit={submit}>
        <Alert>{error}</Alert>

        <div className="field">
          <label>Customer</label>
          <div style={{ fontWeight: 600 }}>{order.company_name || order.ordered_by_name}</div>
          {order.company_name && <div className="sub">Ordered by {order.ordered_by_name}</div>}
        </div>

        <div className="field">
          <label>Amount due</label>
          <div style={{ fontSize: 20, fontWeight: 700 }}>{money(order.total)}</div>
        </div>

        <div className="field">
          <label>Payment method</label>
          <div className="method-group">
            {[['cash', 'Cash'], ['mobile_money', 'Mobile Money'], ['card', 'Card']].map(([v, l]) => (
              <button
                key={v}
                type="button"
                className={method === v ? 'on' : ''}
                onClick={() => setMethod(v)}
              >
                {l}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <label htmlFor="amt">Amount received</label>
          <input id="amt" type="number" min={order.total} value={amount}
                 onChange={(e) => setAmount(e.target.value)} required />
          {change > 0 && (
            <div className="sub" style={{ marginTop: 6 }}>Change to give: <strong>{money(change)}</strong></div>
          )}
        </div>

        {method !== 'cash' && (
          <div className="field">
            <label htmlFor="ref">Transaction reference</label>
            <input id="ref" value={ref} onChange={(e) => setRef(e.target.value)}
                   placeholder="MP2611190934" required />
          </div>
        )}

        <div className="modal-foot" style={{ padding: '8px 0 0', borderTop: 'none' }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-navy" disabled={busy || paid < order.total}>
            {busy ? 'Recording…' : 'Confirm & Send to Accounts'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
