'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, peek } from '@/lib/api';
import { money, list } from '@/lib/format';
import {
  Alert, Button, Card, Checkbox, Chip, Empty, Field, Input, Loading, Modal, PageHead,
  Stat, Stats, Table, TableWrap, Td, Textarea, Th, Tr, LoadFailed } from '@/components/ui';
import { Icon } from '@/components/icons';

const ACCOUNT_LABEL = (c) => {
  if (c.accountType === 'company_owner') return 'Company owner';
  if (c.accountType === 'company_staff') {
    return `Company staff${c.staffRole ? ` · ${c.staffRole}` : ''}`;
  }
  return 'Individual';
};

/**
 * Who buys here, and how much of it.
 *
 * The cashier and the manager see the same list. The cashier's reason
 * for being here is the person at the counter: are they already on the
 * list, and if not, add them — name and number is enough.
 */
export default function Customers({ canAdd = false, from = '/api/customers' }) {
  const [customers, setCustomers] = useState(() => {
    const r = peek(from);
    return r ? list(r.customers) : null;
  });
  const [q, setQ] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [adding, setAdding] = useState(false);
  const [fresh, setFresh] = useState(null);

  const load = useCallback(async () => {
    try {
      const qs = q.trim() ? `?q=${encodeURIComponent(q.trim())}` : '';
      setCustomers(list((await api(`${from}${qs}`)).customers));
      setError('');
    } catch (e) {
      // On failure, keep what was on screen; the error says it is stale.
      setError(e.message);
    }
  }, [q, from]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  // Not named `list` — that is the imported helper, and shadowing it
  // here makes every call to it in this file throw.
  const rows = customers || [];
  const spent = rows.reduce((s, c) => s + (c.totalSpent || 0), 0);
  const walkIns = rows.filter((c) => c.source === 'counter').length;

  // A number typed into the search that matches nobody is very likely
  // the person standing at the counter. Offer to add them with it.
  const typedPhone = /\d{6,}/.test(q.replace(/\D/g, '')) ? q.trim() : '';

  return (
    <>
      <PageHead title="Customers">
        <Input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Name, phone or email"
          className="w-[260px]"
        />
        {canAdd && <Button onClick={() => setAdding({})}>Add customer</Button>}
      </PageHead>

      <Alert>{error}</Alert>
      <Alert kind="ok" onDone={() => setNotice('')}>{notice}</Alert>

      <Stats className="xl:grid-cols-3">
        <Stat label="Customers" value={rows.length} icon={Icon.people()} />
        <Stat label="Added at the counter" value={walkIns} icon={Icon.user()} tone="neutral" />
        <Stat label="Spent with the shop" value={money(spent)} tone="ok" icon={Icon.cash()} />
      </Stats>

      <Card>
        {!customers ? (
          error ? <LoadFailed onRetry={load}>{error}</LoadFailed> : <Loading>Loading customers…</Loading>
        ) : rows.length === 0 ? (
          <Empty
            title={q ? 'Nobody matches' : 'No customers yet'}
            action={
              canAdd ? (
                <Button onClick={() => setAdding(typedPhone ? { phone: typedPhone } : {})}>
                  {typedPhone ? `Add a customer with ${typedPhone}` : 'Add customer'}
                </Button>
              ) : null
            }
          >
            {q ? 'Try a different name or number.' : 'Customers appear here when they order, or when you add them.'}
          </Empty>
        ) : (
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>Name</Th><Th>Phone</Th><Th>Account</Th>
                  <Th num>Orders</Th><Th num>Spent</Th><Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {rows
                  .slice()
                  .sort((a, b) => (fresh === b.id) - (fresh === a.id) || (b.totalSpent || 0) - (a.totalSpent || 0))
                  .map((c) => (
                    <Tr key={c.id} className={fresh === c.id ? 'bg-brand-soft/60' : undefined}>
                      <Td>
                        <span className="font-semibold text-ink">{c.fullName}</span>
                        {c.companyName && (
                          <span className="block text-xs text-ink-muted">{c.companyName}</span>
                        )}
                      </Td>
                      <Td className="tnum whitespace-nowrap">{c.phone || ''}</Td>
                      <Td className="text-ink-muted">
                        {ACCOUNT_LABEL(c)}
                        {c.source === 'counter' && (
                          <span className="block text-xs">
                            Walk-in{c.addedBy ? ` · added by ${c.addedBy}` : ''}
                          </span>
                        )}
                      </Td>
                      <Td num>{c.orderCount}</Td>
                      <Td num className="whitespace-nowrap font-semibold text-ink">{money(c.totalSpent || 0)}</Td>
                      <Td>
                        <Chip tone={c.status === 'active' ? 'good' : 'grey'}>
                          {c.status === 'active' ? 'Active' : 'Suspended'}
                        </Chip>
                      </Td>
                    </Tr>
                  ))}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </Card>

      {adding && (
        <AddCustomer
          start={adding}
          onClose={() => setAdding(false)}
          onFound={(c) => {
            setAdding(false);
            setQ(c.phone || c.fullName);
            setFresh(c.id);
            setNotice(`${c.fullName} is already a customer — they are shown below.`);
          }}
          onDone={(c, smsSent) => {
            setAdding(false);
            setQ('');
            setFresh(c.id);
            setNotice(
              `${c.fullName} added.${smsSent === true ? ' They have been texted a welcome.' : smsSent === false ? ' The welcome text did not send.' : ''}`
            );
            load();
          }}
        />
      )}
    </>
  );
}

/**
 * Add somebody standing at the counter.
 *
 * Name and number are all that is required: anything more is a queue
 * forming behind them. The number is the customer — it is how the
 * shop finds them next time and how they sign in on the app — so a
 * number already on the list brings that customer up instead of
 * making a second one.
 */
function AddCustomer({ start, onClose, onFound, onDone }) {
  const [form, setForm] = useState({
    fullName: '',
    phone: start.phone || '',
    email: '',
    address: '',
    notes: '',
    welcome: true,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [existing, setExisting] = useState(null);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setExisting(null);
    try {
      // Raw, because a 409 here carries the customer who already has
      // the number — the plain helper would keep only the message.
      const res = await api('/api/customers', { method: 'POST', body: form, raw: true });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        onDone(data.customer, data.smsSent);
        return;
      }
      if (data.data && data.data.customer) setExisting(data.data.customer);
      setError(data.error || data.message || `Could not add them (${res.status})`);
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  }

  return (
    <Modal
      title="Add a customer"
      description="For someone who has come to the shop. Name and phone number are enough."
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="add-customer" disabled={busy || form.fullName.trim().length < 2 || form.phone.replace(/\D/g, '').length < 9}>
            {busy ? 'Adding…' : 'Add customer'}
          </Button>
        </>
      }
    >
      <form id="add-customer" onSubmit={save} className="space-y-4">
        <Alert>{error}</Alert>
        {existing && (
          <div className="-mt-2 flex items-center justify-between gap-3 rounded-sm border border-line bg-surface-2 px-3 py-2.5 text-[13.5px]">
            <span>
              <strong className="text-ink">{existing.fullName}</strong>
              <span className="tnum text-ink-muted"> · {existing.phone}</span>
            </span>
            <Button type="button" size="sm" onClick={() => onFound(existing)}>Use this customer</Button>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name">
            <Input value={form.fullName} onChange={set('fullName')} placeholder="Ssebunya Moses" autoFocus={!start.phone} />
          </Field>
          <Field label="Phone" hint="How they are found next time.">
            <Input
              value={form.phone}
              onChange={set('phone')}
              placeholder="0772 123 456"
              inputMode="tel"
              className="tnum"
              autoFocus={!!start.phone}
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Where they are (optional)" hint="For deliveries.">
            <Input value={form.address} onChange={set('address')} placeholder="Kireka, near the market" />
          </Field>
          <Field label="Email (optional)">
            <Input type="email" value={form.email} onChange={set('email')} />
          </Field>
        </div>

        <Field label="Notes (optional)" hint="Anything worth knowing next time they come in.">
          <Textarea rows={2} value={form.notes} onChange={set('notes')} placeholder="Builds rentals, buys cement every month" />
        </Field>

        <Checkbox
          checked={form.welcome}
          onChange={(e) => setForm((f) => ({ ...f, welcome: e.target.checked }))}
          label="Text them a welcome — it tells them they can order on the app with this number"
        />
      </form>
    </Modal>
  );
}
