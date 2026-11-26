'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, getUser, peek } from '@/lib/api';
import { dateTime, list } from '@/lib/format';
import {
  Alert, Button, Card, CardBody, CardHead, CardNote, CardTitle, Chip, Empty,
  Field, Input, Loading, Modal, PageHead, Select, Table, TableWrap, Td,
  Textarea, Th, Tr, LoadFailed } from '@/components/ui';

/**
 * Suppliers, and writing to them.
 *
 * The cashier has been doing this in a mail app: finding the address,
 * typing out what has run out, copying figures off another screen. All
 * three are places to get it wrong, and none of it is written down
 * anywhere the shop can look at later.
 *
 * So the draft is built from what is actually low on the shelf, the
 * address comes from the list rather than from memory, and every
 * message is kept — including the ones that failed to send, which is
 * the only way anybody finds out that they did.
 */
export default function Suppliers() {
  const [data, setData] = useState(() => peek('/api/suppliers'));
  const [mail, setMail] = useState(() => list(peek('/api/suppliers/mail')?.mail));
  const [low, setLow] = useState(() => list(peek('/api/suppliers/restock')?.items));
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [adding, setAdding] = useState(false);
  const [writingTo, setWritingTo] = useState(null);
  const [reading, setReading] = useState(null);

  const user = getUser();

  const load = useCallback(async () => {
    try {
      const [s, m, r] = await Promise.all([
        api('/api/suppliers'),
        api('/api/suppliers/mail'),
        api('/api/suppliers/restock'),
      ]);
      setData(s);
      setMail(list(m.mail));
      setLow(list(r.items));
      setError('');
    } catch (e) {
      // On failure, keep what was on screen; the error says it is stale.
      setError(e.message);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (!data) return error ? <LoadFailed onRetry={load}>{error}</LoadFailed> : <Loading>Loading suppliers…</Loading>;

  const suppliers = list(data.suppliers);
  const active = suppliers.filter((s) => s.active);
  const health = data.mailReady;

  return (
    <>
      <PageHead
        title="Suppliers"
        sub={`${active.length} the shop buys from · ${low.length} ${low.length === 1 ? 'item' : 'items'} low on the shelf`}
      >
        {data.canSend && (
          <Button size="sm" onClick={() => setAdding(true)}>Add a supplier</Button>
        )}
      </PageHead>

      <Alert>{error}</Alert>
      <Alert kind="ok" onDone={() => setNotice('')}>{notice}</Alert>

      {/* Whether mail is actually leaving the building. A cashier who
          believes a message was sent when it was not is worse off than
          one who knows to pick up the telephone. */}
      {health && health.working === false && (
        <Alert>{health.note}</Alert>
      )}

      <Card className="mb-4">
        <CardHead>
          <CardTitle>Who the shop buys from</CardTitle>
          {health?.from && (
            <span className="text-[12px] text-ink-muted">sent as {health.from}</span>
          )}
        </CardHead>

        {suppliers.length === 0 ? (
          <Empty title="No suppliers on the list yet">
            Add the ones the shop already buys from. Their address gets typed
            once, here, instead of remembered every time.
          </Empty>
        ) : (
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>Supplier</Th><Th>Who to ask for</Th><Th>Email</Th>
                  <Th>Supplies</Th><Th>Last written to</Th><Th />
                </tr>
              </thead>
              <tbody>
                {suppliers.map((s) => (
                  <Tr key={s.id}>
                    <Td>
                      <span className="font-semibold text-ink">{s.name}</span>
                      {!s.active && <Chip className="ml-2">No longer used</Chip>}
                      {s.phone && (
                        <span className="tnum block text-[11.5px] text-ink-muted">{s.phone}</span>
                      )}
                    </Td>
                    <Td className="text-ink-muted">{s.contact || ''}</Td>
                    <Td className="text-ink-muted">{s.email}</Td>
                    <Td className="text-ink-muted">{s.supplies || ''}</Td>
                    <Td className="tnum text-ink-muted">
                      {s.lastMail ? dateTime(s.lastMail) : 'never'}
                    </Td>
                    <Td>
                      <div className="flex justify-end gap-2">
                        {data.canSend && s.active && (
                          <Button size="sm" onClick={() => setWritingTo(s)}>Write to them</Button>
                        )}
                        {data.canSend && !s.active && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={async () => {
                              try {
                                await api(`/api/suppliers/${s.id}`, { method: 'PATCH', body: { active: true } });
                                setNotice(`${s.name} is back on the list.`);
                                load();
                              } catch (e) { setError(e.message); }
                            }}
                          >
                            Put back
                          </Button>
                        )}
                      </div>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}
        {health && health.working === null && suppliers.length > 0 && (
          <CardNote>{health.note}</CardNote>
        )}
      </Card>

      <Card className="mb-4">
        <CardHead>
          <CardTitle>Low on the shelf</CardTitle>
          <span className="text-[12px] text-ink-muted">
            {low.length === 0 ? 'nothing to reorder' : 'worst first'}
          </span>
        </CardHead>
        {low.length === 0 ? (
          <Empty title="Nothing is below its reorder level">
            Set a reorder level on a product and it will appear here when stock
            drops to it.
          </Empty>
        ) : (
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>Product</Th><Th>Code</Th><Th num>In stock</Th>
                  <Th num>Reorder at</Th><Th num>Suggest ordering</Th><Th>Supplier</Th>
                </tr>
              </thead>
              <tbody>
                {low.map((i) => (
                  <Tr key={i.code}>
                    <Td className="font-medium text-ink">{i.name}</Td>
                    <Td className="tnum text-ink-muted">{i.code}</Td>
                    <Td num className="font-semibold text-bad">{i.stock}</Td>
                    <Td num className="text-ink-muted">{i.reorder}</Td>
                    <Td num className="font-semibold text-ink">{i.suggest} {i.unit}</Td>
                    <Td className="text-ink-muted">{i.supplier || ''}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}
        <CardNote>
          The suggestion is enough to get back above the reorder level with the
          same again as headroom. Ordering exactly the shortfall means ordering
          again next week.
        </CardNote>
      </Card>

      <Card>
        <CardHead>
          <CardTitle>Messages sent</CardTitle>
          <span className="text-[12px] text-ink-muted">
            {mail.length === 0 ? 'nothing sent yet' : `last ${mail.length}`}
          </span>
        </CardHead>
        {mail.length === 0 ? (
          <Empty title="Nothing has been sent from here yet" />
        ) : (
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>When</Th><Th>Supplier</Th><Th>Subject</Th>
                  <Th>Sent by</Th><Th>Status</Th><Th />
                </tr>
              </thead>
              <tbody>
                {mail.map((m) => (
                  <Tr key={m.id}>
                    <Td className="tnum text-ink-muted">{dateTime(m.at)}</Td>
                    <Td className="font-medium text-ink">{m.supplier || m.to}</Td>
                    <Td>{m.subject}</Td>
                    <Td className="text-ink-muted">{m.sentBy}</Td>
                    <Td>
                      {m.status === 'sent'
                        ? <Chip tone="ok">Sent</Chip>
                        : <Chip tone="bad">Did not send</Chip>}
                    </Td>
                    <Td>
                      <div className="flex justify-end">
                        <Button variant="outline" size="sm" onClick={() => setReading(m)}>
                          Read
                        </Button>
                      </div>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </Card>

      {adding && (
        <AddSupplier
          onClose={() => setAdding(false)}
          onDone={(name) => { setAdding(false); setNotice(`${name} added.`); load(); }}
          onError={setError}
        />
      )}

      {writingTo && (
        <Compose
          supplier={writingTo}
          low={low}
          sender={user?.fullName}
          onClose={() => setWritingTo(null)}
          onSent={(to) => { setWritingTo(null); setNotice(`Sent to ${to}.`); load(); }}
          onError={setError}
        />
      )}

      {reading && (
        <Modal
          title={reading.subject}
          description={`To ${reading.to} · ${dateTime(reading.at)} · sent by ${reading.sentBy}`}
          onClose={() => setReading(null)}
          footer={<Button variant="outline" onClick={() => setReading(null)}>Close</Button>}
        >
          {reading.status !== 'sent' && reading.error && (
            <Alert>{reading.error}</Alert>
          )}
          <pre className="max-h-[50vh] overflow-auto whitespace-pre-wrap rounded-md bg-surface-sunk p-3 text-[12px] leading-relaxed text-ink">
            {reading.body}
          </pre>
        </Modal>
      )}
    </>
  );
}

function AddSupplier({ onClose, onDone, onError }) {
  const [form, setForm] = useState({ name: '', contact: '', email: '', phone: '', supplies: '' });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const ready = form.name.trim().length >= 2 && /\S+@\S+\.\S+/.test(form.email);

  async function save() {
    setBusy(true);
    try {
      const r = await api('/api/suppliers', { method: 'POST', body: form });
      onDone(r.supplier.name);
    } catch (e) {
      onError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Add a supplier"
      description="The address gets typed once here, and is never retyped from memory again."
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={busy || !ready} onClick={save}>
            {busy ? 'Adding…' : 'Add supplier'}
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Supplier name" className="sm:col-span-2">
          <Input value={form.name} onChange={set('name')} placeholder="Mukasa Hardware Supplies" autoFocus />
        </Field>
        <Field label="Who to ask for">
          <Input value={form.contact} onChange={set('contact')} placeholder="Joseph Mukasa" />
        </Field>
        <Field label="Phone">
          <Input value={form.phone} onChange={set('phone')} placeholder="0772 123456" />
        </Field>
        <Field label="Email" hint="Where the shop's messages go." className="sm:col-span-2">
          <Input type="email" value={form.email} onChange={set('email')} placeholder="joseph@mukasahardware.com" />
        </Field>
        <Field label="What they supply" hint="So the right supplier is obvious later." className="sm:col-span-2">
          <Input value={form.supplies} onChange={set('supplies')} placeholder="Cement, iron bars, nails" />
        </Field>
      </div>
    </Modal>
  );
}

/**
 * Writing the message.
 *
 * The draft is filled in from the shelf, not from a blank box. A
 * cashier staring at an empty message at seven in the morning is a
 * cashier who writes "send cement" and gets the wrong thing — so the
 * figures are laid out, and they can delete what they do not want.
 */
function Compose({ supplier, low, sender, onClose, onSent, onError }) {
  const theirs = useMemo(() => {
    const mine = low.filter(
      (i) => i.supplier && i.supplier.toLowerCase().trim() === supplier.name.toLowerCase().trim()
    );
    // A product with no supplier named on it still has to be ordered
    // from somebody, so an unmatched shelf offers everything rather
    // than offering nothing.
    return mine.length ? mine : low;
  }, [low, supplier.name]);

  const [picked, setPicked] = useState(() => new Set(theirs.map((i) => i.code)));
  const [subject, setSubject] = useState(`Restock request: ${supplier.name}`);
  const [intro, setIntro] = useState(
    `Good morning${supplier.contact ? ' ' + supplier.contact.split(' ')[0] : ''},\n\nPlease supply the following:`
  );
  const [outro, setOutro] = useState('Kindly confirm the price and when you can deliver.');
  const [busy, setBusy] = useState(false);

  const chosen = theirs.filter((i) => picked.has(i.code));

  // The table is built as fixed-width text so it still lines up in a
  // mail client that uses a proportional font badly.
  const body = useMemo(() => {
    const lines = chosen.map(
      (i) => `  ${i.name.padEnd(30)} ${String(i.suggest).padStart(5)} ${i.unit.padEnd(8)} (${i.stock} left)`
    );
    return [intro, '', ...lines, '', outro].join('\n');
  }, [chosen, intro, outro]);

  async function send() {
    setBusy(true);
    try {
      await api(`/api/suppliers/${supplier.id}/email`, {
        method: 'POST',
        body: { subject, body, itemCount: chosen.length },
      });
      onSent(supplier.name);
    } catch (e) {
      onError(e.message);
      setBusy(false);
    }
  }

  function toggle(code) {
    setPicked((p) => {
      const next = new Set(p);
      if (next.has(code)) next.delete(code); else next.add(code);
      return next;
    });
  }

  return (
    <Modal
      title={`Write to ${supplier.name}`}
      description={`Goes to ${supplier.email}. It will be signed ${sender || 'by you'}.`}
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={busy || subject.trim().length < 3 || body.trim().length < 10} onClick={send}>
            {busy ? 'Sending…' : 'Send it'}
          </Button>
        </>
      }
    >
      <Field label="Subject">
        <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
      </Field>

      {theirs.length > 0 && (
        <Field
          label="What to ask for"
          hint="Ticked items go into the message. Untick anything not wanted."
        >
          <div className="max-h-[180px] overflow-auto rounded-md border border-line">
            {theirs.map((i) => (
              <label
                key={i.code}
                className="flex cursor-pointer items-center gap-3 border-b border-line px-3 py-2 text-[12px] last:border-0 hover:bg-surface-sunk"
              >
                <input
                  type="checkbox"
                  checked={picked.has(i.code)}
                  onChange={() => toggle(i.code)}
                  className="h-4 w-4 accent-brand"
                />
                <span className="flex-1 font-medium text-ink">{i.name}</span>
                <span className="tnum text-ink-muted">{i.stock} left</span>
                <span className="tnum font-semibold text-ink">ask {i.suggest} {i.unit}</span>
              </label>
            ))}
          </div>
        </Field>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Opening">
          <Textarea rows={3} value={intro} onChange={(e) => setIntro(e.target.value)} />
        </Field>
        <Field label="Closing">
          <Textarea rows={3} value={outro} onChange={(e) => setOutro(e.target.value)} />
        </Field>
      </div>

      <Field label="What they will receive" hint="This is the message, exactly as it goes out.">
        <pre className="max-h-[200px] overflow-auto whitespace-pre rounded-md bg-surface-sunk p-3 text-[12px] leading-relaxed text-ink">
          {body}
        </pre>
      </Field>
    </Modal>
  );
}
