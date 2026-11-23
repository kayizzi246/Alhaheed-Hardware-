'use client';

import { useCallback, useState } from 'react';
import { api, getUser, peek } from '@/lib/api';
import { usePoll } from '@/lib/live';
import { money, shortMoney, dateTime, methodLabel, list } from '@/lib/format';
import { cn } from '@/lib/cn';
import {
  Alert, Button, Card, CardHead, CardTitle, Chip, Empty, Field, Fresh, Input,
  Loading, Modal, PageHead, Segmented, Select, Stat, Stats, Table, TableWrap,
  Td, Textarea, Th, Tr,
} from '@/components/ui';

/**
 * Money going out that is not a customer's order.
 *
 * The same screen for every desk, because it is the same list — what
 * changes is which button you get on a row. A store man sees his
 * request sitting there and can tell it has not been forgotten; the
 * manager sees an Approve button; the cashier sees Pay on the ones
 * that have been approved.
 *
 * That is deliberate. A separate screen per desk would mean three
 * screens showing the same six rows, and nobody able to see what
 * anybody else had done.
 */

const KINDS = [
  ['expense', 'Shop expense'],
  ['stock_use', 'Stock taken for the shop'],
  ['float', 'Float for the till'],
  ['advance', 'Advance to staff'],
];

const FILTERS = [
  ['raised', 'Waiting'],
  ['approved', 'To pay'],
  ['paid', 'Paid'],
  ['declined', 'Declined'],
  ['all', 'Everything'],
];

const TONE = {
  raised: 'pending',
  approved: 'info',
  paid: 'good',
  declined: 'grey',
};

