'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, peek } from '@/lib/api';
import { money, list, dateTime, statusLabel } from '@/lib/format';
import { cn } from '@/lib/cn';
import {
  Alert, Button, Card, Checkbox, Chip, Empty, Field, Input, Loading, Modal, PageHead,
  Segmented, Stat, Stats, StatusChip, Table, TableWrap, Td, Textarea, Th, Tr, LoadFailed } from '@/components/ui';
import { Icon } from '@/components/icons';
import ReceivePayment from '@/components/ReceivePayment';

const ACCOUNT_LABEL = (c) => {
  if (c.accountType === 'company_owner') return 'Company owner';
  if (c.accountType === 'company_staff') {
    return `Company staff${c.staffRole ? ` · ${c.staffRole}` : ''}`;
  }
  return 'Individual';
};

const HOW = [
  { value: 'pickup', label: 'They take it now' },
  { value: 'delivery', label: 'We deliver' },
];

/**
 * Who buys here, and how much of it.
 *
 * The cashier and the manager see the same list. Adding somebody who
 * has walked in works like the till: their name and number, then what
 * they are buying, then the money. Tapping a customer shows everything
 * they have ever bought, and starts a new sale for them.
 */
export default function Customers({ canAdd = false, from = '/api/customers' }) {
  const [customers, setCustomers] = useState(() => {
    const r = peek(from);
    return r ? list(r.customers) : null;
  });
  const [q, setQ] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [adding, setAdding] = useState(false);  // false | { phone?, customer? }
  const [viewing, setViewing] = useState(null); // a customer row
  const [paying, setPaying] = useState(null);   // { order, customer }
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

  function afterSale(customer, text) {
    setQ('');
    setFresh(customer.id);
    setNotice(text);
    load();
  }

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
                    <Tr
                      key={c.id}
                      onClick={() => setViewing(c)}
                      className={cn('cursor-pointer', fresh === c.id && 'bg-brand-soft/60')}
                    >
                      <Td>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setViewing(c); }}
                          className="text-left font-semibold text-ink hover:text-brand hover:underline"
                        >
                          {c.fullName}
                        </button>
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
        <CounterSale
          start={adding}
          onClose={() => setAdding(false)}
          onAdded={(c, smsSent, existed) => {
            setAdding(false);
            afterSale(
              c,
              existed
                ? `${c.fullName} is already a customer. They are shown below.`
                : `${c.fullName} added.${smsSent === true ? ' They have been texted a welcome.' : smsSent === false ? ' The welcome text did not send.' : ''}`
            );
          }}
          onSold={(order, c) => {
            setAdding(false);
            setPaying({ order, customer: c });
          }}
        />
      )}

      {viewing && (
        <CustomerHistory
          customer={viewing}
          canSell={canAdd}
          onClose={() => setViewing(null)}
          onSell={(c) => { setViewing(null); setAdding({ customer: c }); }}
        />
      )}

      {paying && (
        <ReceivePayment
          order={paying.order}
          onClose={() => {
            // Closed without paying: the sale is kept and waits in the
            // payment queue, never silently thrown away.
            afterSale(paying.customer, `Sale ${paying.order.order_no} for ${paying.customer.fullName} is saved. It is waiting in the payment queue.`);
            setPaying(null);
          }}
          onDone={(receiptNo) => {
            afterSale(paying.customer, `${paying.customer.fullName} paid. Receipt ${receiptNo} is issued for ${paying.order.order_no}.`);
            setPaying(null);
          }}
        />
      )}
    </>
  );
}

/**
 * Somebody at the counter, and what they are buying.
 *
 * Works like the till. For a new customer: name and number first, then
 * tap the items they are taking, then the money. Leave the basket empty
 * to only put them on the list. Opened for a customer already on the
 * list, it is just the basket.
 *
 * The number is the customer, so a number already on the list brings
 * that customer up instead of making a second one, and the sale goes
 * to them.
 */
