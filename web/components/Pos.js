'use client';

import { useMemo, useState } from 'react';
import { money } from '@/lib/format';
import { cn } from '@/lib/cn';

/**
 * The till: the shelf as a grid of keys, and the ticket as it prints.
 *
 * Laid out like the POS machines in shops here: tap an item tile to ring
 * it up, tap again for one more; a code typed (or scanned) and Enter
 * rings it straight in; the selected line takes its quantity from the
 * number pad; the total sits on a dark display in big green figures; and
 * the payment keys start the payment the way it was taken.
 *
 * It holds no sale of its own. The screen using it keeps the basket and
 * says what happens on Pay, so the counter sale and "add a customer"
 * share one till without sharing their rules.
 */

const short = (s) => (s || '').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
const qtyText = (n) => (Math.round(n * 100) / 100).toString();

// ── The shelf ───────────────────────────────────────────────────────

export function PosShelf({ products, basket, onAdd, searchRef, loading, error, onRetry, dense }) {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [inStock, setInStock] = useState(false);

  const live = useMemo(() => (products || []).filter((p) => p.status !== 'retired'), [products]);
  const cats = useMemo(() => {
    const m = new Map();
    for (const p of live) {
      const c = p.category_name || 'Other';
      m.set(c, (m.get(c) || 0) + 1);
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [live]);

  const shown = useMemo(() => {
    const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return live.filter((p) => {
      if (cat && (p.category_name || 'Other') !== cat) return false;
      if (inStock && Number(p.stock_available) <= 0) return false;
      if (!words.length) return true;
      const hay = `${p.name} ${p.code} ${p.category_name || ''}`.toLowerCase();
      return words.every((w) => hay.includes(w));
    });
  }, [live, q, cat, inStock]);

  const qtyOf = (id) => basket.find((l) => l.product.id === id)?.qty || 0;

  // A code typed or scanned, then Enter: the exact code, or the only match.
  function enter(e) {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const t = q.trim().toLowerCase();
    const hit = live.find((p) => String(p.code || '').toLowerCase() === t) || (shown.length === 1 ? shown[0] : null);
    if (hit && Number(hit.stock_available) > qtyOf(hit.id)) {
      onAdd(hit);
      setQ('');
    }
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border border-line bg-surface">
      {/* Search, like the scanner field on a till. */}
      <div className="flex items-center gap-2 border-b border-line bg-surface-2 p-2.5">
        <div className="relative min-w-0 flex-1">
          <svg viewBox="0 0 20 20" aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted"><circle cx="9" cy="9" r="6" fill="none" stroke="currentColor" strokeWidth="1.8" /><path d="M14 14l4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
          <input
            ref={searchRef}
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={enter}
            placeholder="Type or scan a code, then Enter · or search a name"
            aria-label="Find an item"
            className="h-10 w-full rounded-lg border border-line bg-surface pl-9 pr-3 text-[13px] text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
          />
        </div>
        <button
          type="button"
          onClick={() => setInStock((v) => !v)}
          className={cn('h-10 shrink-0 rounded-lg border px-3 text-[12px] font-semibold', inStock ? 'border-brand bg-brand-soft text-brand-dark' : 'border-line bg-surface text-ink-muted')}
        >
          In stock
        </button>
      </div>

      {/* Category keys. */}
      <div className="flex gap-1.5 overflow-x-auto border-b border-line px-2.5 py-2 [scrollbar-width:thin]">
        {[['', live.length], ...cats].map(([c, n]) => (
          <button
            key={c || 'all'}
            type="button"
            onClick={() => setCat(c)}
            className={cn(
              'shrink-0 rounded-md px-3 py-1.5 text-[12px] font-semibold transition-colors',
              cat === c ? 'bg-[#0E201A] text-[#92D050]' : 'bg-surface-sunk text-ink-2 hover:bg-line'
            )}
          >
            {c || 'All'} <span className="tnum opacity-60">{n}</span>
          </button>
        ))}
      </div>

      {/* The keys. */}
      <div className="min-h-0 flex-1 overflow-y-auto bg-surface-2 p-2.5">
        {loading ? (
          <p className="p-6 text-center text-[12.5px] text-ink-muted">Loading the shelf…</p>
        ) : error ? (
          <div className="p-6 text-center text-[12.5px] text-bad">{error} {onRetry && <button type="button" onClick={onRetry} className="ml-1 font-semibold underline">Try again</button>}</div>
        ) : !shown.length ? (
          <p className="p-6 text-center text-[12.5px] text-ink-muted">Nothing matches. Try fewer letters, or the code.</p>
        ) : (
          <div className={cn('grid gap-2', dense ? 'grid-cols-[repeat(auto-fill,minmax(128px,1fr))]' : 'grid-cols-[repeat(auto-fill,minmax(148px,1fr))]')}>
            {shown.map((p) => {
              const n = qtyOf(p.id);
              const stock = Number(p.stock_available) || 0;
              const out = stock <= 0;
              const full = n >= stock;
              const noPrice = !(Number(p.price) > 0);
              return (
                <button
                  key={p.id}
                  type="button"
                  disabled={out || full}
                  onClick={() => onAdd(p)}
                  className={cn(
                    'group relative flex min-h-[112px] flex-col overflow-hidden rounded-lg border bg-surface p-2.5 text-left',
                    'transition-[transform,border-color,box-shadow] duration-100 ease-out active:scale-[0.97]',
                    n ? 'border-brand shadow-[0_0_0_2px_rgba(146,208,80,.45)]' : 'border-line hover:border-line-firm',
                    (out || full) && 'cursor-not-allowed opacity-55 active:scale-100'
                  )}
                >
                  <div className="flex items-start gap-2">
                    {p.picture_small || p.picture ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.picture_small || p.picture} alt="" loading="lazy" className="size-9 shrink-0 rounded-md border border-line object-cover" />
                    ) : (
                      <span className="grid size-9 shrink-0 place-items-center rounded-md bg-[#0E201A] text-[11px] font-extrabold text-[#92D050]">{short(p.name)}</span>
                    )}
                    <span className="tnum mt-0.5 truncate text-[10.5px] font-semibold text-ink-muted">{p.code}</span>
                  </div>
                  <span className="mt-1.5 line-clamp-2 text-[12.5px] font-semibold leading-snug text-ink">{p.name}</span>
                  <span className="mt-auto flex flex-wrap items-end justify-between gap-x-1 gap-y-0.5 pt-1.5">
                    <span className={cn('tnum text-[13.5px] font-extrabold', noPrice ? 'text-warn' : 'text-ink')}>{noPrice ? 'No price' : money(p.price)}</span>
                    <span className={cn('tnum shrink-0 rounded px-1.5 py-0.5 text-[10.5px] font-bold', out ? 'bg-bad-bg text-bad' : stock < 10 ? 'bg-warn-bg text-warn' : 'bg-ok-bg text-ok')}>
                      {out ? 'OUT' : `${qtyText(stock - n)} ${p.unit || ''}`}
                    </span>
                  </span>
                  {n > 0 && (
                    <span className="tnum absolute right-1.5 top-1.5 grid h-6 min-w-6 place-items-center rounded-full bg-[#92D050] px-1.5 text-[12px] font-extrabold text-[#102108] shadow">
                      {qtyText(n)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── The ticket ──────────────────────────────────────────────────────

/**
 * props: basket, onQty(id, n), title, sub, children (above the lines:
 * who it is for), payKeys ([{ key, label, onClick }]) or footer, keypad.
 */
export function PosTicket({ basket, onQty, onClear, title = 'Sale', sub, top, payKeys, footer, keypad = true, busy, problem }) {
  const [sel, setSel] = useState(null);
  const [typed, setTyped] = useState('');
  // The pad opens on the line tapped, and closes once the qty is set,
  // so the ticket keeps its room for lines.
  const [pad, setPad] = useState(false);
  const total = basket.reduce((s, l) => s + l.qty * Number(l.product.price || 0), 0);
  const count = basket.reduce((s, l) => s + l.qty, 0);
  const selected = basket.find((l) => l.product.id === sel) || basket[basket.length - 1] || null;
  const now = new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

  // The pad builds a number; Qty puts it on the selected line.
  function press(k) {
    if (!selected) return;
    if (k === 'C') { setTyped(''); return; }
    if (k === '⌫') { setTyped((t) => t.slice(0, -1)); return; }
    if (k === 'QTY') {
      if (typed) onQty(selected.product.id, Number(typed));
      setTyped('');
      setPad(false);
      return;
    }
    if (k === '.' && typed.includes('.')) return;
    setTyped((t) => (t + k).slice(0, 7));
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border border-line bg-surface">
      {/* The display. */}
      <div className="bg-[#0E201A] px-4 pb-3 pt-3 text-white">
        <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[.08em] text-white/55">
          <span>{title}</span>
          <span className="tnum normal-case tracking-normal">{now}</span>
        </div>
        <div className="mt-1.5 flex items-end justify-between gap-3">
          <span className="text-[12px] text-white/60">{count ? `${qtyText(count)} ${count === 1 ? 'item' : 'items'} · ${basket.length} ${basket.length === 1 ? 'line' : 'lines'}` : 'Ready'}</span>
          <span className="tnum font-mono text-[30px] font-bold leading-none tracking-tight text-[#92D050] [text-shadow:0_0_14px_rgba(146,208,80,.35)]">
            {money(total).replace('UGX ', '')}
          </span>
        </div>
        <div className="mt-0.5 text-right text-[10.5px] font-semibold tracking-[.12em] text-white/45">TOTAL · UGX</div>
        {sub && <div className="mt-2 border-t border-white/10 pt-2 text-[12px] text-white/75">{sub}</div>}
      </div>

      {top}

      {/* The lines, as they print. */}
      <div className="min-h-[120px] flex-1 overflow-y-auto bg-[repeating-linear-gradient(0deg,transparent,transparent_31px,rgba(15,27,51,.03)_31px,rgba(15,27,51,.03)_32px)]">
        {!basket.length ? (
          <div className="grid h-full min-h-[140px] place-items-center p-6 text-center">
            <div>
              <div className="mx-auto mb-2 grid size-11 place-items-center rounded-full bg-surface-sunk text-ink-muted">
                <svg viewBox="0 0 20 20" className="size-5" aria-hidden="true"><path d="M4 3h12v14l-2-1.5L12 17l-2-1.5L8 17l-2-1.5L4 17z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /><path d="M7 7h6M7 10h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
              </div>
              <p className="text-[12.5px] text-ink-muted">Tap an item to ring it up.<br />Tap again for one more.</p>
            </div>
          </div>
        ) : (
          <ul className="divide-y divide-dashed divide-line-firm/60">
            {basket.map((l, i) => {
              const on = selected && selected.product.id === l.product.id;
              return (
                <li key={l.product.id}>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => { setSel(l.product.id); setTyped(''); setPad(true); }}
                    onKeyDown={(e) => e.key === 'Enter' && setSel(l.product.id)}
                    className={cn('flex cursor-pointer items-center gap-2 px-3 py-2', on ? 'bg-brand-soft' : 'hover:bg-surface-2')}
                  >
                    <span className="tnum w-5 shrink-0 text-[11px] font-semibold text-ink-faint">{i + 1}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12.5px] font-semibold text-ink">{l.product.name}</span>
                      <span className="tnum block font-mono text-[11.5px] text-ink-muted">{qtyText(l.qty)} {l.product.unit || ''} × {money(l.product.price).replace('UGX ', '')}</span>
                    </span>
                    <span className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                      <button type="button" aria-label="One fewer" onClick={() => onQty(l.product.id, l.qty - 1)} className="grid size-7 place-items-center rounded-md border border-line bg-surface text-[15px] font-bold text-ink-2 active:scale-90">−</button>
                      <button
                        type="button"
                        aria-label="One more"
                        disabled={l.qty >= Number(l.product.stock_available)}
                        onClick={() => onQty(l.product.id, l.qty + 1)}
                        className="grid size-7 place-items-center rounded-md border border-line bg-surface text-[15px] font-bold text-ink-2 active:scale-90 disabled:opacity-30"
                      >+</button>
                    </span>
                    <span className="tnum w-[86px] shrink-0 text-right font-mono text-[12.5px] font-bold text-ink">{money(l.qty * Number(l.product.price || 0)).replace('UGX ', '')}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Totals, like the bottom of a slip. */}
      <div className="border-t-2 border-dashed border-line-firm bg-surface px-4 py-2.5">
        <div className="flex justify-between text-[12px] text-ink-muted"><span>Items</span><span className="tnum font-mono">{qtyText(count)}</span></div>
        <div className="flex justify-between text-[12px] text-ink-muted"><span>Subtotal</span><span className="tnum font-mono">{money(total)}</span></div>
        <div className="mt-1 flex items-baseline justify-between">
          <span className="text-[13px] font-extrabold uppercase tracking-[.06em] text-ink">Total</span>
          <span className="tnum font-mono text-[20px] font-extrabold text-ink">{money(total)}</span>
        </div>
        {keypad && basket.length > 0 && !pad && (
          <p className="mt-1 text-center text-[11px] text-ink-muted">Tap a line to change its quantity on the number pad.</p>
        )}
      </div>

      {/* The number pad, for the selected line. */}
      {keypad && basket.length > 0 && pad && (
        <div className="border-t border-line bg-surface-2 p-2.5">
          <div className="mb-1.5 flex items-center justify-between gap-2 text-[11.5px]">
            <span className="truncate text-ink-muted">Qty for <b className="text-ink">{selected?.product.name}</b></span>
            <button type="button" onClick={() => setPad(false)} className="shrink-0 text-[11.5px] font-semibold text-ink-muted hover:text-ink">Close</button>
            <span className="tnum min-w-[64px] rounded-md bg-[#0E201A] px-2 py-0.5 text-right font-mono text-[14px] font-bold text-[#92D050]">{typed || qtyText(selected?.qty || 0)}</span>
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {['7', '8', '9', '⌫', '4', '5', '6', 'C', '1', '2', '3', 'QTY', '0', '.'].map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => press(k)}
                className={cn(
                  'h-10 rounded-lg border text-[15px] font-bold active:scale-95 transition-transform duration-75',
                  k === 'QTY' ? 'row-span-2 h-auto border-[#0E201A] bg-[#0E201A] text-[13px] text-[#92D050]'
                    : k === '0' ? 'col-span-2 border-line bg-surface text-ink'
                      : ['⌫', 'C'].includes(k) ? 'border-line bg-surface-sunk text-ink-2'
                        : 'border-line bg-surface text-ink'
                )}
              >
                {k === 'QTY' ? 'Set qty' : k}
              </button>
            ))}
          </div>
        </div>
      )}

      {problem && <p className="border-t border-line bg-bad-bg px-3 py-2 text-[12.5px] font-medium text-bad">{problem}</p>}

      {/* The payment keys. */}
      {payKeys && (
        <div className="border-t border-line p-2.5">
          <div className="grid grid-cols-2 gap-1.5">
            {payKeys.map((k) => (
              <button
                key={k.key}
                type="button"
                disabled={!basket.length || busy || k.disabled}
                onClick={k.onClick}
                className={cn(
                  'flex h-12 items-center justify-center gap-2 rounded-lg text-[13.5px] font-extrabold transition-transform duration-75 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40',
                  k.primary ? 'col-span-2 h-14 bg-[#92D050] text-[16px] text-[#102108] hover:brightness-105' : 'border border-line bg-surface text-ink hover:bg-surface-2'
                )}
              >
                {k.icon}{busy && k.primary ? 'Saving…' : k.label}
              </button>
            ))}
          </div>
          {onClear && basket.length > 0 && (
            <button type="button" onClick={onClear} className="mt-2 w-full text-center text-[12px] font-semibold text-ink-muted hover:text-bad">Void the sale</button>
          )}
        </div>
      )}
      {footer}
    </div>
  );
}
