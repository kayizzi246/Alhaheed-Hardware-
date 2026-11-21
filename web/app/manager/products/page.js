'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { money, list } from '@/lib/format';
import { cn } from '@/lib/cn';
import {
  Alert, Button, Card, Empty, Field, Input, Loading, Modal, PageHead,
  Table, TableWrap, Td, Th, Tr,
} from '@/components/ui';

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
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    try {
      setProducts(list((await api('/api/manager/products')).products));
      setError('');
    } catch (e) {
      setProducts([]);
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
        <Button onClick={() => setAdding(true)}>Add product</Button>
      </PageHead>

      <Alert>{error}</Alert>
      <Alert kind="ok" onDone={() => setNotice('')}>{notice}</Alert>

      <Card>
        {!products ? (
          <Loading>Loading the catalogue…</Loading>
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
                      <Td className="text-ink-muted">{p.category_name || '—'}</Td>
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
      description="For a long list, use Import products in WordPress instead."
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
