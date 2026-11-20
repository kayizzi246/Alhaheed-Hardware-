'use client';
import { useCallback, useEffect, useState } from 'react';
import { api, getUser } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { money, shortMoney, time, dateTime } from '@/lib/format';
import { Stat, Card, Chip, Empty, Alert, Modal } from '@/components/ui';

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

  useEffect(() => { load(); }, [load]);

  // Orders arrive from the customer app in real time.
  useEffect(() => {
    const s = getSocket();
    if (!s) return;
    const refresh = () => load();
    s.on('order:new', refresh);
    s.on('order:updated', refresh);
    return () => { s.off('order:new', refresh); s.off('order:updated', refresh); };
  }, [load]);

  if (!data) return <div className="loading">Loading the payment queue…</div>;

  const user = getUser();
  const s = data.summary;

  return (
    <>
      <div className="page-head">
        <h1>Cashier &ndash; Payment Queue</h1>
        <div className="page-meta">
          {user?.fullName} &middot; Cashier desk &middot;{' '}
          {new Date().toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
        </div>
      </div>

      <Alert>{error}</Alert>
      <Alert kind="ok" onDone={() => setNotice('')}>{notice}</Alert>

      <div className="stats">
        <Stat label="Waiting for payment" value={s.waiting} />
        <Stat label="Paid today" value={s.paid_today} />
        <Stat label="Cash received" value={shortMoney(s.cash_today)} tone="green" />
        <Stat label="Mobile Money received" value={shortMoney(s.momo_today)} />
      </div>

      <Card title="Orders waiting for payment">
        {data.orders.length === 0 ? (
          <Empty>No orders are waiting for payment right now.</Empty>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Order</th>
                <th>Customer</th>
                <th>Type</th>
                <th className="num">Items</th>
                <th className="num">Amount</th>
                <th>Time</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.orders.map((o) => (
                <tr key={o.id}>
                  <td className="order-no">#{o.order_no}</td>
                  <td>
                    {o.company_name || o.ordered_by_name}
                    {o.company_name && <div className="sub">Ordered by {o.ordered_by_name}</div>}
                  </td>
                  <td>{o.company_name ? 'Company' : 'Individual'}</td>
                  <td className="num">{o.item_count}</td>
                  <td className="num"><strong>{money(o.total)}</strong></td>
                  <td>{time(o.created_at)}</td>
                  <td><Chip status={o.status}>Pending</Chip></td>
                  <td>
                    <button className="btn btn-primary btn-sm" onClick={() => setPaying(o)}>
                      Receive Payment
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card title="Recently paid">
        {recent.length === 0 ? (
          <Empty>No receipts issued today yet.</Empty>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Order</th>
                <th>Receipt</th>
                <th>Method</th>
                <th className="num">Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((r) => (
                <tr key={r.id}>
                  <td className="order-no">#{r.order_no}</td>
                  <td>{r.receipt_no}</td>
                  <td>{r.method.replace('_', ' ')}</td>
                  <td className="num">{money(r.amount_paid)}</td>
                  <td>
                    {r.verified === 1
                      ? <span className="chip approved">Verified</span>
                      : r.verified === -1
                        ? <span className="chip rejected">Rejected</span>
                        : <span className="chip paid">Sent to Accounts</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

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
