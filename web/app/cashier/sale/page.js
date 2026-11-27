'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { api, peek } from '@/lib/api';
import { money, list } from '@/lib/format';
import { cn } from '@/lib/cn';
import { Button, Card } from '@/components/ui';
import ReceivePayment from '@/components/ReceivePayment';
import SaleBlocked from '@/components/SaleBlocked';
import { PosShelf, PosTicket } from '@/components/Pos';

/**
 * A sale at the counter, on the till.
 *
 * For somebody standing in front of the cashier: no app, no account
 * needed. Ring up the items, say who it is for if they want to, then
 * press how they pay. It becomes an ordinary order, so the receipt,
 * Accounts checking it and the store releasing the goods all happen
 * exactly as for an order from the app.
 */
const ICON = {
  cash: <svg viewBox="0 0 20 20" className="size-4" aria-hidden="true"><rect x="2" y="5" width="16" height="10" rx="2" fill="none" stroke="currentColor" strokeWidth="1.7" /><circle cx="10" cy="10" r="2.2" fill="none" stroke="currentColor" strokeWidth="1.7" /></svg>,
  momo: <svg viewBox="0 0 20 20" className="size-4" aria-hidden="true"><rect x="6" y="2" width="8" height="16" rx="2" fill="none" stroke="currentColor" strokeWidth="1.7" /><path d="M9 15h2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>,
  card: <svg viewBox="0 0 20 20" className="size-4" aria-hidden="true"><rect x="2" y="4" width="16" height="12" rx="2" fill="none" stroke="currentColor" strokeWidth="1.7" /><path d="M2 8h16" stroke="currentColor" strokeWidth="1.7" /></svg>,
  loan: <svg viewBox="0 0 20 20" className="size-4" aria-hidden="true"><path d="M3 7l7-4 7 4M4 8v7M8 8v7M12 8v7M16 8v7M2 17h16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>,
};

