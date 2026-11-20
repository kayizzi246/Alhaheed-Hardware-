'use client';
import { useState } from 'react';
import { api } from '@/lib/api';
import { today } from '@/lib/format';
import { Card, Alert, Modal } from './ui';
import CashBookTable from './CashBookTable';

/**
 * Full cash book page. Accounts can add entries (e.g. transport, fuel);
 * the cashier gets the same view read-only.
 */
export default function CashBook({ readOnly, title = 'Cash Book' }) {
  const [date, setDate] = useState(today());
  const [adding, setAdding] = useState(false);
  const [notice, setNotice] = useState('');
  const [key, setKey] = useState(0);

  return (
    <>
      <div className="page-head">
        <h1>{title}</h1>
        <div className="filters">
          <div className="field">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          {!readOnly && (
            <button className="btn btn-primary" onClick={() => setAdding(true)}>
              + Add entry
            </button>
          )}
        </div>
      </div>

      <Alert kind="ok" onDone={() => setNotice('')}>{notice}</Alert>

      <Card title={`Entries for ${date}`}>
        <CashBookTable key={`${date}-${key}`} date={date} />
      </Card>

      {adding && (
        <AddEntryModal
          date={date}
          onClose={() => setAdding(false)}
          onDone={() => {
            setAdding(false);
            setNotice('Cash book entry recorded.');
            setKey((k) => k + 1);
          }}
        />
      )}
    </>
  );
}

function AddEntryModal({ date, onClose, onDone }) {
  const [details, setDetails] = useState('');
  const [direction, setDirection] = useState('out');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('cash');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api('/api/accounts/cash-book', {
        method: 'POST',
        body: {
          details,
          cashIn: direction === 'in' ? Math.trunc(Number(amount)) : 0,
          cashOut: direction === 'out' ? Math.trunc(Number(amount)) : 0,
          method,
          entryDate: date,
        },
      });
      onDone();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <Modal title="Add cash book entry" onClose={onClose}>
      <form onSubmit={submit}>
        <Alert>{error}</Alert>

        <div className="field">
          <label htmlFor="d">Details</label>
          <input id="d" value={details} onChange={(e) => setDetails(e.target.value)}
                 placeholder="Transport - delivery truck fuel" required />
        </div>

        <div className="field">
          <label>Direction</label>
          <div className="method-group">
            <button type="button" className={direction === 'in' ? 'on' : ''}
                    onClick={() => setDirection('in')}>Cash In</button>
            <button type="button" className={direction === 'out' ? 'on' : ''}
                    onClick={() => setDirection('out')}>Cash Out</button>
          </div>
        </div>

        <div className="field">
          <label htmlFor="a">Amount (UGX)</label>
          <input id="a" type="number" min="1" value={amount}
                 onChange={(e) => setAmount(e.target.value)} required />
        </div>

        <div className="field">
          <label htmlFor="m">Method</label>
          <select id="m" value={method} onChange={(e) => setMethod(e.target.value)}>
            <option value="cash">Cash</option>
            <option value="mobile_money">Mobile Money</option>
            <option value="bank">Bank</option>
          </select>
        </div>

        <div className="modal-foot" style={{ padding: '8px 0 0', borderTop: 'none' }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save entry'}</button>
        </div>
      </form>
    </Modal>
  );
}
