'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, upload } from '@/lib/api';
import { money, list, today } from '@/lib/format';
import { cn } from '@/lib/cn';
import {
  Alert, Button, Card, Empty, Field, Input, Loading, Modal, PageHead,
  Table, TableWrap, Td, Th, Tr, LoadFailed } from '@/components/ui';

/**
 * The catalogue, as the manager maintains it.
 *
 * Price and stock are edited in a small dialog rather than on a form
 * page, because those are the two things that change weekly in a
 * hardware shop and nobody should navigate away to correct a bag count.
 */
export default function ManagerProducts() {
  const [products, setProducts] = useState(null);
  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  /**
   * The catalogue as a spreadsheet, in the shape the importer reads
   * back. Export, change the prices in Excel, import — that round trip
   * is the whole point of an export for a shop this size.
   */
  async function exportSheet() {
    try {
      const { writeSheet } = await import('@/lib/sheet');
      const r = await api('/api/manager/products/export');
      writeSheet(list(r.products), `al-hadeed-products-${today()}.xlsx`);
      setNotice(`${list(r.products).length} products exported.`);
    } catch (e) {
      setError(e.message);
    }
  }

  const load = useCallback(async () => {
    try {
      setProducts(list((await api('/api/manager/products')).products));
      setError('');
    } catch (e) {
      // On failure, keep what was on screen; the error says it is stale.
      setError(e.message);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function save(id, patch, what) {
    try {
      await api(`/api/manager/products/${id}`, { method: 'POST', body: patch });
      setNotice(what);
      setEditing(null);
      load();
    } catch (e) {
      setError(e.message);
    }
  }

  const shown = (products || []).filter((p) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return `${p.name} ${p.code} ${p.category_name || ''}`.toLowerCase().includes(q);
  });

  return (
    <>
      <PageHead title="Products" sub={products ? `${shown.length} of ${products.length}` : null}>
        <Input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, code or category"
          className="w-[280px]"
        />
        <Button variant="outline" onClick={() => setImporting(true)}>Import</Button>
        <Button variant="outline" onClick={exportSheet} disabled={!products?.length}>
          Export
        </Button>
        <Button onClick={() => setAdding(true)}>Add product</Button>
      </PageHead>

      <Alert>{error}</Alert>
      <Alert kind="ok" onDone={() => setNotice('')}>{notice}</Alert>

      <Card>
        {!products ? (
          error ? <LoadFailed onRetry={load}>{error}</LoadFailed> : <Loading>Loading the catalogue…</Loading>
        ) : shown.length === 0 ? (
          <Empty
            title="Nothing matches"
            action={<Button variant="outline" onClick={() => setSearch('')}>Clear the search</Button>}
          >
            Try a different name or code.
          </Empty>
        ) : (
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>Product</Th><Th>Code</Th><Th>Category</Th>
                  <Th num>Price</Th><Th num>In stock</Th><Th num>Reorder at</Th><Th />
                </tr>
              </thead>
              <tbody>
                {shown.map((p) => {
                  const low = p.stock_available <= p.reorder_level;
                  return (
                    <Tr key={p.id} className={cn(!p.active && 'opacity-50')}>
                      <Td className="font-medium text-ink">{p.name}</Td>
                      <Td className="tnum text-ink-muted">{p.code}</Td>
                      <Td className="text-ink-muted">{p.category_name || ''}</Td>
                      <Td num className="font-semibold text-ink">{money(p.price)}</Td>
                      <Td num className={low ? 'text-bad' : undefined}>
                        <strong className={low ? 'font-bold' : 'font-semibold text-ink'}>
                          {p.stock_available}
                        </strong>{' '}
                        {p.unit}
                      </Td>
                      <Td num className="text-ink-muted">{p.reorder_level}</Td>
                      <Td className="text-right">
                        <Button variant="outline" size="sm" onClick={() => setEditing(p)}>Edit</Button>
                      </Td>
                    </Tr>
                  );
                })}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </Card>

      <EditProduct product={editing} onClose={() => setEditing(null)} onSave={save} />

      {importing && (
        <ImportSheet
          onClose={() => setImporting(false)}
          onDone={(msg) => { setImporting(false); setNotice(msg); load(); }}
        />
      )}

      {adding && (
        <AddProduct
          onClose={() => setAdding(false)}
          onDone={(msg) => { setAdding(false); setNotice(msg); load(); }}
          onError={setError}
        />
      )}
    </>
  );
}

function EditProduct({ product, onClose, onSave }) {
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('');
  const [reorder, setReorder] = useState('');

  useEffect(() => {
    if (!product) return;
    setPrice(String(product.price));
    setStock(String(product.stock_available));
    setReorder(String(product.reorder_level));
  }, [product]);

  if (!product) return null;

  return (
    <Modal
      title={product.name}
      description={product.code}
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            variant="ghost"
            onClick={() =>
              onSave(
                product.id,
                { active: !product.active },
                product.active ? `${product.name} retired.` : `${product.name} is back on sale.`
              )
            }
          >
            {product.active ? 'Retire' : 'Put back on sale'}
          </Button>
          <Button
            onClick={() =>
              onSave(
                product.id,
                { price: Number(price), stockAvailable: Number(stock), reorderLevel: Number(reorder) },
                `${product.name} updated.`
              )
            }
          >
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <ProductPicture product={product} />

        <Field label="Price (UGX)">
          <Input
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="tnum font-semibold"
            autoFocus
          />
        </Field>
        <Field label={`In stock (${product.unit})`}>
          <Input type="number" value={stock} onChange={(e) => setStock(e.target.value)} className="tnum" />
        </Field>
        <Field
          label="Reorder level"
          hint="At or below this, the product shows as low stock on the dashboard."
        >
          <Input type="number" value={reorder} onChange={(e) => setReorder(e.target.value)} className="tnum" />
        </Field>
      </div>
    </Modal>
  );
}

const BLANK = { name: '', code: '', price: '', stockAvailable: '', unit: 'pc', reorderLevel: '' };

function AddProduct({ onClose, onDone, onError }) {
  const [form, setForm] = useState(BLANK);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit() {
    setBusy(true);
    try {
      await api('/api/manager/products', {
        method: 'POST',
        body: {
          name: form.name.trim(),
          code: form.code.trim(),
          price: Number(form.price),
          stockAvailable: Number(form.stockAvailable || 0),
          reorderLevel: Number(form.reorderLevel || 0),
          unit: form.unit.trim() || 'pc',
        },
      });
      onDone(`${form.name} added.`);
      setForm(BLANK);
    } catch (e) {
      onError(e.message);
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Add a product"
      description="For a long list, use Import on this page instead."
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={busy || !form.name.trim() || !form.code.trim() || !form.price} onClick={submit}>
            {busy ? 'Adding…' : 'Add product'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Name">
          <Input value={form.name} onChange={set('name')} placeholder="Hima Cement 50kg" autoFocus />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Code (SKU)" hint="What the app and the pick list show.">
            <Input value={form.code} onChange={set('code')} placeholder="AH-CEM-001" className="tnum" />
          </Field>
          <Field label="Unit" hint="A price with no unit is half a price.">
            <Input value={form.unit} onChange={set('unit')} placeholder="bag, length, tin, pc" />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Price (UGX)">
            <Input type="number" value={form.price} onChange={set('price')} className="tnum font-semibold" />
          </Field>
          <Field label="Opening stock">
            <Input type="number" value={form.stockAvailable} onChange={set('stockAvailable')} className="tnum" />
          </Field>
          <Field label="Reorder level">
            <Input type="number" value={form.reorderLevel} onChange={set('reorderLevel')} className="tnum" />
          </Field>
        </div>
      </div>
    </Modal>
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
      description="Excel (.xlsx, .xls) or CSV. Matched on the product code — existing products are updated, new codes are added, nothing is deleted."
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
          <span className="text-sm font-semibold text-ink">
            {file ? file.name : 'Choose a spreadsheet'}
          </span>
          <span className="text-[12.5px] text-ink-muted">
            {file
              ? `${(file.size / 1024).toFixed(0)} KB — click to choose a different one`
              : 'Excel or CSV, up to 2,000 rows'}
          </span>
        </label>

        {parsed && (
          <div className="rounded-sm border border-line bg-surface-2 px-4 py-3 text-[13px]">
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
                {' '}— these columns have nowhere to go, and are left alone.
              </p>
            )}
          </div>
        )}

        {parsed?.rows?.length > 0 && (
          <div className="overflow-x-auto rounded-sm border border-line">
            <Table className="text-[12.5px]">
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
              <p className="border-t border-line px-4 py-2 text-xs text-ink-muted">
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

  const shown = preview || product.picture;

  async function pick(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('That is not a picture. Use a JPG, PNG or WEBP.');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setError('That picture is over 8MB. Most phones can shrink it before sending.');
      return;
    }

    setError('');
    setSaved(false);
    setPreview(URL.createObjectURL(file));
    setBusy(true);

    try {
      const body = new FormData();
      body.append('file', file);
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
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-sm border border-line bg-surface px-3 py-2 text-[13px] font-semibold text-ink-2 transition-colors hover:border-line-firm hover:text-ink">
          <input type="file" accept="image/*" className="sr-only" onChange={pick} disabled={busy} />
          {busy ? 'Uploading…' : shown ? 'Replace picture' : 'Upload a picture'}
        </label>

        <p className={cn('mt-1.5 text-[11.5px]', error ? 'text-bad' : saved ? 'text-ok' : 'text-ink-muted')}>
          {error || (saved ? 'Saved. It shows in the app straight away.' : 'JPG, PNG or WEBP, up to 8MB.')}
        </p>
      </div>
    </div>
  );
}
