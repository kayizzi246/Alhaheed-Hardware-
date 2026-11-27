'use client';

import { useEffect, useState } from 'react';
import { api, upload, getUser } from '@/lib/api';
import { readPaymentText, normaliseRef } from '@/lib/txref';
import { readImageText, shrinkImage } from '@/lib/ocr';
import { money } from '@/lib/format';
import { cn } from '@/lib/cn';
import { Alert, Button, Field, Input, Modal, Segmented } from '@/components/ui';

/**
 * Taking the money for one order.
 *
 * Its own file because two screens open it: the payment queue, for
 * orders placed on the app, and the counter sale, for somebody standing
 * at the till. The same form both ways, so a counter sale gets the same
 * duplicate-reference check, screenshot reading and receipt.
 */
const METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'mobile_money', label: 'Mobile Money' },
  { value: 'card', label: 'Card' },
];

export default function ReceivePayment({ order, onClose, onDone }) {
  const [method, setMethod] = useState('cash');
  // The customer's credit account, if they have one: then "On credit"
  // is a way to pay, within the limit.
  const [credit, setCredit] = useState(null);
  const [override, setOverride] = useState('');
  const isManager = getUser()?.role === 'manager';
  const [first, setFirst] = useState({ amount: '', method: 'cash', ref: '', busy: false, done: '' });
  const loadCredit = () => {
    if (!order.customer_id) return Promise.resolve();
    return api(`/api/credit/${order.customer_id}`)
      .then((r) => {
        const a = r.account;
        if (a && a.status !== 'none') {
          setCredit(a);
          if (order.wants_credit) setMethod('credit');
        }
      })
      .catch(() => {});
  };
  useEffect(() => { loadCredit(); }, [order.customer_id, order.wants_credit]); // eslint-disable-line react-hooks/exhaustive-deps
  // What they must pay off first for this to fit: what is late, and
  // enough to bring the total under the limit.
  const payFirst = credit && credit.status === 'active'
    ? Math.max(0, credit.overdue, credit.owed + order.total - credit.limit)
    : 0;
  async function takeFirst() {
    setFirst((x) => ({ ...x, busy: true }));
    setError('');
    try {
      const r = await api(`/api/credit/${order.customer_id}/payment`, {
        method: 'POST',
        body: { amount: Number(first.amount), method: first.method, ref: first.ref },
      });
      setFirst({ amount: '', method: 'cash', ref: '', busy: false, done: `Received ${money(Number(first.amount))}, receipt ${r.receiptNo}.` });
      await loadCredit();
    } catch (e) {
      setError(e.message);
      setFirst((x) => ({ ...x, busy: false }));
    }
  }
  const onCredit = method === 'credit';
  // Part paid now on a loan sale: only the rest goes on the loan.
  const [part, setPart] = useState({ amount: '', method: 'cash', ref: '' });
  const partNow = Math.min(order.total, Number(part.amount || 0));
  const onLoan = order.total - partNow;
  const partOk = !partNow || part.method === 'cash' || part.ref.trim().length >= 3;
  const after = credit ? credit.owed + onLoan : 0;
  // The same rules the server applies, said before Confirm is pressed.
  const blocked = !credit ? null
    : credit.status === 'hold' ? 'Credit is stopped for this customer.'
    : credit.status === 'closed' ? 'This credit account is closed.'
    : credit.overdue > 0 ? `${money(credit.overdue)} is past the ${credit.termsDays} days to pay. Pay that first.`
    : after > credit.limit ? `This would make ${money(after)} owed. The limit is ${money(credit.limit)}. Only ${money(Math.max(0, credit.limit - credit.owed))} is left.`
    : null;
  const [amount, setAmount] = useState(String(order.total));
  const [ref, setRef] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // The screenshot, and what was read off it.
  const [proof, setProof] = useState(null);       // File, already shrunk
  const [preview, setPreview] = useState('');     // object URL for the thumbnail
  const [reading, setReading] = useState(null);   // null | { stage, progress }
  const [found, setFound] = useState(null);       // { ref, how, amount, network } | { failed: true }
  const [refFrom, setRefFrom] = useState('typed'); // 'typed' | 'picture' | 'pasted'
  const [dupe, setDupe] = useState(null);         // { orderNo, receiptNo } when already used
  const [big, setBig] = useState(false);          // the picture shown full width

  const paid = Number(amount || 0);
  const change = paid - order.total;
  const needsRef = method !== 'cash' && method !== 'credit';

  // The thumbnail's URL is let go of when the picture changes or the
  // box closes, or every attached picture stays in memory for the day.
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  // Ask the server whether this reference has already paid for
  // something, while the cashier can still do something about it.
  useEffect(() => {
    const value = normaliseRef(ref);
    if (!needsRef || value.length < 6) { setDupe(null); return undefined; }
    let live = true;
    const t = setTimeout(() => {
      api(`/api/cashier/check-ref?ref=${encodeURIComponent(value)}&order=${order.id}`)
        .then((r) => { if (live) setDupe(r.used ? r : null); })
        .catch(() => { /* the server checks again on Confirm */ });
    }, 350);
    return () => { live = false; clearTimeout(t); };
  }, [ref, needsRef, order.id]);

  async function attach(file) {
    if (!file) return;
    setError('');
    setFound(null);
    try {
      const small = await shrinkImage(file);
      setProof(small);
      setPreview(URL.createObjectURL(small));

      setReading({ stage: 'preparing', progress: 0 });
      const text = await readImageText(small, (stage, progress) => setReading({ stage, progress }));
      const result = readPaymentText(text);
      setFound(result.ref || result.amount ? result : { failed: true });
      // Opened so the ID can be checked against it without hunting.
      setBig(true);

      // Only fill the box if the cashier has not typed something
      // already — what a person typed outranks what a machine read.
      if (result.ref && (!ref || refFrom !== 'typed')) {
        setRef(result.ref);
        setRefFrom('picture');
      }
    } catch (e) {
      // Reading failed (offline, odd picture). The picture is still
      // attached as the record; the cashier types the ID.
      setFound({ failed: true });
    } finally {
      setReading(null);
    }
  }

  function removeProof() {
    setProof(null);
    setPreview('');
    setFound(null);
    if (refFrom === 'picture') { setRef(''); setRefFrom('typed'); }
  }

  // Pasting the whole SMS into the box works too: the ID is taken out
  // of it rather than the paragraph landing in the field.
  function onPaste(e) {
    const text = e.clipboardData.getData('text');
    if (text.length < 30) return;
    const result = readPaymentText(text);
    if (result.ref) {
      e.preventDefault();
      setRef(result.ref);
      setRefFrom('pasted');
      setFound(result);
    }
  }

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (onCredit) {
        const res = await api(`/api/cashier/orders/${order.id}/payment`, {
          method: 'POST',
          body: {
            method: 'credit',
            creditOverride: blocked ? override.trim() : '',
            paidNow: partNow,
            paidMethod: part.method,
            paidRef: part.ref.trim(),
          },
        });
        if (res.order?.credit_approval?.status === 'pending') {
          onDone(`${order.order_no} is waiting for the owner to approve the loan. It stays in the queue until then`);
          return;
        }
        const no = res.order?.payment?.receipt_no || '';
        onDone(partNow
          ? `${no}. Total ${money(order.total)}, paid now ${money(partNow)}${res.order?.paid_now_receipt ? ` (receipt ${res.order.paid_now_receipt})` : ''}, ${money(onLoan)} on the loan`
          : no);
        return;
      }
      const fields = {
        method,
        amountPaid: String(Math.trunc(paid)),
        transactionRef: needsRef ? normaliseRef(ref) : '',
      };

      let res;
      if (needsRef && proof) {
        const form = new FormData();
        Object.entries(fields).forEach(([k, v]) => form.append(k, v));
        form.append('proof', proof, proof.name || 'proof.jpg');
        res = await upload(`/api/cashier/orders/${order.id}/payment`, form);
      } else {
        res = await api(`/api/cashier/orders/${order.id}/payment`, {
          method: 'POST',
          body: { ...fields, amountPaid: Math.trunc(paid), transactionRef: fields.transactionRef || null },
        });
      }

      // The server answers with the order; the receipt is on its
      // payment. This used to read res.receipt, which does not exist,
      // so a payment that had gone through showed the cashier an error.
      onDone(res.order?.payment?.receipt_no || res.order?.receipt_no || '');
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  const amountMismatch =
    found && !found.failed && found.amount && needsRef && found.amount !== Math.trunc(paid);

  return (
    <Modal
      title={`Receive payment: ${order.order_no}`}
      description={`${order.company_name || order.ordered_by_name} · ${order.item_count} ${
        order.item_count === 1 ? 'item' : 'items'
      }`}
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            type="submit"
            form="pay"
            disabled={onCredit
              ? busy || !partOk || order.credit_approval?.status === 'pending' || (blocked && !(isManager && override.trim().length >= 5))
              : busy || reading !== null || paid < order.total || (needsRef && (!normaliseRef(ref) || dupe))}
          >
            {busy ? 'Recording…' : onCredit ? (isManager ? (partNow ? `Take ${money(partNow)}, ${money(onLoan)} on loan` : 'Put on loan & send to Accounts') : 'Ask the owner to approve the loan') : 'Confirm & send to Accounts'}
          </Button>
        </>
      }
    >
      <form id="pay" onSubmit={submit} className="space-y-4">
        <Alert>{error}</Alert>

        <div className="rounded-sm border border-line bg-surface-2 px-4 py-3">
          <span className="block text-[11px] font-bold uppercase tracking-[.07em] text-ink-muted">
            Amount due
          </span>
          <strong className="tnum mt-1 block font-display text-[22px] font-extrabold leading-none text-ink">
            {money(order.total)}
          </strong>
        </div>

        <Field label="How did they pay?">
          <Segmented
            label="Payment method"
            value={method}
            onChange={setMethod}
            options={credit ? [...METHODS, { value: 'credit', label: 'On loan' }] : METHODS}
          />
        </Field>

        {order.wants_credit && !credit && (
          <Alert kind="warn">The customer asked for credit, but has no credit account. Take payment, or ask the manager.</Alert>
        )}

        {onCredit && order.credit_approval?.status === 'pending' && (
          <Alert kind="warn">This loan is waiting for the owner. It cannot be sent again. Take cash instead, or wait.</Alert>
        )}
        {onCredit && order.credit_approval?.status === 'rejected' && (
          <Alert>The owner refused this loan{order.credit_approval.note ? `: “${order.credit_approval.note}”` : '.'} Take payment another way.</Alert>
        )}
        {onCredit && credit && (
          <div className="space-y-3 rounded-xl border border-line bg-surface-2 p-4">
            <div className="grid grid-cols-3 gap-3 text-[12px]">
              <div><span className="block text-ink-muted">{credit.owed < 0 ? 'Paid ahead' : 'Owes now'}</span><b className={cn('tnum text-[14px]', credit.owed < 0 ? 'text-ok' : 'text-ink')}>{money(Math.abs(credit.owed))}</b></div>
              <div><span className="block text-ink-muted">Limit</span><b className="tnum text-[14px] text-ink">{money(credit.limit)}</b></div>
              <div><span className="block text-ink-muted">After this</span><b className={cn('tnum text-[14px]', blocked ? 'text-bad' : 'text-ink')}>{money(after)}</b></div>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-line">
              <div className={cn('h-full rounded-full', after > credit.limit ? 'bg-bad' : after > credit.limit * 0.8 ? 'bg-warn' : 'bg-[#92D050]')} style={{ width: `${Math.min(100, credit.limit ? (after / credit.limit) * 100 : 100)}%` }} />
            </div>
            <div className="space-y-2 rounded-lg border border-line bg-surface p-3">
              <p className="text-[13px] font-bold text-ink">Paid now <span className="font-normal text-ink-muted">(leave empty if nothing)</span></p>
              <div className="flex flex-wrap items-end gap-2">
                <Input className="tnum w-[150px]" inputMode="numeric" value={part.amount} placeholder="0" onChange={(e) => setPart((x) => ({ ...x, amount: e.target.value.replace(/D/g, '') }))} />
                <Segmented label="Paid by" value={part.method} onChange={(v) => setPart((x) => ({ ...x, method: v }))} options={[{ value: 'cash', label: 'Cash' }, { value: 'mobile_money', label: 'MoMo' }, { value: 'bank', label: 'Bank' }]} />
                {part.method !== 'cash' && <Input className="w-[160px]" value={part.ref} placeholder="Transaction ID" onChange={(e) => setPart((x) => ({ ...x, ref: e.target.value }))} />}
              </div>
              <div className="grid grid-cols-3 gap-2 rounded-md bg-surface-2 px-3 py-2 text-[12px]">
                <div><span className="block text-ink-muted">Total</span><b className="tnum text-ink">{money(order.total)}</b></div>
                <div><span className="block text-ink-muted">Paid now</span><b className="tnum text-ok">{money(partNow)}</b></div>
                <div><span className="block text-ink-muted">On the loan</span><b className="tnum text-ink">{money(onLoan)}</b></div>
              </div>
            </div>
            <p className="text-[12px] text-ink-muted">The loan is paid within {credit.termsDays} days. {partNow ? 'What is paid now gets its own receipt and goes in the cash book.' : 'No money goes in the cash book now.'}</p>
            {first.done && <p className="rounded-lg bg-ok-bg px-3 py-2 text-[12.5px] font-semibold text-ok">{first.done}</p>}
            {blocked && payFirst > 0 && (
              <div className="space-y-2 rounded-lg border border-warn/30 bg-warn-bg/60 p-3">
                <p className="text-[13px] font-bold text-ink">Take {money(payFirst)} from them first</p>
                <p className="text-[12px] text-ink-2">That pays what is late and brings them under the limit. Then put this order on credit.</p>
                <div className="flex flex-wrap items-end gap-2">
                  <Input className="w-[140px]" inputMode="numeric" value={first.amount} placeholder={String(payFirst)} onChange={(e) => setFirst((x) => ({ ...x, amount: e.target.value.replace(/D/g, '') }))} />
                  <Segmented label="Paid by" value={first.method} onChange={(v) => setFirst((x) => ({ ...x, method: v }))} options={[{ value: 'cash', label: 'Cash' }, { value: 'mobile_money', label: 'MoMo' }, { value: 'bank', label: 'Bank' }]} />
                  {first.method !== 'cash' && <Input className="w-[150px]" value={first.ref} placeholder="Transaction ID" onChange={(e) => setFirst((x) => ({ ...x, ref: e.target.value }))} />}
                  <Button type="button" size="sm" disabled={first.busy || !(Number(first.amount) > 0) || (first.method !== 'cash' && first.ref.trim().length < 3)} onClick={takeFirst}>
                    {first.busy ? 'Saving…' : 'Receive'}
                  </Button>
                  <button type="button" className="text-[12px] font-semibold text-brand hover:underline" onClick={() => setFirst((x) => ({ ...x, amount: String(payFirst) }))}>Fill {money(payFirst)}</button>
                </div>
              </div>
            )}
            {blocked && (
              <div className="space-y-2">
                <p className="rounded-lg bg-bad-bg px-3 py-2 text-[12.5px] font-semibold text-bad">{blocked}</p>
                {isManager ? (
                  <Field label="Allow it anyway? Say why" hint="Written in History with your name.">
                    <Input value={override} onChange={(e) => setOverride(e.target.value)} placeholder="Ben pays on Friday, agreed by phone" />
                  </Field>
                ) : (
                  <p className="text-[12px] text-ink-muted">Ask them to pay some first, take cash, or call the manager.</p>
                )}
              </div>
            )}
          </div>
        )}

        {!onCredit && (<>

        <Field
          label="Amount received"
          hint={change > 0 ? `Change to give: ${money(change)}` : null}
        >
          <Input
            type="number"
            min={order.total}
            inputMode="numeric"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            onFocus={(e) => e.target.select()}
            autoFocus
            required
            className="tnum text-[15px] font-semibold"
          />
        </Field>

        {needsRef && (
          <>
            <Field
              label="Proof of payment"
              hint={proof ? null : 'A screenshot or photo of the message. The transaction ID is read off it for you.'}
            >
              {!proof ? (
                <label
                  className={cn(
                    'flex cursor-pointer items-center justify-center gap-2 rounded-sm border border-dashed border-line-firm',
                    'bg-surface px-4 py-4 text-[12.5px] font-semibold text-brand transition-colors duration-150',
                    'hover:border-brand hover:bg-brand-soft active:scale-[0.99]'
                  )}
                >
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={(e) => { attach(e.target.files?.[0]); e.target.value = ''; }}
                  />
                  Attach the screenshot
                </label>
              ) : (
                <div className="flex items-center gap-3 rounded-sm border border-line bg-surface p-2.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <button type="button" onClick={() => setBig((b) => !b)} title={big ? 'Hide the picture' : 'Show the picture'} className="shrink-0">
                    <img src={preview} alt="Payment screenshot" className="h-16 w-12 rounded-[3px] border border-line object-cover object-center" />
                  </button>
                  <div className="min-w-0 flex-1 text-[12px]">
                    {reading ? (
                      <>
                        <span className="block font-medium text-ink">
                          {reading.stage === 'preparing' ? 'Getting the reader ready…' : 'Reading the transaction ID…'}
                        </span>
                        <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-surface-sunk">
                          <span
                            className="block h-full rounded-full bg-brand transition-[width] duration-200 ease-out"
                            style={{ width: `${Math.round((reading.progress || 0) * 100)}%` }}
                          />
                        </span>
                      </>
                    ) : found?.failed || (found && !found.ref) ? (
                      <span className="block text-ink-muted">
                        Could not read an ID off this picture. Type it in below. The picture is kept as the record.
                      </span>
                    ) : found?.ref ? (
                      <span className="block text-ink-muted">
                        Read <strong className="tnum text-ink">{found.ref}</strong>
                        {found.network ? ` · ${found.network}` : ''}. Check it matches the picture.
                      </span>
                    ) : (
                      <span className="block text-ink-muted">Attached.</span>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <Button type="button" variant="ghost" size="sm" onClick={() => setBig((b) => !b)} disabled={!!reading}>
                      {big ? 'Hide picture' : 'Show picture'}
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={removeProof} disabled={!!reading}>
                      Remove
                    </Button>
                  </div>
                </div>
              )}
            </Field>

            {/* Big enough to check the ID against, character by
                character, right above the box it was copied into. A
                thumbnail with "check it matches" under it is an
                instruction nobody can follow. */}
            {proof && big && (
              <div className="max-h-[320px] overflow-auto rounded-sm border border-line bg-surface-sunk">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={preview} alt="Payment screenshot, full width" className="block w-full" />
              </div>
            )}

            <Field
              label="Transaction ID"
              hint={
                refFrom === 'picture' ? 'Filled in from the picture. Correct it if it is wrong.'
                  : refFrom === 'pasted' ? 'Taken from the message you pasted.'
                    : method === 'mobile_money' ? 'From the MTN or Airtel message. You can paste the whole message here.'
                      : 'The RRN or reference on the card slip.'
              }
              error={dupe ? `Already used. It paid for order ${dupe.orderNo} (receipt ${dupe.receiptNo}).` : null}
            >
              <Input
                value={ref}
                onChange={(e) => { setRef(e.target.value); setRefFrom('typed'); }}
                onPaste={onPaste}
                placeholder={method === 'mobile_money' ? '12345678901 or MP261123.1401.A77821' : '432118765123'}
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
                required
                className="tnum uppercase tracking-wide"
              />
            </Field>

            {amountMismatch && (
              <p className="rounded-sm border border-warn/30 bg-warn-bg px-3 py-2 text-[12px] text-warn">
                The message says <strong className="tnum">{money(found.amount)}</strong>, but{' '}
                <strong className="tnum">{money(Math.trunc(paid))}</strong> is entered as received.
                Check before confirming.
              </p>
            )}
          </>
        )}
        </>)}
      </form>
    </Modal>
  );
}
