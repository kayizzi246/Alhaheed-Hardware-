'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api, getUser, peek } from '@/lib/api';
import { usePoll } from '@/lib/live';
import { money, shortMoney, dateTime, methodLabel, list } from '@/lib/format';
import { cn } from '@/lib/cn';
import {
  Alert, Button, Card, CardHead, CardTitle, Chip, Empty, Field, Fresh, Input,
  Loading, Modal, PageHead, Segmented, Select, Stat, Stats, Table, TableWrap,
  Td, Textarea, Th, Tr,
} from '@/components/ui';
import { Icon } from '@/components/icons';

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

/** How money leaves the shop, what to ask about each, and what it leaves behind. */
const PAY = [
  { value: 'cash', label: 'Cash' },
  { value: 'mtn_momo', label: 'MTN Mobile Money', number: 'Phone number', ref: 'Transaction ID' },
  { value: 'airtel_money', label: 'Airtel Money', number: 'Phone number', ref: 'Transaction ID' },
  { value: 'bank', label: 'Bank transfer', number: 'Bank and account number', ref: 'Transaction ID' },
  { value: 'cheque', label: 'Cheque', ref: 'Cheque number' },
  { value: 'card', label: 'Card', ref: 'Transaction ID' },
];

/** Who is paid and how. `paid` asks for the proof as well. */
function PaymentFields({ p, set, paid }) {
  const how = PAY.find((m) => m.value === p.method) || PAY[0];
  return (
    <>
      <Field label="Payment method">
        <div role="radiogroup" aria-label="Payment method" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {PAY.map((m) => {
            const on = m.value === how.value;
            return (
              <button
                key={m.value}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => set({ ...p, method: m.value })}
                className={cn(
                  'min-h-11 rounded-sm border px-3 py-2 text-[12px] font-semibold leading-tight',
                  'transition-[background-color,border-color,color,transform] duration-150 ease-out active:scale-[.97]',
                  on ? 'border-fill bg-fill text-on-fill' : 'border-line-firm/80 bg-surface text-ink-2 hover:bg-surface-2'
                )}
              >
                {m.label}
              </button>
            );
          })}
        </div>
      </Field>

      <div className={cn('grid gap-4', how.number && 'sm:grid-cols-2')}>
        <Field label="Who is being paid?" hint={how.number ? 'The name on the account.' : undefined}>
          <Input value={p.payee} onChange={(e) => set({ ...p, payee: e.target.value })} placeholder="Name" maxLength={191} />
        </Field>
        {how.number && (
          <Field label={how.number}>
            <Input
              value={p.payNumber}
              onChange={(e) => set({ ...p, payNumber: e.target.value })}
              inputMode={how.value === 'bank' ? 'text' : 'tel'}
              placeholder={how.value === 'bank' ? 'Stanbic 9030001234567' : how.value === 'mtn_momo' ? '0772 123 456' : '0752 123 456'}
              maxLength={64}
              className="tnum"
            />
          </Field>
        )}
      </div>

      {paid && how.ref && (
        <Field label={how.ref} hint="Kept on the record and shown in the reports.">
          <Input value={p.payRef} onChange={(e) => set({ ...p, payRef: e.target.value })} maxLength={64} autoComplete="off" className="tnum font-semibold" />
        </Field>
      )}
    </>
  );
}

const noPayment = { method: 'cash', payee: '', payNumber: '', payRef: '' };

/** Only what the chosen method has: a phone number typed before switching to cash is not sent. */
function paymentBody(p) {
  const how = PAY.find((m) => m.value === p.method) || PAY[0];
  return {
    method: how.value,
    payee: p.payee.trim(),
    payNumber: how.number ? p.payNumber.trim() : '',
    payRef: how.ref ? p.payRef.trim() : '',
  };
}

const proofMissing = (p) => {
  const how = PAY.find((m) => m.value === p.method) || PAY[0];
  return !!how.ref && p.payRef.trim().length < 3;
};

