'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { today } from '@/lib/format';
import {
  Alert, Button, Card, CardHead, CardTitle, Field, Input, Modal, PageHead, Segmented, Select,
} from '@/components/ui';
import CashBookTable from '@/components/CashBookTable';

const DIRECTIONS = [
  { value: 'in', label: 'Cash in' },
  { value: 'out', label: 'Cash out' },
];

/**
 * The cash book for a day.
 *
 * Accounts can add entries — a float, a bank deposit, transport, a
 * supplier paid out of the drawer. The cashier gets the same view
 * read-only, because the drawer is theirs to count but not to correct.
 */
export default function CashBook({ readOnly, title = 'Cash book' }) {
  const [date, setDate] = useState(today());
  const [adding, setAdding] = useState(false);
  const [notice, setNotice] = useState('');
  const [key, setKey] = useState(0);

  return (
    <>
      <PageHead
        title={title}
        sub={readOnly ? 'Accounts keeps this. You can read it and count against it.' : null}
      >
        <Input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="tnum w-[170px]"
        />
        {!readOnly && <Button onClick={() => setAdding(true)}>Add entry</Button>}
      </PageHead>

      <Alert kind="ok" onDone={() => setNotice('')}>{notice}</Alert>

      <Card>
        <CardHead><CardTitle>Entries for {date}</CardTitle></CardHead>
        <CashBookTable key={`${date}-${key}`} date={date} />
      </Card>

      {adding && (
        <AddEntry
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

function AddEntry({ date, onClose, onDone }) {
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
    <Modal
      title="Add a cash book entry"
      description={`Booked against ${date}.`}
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="entry" disabled={busy || !details.trim() || !amount}>
            {busy ? 'Saving…' : 'Save entry'}
          </Button>
        </>
      }
    >
      <form id="entry" onSubmit={submit} className="space-y-4">
        <Alert>{error}</Alert>

        <Field label="What is it for?">
          <Input
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            placeholder="Transport — delivery truck fuel"
            autoFocus
            required
          />
        </Field>

        <Field label="Direction">
          <Segmented label="Direction" value={direction} onChange={setDirection} options={DIRECTIONS} />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Amount (UGX)">
            <Input
              type="number"
              min="1"
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              className="tnum font-semibold"
            />
          </Field>

          <Field label="Method">
            <Select value={method} onChange={(e) => setMethod(e.target.value)}>
              <option value="cash">Cash</option>
              <option value="mobile_money">Mobile Money</option>
              <option value="bank">Bank</option>
            </Select>
          </Field>
        </div>
      </form>
    </Modal>
  );
}
