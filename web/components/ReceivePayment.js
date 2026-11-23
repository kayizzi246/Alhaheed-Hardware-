'use client';

import { useEffect, useState } from 'react';
import { api, upload } from '@/lib/api';
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
  const needsRef = method !== 'cash';

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
      title={`Receive payment — ${order.order_no}`}
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
            disabled={busy || reading !== null || paid < order.total || (needsRef && (!normaliseRef(ref) || dupe))}
          >
            {busy ? 'Recording…' : 'Confirm & send to Accounts'}
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
          <strong className="tnum mt-1 block font-display text-[26px] font-extrabold leading-none text-ink">
            {money(order.total)}
          </strong>
        </div>

        <Field label="How did they pay?">
          <Segmented label="Payment method" value={method} onChange={setMethod} options={METHODS} />
        </Field>

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
            className="tnum text-[17px] font-semibold"
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
                    'bg-surface px-4 py-4 text-[13.5px] font-semibold text-brand transition-colors duration-150',
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
                  <div className="min-w-0 flex-1 text-[13px]">
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
                        Could not read an ID off this picture. Type it in below — the picture is kept as the record.
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
                refFrom === 'picture' ? 'Filled in from the picture — correct it if it is wrong.'
                  : refFrom === 'pasted' ? 'Taken from the message you pasted.'
                    : method === 'mobile_money' ? 'From the MTN or Airtel message. You can paste the whole message here.'
                      : 'The RRN or reference on the card slip.'
              }
              error={dupe ? `Already used — it paid for order ${dupe.orderNo} (receipt ${dupe.receiptNo}).` : null}
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
              <p className="rounded-sm border border-warn/30 bg-warn-bg px-3 py-2 text-[13px] text-warn">
                The message says <strong className="tnum">{money(found.amount)}</strong>, but{' '}
                <strong className="tnum">{money(Math.trunc(paid))}</strong> is entered as received.
                Check before confirming.
              </p>
            )}
          </>
        )}
      </form>
    </Modal>
  );
}