/** "MTN Mobile Money to Kayizzi Badru, 0772 123 456, ID 1234" */
export function paymentLine(e) {
  const out = [];
  const label = e.method ? methodLabel(e.method) : '';
  if (label && e.payee) out.push(`${label} to ${e.payee}`);
  else if (label || e.payee) out.push(label || `To ${e.payee}`);
  if (e.pay_number) out.push(e.pay_number);
  if (e.pay_ref) out.push(`ID ${e.pay_ref}`);
  return out.join(', ');
}

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
  // Everything, newest first: a new expense shows where it was added,
  // whatever happened to it.
  const [status, setStatus] = useState('all');
  const [data, setData] = useState(() => peek('/api/expenses?status=all'));
  const [raising, setRaising] = useState(false);
  const [deciding, setDeciding] = useState(null);
  const [paying, setPaying] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const wanted = useRef(status);
  wanted.current = status;

  const load = useCallback(async () => {
    try {
      const r = await api(`/api/expenses?status=${status}`);
      // An answer for a filter that has since been changed is not shown.
      if (wanted.current !== status) return;
      setData(r);
      setError('');
    } catch (e) {
      // An empty shape, not null. Leaving it null kept the screen on
      // "Loading requests…" for ever while the error sat in state with
      // nothing rendering it — so a server that answered 404 looked
      // exactly like a slow one, and there was nothing to act on.
      // On failure, keep what was on screen; the error says it is stale.
      setError(e.message);
    }
  }, [status]);

  const { at, failing } = usePoll(load, 20000);

  // The poll alone would leave the last filter's rows under the new
  // filter's name until its next turn.
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    const kept = peek(`/api/expenses?status=${status}`);
    if (kept) setData(kept);
    else setData((d) => (d ? { ...d, expenses: null } : d));
    load();
  }, [status, load]);

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
        sub={data.canApprove
          ? "Money out that is not a customer's order."
          : "Money out that is not a customer's order. The manager approves each one."}
      >
        <Fresh at={at} failing={failing} />
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-[150px]">
          {FILTERS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </Select>
        <Button onClick={() => setRaising(true)}>Add expense</Button>
      </PageHead>

      <Alert>{error}</Alert>
      <Alert kind="ok" onDone={() => setNotice('')}>{notice}</Alert>

      <Stats>
        <Stat
          label="Waiting for the manager" icon={Icon.clock()} tone={s.waiting ? 'warn' : 'ok'}
          value={s.waiting ?? 0}
          note={s.waiting_value ? money(s.waiting_value) : 'nothing pending'}
          lead={data.canApprove && s.waiting > 0}
        />
        <Stat
          label="Approved, to pay out" icon={Icon.check()}
          value={s.to_pay ?? 0}
          lead={data.canPay && !data.canApprove && s.to_pay > 0}
        />
        <Stat label="Paid today" icon={Icon.cash()} value={shortMoney(s.paid_today)} note={money(s.paid_today)} />
        <Stat label="Showing" icon={Icon.queue()} tone="neutral" value={rows.length} note={FILTERS.find(([v]) => v === status)?.[1]} />
      </Stats>

      <Card>
        <CardHead>
          <CardTitle>{FILTERS.find(([v]) => v === status)?.[1]}</CardTitle>
        </CardHead>

        {data.expenses === null ? (
          <Loading>Loading expenses…</Loading>
        ) : rows.length === 0 ? (
          <Empty
            title="Nothing here"
            action={<Button variant="outline" onClick={() => setRaising(true)}>Add expense</Button>}
          >
            {status === 'raised'
              ? 'No expense is waiting on anybody.'
              : 'Try a different filter.'}
          </Empty>
        ) : (
          <>
          {/* On a phone: one card per request, the decision buttons in
              reach — the table put them past the edge of the screen. */}
          <ul className="divide-y divide-line md:hidden">
            {rows.map((e) => (
              <li key={e.id} className="px-4 py-3.5">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 text-[13.5px] font-semibold text-ink">{e.details}</span>
                  <span className="tnum text-[13.5px] font-bold text-ink">{money(e.amount)}</span>
                </div>
                <p className="mt-1 text-[12px] text-ink-muted">
                  <span className="tnum">{e.ref}</span> · {e.kind_label} · {e.raised_by} · <span className="tnum">{dateTime(e.created_at)}</span>
                </p>
                {paymentLine(e) && <p className="mt-1 text-[12px] text-ink-2">{paymentLine(e)}</p>}
                <div className="mt-1.5">
                  <Chip tone={TONE[e.status] || 'grey'}>{e.status_label}</Chip>
                  {e.decision_note && <span className="mt-1 block text-[11.5px] text-ink-muted">{e.decision_note}</span>}
                </div>
                {data.canApprove && e.status === 'raised' && (
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <Button variant="danger" onClick={() => setDeciding({ e, approve: false })}>Decline</Button>
                    <Button variant="good" onClick={() => setDeciding({ e, approve: true })}>Approve</Button>
                  </div>
                )}
                {data.canPay && e.status === 'approved' && (
                  <Button className="mt-3 w-full" onClick={() => setPaying(e)}>Pay out</Button>
                )}
              </li>
            ))}
          </ul>
          <TableWrap className="hidden md:block">
            <Table>
              <thead>
                <tr>
                  <Th>Ref</Th><Th>What for</Th><Th>Payment</Th><Th>Raised by</Th>
                  <Th num>Amount</Th><Th>Status</Th><Th>When</Th><Th />
                </tr>
              </thead>
              <tbody>
                {rows.map((e) => (
                  <Tr key={e.id}>
                    <Td className="tnum font-bold text-ink">{e.ref}</Td>
                    <Td>
                      <span className="font-medium text-ink">{e.details}</span>
                      <span className="block text-[11.5px] text-ink-muted">{e.kind_label}</span>
                    </Td>
                    <Td className="max-w-[220px]">
                      <span className="block font-medium text-ink">{methodLabel(e.method)}</span>
                      {e.payee && <span className="block text-[11.5px] text-ink-2">{e.payee}</span>}
                      {(e.pay_number || e.pay_ref) && (
                        <span className="block break-words text-[11.5px] text-ink-muted">
                          {[e.pay_number, e.pay_ref && `ID ${e.pay_ref}`].filter(Boolean).join(' · ')}
                        </span>
                      )}
                    </Td>
                    <Td>
                      {e.raised_by}
                      <span className="block text-[11.5px] capitalize text-ink-muted">{e.raised_desk}</span>
                    </Td>
                    <Td num className="font-semibold text-ink">{money(e.amount)}</Td>
                    <Td>
                      <Chip tone={TONE[e.status] || 'grey'}>{e.status_label}</Chip>
                      {e.decision_note && (
                        <span className="mt-0.5 block max-w-[220px] text-[11.5px] text-ink-muted">
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
          </>
        )}
      </Card>

      {raising && (
        <RaiseDialog
          who={me}
          boss={!!data.canApprove}
          onClose={() => setRaising(false)}
          onDone={(msg, landed) => {
            setRaising(false);
            setNotice(msg);
            // Stay on this page and show it. A filter that would hide it
            // opens out to Everything, rather than jumping to another list.
            if (landed && landed !== status && status !== 'all') setStatus('all');
            else load();
          }}
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

/**
 * Adding one. The cashier's goes to the manager to approve. The manager
 * is the approval, so theirs is recorded as paid there and then, or sent
 * to the cashier to pay out.
 */
const SETTLE = [
  { value: 'paid', label: 'Already paid' },
  { value: 'approve', label: 'Cashier to pay' },
];

function RaiseDialog({ who, boss, onClose, onDone }) {
  const [settle, setSettle] = useState('paid');
  const [pay, setPay] = useState(noPayment);
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
        body: { kind, details, amount: Number(amount), ...paymentBody(pay), ...(boss ? { settle } : {}) },
      });
      onDone(
        r.expense.status === 'paid'
          ? `${r.expense.ref} added. It is in the cash book.`
          : r.expense.status === 'approved'
            ? `${r.expense.ref} added. The cashier has been told to pay it.`
            : `${r.expense.ref} added. The manager has been told.`,
        r.expense.status
      );
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Add expense"
      description={boss
        ? 'You are the manager, so it is approved as you save it.'
        : 'It goes to the manager. Nothing leaves the till until they approve it.'}
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="raise" disabled={busy || details.trim().length < 3 || !(Number(amount) > 0) || (boss && settle === 'paid' && proofMissing(pay))}>
            {busy ? 'Saving…' : boss ? 'Add expense' : 'Send to the manager'}
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
          hint="Be specific: “grinder disc for the workshop”, not “parts”."
        >
          <Input
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            placeholder="Transport, delivery to Ntinda"
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

        {boss && (
          <Field
            label="Has it been paid?"
            hint={settle === 'paid'
              ? 'It goes in today’s cash book as money out.'
              : 'It waits under “To pay” until the cashier pays it out.'}
          >
            <Segmented label="Has it been paid?" value={settle} onChange={setSettle} options={SETTLE} />
          </Field>
        )}

        <PaymentFields p={pay} set={setPay} paid={boss && settle === 'paid'} />

        {who && (
          <p className="text-[12px] text-ink-muted">
            Added as <b className="font-semibold text-ink-2">{who.fullName}</b>. Your name stays
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
      description={[e.details, paymentLine(e), `raised by ${e.raised_by}`, `asked for ${money(e.amount)}`].filter(Boolean).join(' · ')}
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
              className="tnum text-[15px] font-semibold"
              autoFocus
            />
          </Field>
        )}

        <Field
          label={approve ? 'Note (optional)' : 'Why is it declined?'}
          hint={
            approve
              ? 'Anything they should know: “take the cheaper disc”.'
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

function PayDialog({ expense, onClose, onDone }) {
  const [pay, setPay] = useState({
    ...noPayment,
    method: PAY.some((m) => m.value === expense.method) ? expense.method : 'cash',
    payee: expense.payee || '',
    payNumber: expense.pay_number || '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api(`/api/expenses/${expense.id}/pay`, { method: 'POST', body: paymentBody(pay) });
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
          <Button type="submit" form="pay-out" disabled={busy || proofMissing(pay)}>
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
          <strong className="tnum mt-1 block font-display text-[22px] font-extrabold leading-none text-ink">
            {money(expense.amount)}
          </strong>
        </div>

        <PaymentFields p={pay} set={setPay} paid />

        <p className="text-[12px] leading-relaxed text-ink-muted">
          This writes a cash-out line in today&rsquo;s cash book against{' '}
          <b className="font-semibold text-ink-2">{expense.ref}</b>, so the book still matches the
          drawer.
        </p>
      </form>
    </Modal>
  );
}
