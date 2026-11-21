'use client';
import { useCallback, useEffect, useState } from 'react';
import { api, getUser } from '@/lib/api';
import { usePoll } from '@/lib/live';
import { money, shortMoney, methodLabel, time } from '@/lib/format';
import { Stat, Card, Empty, Alert, Modal } from '@/components/ui';
import CashBookTable from '@/components/CashBookTable';

/** Fig 9: Accounts Web Panel - Verify Payments & Cash Book. */
export default function VerifyPayments() {
  const [data, setData] = useState(null);
  const [rejecting, setRejecting] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    try { setData(await api('/api/accounts/queue')); }
    catch (e) { setError(e.message); }
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
          ? `#${order.order_no} verified and sent to the Store.`
          : `#${order.order_no} rejected and sent back to the Cashier.`
      );
      load();
    } catch (e) { setError(e.message); }
    finally { setBusyId(null); setRejecting(null); }
  }

  if (!data) return <div className="loading">Loading payments to verify…</div>;

  const user = getUser();
  const s = data.summary;

  return (
    <>
      <div className="page-head">
        <h1>Accounts &ndash; Verify Payments</h1>
        <div className="page-meta">
          {user?.fullName} &middot; Accounts &middot;{' '}
          {new Date().toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
        </div>
      </div>

      <Alert>{error}</Alert>
      <Alert kind="ok" onDone={() => setNotice('')}>{notice}</Alert>

      <div className="stats">
        <Stat label="Awaiting verification" value={s.awaiting} />
        <Stat label="Verified today" value={s.verified_today} />
        <Stat label="Cash in today" value={shortMoney(s.cash_in)} tone="green" />
        <Stat label="Cash out today" value={shortMoney(s.cash_out)} tone="red" />
      </div>

      <Card title="Payments awaiting verification">
        {data.orders.length === 0 ? (
          <Empty>Every payment has been verified. Nothing is waiting.</Empty>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Order</th><th>Receipt</th><th>Customer</th><th>Method</th>
                <th>Transaction Ref</th><th className="num">Amount</th><th>Cashier</th><th>Action</th>
              </tr>
            </thead>
            <tbody>
              {data.orders.map((o) => (
                <tr key={o.id}>
                  <td className="order-no">#{o.order_no}</td>
                  <td>{o.receipt_no}</td>
                  <td>
                    {o.company_name || o.ordered_by_name}
                    {o.company_name && <div className="sub">Ordered by {o.ordered_by_name}</div>}
                  </td>
                  <td>{methodLabel(o.method)}</td>
                  <td>{o.transaction_ref || '—'}</td>
                  <td className="num"><strong>{money(o.amount_paid)}</strong></td>
                  <td>{o.cashier_name}<div className="sub">{time(o.created_at)}</div></td>
                  <td>
                    <div className="btn-row">
                      <button
                        className="btn btn-primary btn-sm"
                        disabled={busyId === o.id}
                        onClick={() => verify(o, true)}
                      >
                        Verify
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        disabled={busyId === o.id}
                        onClick={() => setRejecting(o)}
                      >
                        Reject
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card title="Cash Book - Today">
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
      title={`Reject payment - #${order.order_no}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-danger"
            disabled={busy || remarks.trim().length < 3}
            onClick={() => onConfirm(remarks)}
          >
            {busy ? 'Rejecting…' : 'Reject & send back'}
          </button>
        </>
      }
    >
      <p style={{ marginTop: 0, fontSize: 13, color: 'var(--muted)' }}>
        The order goes back to the Cashier and the customer is notified. Say what is wrong
        so the cashier can fix it.
      </p>
      <div className="field">
        <label htmlFor="rm">Reason</label>
        <textarea
          id="rm"
          rows={3}
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          placeholder="No matching entry on the mobile money statement"
        />
      </div>
    </Modal>
  );
}