function CounterSale({ start, onClose, onAdded, onSold }) {
  const known = start.customer || null;
  const [form, setForm] = useState({
    fullName: '',
    phone: start.phone || '',
    email: '',
    address: '',
    notes: '',
    welcome: true,
  });
  const [products, setProducts] = useState(() => {
    const r = peek('/api/products');
    return r ? list(r.products) : null;
  });
  const [loadError, setLoadError] = useState('');
  const [q, setQ] = useState('');
  const [basket, setBasket] = useState([]); // [{ product, qty }]
  const [how, setHow] = useState('pickup');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [existing, setExisting] = useState(null);
  const [more, setMore] = useState(false);
  const search = useRef(null);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  useEffect(() => {
    api('/api/products')
      .then((r) => { setProducts(list(r.products)); setLoadError(''); })
      .catch((e) => setLoadError(e.message));
  }, []);

  useEffect(() => { if (known) search.current?.focus(); }, [known]);

  const shown = useMemo(() => {
    const all = (products || []).filter((p) => p.status !== 'retired');
    const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const hits = words.length
      ? all.filter((p) => words.every((w) => `${p.name} ${p.code} ${p.category_name || ''}`.toLowerCase().includes(w)))
      : all;
    return hits.slice(0, 40);
  }, [products, q]);

  const total = basket.reduce((s, l) => s + l.qty * Number(l.product.price || 0), 0);
  const count = basket.reduce((s, l) => s + l.qty, 0);
  const line = (id) => basket.find((l) => l.product.id === id);

  function add(p) {
    setError('');
    setBasket((b) => {
      const l = b.find((x) => x.product.id === p.id);
      if (!l) return [...b, { product: p, qty: 1 }];
      if (l.qty >= Number(p.stock_available)) return b;
      return b.map((x) => (x.product.id === p.id ? { ...x, qty: x.qty + 1 } : x));
    });
  }

  function setQty(id, value) {
    setBasket((b) =>
      b
        .map((l) => {
          if (l.product.id !== id) return l;
          const n = Math.max(0, Math.min(Number(l.product.stock_available) || 0, Math.floor(Number(value) || 0)));
          return { ...l, qty: n };
        })
        .filter((l) => l.qty > 0)
    );
  }

  const detailsOk = known || (form.fullName.trim().length >= 2 && form.phone.replace(/\D/g, '').length >= 9);
  const addressOk = how !== 'delivery' || (known ? true : form.address.trim().length > 0);
  const ready = !busy && detailsOk && addressOk && (known ? basket.length > 0 : true);

  // The basket becomes an ordinary counter sale for this customer.
  async function sell(customer) {
    const r = await api('/api/cashier/orders', {
      method: 'POST',
      body: {
        customerId: customer.id,
        items: basket.map((l) => ({ productId: l.product.id, quantity: l.qty })),
        fulfilment: how,
        address: how === 'delivery' ? (form.address.trim() || customer.address || '') : '',
      },
    });
    onSold(r.order, customer);
  }

  async function save(e) {
    e?.preventDefault();
    if (!ready) return;
    setBusy(true);
    setError('');
    setExisting(null);
    try {
      if (known) {
        await sell(known);
        return;
      }
      // Raw, because a 409 here carries the customer who already has
      // the number — the plain helper would keep only the message.
      const res = await api('/api/customers', { method: 'POST', body: form, raw: true });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        if (basket.length) await sell(data.customer);
        else onAdded(data.customer, data.smsSent, false);
        return;
      }
      if (data.data && data.data.customer) setExisting(data.data.customer);
      setError(data.error || data.message || `Could not add them (${res.status})`);
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  }

  async function useExisting() {
    if (!basket.length) { onAdded(existing, null, true); return; }
    setBusy(true);
    setError('');
    try {
      await sell(existing);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  const label = busy
    ? 'Saving…'
    : basket.length
      ? `${known ? 'Take payment' : 'Add and take payment'} · ${money(total)}`
      : known ? 'Add items to sell' : 'Add customer';

  return (
    <Modal
      wide
      title={known ? `New sale for ${known.fullName}` : 'Add a customer'}
      description={
        known
          ? 'Tap what they are taking, then take the money.'
          : 'For someone who has come to the shop. Their name and number, then what they are buying. Leave the basket empty to only add them.'
      }
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="counter-sale" disabled={!ready}>{label}</Button>
        </>
      }
    >
      <form id="counter-sale" onSubmit={save} className="space-y-5">
        <Alert>{error}</Alert>
        {existing && (
          <div className="-mt-2 flex flex-wrap items-center justify-between gap-3 rounded-sm border border-line bg-surface-2 px-3 py-2.5 text-[13.5px]">
            <span>
              <strong className="text-ink">{existing.fullName}</strong>
              <span className="tnum text-ink-muted"> · {existing.phone}</span>
            </span>
            <Button type="button" size="sm" disabled={busy} onClick={useExisting}>
              {basket.length ? `Sell to ${existing.fullName.split(' ')[0]}` : 'Use this customer'}
            </Button>
          </div>
        )}

        {known ? (
          <p className="flex flex-wrap items-center gap-x-2 rounded-sm border border-line bg-surface-2 px-3 py-2.5 text-[13.5px]">
            <strong className="text-ink">{known.fullName}</strong>
            {known.phone && <span className="tnum text-ink-muted">{known.phone}</span>}
          </p>
        ) : (
          <section className="space-y-4">
            <h3 className="text-[12px] font-bold uppercase tracking-[.08em] text-ink-muted">The customer</h3>
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
              {(more || how === 'delivery') && (
                <Field label={how === 'delivery' ? 'Deliver to' : 'Where they are (optional)'} hint={how === 'delivery' ? null : 'For deliveries.'}>
                  <Input value={form.address} onChange={set('address')} placeholder="Kireka, near the market" />
                </Field>
              )}
              {more && (
                <Field label="Email (optional)">
                  <Input type="email" value={form.email} onChange={set('email')} />
                </Field>
              )}
            </div>
            {more ? (
              <Field label="Notes (optional)" hint="Anything worth knowing next time they come in.">
                <Textarea rows={2} value={form.notes} onChange={set('notes')} placeholder="Builds rentals, buys cement every month" />
              </Field>
            ) : (
              <button type="button" onClick={() => setMore(true)} className="block text-[13px] font-semibold text-brand hover:underline">
                Add where they are, email or notes
              </button>
            )}
            <Checkbox
              checked={form.welcome}
              onChange={(e) => setForm((f) => ({ ...f, welcome: e.target.checked }))}
              label="Text them a welcome. It tells them they can order on the app with this number"
            />
          </section>
        )}

        <section className="space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-[12px] font-bold uppercase tracking-[.08em] text-ink-muted">What they are buying</h3>
            <span className="tnum text-[12.5px] text-ink-muted">{count} {count === 1 ? 'item' : 'items'}</span>
          </div>

          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            {/* The shelf */}
            <div className="min-w-0 rounded-sm border border-line">
              <div className="border-b border-line p-2.5">
                <Input
                  ref={search}
                  type="search"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  onKeyDown={(e) => {
                    // Enter adds the only match, so a code typed in goes straight in.
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (shown.length === 1) { add(shown[0]); setQ(''); }
                    }
                  }}
                  placeholder="Find an item by name or code"
                  aria-label="Find an item"
                />
              </div>
              {!products ? (
                loadError ? <p className="p-4 text-[13px] text-bad">{loadError}</p> : <p className="p-4 text-[13px] text-ink-muted">Loading the shelf…</p>
              ) : shown.length === 0 ? (
                <p className="p-4 text-[13px] text-ink-muted">Nothing matches. Try fewer letters, or the item&rsquo;s code.</p>
              ) : (
                <ul className="max-h-[300px] divide-y divide-line overflow-y-auto">
                  {shown.map((p) => {
                    const l = line(p.id);
                    const out = Number(p.stock_available) <= 0;
                    const full = l && l.qty >= Number(p.stock_available);
                    return (
                      <li key={p.id}>
                        <button
                          type="button"
                          disabled={out || full}
                          onClick={() => add(p)}
                          className={cn(
                            'flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors duration-100',
                            'hover:bg-surface-2 active:bg-brand-soft disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent',
                            l && 'bg-brand-soft/50'
                          )}
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13.5px] font-medium text-ink">{p.name}</span>
                            <span className="block text-xs text-ink-muted">
                              {out ? <span className="font-semibold text-bad">out of stock</span> : <span className="tnum">{p.stock_available} {p.unit} left</span>}
                            </span>
                          </span>
                          <span className="tnum shrink-0 text-[13px] font-semibold text-ink">{money(p.price)}</span>
                          <span
                            className={cn(
                              'tnum grid h-6 min-w-6 shrink-0 place-items-center rounded-full px-1.5 text-xs font-bold',
                              l ? 'bg-fill text-white' : 'border border-line text-ink-muted'
                            )}
                            aria-label={l ? `${l.qty} in the sale` : 'Add'}
                          >
                            {l ? l.qty : '+'}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {/* The basket */}
            <div className="flex min-w-0 flex-col rounded-sm border border-line">
              {basket.length === 0 ? (
                <p className="flex flex-1 items-center justify-center p-6 text-center text-[13px] text-ink-muted">
                  Tap an item to add it. Tap again for one more.
                </p>
              ) : (
                <ul className="max-h-[300px] flex-1 divide-y divide-line overflow-y-auto">
                  {basket.map((l) => (
                    <li key={l.product.id} className="flex items-center gap-2 px-3 py-2">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-medium text-ink">{l.product.name}</span>
                        <span className="tnum block text-xs text-ink-muted">{money(l.product.price)} each</span>
                      </span>
                      <span className="flex items-center rounded-md border border-line">
                        <button type="button" aria-label="One fewer" onClick={() => setQty(l.product.id, l.qty - 1)} className="grid size-7 place-items-center text-ink-muted hover:text-ink active:scale-95">−</button>
                        <input
                          value={l.qty}
                          onChange={(e) => setQty(l.product.id, e.target.value)}
                          inputMode="numeric"
                          aria-label={`How many ${l.product.name}`}
                          className="tnum w-9 bg-transparent text-center text-[13.5px] font-semibold text-ink outline-none"
                        />
                        <button
                          type="button"
                          aria-label="One more"
                          disabled={l.qty >= Number(l.product.stock_available)}
                          onClick={() => setQty(l.product.id, l.qty + 1)}
                          className="grid size-7 place-items-center text-ink-muted hover:text-ink active:scale-95 disabled:opacity-30"
                        >
                          +
                        </button>
                      </span>
                      <span className="tnum w-[84px] shrink-0 text-right text-[13px] font-semibold text-ink">
                        {money(l.qty * Number(l.product.price || 0))}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex items-baseline justify-between border-t border-line px-3 py-2.5">
                <span className="text-[13px] font-semibold text-ink-muted">Total</span>
                <span className="tnum text-[20px] font-extrabold text-ink">{money(total)}</span>
              </div>
            </div>
          </div>

          {basket.length > 0 && (
            <Segmented label="How they get it" value={how} onChange={setHow} options={HOW} />
          )}
        </section>
      </form>
    </Modal>
  );
}

/**
 * Everything one customer has bought: each sale with its items, what
 * they buy most, and anything still not paid for.
 */
function CustomerHistory({ customer, canSell, onClose, onSell }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(null); // order id expanded on a phone

  const load = useCallback(() => {
    setError('');
    api(`/api/customers/${customer.id}`)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [customer.id]);

  useEffect(load, [load]);

  const c = data ? data.customer : customer;
  const orders = data ? list(data.orders) : [];

  return (
    <Modal
      wide
      title={c.fullName}
      description={[c.phone, ACCOUNT_LABEL(c), c.source === 'counter' ? 'Walk-in' : null].filter(Boolean).join(' · ')}
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose}>Close</Button>
          {canSell && <Button type="button" onClick={() => onSell(c)}>New sale for them</Button>}
        </>
      }
    >
      {!data ? (
        error ? <LoadFailed onRetry={load}>{error}</LoadFailed> : <Loading>Loading what they have bought…</Loading>
      ) : (
        <div className="space-y-5">
          {(c.address || c.notes) && (
            <div className="space-y-1 rounded-sm border border-line bg-surface-2 px-3 py-2.5 text-[13.5px]">
              {c.address && <p><span className="text-ink-muted">Lives at </span><span className="text-ink">{c.address}</span></p>}
              {c.notes && <p className="text-ink">{c.notes}</p>}
            </div>
          )}

          <div className="grid grid-cols-3 gap-2">
            <Figure label="Paid for" value={money(data.spent)} />
            <Figure label="Not paid yet" value={money(data.unpaid)} warn={data.unpaid > 0} />
            <Figure label="Sales" value={orders.length} />
          </div>

          {list(data.topItems).length > 0 && (
            <section>
              <h3 className="mb-2 text-[12px] font-bold uppercase tracking-[.08em] text-ink-muted">What they buy most</h3>
              <ul className="flex flex-wrap gap-2">
                {data.topItems.map((t) => (
                  <li key={t.name} className="rounded-full border border-line px-3 py-1 text-[12.5px] text-ink">
                    {t.name} <span className="tnum text-ink-muted">· {t.quantity} {t.unit}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section>
            <h3 className="mb-2 text-[12px] font-bold uppercase tracking-[.08em] text-ink-muted">Every sale</h3>
            {orders.length === 0 ? (
              <p className="rounded-sm border border-dashed border-line px-4 py-8 text-center text-[13.5px] text-ink-muted">
                Nothing bought yet.{canSell ? ' Use New sale for them to ring up what they are taking.' : ''}
              </p>
            ) : (
              <ul className="divide-y divide-line rounded-sm border border-line">
                {orders.map((o) => {
                  const shut = open !== o.id && list(o.items).length > 3;
                  return (
                    <li key={o.id} className="px-3 py-3">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className="tnum text-[13.5px] font-bold text-ink">{o.order_no}</span>
                        <StatusChip status={o.status}>{statusLabel(o.status)}</StatusChip>
                        <span className="text-xs text-ink-muted">
                          {dateTime(o.created_at)} · {o.source === 'counter' ? 'At the counter' : 'On the app'}
                        </span>
                        <span className="tnum ml-auto text-[14px] font-bold text-ink">{money(o.total)}</span>
                      </div>
                      <ul className="mt-1.5 space-y-0.5">
                        {(shut ? list(o.items).slice(0, 3) : list(o.items)).map((it) => (
                          <li key={it.id} className="flex gap-2 text-[13px]">
                            <span className="tnum w-14 shrink-0 text-ink-muted">{it.quantity} {it.unit}</span>
                            <span className="min-w-0 flex-1 truncate text-ink">{it.product_name}</span>
                            <span className="tnum shrink-0 text-ink-muted">{money(it.line_total)}</span>
                          </li>
                        ))}
                      </ul>
                      {shut && (
                        <button type="button" onClick={() => setOpen(o.id)} className="mt-1 text-[12.5px] font-semibold text-brand hover:underline">
                          {list(o.items).length - 3} more
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      )}
    </Modal>
  );
}

function Figure({ label, value, warn }) {
  return (
    <div className="min-w-0 rounded-sm border border-line px-3 py-2.5">
      <p className="truncate text-[12px] font-semibold text-ink-muted">{label}</p>
      <p className={cn('tnum truncate text-[16px] font-extrabold', warn ? 'text-warn' : 'text-ink')}>{value}</p>
    </div>
  );
}