export default function CounterSale() {
  const [products, setProducts] = useState(() => {
    const r = peek('/api/products');
    return r ? list(r.products) : null;
  });
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [basket, setBasket] = useState([]); // [{ product, qty }]

  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [match, setMatch] = useState(null); // null | 'looking' | 'none' | customer
  const [how, setHow] = useState('pickup');
  const [address, setAddress] = useState('');

  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');
  const [blocked, setBlocked] = useState(null);
  const [paying, setPaying] = useState(null); // { order, method }
  const [done, setDone] = useState(null);
  const [lastMethod, setLastMethod] = useState('cash');
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

  function add(p) {
    setProblem('');
    setBasket((b) => {
      const line = b.find((l) => l.product.id === p.id);
      if (!line) return [...b, { product: p, qty: 1 }];
      if (line.qty >= Number(p.stock_available)) return b;
      return b.map((l) => (l.product.id === p.id ? { ...l, qty: l.qty + 1 } : l));
    });
  }

  function setQty(id, value) {
    setBasket((b) =>
      b
        .map((l) => {
          if (l.product.id !== id) return l;
          const n = Math.max(0, Math.min(Number(l.product.stock_available) || 0, Math.round((Number(value) || 0) * 100) / 100));
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
    setProblem('');
    setBlocked(null);
    search.current?.focus();
  }

  const known = match && typeof match === 'object' ? match : null;
  const isNew = match === 'none';
  const total = basket.reduce((s, l) => s + l.qty * Number(l.product.price || 0), 0);
  const ready =
    basket.length > 0 &&
    !busy &&
    match !== 'looking' &&
    (!isNew || name.trim().length >= 2) &&
    (how !== 'delivery' || address.trim().length > 0);

  async function ring(method, override) {
    if (!ready) return;
    setBusy(true);
    setProblem('');
    setBlocked(null);
    setLastMethod(method);
    try {
      const body = {
        items: basket.map((l) => ({ productId: l.product.id, quantity: l.qty })),
        fulfilment: how,
        address: how === 'delivery' ? address.trim() : '',
        ...(typeof override === 'string' ? { override } : {}),
      };
      if (known) body.customerId = known.id;
      else if (phone.trim()) { body.phone = phone.trim(); body.name = name.trim(); body.welcome = true; }
      const r = await api('/api/cashier/orders', { method: 'POST', body });
      setPaying({ order: r.order, method });
    } catch (e) {
      if (e.code === 'ah_sale_blocked') setBlocked(e);
      else setProblem(e.message);
    } finally {
      setBusy(false);
    }
  }

  // ── After the sale ─────────────────────────────────────────────────
  if (done) {
    return (
      <Card className="mx-auto mt-4 max-w-md overflow-hidden">
        <div className="bg-navy px-4 py-4 text-center text-white">
          <p className="text-[11px] font-bold uppercase tracking-[.12em] text-white/60">{done.waiting ? 'Saved · not paid' : 'Paid'}</p>
          <p className="tnum mt-1 font-mono text-[26px] font-bold text-lime">{done.orderNo}</p>
        </div>
        <div className="px-4 py-4 text-center">
          <p className="mx-auto max-w-sm text-[12.5px] leading-relaxed text-ink-2">
            {done.waiting
              ? 'The sale is saved in the payment queue. Take the money from there when they are ready.'
              : <>Receipt <strong className="tnum text-ink">{done.receiptNo}</strong>. The payment is with Accounts.</>}
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Button size="lg" onClick={() => { setDone(null); reset(); }}>Next sale</Button>
            <Link href={done.waiting ? '/cashier' : '/cashier/receipts'} className="inline-flex h-11 items-center rounded-sm border border-line px-4 text-[12.5px] font-semibold text-ink hover:bg-surface-2">
              {done.waiting ? 'Payment queue' : 'Receipts'}
            </Link>
          </div>
        </div>
      </Card>
    );
  }

  // Who it is for, compact, at the top of the ticket.
  const customer = (
    <div className="space-y-2 border-b border-line bg-surface-2 px-3 py-2.5">
      <div className="flex gap-2">
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Customer phone (optional)"
          inputMode="tel"
          className="tnum h-9 min-w-0 flex-1 rounded-md border border-line bg-surface px-2.5 text-[12px] outline-none focus:border-brand"
        />
        <div className="flex shrink-0 overflow-hidden rounded-md border border-line text-[11.5px] font-semibold">
          {[['pickup', 'Takes now'], ['delivery', 'Deliver']].map(([k, l]) => (
            <button key={k} type="button" onClick={() => setHow(k)} className={cn('px-2.5', how === k ? 'bg-navy text-lime' : 'bg-surface text-ink-2')}>{l}</button>
          ))}
        </div>
      </div>
      {match === 'looking' && <p className="text-[11.5px] text-ink-muted">Looking them up…</p>}
      {known && (
        <p className="flex items-center gap-1.5 rounded-md bg-ok-bg px-2.5 py-1.5 text-[11.5px] text-ok">
          <svg viewBox="0 0 16 16" aria-hidden="true" className="size-3.5 shrink-0"><path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          <b>{known.fullName}</b>{known.orderCount ? ` · ${known.orderCount} orders before` : ''}
        </p>
      )}
      {isNew && (
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="New customer: their name" autoFocus className="h-9 w-full rounded-md border border-warn/40 bg-surface px-2.5 text-[12px] outline-none focus:border-brand" />
      )}
      {how === 'delivery' && (
        <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Deliver to: Ntinda, behind the church" className="h-9 w-full rounded-md border border-line bg-surface px-2.5 text-[12px] outline-none focus:border-brand" />
      )}
    </div>
  );

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-[18px] font-extrabold text-ink">Till · New sale</h1>
          <p className="text-[12px] text-ink-muted">Tap items to ring them up. Type or scan a code and press Enter.</p>
        </div>
        <Link href="/cashier" className="text-[12px] font-semibold text-brand-dark hover:underline">Payment queue →</Link>
      </div>

      {blocked && (
        <div className="mb-3">
          <SaleBlocked error={blocked} busy={busy} onOverride={(why) => ring(lastMethod, why)} onCancel={() => setBlocked(null)} />
        </div>
      )}

      <div className="grid grid-cols-[minmax(0,1fr)] gap-3 lg:h-[calc(100vh-150px)] lg:grid-cols-[minmax(0,1fr)_400px]">
        <div className="h-[60vh] min-h-0 lg:h-auto">
          <PosShelf
            products={products}
            basket={basket}
            onAdd={add}
            searchRef={search}
            loading={!products && !error}
            error={!products ? error : ''}
            onRetry={() => setAttempt((n) => n + 1)}
          />
        </div>
        <PosTicket
          basket={basket}
          onQty={setQty}
          onClear={reset}
          title="Counter sale"
          sub={known ? `For ${known.fullName}` : isNew && name.trim() ? `New customer · ${name.trim()}` : 'Walk-in customer'}
          top={customer}
          busy={busy}
          problem={problem}
          payKeys={[
            { key: 'cash', primary: true, icon: ICON.cash, label: `Cash · ${money(total)}`, onClick: () => ring('cash'), disabled: !ready },
            { key: 'momo', icon: ICON.momo, label: 'Mobile Money', onClick: () => ring('mobile_money'), disabled: !ready },
            { key: 'card', icon: ICON.card, label: 'Card', onClick: () => ring('card'), disabled: !ready },
            { key: 'loan', icon: ICON.loan, label: known ? 'On loan' : 'On loan (needs customer)', onClick: () => ring('credit'), disabled: !ready || !known },
          ]}
        />
      </div>

      {paying && (
        <ReceivePayment
          order={paying.order}
          initialMethod={paying.method}
          onClose={() => {
            // Closed without paying: the sale is kept in the queue,
            // never silently thrown away, and never made twice.
            setDone({ orderNo: paying.order.order_no, waiting: true });
            setPaying(null);
          }}
          onDone={(receiptNo) => {
            setDone({ orderNo: paying.order.order_no, receiptNo });
            setPaying(null);
          }}
        />
      )}
    </>
  );
}
