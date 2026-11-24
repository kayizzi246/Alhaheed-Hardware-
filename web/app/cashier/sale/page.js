'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { api, peek } from '@/lib/api';
import { money, list } from '@/lib/format';
import { cn } from '@/lib/cn';
import {
  Alert, Button, Card, CardHead, CardTitle, Empty, Field, Input, LoadFailed, Loading,
  PageHead, Segmented,
} from '@/components/ui';
import ReceivePayment from '@/components/ReceivePayment';

const HOW = [
  { value: 'pickup', label: 'They take it now' },
  { value: 'delivery', label: 'We deliver' },
];

/**
 * A sale at the counter.
 *
 * For somebody standing in front of the cashier — no app, no account
 * needed. Find the items, set the quantities, say who it is for if they
 * want to, take the money. It becomes an ordinary order, so the
 * receipt, Accounts checking it and the store releasing the goods all
 * happen exactly as for an order from the app.
 *
 * Built for a queue: the search box is ready the moment the screen
 * opens, one tap adds an item and another tap adds one more, and the
 * total and the pay button stay in view on a phone however long the
 * basket gets.
 */
export default function CounterSale() {
  const [products, setProducts] = useState(() => {
    const r = peek('/api/products');
    return r ? list(r.products) : null;
  });
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [q, setQ] = useState('');
  const [basket, setBasket] = useState([]); // [{ product, qty }]

  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [match, setMatch] = useState(null); // null | 'looking' | 'none' | customer
  const [how, setHow] = useState('pickup');
  const [address, setAddress] = useState('');

  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');
  const [paying, setPaying] = useState(null); // the order, once made
  const [done, setDone] = useState(null);     // { orderNo, receiptNo } | { orderNo, waiting: true }
  const search = useRef(null);

  useEffect(() => {
    api('/api/products')
      .then((r) => { setProducts(list(r.products)); setError(''); })
      .catch((e) => setError(e.message));
  }, [attempt]);

  useEffect(() => { search.current?.focus(); }, []);

  // Who is it for? Looked up as the number is typed.
  useEffect(() => {
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 9) { setMatch(null); return undefined; }
    setMatch('looking');
    let live = true;
    const t = setTimeout(() => {
      api(`/api/customers?q=${encodeURIComponent(digits.slice(-9))}`)
        .then((r) => {
          if (!live) return;
          const found = list(r.customers).find((c) => (c.phone || '').replace(/\D/g, '').endsWith(digits.slice(-9)));
          setMatch(found || 'none');
        })
        .catch(() => live && setMatch('none'));
    }, 300);
    return () => { live = false; clearTimeout(t); };
  }, [phone]);

  const shown = useMemo(() => {
    const all = products || [];
    const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return all;
    return all.filter((p) => {
      const hay = `${p.name} ${p.code} ${p.category_name || ''}`.toLowerCase();
      return words.every((w) => hay.includes(w));
    });
  }, [products, q]);

  const inBasket = (id) => basket.find((l) => l.product.id === id);
  const total = basket.reduce((s, l) => s + l.qty * Number(l.product.price || 0), 0);
  const count = basket.reduce((s, l) => s + l.qty, 0);

  function add(p) {
    setProblem('');
    setBasket((b) => {
      const line = b.find((l) => l.product.id === p.id);
      if (!line) return [...b, { product: p, qty: 1 }];
      if (line.qty >= p.stock_available) return b;
      return b.map((l) => (l.product.id === p.id ? { ...l, qty: l.qty + 1 } : l));
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

  function reset() {
    setBasket([]);
    setPhone('');
    setName('');
    setMatch(null);
    setHow('pickup');
    setAddress('');
    setQ('');
    setProblem('');
    search.current?.focus();
  }

  const isNew = match === 'none';
  const ready =
    basket.length > 0 &&
    !busy &&
    match !== 'looking' &&
    (!isNew || name.trim().length >= 2) &&
    (how !== 'delivery' || address.trim().length > 0);

  async function takePayment() {
    if (!ready) return;
    setBusy(true);
    setProblem('');
    try {
      const body = {
        items: basket.map((l) => ({ productId: l.product.id, quantity: l.qty })),
        fulfilment: how,
        address: how === 'delivery' ? address.trim() : '',
      };
      if (match && typeof match === 'object') body.customerId = match.id;
      else if (phone.trim()) { body.phone = phone.trim(); body.name = name.trim(); body.welcome = true; }

      const r = await api('/api/cashier/orders', { method: 'POST', body });
      setPaying(r.order);
    } catch (e) {
      setProblem(e.message);
    } finally {
      setBusy(false);
    }
  }

  // ── After the sale ─────────────────────────────────────────────────
  if (done) {
    return (
      <>
        <PageHead title="New sale" />
        <Card className="mx-auto max-w-lg">
          <div className="px-6 py-10 text-center">
            <p className="text-[12px] font-bold uppercase tracking-[.08em] text-ink-muted">
              {done.waiting ? 'Saved' : 'Paid'}
            </p>
            <h2 className="tnum mt-2 text-[26px] font-extrabold text-ink">{done.orderNo}</h2>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-ink-muted">
              {done.waiting
                ? 'The sale is saved and waiting in the payment queue. Take the money from there when they are ready.'
                : <>Receipt <strong className="tnum text-ink">{done.receiptNo}</strong> is issued and the payment is with Accounts.</>}
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <Button size="lg" onClick={() => { setDone(null); reset(); }}>Next sale</Button>
              <Link
                href={done.waiting ? '/cashier' : '/cashier/receipts'}
                className="inline-flex h-11 items-center rounded-sm border border-line px-5 text-sm font-semibold text-ink hover:bg-surface-2"
              >
                {done.waiting ? 'Payment queue' : 'Receipts'}
              </Link>
            </div>
          </div>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHead title="New sale" sub="For somebody at the counter. No app or account needed." />

      {/* minmax(0,1fr) on a phone too: an unsized column grows to its widest
          row — a long name beside a price — and pushes past the screen. */}
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 pb-24 lg:grid-cols-[minmax(0,1fr)_380px] lg:pb-0">
        {/* ── The shelf ──────────────────────────────────────────────── */}
        <Card>
          <div className="border-b border-line p-4">
            <Input
              ref={search}
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Find an item by name or code"
              aria-label="Find an item"
            />
          </div>

          {!products ? (
            error ? <LoadFailed onRetry={() => setAttempt((n) => n + 1)}>{error}</LoadFailed> : <Loading>Loading the shelf…</Loading>
          ) : shown.length === 0 ? (
            <Empty title="Nothing matches">Try fewer letters, or the item&rsquo;s code.</Empty>
          ) : (
            <ul className="max-h-[calc(100vh-260px)] divide-y divide-line overflow-y-auto max-lg:max-h-none">
              {shown.map((p) => {
                const line = inBasket(p.id);
                const out = Number(p.stock_available) <= 0;
                const full = line && line.qty >= p.stock_available;
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      disabled={out || full}
                      onClick={() => add(p)}
                      className={cn(
                        'flex w-full items-center gap-3 px-4 py-3 text-left transition-colors duration-100',
                        'hover:bg-surface-2 active:bg-brand-soft disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent',
                        line && 'bg-brand-soft/50'
                      )}
                    >
                      {p.picture ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.picture} alt="" loading="lazy" className="size-10 shrink-0 rounded-md border border-line object-cover" />
                      ) : (
                        <span className="grid size-10 shrink-0 place-items-center rounded-md bg-surface-sunk text-xs font-bold text-ink-muted">
                          {p.name.slice(0, 2).toUpperCase()}
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-medium text-ink">{p.name}</span>
                        <span className="block text-xs text-ink-muted">
                          <span className="tnum">{p.code}</span> ·{' '}
                          {out ? <span className="font-semibold text-bad">out of stock</span> : <span className="tnum">{p.stock_available} {p.unit} left</span>}
                        </span>
                      </span>
                      <span className="text-right">
                        <span className="tnum block text-[14px] font-semibold text-ink">{money(p.price)}</span>
                        <span className="block text-xs text-ink-muted">per {p.unit}</span>
                      </span>
                      <span
                        className={cn(
                          'tnum grid h-7 min-w-7 shrink-0 place-items-center rounded-full px-2 text-xs font-bold',
                          line ? 'bg-fill text-white' : 'border border-line text-ink-muted'
                        )}
                        aria-label={line ? `${line.qty} in the sale` : 'Add'}
                      >
                        {line ? line.qty : '+'}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        {/* ── The sale ───────────────────────────────────────────────── */}
        <div className="space-y-4 lg:sticky lg:top-[76px]">
          <Card>
            <CardHead>
              <CardTitle>Who is it for?</CardTitle>
              <span className="text-[12.5px] text-ink-muted">optional</span>
            </CardHead>
            <div className="space-y-4 p-4 sm:p-6">
              <Field
                label="Their phone number"
                hint={
                  !phone.trim() ? 'Leave it blank for a walk-in who would rather not say.'
                    : match === 'looking' ? 'Looking them up…'
                      : null
                }
              >
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="0772 123 456"
                  inputMode="tel"
                  className="tnum"
                />
              </Field>
              {match && typeof match === 'object' && (
                <p className="flex items-center gap-2 rounded-sm border border-ok/25 bg-ok-bg px-3 py-2 text-[13.5px] text-ok">
                  <svg viewBox="0 0 16 16" aria-hidden="true" className="size-4 shrink-0"><path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  <span><strong>{match.fullName}</strong>{match.orderCount ? ` · ${match.orderCount} ${match.orderCount === 1 ? 'order' : 'orders'} before` : ' · on the list'}</span>
                </p>
              )}
              {isNew && (
                <Field label="New customer: their name" hint="They are added to the customer list and texted a welcome.">
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Kato Ibrahim" autoFocus />
                </Field>
              )}
              <Segmented label="How they get it" value={how} onChange={setHow} options={HOW} />
              {how === 'delivery' && (
                <Field label="Deliver to">
                  <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Ntinda, behind the church" />
                </Field>
              )}
            </div>
          </Card>

          <Card id="basket">
            <CardHead>
              <CardTitle>The sale</CardTitle>
              <span className="tnum text-[12.5px] text-ink-muted">{count} {count === 1 ? 'item' : 'items'}</span>
            </CardHead>
            {basket.length === 0 ? (
              <Empty title="Nothing in it yet">Tap an item to add it. Tap again for one more.</Empty>
            ) : (
              <ul className="divide-y divide-line">
                {basket.map((l) => (
                  <li key={l.product.id} className="flex items-center gap-3 px-4 py-3 sm:px-6">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-medium text-ink">{l.product.name}</span>
                      <span className="tnum block text-xs text-ink-muted">{money(l.product.price)} × {l.qty}</span>
                    </span>
                    <span className="flex items-center rounded-md border border-line">
                      <button type="button" aria-label="One fewer" onClick={() => setQty(l.product.id, l.qty - 1)} className="grid size-8 place-items-center text-ink-muted hover:text-ink active:scale-95">−</button>
                      <input
                        value={l.qty}
                        onChange={(e) => setQty(l.product.id, e.target.value)}
                        inputMode="numeric"
                        aria-label={`How many ${l.product.name}`}
                        className="tnum w-10 bg-transparent text-center text-[14px] font-semibold text-ink outline-none"
                      />
                      <button
                        type="button"
                        aria-label="One more"
                        disabled={l.qty >= l.product.stock_available}
                        onClick={() => setQty(l.product.id, l.qty + 1)}
                        className="grid size-8 place-items-center text-ink-muted hover:text-ink active:scale-95 disabled:opacity-30"
                      >
                        +
                      </button>
                    </span>
                    <span className="tnum w-[92px] shrink-0 text-right text-[13.5px] font-semibold text-ink">
                      {money(l.qty * Number(l.product.price || 0))}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <div className="border-t border-line p-6 max-lg:hidden">
              <Alert>{problem}</Alert>
              <div className="mb-3 flex items-baseline justify-between">
                <span className="text-sm font-semibold text-ink-muted">Total</span>
                <span className="tnum text-[26px] font-extrabold text-ink">{money(total)}</span>
              </div>
              <Button size="lg" block disabled={!ready} onClick={takePayment}>
                {busy ? 'Saving the sale…' : 'Take payment'}
              </Button>
              {basket.length > 0 && (
                <button type="button" onClick={reset} className="mt-2.5 w-full text-center text-[13px] font-medium text-ink-muted hover:text-bad">
                  Clear the sale
                </button>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* On a phone the total and the button never scroll away. */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 backdrop-blur lg:hidden">
        {problem && <p className="mb-2 text-[13px] font-medium text-bad">{problem}</p>}
        <div className="flex items-center gap-3">
          <a href="#basket" className="min-w-0 flex-1">
            <span className="block text-xs text-ink-muted">{count} {count === 1 ? 'item' : 'items'}</span>
            <span className="tnum block text-[20px] font-extrabold leading-tight text-ink">{money(total)}</span>
          </a>
          <Button size="lg" disabled={!ready} onClick={takePayment}>
            {busy ? 'Saving…' : 'Take payment'}
          </Button>
        </div>
      </div>

      {paying && (
        <ReceivePayment
          order={paying}
          onClose={() => {
            // Closed without paying: the sale is kept and waits in the
            // queue — it is never silently thrown away, and never made twice.
            setDone({ orderNo: paying.order_no, waiting: true });
            setPaying(null);
          }}
          onDone={(receiptNo) => {
            setDone({ orderNo: paying.order_no, receiptNo });
            setPaying(null);
          }}
        />
      )}
    </>
  );
}
