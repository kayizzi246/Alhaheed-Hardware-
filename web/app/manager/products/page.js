'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, upload } from '@/lib/api';
import { money, list, today } from '@/lib/format';
import { cn } from '@/lib/cn';
import { Icon } from '@/components/icons';
import Categories from '@/components/Categories';
import { MoneyField, MeasureField } from '@/components/Fields';
import { shrinkImage } from '@/lib/ocr';
import {
  Alert, Button, Card, Checkbox, Chip, Empty, Field, Input, Loading, Modal, PageHead, Segmented, Select,
  Stat, Table, TableWrap, Td, Textarea, Th, Tr, LoadFailed } from '@/components/ui';
import { confirmAction } from '@/components/Confirm';

/**
 * Products and their stock, as the manager keeps them.
 *
 * Every product has a sale price and a buy price, so the margin and the
 * value of what is on the shelf are always in view. The count is never
 * typed over: goods received, a stock count, breakage and corrections
 * each go in the stock book with who did it and why, and sales go in on
 * their own when the store releases an order.
 */

const STATE_TONE = { out: 'bad', low: 'pending', ok: 'good', untracked: 'grey' };

/** "24 Nov, 15:06" from the server's local "2026-11-24 15:06:41". */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const stamp = (s) => (s && s.length >= 16 ? `${+s.slice(8, 10)} ${MONTHS[+s.slice(5, 7) - 1]}, ${s.slice(11, 16)}` : '');
const signed = (n) => (n > 0 ? `+${n}` : String(n));
const int = (v) => (v === '' || v === null || v === undefined ? 0 : Math.round(Number(v)) || 0);