export default function Expenses() {
  const [status, setStatus] = useState('raised');
  const [data, setData] = useState(() => peek('/api/expenses?status=raised'));
  const [raising, setRaising] = useState(false);
  const [deciding, setDeciding] = useState(null);
  const [paying, setPaying] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    try {
      setData(await api(`/api/expenses?status=${status}`));
      setError('');
    } catch (e) {
      // An empty shape, not null. Leaving it null kept the screen on
      // "Loading requests…" for ever while the error sat in state with
      // nothing rendering it — so a server that answered 404 looked
      // exactly like a slow one, and there was nothing to act on.
      setData({ expenses: [], summary: {}, canApprove: false, canPay: false });
      setError(e.message);
    }
  }, [status]);

  const { at, failing } = usePoll(load, 20000);

  if (!data && !error) return <Loading>Loading requests…</Loading>;

  if (!data) {
    return (
      <>
        <PageHead title="Expenses" />
        <Alert>{error}</Alert>
        <Button variant="outline" onClick={load}>Try again</Button>
      </>
    );
  }

  const rows = list(data.expenses);
  const s = data.summary || {};
  const me = getUser();

  return (
    <>
      <PageHead
        title="Expenses"
        sub="Money out that is not a customer's order. Every one needs the manager."
      >
        <Fresh at={at} failing={failing} />
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-[150px]">
          {FILTERS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </Select>
        <Button onClick={() => setRaising(true)}>Raise a request</Button>
      </PageHead>

      <Alert>{error}</Alert>
      <Alert kind="ok" onDone={() => setNotice('')}>{notice}</Alert>

      <Stats>
        <Stat
          label="Waiting for the manager"
          value={s.waiting ?? 0}
          note={s.waiting_value ? money(s.waiting_value) : 'nothing pending'}
          lead={data.canApprove && s.waiting > 0}
        />
        <Stat
          label="Approved, to pay out"
          value={s.to_pay ?? 0}
          lead={data.canPay && !data.canApprove && s.to_pay > 0}
        />
        <Stat label="Paid today" value={shortMoney(s.paid_today)} note={money(s.paid_today)} />
        <Stat label="Showing" value={rows.length} note={FILTERS.find(([v]) => v === status)?.[1]} />
      </Stats>

      <Card>
        <CardHead>
          <CardTitle>{FILTERS.find(([v]) => v === status)?.[1]}</CardTitle>
        </CardHead>

        {rows.length === 0 ? (
          <Empty title="Nothing here">
            {status === 'raised'
              ? 'No request is waiting on anybody.'
              : 'Try a different filter.'}
          </Empty>
        ) : (
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>Ref</Th><Th>What for</Th><Th>Raised by</Th>
                  <Th num>Amount</Th><Th>Status</Th><Th>When</Th><Th />
                </tr>
              </thead>
              <tbody>
                {rows.map((e) => (
                  <Tr key={e.id}>
                    <Td className="tnum font-bold text-ink">{e.ref}</Td>
                    <Td>
                      <span className="font-medium text-ink">{e.details}</span>
                      <span className="block text-xs text-ink-muted">{e.kind_label}</span>
                    </Td>
                    <Td>
                      {e.raised_by}
                      <span className="block text-xs capitalize text-ink-muted">{e.raised_desk}</span>
                    </Td>
                    <Td num className="font-semibold text-ink">{money(e.amount)}</Td>
                    <Td>
                      <Chip tone={TONE[e.status] || 'grey'}>{e.status_label}</Chip>
                      {e.decision_note && (
                        <span className="mt-0.5 block max-w-[220px] text-xs text-ink-muted">
                          {e.decision_note}
                        </span>
                      )}
                    </Td>
                    <Td className="tnum whitespace-nowrap text-ink-muted">{dateTime(e.created_at)}</Td>
                    <Td className="text-right">
                      <div className="flex justify-end gap-2">
                        {data.canApprove && e.status === 'raised' && (
                          <>
                            <Button variant="danger" size="sm" onClick={() => setDeciding({ e, approve: false })}>
                              Decline
                            </Button>
                            <Button variant="good" size="sm" onClick={() => setDeciding({ e, approve: true })}>
                              Approve
                            </Button>
                          </>
                        )}
                        {data.canPay && e.status === 'approved' && (
                          <Button size="sm" onClick={() => setPaying(e)}>Pay out</Button>
                        )}
                      </div>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </Card>

      {raising && (
        <RaiseDialog
          who={me}
          onClose={() => setRaising(false)}
          onDone={(msg) => { setRaising(false); setNotice(msg); load(); }}
        />
      )}

      {deciding && (
        <DecideDialog
          {...deciding}
          onClose={() => setDeciding(null)}
          onDone={(msg) => { setDeciding(null); setNotice(msg); load(); }}
        />
      )}

      {paying && (
        <PayDialog
          expense={paying}
          onClose={() => setPaying(null)}
          onDone={(msg) => { setPaying(null); setNotice(msg); load(); }}
        />
      )}
    </>
  );
}

/* ── Raising ──────────────────────────────────────────────────────── */

function RaiseDialog({ who, onClose, onDone }) {
  const [kind, setKind] = useState('expense');
  const [details, setDetails] = useState('');
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const r = await api('/api/expenses', {
        method: 'POST',
        body: { kind, details, amount: Number(amount) },
      });
      onDone(`${r.expense.ref} raised. The manager has been told.`);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Raise a request"
      description="It goes to the manager. Nothing leaves the till until they approve it."
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="raise" disabled={busy || !details.trim() || !amount}>
            {busy ? 'Sending…' : 'Send to the manager'}
          </Button>
        </>
      }
    >
      <form id="raise" onSubmit={submit} className="space-y-4">
        <Alert>{error}</Alert>

        <Field label="What kind">
          <Select value={kind} onChange={(e) => setKind(e.target.value)}>
            {KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Select>
        </Field>

        <Field
          label="What is it for?"
          hint="The manager reads this and nothing else. Be specific — “grinder disc for the workshop”, not “parts”."
        >
          <Input
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            placeholder="Transport — delivery to Ntinda"
            autoFocus
          />
        </Field>

        <Field label="How much (UGX)">
          <Input
            type="number"
            min="1"
            inputMode="numeric"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="tnum font-semibold"
          />
        </Field>

        {who && (
          <p className="text-[12.5px] text-ink-muted">
            Raised as <b className="font-semibold text-ink-2">{who.fullName}</b>. Your name stays
            on it.
          </p>
        )}
      </form>
    </Modal>
  );
}

/* ── Deciding ─────────────────────────────────────────────────────── */

function DecideDialog({ e, approve, onClose, onDone }) {
  const [amount, setAmount] = useState(String(e.amount));
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const changed = Number(amount) !== e.amount;

  async function submit(ev) {
    ev.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api(`/api/expenses/${e.id}/decide`, {
        method: 'POST',
        body: { approve, amount: Number(amount), note: note || null },
      });
      onDone(
        approve
          ? `${e.ref} approved${changed ? ` at ${money(Number(amount))}` : ''}. The cashier has been told.`
          : `${e.ref} declined. ${e.raised_by} has been told why.`
      );
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <Modal
      title={approve ? `Approve ${e.ref}` : `Decline ${e.ref}`}
      description={`${e.details} · raised by ${e.raised_by} · asked for ${money(e.amount)}`}
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            type="submit"
            form="decide"
            variant={approve ? 'good' : 'danger'}
            disabled={busy || (!approve && note.trim().length < 3)}
          >
            {busy ? 'Saving…' : approve ? 'Approve it' : 'Decline it'}
          </Button>
        </>
      }
    >
      <form id="decide" onSubmit={submit} className="space-y-4">
        <Alert>{error}</Alert>

        {approve && (
          <Field
            label="Amount to approve (UGX)"
            hint={
              changed
                ? `${money(e.amount)} was asked for. They will be told it is ${money(Number(amount))}.`
                : 'Change it if you want to approve a different figure.'
            }
          >
            <Input
              type="number"
              min="1"
              inputMode="numeric"
              value={amount}
              onChange={(ev) => setAmount(ev.target.value)}
              className="tnum text-[17px] font-semibold"
              autoFocus
            />
          </Field>
        )}

        <Field
          label={approve ? 'Note (optional)' : 'Why is it declined?'}
          hint={
            approve
              ? 'Anything they should know — “take the cheaper disc”.'
              : 'They will read this. A bare “declined” just gets raised again tomorrow.'
          }
        >
          <Textarea
            rows={3}
            value={note}
            onChange={(ev) => setNote(ev.target.value)}
            placeholder={approve ? 'Optional' : 'We already have two of these in the store'}
            autoFocus={!approve}
          />
        </Field>
      </form>
    </Modal>
  );
}

/* ── Paying ───────────────────────────────────────────────────────── */

const METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'mobile_money', label: 'Mobile Money' },
  { value: 'bank', label: 'Bank' },
];

function PayDialog({ expense, onClose, onDone }) {
  const [method, setMethod] = useState('cash');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api(`/api/expenses/${expense.id}/pay`, { method: 'POST', body: { method } });
      onDone(`${expense.ref} paid out. It is in the cash book.`);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <Modal
      title={`Pay out ${expense.ref}`}
      description={`${expense.details} · approved by ${expense.decided_by}`}
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="pay-out" disabled={busy}>
            {busy ? 'Booking…' : `Pay ${money(expense.amount)}`}
          </Button>
        </>
      }
    >
      <form id="pay-out" onSubmit={submit} className="space-y-4">
        <Alert>{error}</Alert>

        <div className="rounded-sm border border-line bg-surface-2 px-4 py-3">
          <span className="block text-[11px] font-bold uppercase tracking-[.07em] text-ink-muted">
            Approved amount
          </span>
          <strong className="tnum mt-1 block font-display text-[26px] font-extrabold leading-none text-ink">
            {money(expense.amount)}
          </strong>
        </div>

        <Field label="Paid how?">
          <Segmented label="Method" value={method} onChange={setMethod} options={METHODS} />
        </Field>

        <p className="text-[12.5px] leading-relaxed text-ink-muted">
          This writes a cash-out line in today&rsquo;s cash book against{' '}
          <b className="font-semibold text-ink-2">{expense.ref}</b>, so the book still matches the
          drawer.
        </p>
      </form>
    </Modal>
  );
}