export default function ManagerProducts() {
  const [data, setData] = useState(null);
  const [tab, setTab] = useState('products');
  const [search, setSearch] = useState('');
  const [show, setShow] = useState('all');
  const [category, setCategory] = useState('');
  const [form, setForm] = useState(null); // a product, or {} for a new one
  const [moving, setMoving] = useState(null);
  const [history, setHistory] = useState(null);
  const [importing, setImporting] = useState(false);
  const [picked, setPicked] = useState(() => new Set());
  const [deleting, setDeleting] = useState(null); // the products about to go
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    try {
      const r = await api('/api/manager/products');
      // Fill in what an older plugin does not send yet.
      r.products = list(r.products).map((p) => ({
        tracked: true,
        cost: 0,
        margin: null,
        stock_value: 0,
        sold_30: 0,
        days_left: null,
        state: p.stock_available <= 0 ? 'out' : p.reorder_level > 0 && p.stock_available <= p.reorder_level ? 'low' : 'ok',
        ...p,
      }));
      r.products.forEach((p) => {
        p.status_label = p.status_label || { out: 'Out of stock', low: 'Low', ok: 'In stock', untracked: 'Not counted' }[p.state];
      });
      setData(r);
      setError('');
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function exportSheet() {
    try {
      const { exportProducts } = await import('@/lib/exports');
      setNotice(`${await exportProducts()} products exported.`);
    } catch (e) {
      setError(e.message);
    }
  }

  const done = (msg) => {
    setPicked(new Set());
    setDeleting(null);
    setNotice(msg);
    setForm(null);
    setMoving(null);
    load();
  };

  const products = list(data?.products);
  // An older plugin sends the products without the totals: work them out
  // here, so the page still opens before the new plugin is uploaded.
  const s = data && (data.summary || (() => {
    const on = products.filter((p) => p.active);
    const sum = (k) => on.reduce((n, p) => n + (Number(p[k]) || 0), 0);
    const low = (p) => p.stock_available > 0 && p.reorder_level > 0 && p.stock_available <= p.reorder_level;
    return {
      products: on.length,
      stockValue: sum('stock_value'),
      retailValue: on.reduce((n, p) => n + Math.max(0, p.stock_available || 0) * (p.price || 0), 0),
      profitInStock: 0,
      low: on.filter(low).length,
      out: on.filter((p) => p.stock_available <= 0).length,
      noCost: on.filter((p) => !p.cost).length,
    };
  })());

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (show === 'retired' ? p.active : !p.active) return false;
      if (show === 'low' && p.state !== 'low' && p.state !== 'out') return false;
      if (show === 'out' && p.state !== 'out') return false;
      if (show === 'nocost' && p.cost) return false;
      if (category && p.category_name !== category) return false;
      if (!q) return true;
      return `${p.name} ${p.code} ${p.category_name || ''} ${p.supplier || ''} ${p.shelf || ''}`.toLowerCase().includes(q);
    });
  }, [products, search, show, category]);

  // Ticks only count for what is on screen, so a filter never hides a
  // product that is about to be deleted.
  const pickedShown = shown.filter((p) => picked.has(p.id));
  const allPicked = shown.length > 0 && pickedShown.length === shown.length;
  const pick = (id) => setPicked((old) => {
    const next = new Set(old);
    if (!next.delete(id)) next.add(id);
    return next;
  });
  const pickAll = () => setPicked(allPicked ? new Set() : new Set(shown.map((p) => p.id)));

  const counts = {
    low: products.filter((p) => p.active && (p.state === 'low' || p.state === 'out')).length,
    out: products.filter((p) => p.active && p.state === 'out').length,
    retired: products.filter((p) => !p.active).length,
    nocost: products.filter((p) => p.active && !p.cost).length,
  };

  return (
    <>
      <PageHead title="Products" sub={data ? `${s.products} on sale` : null}>
        <Button variant="outline" onClick={() => setImporting(true)}>Import</Button>
        <Button variant="outline" onClick={exportSheet} disabled={!products.length}>Export</Button>
        <Button onClick={() => setForm({})}>Add product</Button>
      </PageHead>

      <Alert>{error}</Alert>
      <Alert kind="ok" onDone={() => setNotice('')}>{notice}</Alert>

      {s && (
        <div className="mb-5 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          <Stat
            hero
            label="Stock value"
            value={money(s.stockValue)}
            note={s.noCost ? `at buy price; ${s.noCost} without one` : 'at buy price'}
            icon={Icon.box()}
            className="col-span-2 sm:col-span-1"
          />
          <Stat label="Sale value" value={money(s.retailValue)} note="if it all sold at today's prices" icon={Icon.cash()} tone="neutral" />
          <Stat label="Profit on the shelf" value={money(s.profitInStock)} note="sale value less buy price" icon={Icon.chart()} tone="ok" />
          <Stat
            label="Buy again"
            value={String(s.low)}
            note={s.out ? `${s.out} have no stock` : 'everything is stocked'}
            icon={Icon.clock()}
            tone={s.out ? 'bad' : s.low ? 'warn' : 'ok'}
          />
        </div>
      )}

      <div className="mb-4">
        <Segmented
          label="View"
          value={tab}
          onChange={setTab}
          options={[{ value: 'products', label: 'Products' }, { value: 'categories', label: 'Categories' }, { value: 'book', label: 'Stock history' }]}
        />
      </div>

      {tab === 'categories' ? (
        <Categories />
      ) : tab === 'book' ? (
        <StockBook kinds={data?.kinds || {}} />
      ) : (
        <Card>
          <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3 sm:px-5">
            <Input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, code, supplier or shelf"
              className="w-full sm:w-[280px]"
              aria-label="Search products"
            />
            <Select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full sm:w-[190px]" aria-label="Category">
              <option value="">Every category</option>
              {list(data?.categories).map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
            <div className="flex flex-wrap gap-1.5">
              {[
                ['all', 'On sale'],
                ['low', `To order (${counts.low})`],
                ['out', `Out (${counts.out})`],
                ['nocost', `No buy price (${counts.nocost})`],
                ['retired', `Retired (${counts.retired})`],
              ].map(([v, label]) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setShow(v)}
                  aria-pressed={show === v}
                  className={cn(
                    'rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-colors',
                    show === v ? 'border-brand bg-brand-soft text-brand-dark' : 'border-line text-ink-muted hover:border-line-firm hover:text-ink'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {pickedShown.length > 0 && (
            <div className="flex flex-wrap items-center gap-3 border-b border-line bg-brand-soft px-4 py-2.5 sm:px-5" role="status">
              <span className="text-[12.5px] font-semibold text-brand-dark">
                {pickedShown.length} {pickedShown.length === 1 ? 'product' : 'products'} selected
              </span>
              <Button variant="ghost" size="sm" onClick={() => setPicked(new Set())}>Clear</Button>
              <Button variant="danger" size="sm" className="ml-auto" onClick={() => setDeleting(pickedShown)}>
                Delete {pickedShown.length}
              </Button>
            </div>
          )}

          {!data ? (
            error ? <LoadFailed onRetry={load}>{error}</LoadFailed> : <Loading>Loading the products…</Loading>
          ) : shown.length === 0 ? (
            <Empty
              title="Nothing here"
              action={(search || category || show !== 'all') && (
                <Button variant="outline" onClick={() => { setSearch(''); setCategory(''); setShow('all'); }}>Show everything</Button>
              )}
            >
              {show === 'low' ? 'Nothing is at or below its reorder level.' : 'Try a different search or filter.'}
            </Empty>
          ) : (
            <TableWrap>
              <Table>
                <thead>
                  <tr>
                    <Th className="w-10 pr-0">
                      <Checkbox
                        checked={allPicked}
                        onChange={pickAll}
                        aria-label={allPicked ? 'Clear the selection' : `Select all ${shown.length} shown`}
                      />
                    </Th>
                    <Th>Product</Th>
                    <Th num>Buy</Th>
                    <Th num>Sell</Th>
                    <Th num>Margin</Th>
                    <Th num>In stock</Th>
                    <Th num>Value</Th>
                    <Th num>Sold, 30 days</Th>
                    <Th />
                  </tr>
                </thead>
                <tbody>
                  {shown.map((p) => (
                    <Tr key={p.id} className={cn(picked.has(p.id) && 'bg-brand-soft/60')}>
                      <Td className="w-10 pr-0">
                        <Checkbox checked={picked.has(p.id)} onChange={() => pick(p.id)} aria-label={`Select ${p.name}`} />
                      </Td>
                      <Td className="min-w-[220px]">
                        <button type="button" onClick={() => setHistory(p)} className="text-left">
                          <span className="block font-semibold text-ink hover:text-brand-dark">{p.name}</span>
                          <span className="tnum block text-[11.5px] text-ink-muted">
                            {[p.code, p.category_name, p.shelf && `shelf ${p.shelf}`].filter(Boolean).join(' · ')}
                          </span>
                        </button>
                      </Td>
                      <Td num className={p.cost ? 'text-ink-2' : 'text-ink-faint'}>
                        {p.cost ? money(p.cost) : 'Not set'}
                        {p.last_buy?.supplier && <span className="block max-w-[140px] truncate text-[11.5px] text-ink-muted" title={`Last bought from ${p.last_buy.supplier}`}>{p.last_buy.supplier}</span>}
                      </Td>
                      <Td num className="font-semibold text-ink">{money(p.price)}</Td>
                      <Td num className={p.margin === null ? 'text-ink-faint' : p.margin < 0 ? 'font-semibold text-bad' : 'text-ink-2'}>
                        {p.margin === null ? '' : `${p.margin}%`}
                      </Td>
                      <Td num>
                        <span className="tnum font-semibold text-ink">{p.tracked ? p.stock_available : ''}</span>{' '}
                        <span className="text-ink-muted">{p.tracked ? p.unit : ''}</span>
                        <div className="mt-1">
                          <Chip tone={STATE_TONE[p.state]}>{p.status_label}</Chip>
                        </div>
                      </Td>
                      <Td num className="text-ink-2">{p.cost ? money(p.stock_value) : ''}</Td>
                      <Td num className="text-ink-2">
                        {p.sold_30 || 0}
                        {p.days_left !== null && (
                          <span className={cn('block text-[11.5px]', p.days_left <= 7 ? 'font-semibold text-bad' : 'text-ink-muted')}>
                            about {p.days_left} {p.days_left === 1 ? 'day' : 'days'} left
                          </span>
                        )}
                      </Td>
                      <Td className="whitespace-nowrap text-right">
                        <div className="flex justify-end gap-2">
                          <Button size="sm" onClick={() => setMoving(p)}>Stock</Button>
                          <Button variant="outline" size="sm" onClick={() => setForm(p)}>Edit</Button>
                        </div>
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          )}
        </Card>
      )}

      {form && (
        <ProductForm
          product={form.id ? form : null}
          categories={list(data?.categories)}
          suppliers={list(data?.suppliers)}
          onClose={() => setForm(null)}
          onDone={done}
          onDelete={() => { setDeleting([form]); setForm(null); }}
        />
      )}
      {deleting && <DeleteProducts products={deleting} onClose={() => setDeleting(null)} onDone={done} />}
      {moving && (
        <StockMove product={moving} suppliers={list(data?.suppliers)} onClose={() => setMoving(null)} onDone={done} />
      )}
      {history && (
        <History
          product={history}
          onClose={() => setHistory(null)}
          onStock={() => { setMoving(history); setHistory(null); }}
          onEdit={() => { setForm(history); setHistory(null); }}
          onDelete={() => { setDeleting([history]); setHistory(null); }}
        />
      )}
      {importing && (
        <ImportSheet
          onClose={() => setImporting(false)}
          onDone={(msg) => { setImporting(false); setNotice(msg); load(); }}
        />
      )}
    </>
  );
}

/* ── Adding and editing ──────────────────────────────────────────── */

/**
 * Deleting one product or many. Spelt out first, because it takes the
 * product out of the app and off every list; it goes to the WordPress
 * bin rather than vanishing, so it can still be brought back from there.
 */
function DeleteProducts({ products, onClose, onDone }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const n = products.length;
  const one = n === 1;

  async function go() {
    setBusy(true);
    setError('');
    try {
      const r = await api('/api/manager/products/delete', { method: 'POST', body: { ids: products.map((p) => p.id) } });
      const d = r.deleted ?? n;
      onDone(one ? `${products[0].name} deleted.` : `${d} products deleted.`);
    } catch (e) {
      setError(/no route/i.test(e.message) ? 'Deleting needs the new plugin. Upload al-hadeed-hardware.zip (1.9.0) to the website first.' : e.message);
      setBusy(false);
    }
  }

  return (
    <Modal
      title={one ? `Delete ${products[0].name}?` : `Delete ${n} products?`}
      description="They come off sale, out of the app and off this list."
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Keep {one ? 'it' : 'them'}</Button>
          <Button variant="danger" disabled={busy} onClick={go}>
            {busy ? 'Deleting…' : one ? 'Delete product' : `Delete ${n} products`}
          </Button>
        </>
      }
    >
      <div className="space-y-4 text-[13px] text-ink-2">
        <Alert>{error}</Alert>
        <ul className="max-h-48 space-y-1 overflow-y-auto rounded-xl border border-line bg-surface-2 px-4 py-3">
          {products.map((p) => (
            <li key={p.id} className="flex justify-between gap-3">
              <span className="font-medium text-ink">{p.name}</span>
              <span className="tnum text-ink-muted">{p.code}</span>
            </li>
          ))}
        </ul>
        {products.some((p) => Number(p.stock_available) > 0) && (
          <p className="rounded-xl bg-bad-bg px-4 py-3 text-bad">
            Some still have stock. That stock goes to <b>0</b> and leaves the stock value.
          </p>
        )}
        <p>
          Old receipts keep the name and price. History keeps one line saying you deleted {one ? 'it' : 'them'}.
          To stop selling but keep {one ? 'it' : 'them'}, use <b>Retire</b>.
        </p>
      </div>
    </Modal>
  );
}

function ProductForm({ product, categories, suppliers, onClose, onDone, onDelete }) {
  const editing = !!product;
  const [f, setF] = useState(() => ({
    name: product?.name || '',
    code: product?.code || '',
    category: product?.category_name || '',
    unit: product?.unit || 'pc',
    price: product?.price ? String(product.price) : '',
    cost: product?.cost ? String(product.cost) : '',
    stock: '',
    reorderLevel: product ? String(product.reorder_level || '') : '',
    reorderQty: product?.reorder_qty ? String(product.reorder_qty) : '',
    supplier: product?.supplier || '',
    shelf: product?.shelf || '',
    description: product?.description || '',
    itemShort: product?.item_short || '',
    widthFt: product?.width_ft != null ? String(product.width_ft) : '',
    lengthFt: product?.length_ft != null ? String(product.length_ft) : '',
    thicknessMm: product?.thickness_mm != null ? String(product.thickness_mm) : '',
    weightKg: product?.weight_kg != null ? String(product.weight_kg) : '',
    expectedCost: product?.expected_cost != null ? String(product.expected_cost) : '',
    expectedPrice: product?.expected_price != null ? String(product.expected_price) : '',
  }));
  const [newCategory, setNewCategory] = useState(false);
  // Main categories with their sub-categories, for a grouped list.
  const [tree, setTree] = useState(null);
  useEffect(() => {
    api('/api/manager/categories').then((r) => setTree(list(r.categories))).catch(() => setTree(null));
  }, []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const price = int(f.price);
  const cost = int(f.cost);
  const margin = price > 0 && cost > 0 ? ((price - cost) / price) * 100 : null;

  async function save(patch) {
    setBusy(true);
    setError('');
    try {
      const body = patch || {
        name: f.name.trim(),
        code: f.code.trim(),
        category: f.category.trim(),
        unit: f.unit.trim() || 'pc',
        price,
        cost,
        ...(editing ? { reorderLevel: int(f.reorderLevel) } : {}),
        supplier: f.supplier.trim(),
        shelf: f.shelf.trim(),
        description: f.description.trim(),
        itemShort: f.itemShort.trim(),
        widthFt: f.widthFt.trim(),
        lengthFt: f.lengthFt.trim(),
        thicknessMm: f.thicknessMm.trim(),
        weightKg: f.weightKg.trim(),
        expectedCost: f.expectedCost.trim(),
        expectedPrice: f.expectedPrice.trim(),
      };
      await api(editing ? `/api/manager/products/${product.id}` : '/api/manager/products', { method: 'POST', body });
      onDone(
        patch
          ? patch.active ? `${product.name} is back on sale.` : `${product.name} retired. It no longer shows in the app.`
          : editing ? `${f.name.trim()} saved.` : `${f.name.trim()} added.`
      );
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }

  // A product may be saved with no price: the app then says "Ask for the
  // price" and nothing sells until one is set.
  const ok = f.name.trim().length >= 2 && !busy;

  return (
    <Modal
      wide
      title={editing ? product.name : 'Add a product'}
      description={editing ? `${product.code}. Stock changes with a purchase, a count or Stock, so it goes in the stock book.` : 'Stock is added with Receive once it is saved. For a long list, use Import instead.'}
      onClose={onClose}
      footer={
        <>
          {editing && (
            <div className="mr-auto flex flex-wrap gap-2">
              <Button variant="ghost" className="text-bad hover:bg-bad-bg hover:text-bad" disabled={busy} onClick={onDelete}>
                Delete
              </Button>
              <Button
                variant="ghost"
                disabled={busy}
                onClick={() => save({ active: !product.active })}
                title={product.active ? 'Off sale and out of the app, but kept. Put it back any time.' : undefined}
              >
                {product.active ? 'Retire' : 'Put back on sale'}
              </Button>
            </div>
          )}
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={!ok} onClick={() => save()}>
            {busy ? 'Saving…' : editing ? 'Save' : 'Add product'}
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        <Alert>{error}</Alert>
        {editing && <ProductPicture product={product} />}

        <Section title="The product">
          <Field label="Name">
            <Input value={f.name} onChange={set('name')} placeholder="Hima Cement 50kg" autoFocus={!editing} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Code (SKU)" hint={editing ? undefined : 'Left empty, one is made.'}>
              <Input value={f.code} onChange={set('code')} placeholder="AH-CEM-001" className="tnum" />
            </Field>
            <Field label="Category">
              {newCategory || !categories.length ? (
                <Input value={f.category} onChange={set('category')} placeholder="A new category" />
              ) : (
                <Select
                  value={f.category}
                  onChange={(e) => (e.target.value === '+new' ? (setNewCategory(true), setF({ ...f, category: '' })) : set('category')(e))}
                >
                  <option value="">None</option>
                  {tree
                    ? tree.map((t) => (t.children.length ? (
                        <optgroup key={t.id} label={t.name}>
                          <option value={t.name}>{t.name} (main)</option>
                          {t.children.map((c) => <option key={c.id} value={c.name}>{t.name} › {c.name}</option>)}
                        </optgroup>
                      ) : (
                        <option key={t.id} value={t.name}>{t.name}</option>
                      )))
                    : categories.map((c) => <option key={c} value={c}>{c}</option>)}
                  <option value="+new">Add a new category…</option>
                </Select>
              )}
            </Field>
            <Field label="Sold by" hint="bag, kg, length, tin, pc">
              <Input value={f.unit} onChange={set('unit')} placeholder="pc" />
            </Field>
          </div>
        </Section>

        <Section title="Prices">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Buy price" hint="What the shop pays for one.">
              <MoneyField value={f.cost} onChange={(v) => setF((x) => ({ ...x, cost: v }))} placeholder="Not set" />
            </Field>
            <Field label="Sale price" hint="What a customer pays for one.">
              <MoneyField value={f.price} onChange={(v) => setF((x) => ({ ...x, price: v }))} placeholder="No price yet" strong />
            </Field>
            <div className="rounded-xl border border-line bg-surface-2 px-4 py-3">
              <p className="text-[12px] font-semibold text-ink-muted">Profit on each</p>
              <p className={cn('tnum mt-1 text-[16px] font-bold', margin === null ? 'text-ink-faint' : margin < 0 ? 'text-bad' : 'text-ok')}>
                {margin === null ? (price > 0 ? 'Add the buy price' : 'No price yet') : money(price - cost)}
              </p>
              {margin !== null && (
                <p className={cn('text-[12px]', margin < 0 ? 'font-semibold text-bad' : 'text-ink-muted')}>
                  {margin < 0 ? 'Sold below cost' : `${margin.toFixed(1)}% margin`}
                </p>
              )}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Next buy price" hint="What you expect to pay next time.">
              <MoneyField value={f.expectedCost} onChange={(v) => setF((x) => ({ ...x, expectedCost: v }))} placeholder="Optional" />
            </Field>
            <Field label="Next sale price" hint="What you plan to sell at.">
              <MoneyField value={f.expectedPrice} onChange={(v) => setF((x) => ({ ...x, expectedPrice: v }))} placeholder="Optional" />
            </Field>
            {editing && product.last_buy ? (
              <div className="rounded-xl border border-line bg-surface-2 px-4 py-3">
                <p className="text-[12px] font-semibold text-ink-muted">Last bought</p>
                <p className="tnum mt-1 text-[14px] font-bold text-ink">{money(product.last_buy.cost)}</p>
                <p className="text-[12px] text-ink-muted">
                  {[product.last_buy.supplier, product.last_buy.fdn && `FDN ${product.last_buy.fdn}`, product.last_buy.date].filter(Boolean).join(' · ')}
                </p>
              </div>
            ) : <div />}
          </div>
        </Section>

        <Section title="Size and weight">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
            <Field label="Short name" hint="PL, PIPE, ANG">
              <Input value={f.itemShort} onChange={set('itemShort')} placeholder="PL" />
            </Field>
            <Field label="Width">
              <MeasureField value={f.widthFt} onChange={(v) => setF((x) => ({ ...x, widthFt: v }))} unit="ft" placeholder="4" />
            </Field>
            <Field label="Length">
              <MeasureField value={f.lengthFt} onChange={(v) => setF((x) => ({ ...x, lengthFt: v }))} unit="ft" placeholder="8" />
            </Field>
            <Field label="Thickness">
              <MeasureField value={f.thicknessMm} onChange={(v) => setF((x) => ({ ...x, thicknessMm: v }))} unit="mm" placeholder="1.5" />
            </Field>
            <Field label="Weight of one">
              <MeasureField value={f.weightKg} onChange={(v) => setF((x) => ({ ...x, weightKg: v }))} unit="kg" placeholder="35.05" />
            </Field>
          </div>
          {f.widthFt && f.lengthFt && f.thicknessMm && (
            <button
              type="button"
              className="text-[12.5px] font-semibold text-brand hover:underline"
              onClick={() => setF({ ...f, weightKg: String(Math.round((Number(f.widthFt) / 3.281) * (Number(f.lengthFt) / 3.281) * 7850 * (Number(f.thicknessMm) / 1000) * 100) / 100) })}
            >
              Work out the weight for steel plate ({Math.round((Number(f.widthFt) / 3.281) * (Number(f.lengthFt) / 3.281) * 7850 * (Number(f.thicknessMm) / 1000) * 100) / 100} kg)
            </button>
          )}
        </Section>

        {/* No stock here: stock comes in as a purchase, with its supplier,
            delivery note and date, so every unit in the book has a source. */}
        <Section title={editing ? 'Supplier, shelf and target stock' : 'Supplier and shelf'}>
          {editing && (
            <Field
              label="Target stock (minimum level)"
              hint="Below this it goes on the reorder list, and the suggested order tops it back up."
            >
              <Input type="number" inputMode="numeric" min="0" value={f.reorderLevel} onChange={set('reorderLevel')} className="tnum sm:max-w-[220px]" />
            </Field>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Supplier">
              {suppliers.length ? (
                <Select value={f.supplier} onChange={set('supplier')}>
                  <option value="">None</option>
                  {[...new Set([...suppliers, f.supplier].filter(Boolean))].map((x) => <option key={x} value={x}>{x}</option>)}
                </Select>
              ) : (
                <Input value={f.supplier} onChange={set('supplier')} placeholder="Who the shop buys it from" />
              )}
            </Field>
            <Field label="Shelf or store location">
              <Input value={f.shelf} onChange={set('shelf')} placeholder="B2, back store" />
            </Field>
          </div>
        </Section>

        <Section title="Shown in the app">
          <Field label="Description">
            <Textarea value={f.description} onChange={set('description')} placeholder="Size, grade, colour, what it is for" />
          </Field>
        </Section>
      </div>
    </Modal>
  );
}

const Section = ({ title, children }) => (
  <section className="space-y-4">
    <h3 className="text-[11.5px] font-bold uppercase tracking-[0.06em] text-ink-muted">{title}</h3>
    {children}
  </section>
);

/* ── Moving stock ────────────────────────────────────────────────── */

const MOVES = [
  { value: 'count', label: 'Count it', sign: 0, about: 'Type the number on the shelf.' },
  { value: 'received', label: 'Goods arrived', sign: 1, about: 'New goods from a supplier.' },
  { value: 'damaged', label: 'Damaged or lost', sign: -1, about: 'Broken, stolen or missing. Say why.' },
  { value: 'own_use', label: 'Used by the shop', sign: -1, about: 'The shop used it. Say what for.' },
  { value: 'returned', label: 'Customer returned', sign: 1, about: 'A customer brought it back.' },
  { value: 'correction', label: 'Fix a mistake', sign: 0, about: 'Fix a typing mistake. Use minus (-) for less.' },
];

function StockMove({ product, suppliers, onClose, onDone }) {
  const [kind, setKind] = useState('count');
  const [qty, setQty] = useState('');
  const [cost, setCost] = useState(product.cost ? String(product.cost) : '');
  const [supplier, setSupplier] = useState(product.supplier || '');
  const [ref, setRef] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(today());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const move = MOVES.find((m) => m.value === kind);
  const now = product.stock_available ?? 0;
  const n = Math.round((Number(qty) || 0) * 100) / 100;
  const after = kind === 'count' ? n : kind === 'correction' ? now + n : now + move.sign * n;
  const needsNote = ['damaged', 'own_use', 'correction'].includes(kind);
  // A purchase only counts with its paperwork.
  const purchaseOk = kind !== 'received' || (supplier.trim() && ref.trim() && int(cost) > 0);
  const ok = !busy && qty !== '' && after >= 0 && !!date && !!purchaseOk &&
    (kind === 'correction' ? n !== 0 : kind === 'count' ? n >= 0 : n > 0) &&
    (!needsNote || note.trim().length >= 3);

  async function save() {
    setBusy(true);
    setError('');
    try {
      await api(`/api/manager/products/${product.id}/stock`, {
        method: 'POST',
        body: {
          kind,
          qty: n,
          note: note.trim(),
          date,
          ...(kind === 'received' ? { unitCost: int(cost), supplier: supplier.trim(), ref: ref.trim() } : {}),
        },
      });
      onDone(`${product.name}: ${after} ${product.unit} in stock.`);
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }

  return (
    <Modal
      title={`Stock: ${product.name}`}
      description={`Stock now: ${now} ${product.unit}.`}
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={!ok} onClick={save}>{busy ? 'Saving…' : 'Save'}</Button>
          {kind === 'received' && !purchaseOk && (
            <span className="order-first mr-auto self-center text-[12px] text-ink-muted">Needs the supplier, FDN number and buy price.</span>
          )}
        </>
      }
    >
      <div className="space-y-4">
        <Alert>{error}</Alert>
        <div>
          <p className="mb-2 text-[12px] font-semibold text-ink-2">What happened?</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {MOVES.map((m) => (
              <button
                key={m.value}
                type="button"
                aria-pressed={kind === m.value}
                onClick={() => { setKind(m.value); setError(''); }}
                className={cn(
                  'rounded-xl border px-3 py-2.5 text-left text-[12px] font-semibold transition-colors',
                  kind === m.value ? 'border-brand bg-brand-soft text-brand-dark' : 'border-line text-ink-2 hover:border-line-firm'
                )}
              >
                {m.label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[12px] text-ink-muted">{move.about}</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={kind === 'count' ? `How many ${product.unit} are on the shelf?` : kind === 'correction' ? `${product.unit} to add, or minus to take off` : `How many ${product.unit}?`}>
            <Input type="number" step="any" inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} className="tnum text-[16px] font-semibold" autoFocus />
          </Field>
          <Field label={kind === 'received' ? 'Delivery date' : 'Date'}>
            <Input type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} />
          </Field>
        </div>

        {kind === 'received' && (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Buy price for one (UGX)" hint="Becomes the cost of every sale after this.">
                <Input type="number" inputMode="numeric" min="0" value={cost} onChange={(e) => setCost(e.target.value)} className="tnum" />
              </Field>
              <Field label="Delivery note (FDN) no.">
                <Input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="FDN 10422" />
              </Field>
            </div>
            <Field label="Supplier">
              {suppliers.length ? (
                <Select value={supplier} onChange={(e) => setSupplier(e.target.value)}>
                  <option value="">Choose the supplier</option>
                  {[...new Set([...suppliers, supplier].filter(Boolean))].map((x) => <option key={x} value={x}>{x}</option>)}
                </Select>
              ) : (
                <Input value={supplier} onChange={(e) => setSupplier(e.target.value)} />
              )}
            </Field>
          </>
        )}

        <Field label={needsNote ? 'What happened? (needed)' : 'Note (optional)'}>
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder={kind === 'damaged' ? 'Three bags got wet in the rain' : ''} />
        </Field>

        {qty !== '' && (
          <div className={cn('flex items-center justify-between rounded-xl px-4 py-3', after < 0 ? 'bg-bad-bg' : 'bg-surface-2')}>
            <span className="text-[12px] text-ink-muted">Stock after this</span>
            <span className={cn('tnum text-[13.5px] font-bold', after < 0 ? 'text-bad' : 'text-ink')}>
              {now} → {after} {product.unit}
              {after < 0 && <span className="ml-2 text-[12px] font-semibold">Cannot go below zero</span>}
            </span>
          </div>
        )}
        {kind === 'received' && n > 0 && int(cost) > 0 && (
          <p className="text-right text-[12px] text-ink-muted">Cost of this delivery: <b className="text-ink">{money(n * int(cost))}</b></p>
        )}
      </div>
    </Modal>
  );
}

/* ── One product's ledger ─────────────────────────────────────────── */

/**
 * One product's statement: every purchase, sale, count and adjustment,
 * with what came in (debit), what went out (credit) and the balance
 * after each, worked out from the stock book itself.
 */
function History({ product, onClose, onStock, onEdit, onDelete }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [kind, setKind] = useState('');

  const load = useCallback(() => {
    setError('');
    api(`/api/manager/products/${product.id}/ledger`)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [product.id]);
  useEffect(load, [load]);

  const s = data?.stock;
  const t = data?.totals;
  const lines = list(data?.lines).filter((l) =>
    !kind ? true : kind === 'sales' ? ['sold', 'restored'].includes(l.kind) : kind === 'purchases' ? l.kind === 'received' : !['sold', 'restored', 'received'].includes(l.kind)
  );
  const days = s?.daysOfStock;

  const facts = [
    ['Book stock', t ? `${t.book} ${product.unit}` : '…', t && t.book < 0 ? 'text-bad' : ''],
    ['Purchased', t ? `${t.purchased} ${product.unit}` : '…'],
    ['Sold', t ? `${t.sold} ${product.unit}` : '…'],
    ['Adjusted', t ? `${t.adjusted > 0 ? '+' : ''}${t.adjusted} ${product.unit}` : '…'],
    ['Stock value', s ? money(s.value) : '…'],
    ['Buy price', product.cost ? money(product.cost) : 'Not set'],
    ['Last bought from', product.last_buy ? [product.last_buy.supplier, product.last_buy.fdn && `FDN ${product.last_buy.fdn}`].filter(Boolean).join(' · ') : 'Not yet'],
    ['Size', [product.width_ft && `${product.width_ft} ft`, product.length_ft && `${product.length_ft} ft`, product.thickness_mm && `${product.thickness_mm} mm`].filter(Boolean).join(' x ') || 'Not set'],
    ['Weight of one', product.weight_kg ? `${product.weight_kg} kg` : 'Not set'],
    ['Sale price', product.price ? money(product.price) : 'Not set', !product.price ? 'text-bad' : ''],
    ['Sells a day', s ? (s.avgDaily ? `${s.avgDaily} (90 days)` : 'None in 90 days') : '…'],
    ['Days of stock', s ? (days === null ? 'Not selling' : days > 365 ? 'Over a year' : `${days} days`) : '…', s && days !== null && days < 15 ? 'text-bad' : ''],
    ['Last sale', s ? (s.lastSale ? s.lastSale : 'Never') : '…'],
    ['Target stock', product.reorder_level ? `${product.reorder_level} ${product.unit}` : 'Not set'],
    ['Supplier', product.supplier || '—'],
  ];

  return (
    <Modal
      wide
      title={product.name}
      description={[product.code, product.category_name].filter(Boolean).join(' · ')}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" className="mr-auto text-bad hover:bg-bad-bg hover:text-bad" onClick={onDelete}>Delete</Button>
          <Button variant="outline" onClick={onEdit}>Edit</Button>
          <Button onClick={onStock}>Change stock</Button>
        </>
      }
    >
      {s?.reorder && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-sm border border-warn/30 bg-warn-bg px-3 py-2.5 text-[12.5px] text-warn">
          <span><b>Reorder now.</b> {s.suggestedQty > 0 ? `Order ${s.suggestedQty} ${product.unit} to reach the target.` : 'Under 15 days of stock left.'}</span>
          {s.suggestedQty > 0 && s.cost > 0 && <span className="tnum font-semibold">{money(s.suggestedQty * s.cost)}</span>}
        </div>
      )}
      {s?.shelfMismatch !== null && s?.shelfMismatch !== undefined && (
        <p className="mb-4 rounded-sm border border-bad/25 bg-bad-bg px-3 py-2 text-[12px] text-bad">
          The shop&rsquo;s own count says {s.shelfMismatch}, the stock book says {t?.book}. Count it to settle which is right.
        </p>
      )}

      <dl className="mb-5 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
        {facts.map(([k, v, c]) => (
          <div key={k} className="min-w-0">
            <dt className="text-[11.5px] text-ink-muted">{k}</dt>
            <dd className={cn('tnum truncate text-[13px] font-semibold text-ink', c)}>{v}</dd>
          </div>
        ))}
      </dl>

      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[11.5px] font-bold uppercase tracking-[0.06em] text-ink-muted">Stock history</h3>
        <Segmented
          label="Show"
          value={kind}
          onChange={setKind}
          options={[
            { value: '', label: 'Everything' },
            { value: 'purchases', label: 'Purchases' },
            { value: 'sales', label: 'Sales' },
            { value: 'other', label: 'Counts and adjustments' },
          ]}
        />
      </div>
      {error ? (
        <LoadFailed onRetry={load}>{error}</LoadFailed>
      ) : !data ? (
        <Loading>Reading the stock book…</Loading>
      ) : lines.length === 0 ? (
        <p className="py-6 text-center text-[12.5px] text-ink-muted">Nothing here yet. Purchases, sales and counts show here.</p>
      ) : (
        <TableWrap className="rounded-xl border border-line">
          <Table className="text-[12px]">
            <thead>
              <tr>
                <Th>Date</Th>
                <Th>What</Th>
                <Th>Who</Th>
                <Th num>In</Th>
                <Th num>Out</Th>
                <Th num>Stock</Th>
                <Th num>Cost</Th>
                <Th num>Price</Th>
                <Th>By</Th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => (
                <Tr key={l.id}>
                  <Td className="tnum whitespace-nowrap text-ink-muted">{l.date}</Td>
                  <Td>
                    <span className="whitespace-nowrap font-semibold text-ink">{l.kindLabel}</span>
                    {(l.ref || l.note) && <span className="block text-[11.5px] text-ink-muted">{[l.ref, l.note].filter(Boolean).join(' · ')}</span>}
                  </Td>
                  <Td className="text-ink-2">{l.party}</Td>
                  <Td num className="font-bold text-ok">{l.in || ''}</Td>
                  <Td num className="font-bold text-bad">{l.out || ''}</Td>
                  <Td num className={cn('font-bold', l.balance < 0 ? 'text-bad' : 'text-ink')}>{l.balance}</Td>
                  <Td num className="text-ink-2">{l.unitCost ? money(l.unitCost) : ''}</Td>
                  <Td num className={cn(l.unitPrice && l.unitCost && l.unitPrice < l.unitCost ? 'font-semibold text-bad' : 'text-ink-2')}>{l.unitPrice ? money(l.unitPrice) : ''}</Td>
                  <Td className="whitespace-nowrap text-ink-muted">{l.by}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </TableWrap>
      )}
    </Modal>
  );
}

function MovesTable({ moves, withProduct }) {
  return (
    <TableWrap className="rounded-xl border border-line">
      <Table className="text-[12px]">
        <thead>
          <tr>
            <Th>When</Th>
            {withProduct && <Th>Product</Th>}
            <Th>What</Th>
            <Th num>Change</Th>
            <Th num>Stock</Th>
            <Th num>Value</Th>
            <Th>By</Th>
          </tr>
        </thead>
        <tbody>
          {moves.map((m) => (
            <Tr key={m.id}>
              <Td className="whitespace-nowrap text-ink-muted">{stamp(m.created_at)}</Td>
              {withProduct && <Td className="font-medium text-ink">{m.product_name}</Td>}
              <Td>
                <span className="font-semibold text-ink">{m.kind_label}</span>
                {[m.ref, m.supplier, m.note].filter(Boolean).length > 0 && (
                  <span className="block text-[11.5px] text-ink-muted">{[m.ref, m.supplier, m.note].filter(Boolean).join(' · ')}</span>
                )}
              </Td>
              <Td num className={cn('font-bold', m.qty > 0 ? 'text-ok' : m.qty < 0 ? 'text-bad' : 'text-ink-muted')}>
                {signed(m.qty)}
              </Td>
              <Td num className="whitespace-nowrap text-ink-muted">{m.before} → <b className="text-ink">{m.after}</b></Td>
              <Td num className="text-ink-2">{m.value ? money(m.value) : ''}</Td>
              <Td className="whitespace-nowrap text-ink-muted">{m.by}</Td>
            </Tr>
          ))}
        </tbody>
      </Table>
    </TableWrap>
  );
}

/* ── The whole stock book ────────────────────────────────────────── */

function StockBook({ kinds }) {
  const monthStart = today().slice(0, 8) + '01';
  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(today());
  const [kind, setKind] = useState('');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const q = new URLSearchParams({ from, to, limit: '1000', ...(kind ? { kind } : {}) });
      setData(await api(`/api/manager/stock/moves?${q}`));
    } catch (e) {
      setError(e.message);
    }
  }, [from, to, kind]);

  useEffect(() => { load(); }, [load]);

  const s = data?.summary;
  return (
    <Card>
      <div className="flex flex-wrap items-end gap-3 border-b border-line px-4 py-3 sm:px-5">
        <Field label="From"><Input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} /></Field>
        <Field label="To"><Input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} /></Field>
        <Field label="What" className="w-full sm:w-[220px]">
          <Select value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="">Everything</option>
            {Object.entries(kinds).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
          </Select>
        </Field>
      </div>
      {s && (
        <div className="grid grid-cols-2 gap-px border-b border-line bg-line sm:grid-cols-4">
          {[
            ['Units in', s.unitsIn, 'text-ok'],
            ['Units out', s.unitsOut, 'text-bad'],
            ['Value in, at buy price', money(s.valueIn), 'text-ink'],
            ['Value out, at buy price', money(s.valueOut), 'text-ink'],
          ].map(([k, v, c]) => (
            <div key={k} className="bg-surface px-4 py-3 sm:px-5">
              <p className="text-[11.5px] text-ink-muted">{k}</p>
              <p className={cn('tnum text-[15px] font-bold', c)}>{v}</p>
            </div>
          ))}
        </div>
      )}
      <div className="p-4 sm:p-5">
        {error ? (
          <LoadFailed onRetry={load}>{error}</LoadFailed>
        ) : !data ? (
          <Loading>Reading the stock book…</Loading>
        ) : !list(data.moves).length ? (
          <Empty title="Nothing in these dates">Stock received, sold, counted or written off shows here.</Empty>
        ) : (
          <MovesTable moves={list(data.moves)} withProduct />
        )}
      </div>
    </Card>
  );
}

/**
 * Bring a price list in from a spreadsheet.
 *
 * The file is read in the browser, so the person sees what was
 * understood — how many rows, which columns were recognised, which
 * were ignored — before a single product is touched. An importer that
 * writes first and reports afterwards is how a shop loses its prices.
 *
 * Matching is on the product code. A code already on the shelf is
 * updated; a new one is added. Nothing is ever deleted: a spreadsheet
 * missing a line is a spreadsheet somebody trimmed, not an instruction
 * to discontinue a product.
 */
function ImportSheet({ onClose, onDone }) {
  const [file, setFile] = useState(null);
  const [parsed, setParsed] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function pick(e) {
    const chosen = e.target.files?.[0];
    if (!chosen) return;
    setFile(chosen);
    setParsed(null);
    setError('');
    try {
      const { readSheet } = await import('@/lib/sheet');
      setParsed(await readSheet(chosen));
    } catch (err) {
      setError(err.message);
    }
  }

  async function send() {
    setBusy(true);
    setError('');
    try {
      const r = await api('/api/manager/products/import', {
        method: 'POST',
        body: { rows: parsed.rows },
      });
      const bits = [];
      if (r.added) bits.push(`${r.added} added`);
      if (r.updated) bits.push(`${r.updated} updated`);
      if (r.failed?.length) bits.push(`${r.failed.length} skipped`);
      onDone(bits.length ? bits.join(', ') + '.' : 'Nothing changed.');
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Import from a spreadsheet"
      description="Excel (.xlsx, .xls) or CSV. Matched on the product code. Existing products are updated, new codes are added, nothing is deleted."
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={busy || !parsed?.rows?.length} onClick={send}>
            {busy
              ? 'Writing…'
              : parsed?.rows?.length
                ? `Import ${parsed.rows.length} ${parsed.rows.length === 1 ? 'row' : 'rows'}`
                : 'Import'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Alert>{error}</Alert>

        <label
          className={cn(
            'flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-sm border-2 border-dashed px-4 py-8 text-center',
            'transition-colors duration-150',
            file ? 'border-brand/40 bg-brand-soft' : 'border-line-firm hover:border-brand/40 hover:bg-surface-2'
          )}
        >
          <input
            type="file"
            accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
            className="sr-only"
            onChange={pick}
          />
          <span className="text-[13px] font-semibold text-ink">
            {file ? file.name : 'Choose a spreadsheet'}
          </span>
          <span className="text-[12px] text-ink-muted">
            {file
              ? `${(file.size / 1024).toFixed(0)} KB. Click to choose a different one`
              : 'Excel or CSV, up to 2,000 rows'}
          </span>
        </label>

        {parsed && (
          <div className="rounded-sm border border-line bg-surface-2 px-4 py-3 text-[12px]">
            <p className="font-semibold text-ink">
              {parsed.rows.length} {parsed.rows.length === 1 ? 'row' : 'rows'} read from “{parsed.sheetName}”
            </p>
            <p className="mt-1.5 text-ink-muted">
              <span className="font-medium text-ink-2">Understood:</span>{' '}
              {parsed.recognised.join(', ')}
            </p>
            {parsed.ignored.length > 0 && (
              <p className="mt-1 text-ink-muted">
                <span className="font-medium text-ink-2">Ignored:</span> {parsed.ignored.join(', ')}
                {' '}These columns have nowhere to go, and are left alone.
              </p>
            )}
          </div>
        )}

        {parsed?.rows?.length > 0 && (
          <div className="overflow-x-auto rounded-sm border border-line">
            <Table className="text-[12px]">
              <thead>
                <tr>
                  {parsed.recognised.map((f) => <Th key={f}>{f}</Th>)}
                </tr>
              </thead>
              <tbody>
                {parsed.rows.slice(0, 4).map((r, i) => (
                  <Tr key={i}>
                    {parsed.recognised.map((f) => (
                      <Td key={f} className="whitespace-nowrap">{String(r[f] ?? '')}</Td>
                    ))}
                  </Tr>
                ))}
              </tbody>
            </Table>
            {parsed.rows.length > 4 && (
              <p className="border-t border-line px-4 py-2 text-[11.5px] text-ink-muted">
                …and {parsed.rows.length - 4} more.
              </p>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}

/**
 * The product's photograph, and a way to replace it.
 *
 * Sent as multipart rather than in the JSON body: base64 inflates a
 * picture by a third, and a 4MB photo off a phone would go straight
 * past the post limit on most shared hosting.
 *
 * The preview is the file the person just chose, shown immediately
 * from the browser's own copy. Waiting for a round trip to find out
 * whether you picked the right photo is a poor way to spend a minute
 * on a slow line.
 */
function ProductPicture({ product }) {
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const [gone, setGone] = useState(false);
  const shown = preview || (gone ? null : product.picture);

  async function remove() {
    const ok = await confirmAction({
      title: 'Remove this picture?',
      body: 'The product stays. The app shows "No photo yet" until you add a new one.',
      confirm: 'Remove picture',
    });
    if (!ok) return;
    setBusy(true);
    setError('');
    try {
      await api(`/api/manager/products/${product.id}/image/remove`, { method: 'POST', body: {} });
      setPreview(null);
      setGone(true);
      setSaved(false);
    } catch (err) {
      setError(/no route/i.test(err.message) ? 'This needs the new plugin. Upload the zip to the website first.' : err.message);
    } finally {
      setBusy(false);
    }
  }

  async function pick(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('That is not a picture. Use a JPG, PNG or WEBP.');
      return;
    }
    if (file.size > 30 * 1024 * 1024) {
      setError('That picture is over 30MB. Choose a smaller one.');
      return;
    }

    setError('');
    setSaved(false);
    setPreview(URL.createObjectURL(file));
    setBusy(true);

    try {
      // A phone photo is often 4 to 8MB. Shrunk here to about 1200 pixels,
      // it is a fraction of that, so it uploads in a moment.
      const small = await shrinkImage(file, 1200);
      const body = new FormData();
      body.append('file', small, small.name || 'photo.jpg');
      // Not api(): that sets a JSON content type, and multipart needs
      // the browser to set its own boundary.
      await upload(`/api/manager/products/${product.id}/image`, body);
      setSaved(true);
    } catch (err) {
      setError(err.message);
      setPreview(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-4">
      <div className="size-20 shrink-0 overflow-hidden rounded-sm border border-line bg-surface-sunk">
        {shown ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shown} alt="" className="size-full object-cover" />
        ) : (
          <div className="grid size-full place-items-center text-[11px] text-ink-faint">
            No picture
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-[12px] font-semibold text-ink-2 transition-colors hover:border-line-firm hover:text-ink">
            <input type="file" accept="image/*" className="sr-only" onChange={(e) => { setGone(false); pick(e); }} disabled={busy} />
            {busy ? 'Working…' : shown ? 'Replace picture' : 'Upload a picture'}
          </label>
          {shown && !busy && (
            <button
              type="button"
              onClick={remove}
              className="inline-flex items-center gap-1.5 rounded-lg border border-transparent px-3 py-2 text-[12px] font-semibold text-bad transition-colors hover:border-bad/20 hover:bg-bad-bg"
            >
              Remove picture
            </button>
          )}
        </div>

        <p className={cn('mt-1.5 text-[11.5px]', error ? 'text-bad' : saved ? 'text-ok' : 'text-ink-muted')}>
          {error || (saved ? 'Saved. It shows in the app straight away.' : 'JPG, PNG or WEBP, up to 8MB.')}
        </p>
      </div>
    </div>
  );
}
