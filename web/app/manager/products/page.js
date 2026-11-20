'use client';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { money } from '@/lib/format';
import { Card, Alert, Empty, Modal } from '@/components/ui';

/**
 * The catalogue, as the manager maintains it.
 *
 * Price and stock are edited in place, because those are the two things
 * that change weekly in a hardware shop and nobody should open a form
 * to correct a bag count.
 */
export default function ManagerProducts() {
  const [products, setProducts] = useState(null);
  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    try { setProducts((await api('/api/manager/products')).products); setError(''); }
    catch (e) { setError(e.message); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function save(id, patch, what) {
    try {
      await api(`/api/manager/products/${id}`, { method: 'POST', body: patch });
      setNotice(what);
      setEditing(null);
      load();
    } catch (e) { setError(e.message); }
  }

  const shown = (products || []).filter((p) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return `${p.name} ${p.code} ${p.category_name || ''}`.toLowerCase().includes(q);
  });

  return (
    <>
      <div className="page-head">
        <h1>Products</h1>
        <div className="filters">
          <div className="field">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, code or category"
            />
          </div>
          <button className="btn btn-primary" onClick={() => setAdding(true)}>Add product</button>
        </div>
      </div>

      <Alert>{error}</Alert>
      <Alert kind="ok" onDone={() => setNotice('')}>{notice}</Alert>

      <Card>
        {!products ? (
          <div className="loading">Loading the catalogue…</div>
        ) : shown.length === 0 ? (
          <Empty>Nothing matches.</Empty>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Product</th><th>Code</th><th>Category</th>
                <th className="num">Price</th><th className="num">In stock</th>
                <th className="num">Reorder at</th><th />
              </tr>
            </thead>
            <tbody>
              {shown.map((p) => (
                <tr key={p.id} style={{ opacity: p.active ? 1 : 0.5 }}>
                  <td>{p.name}</td>
                  <td><code>{p.code}</code></td>
                  <td>{p.category_name || '—'}</td>
                  <td className="num">{money(p.price)}</td>
                  <td
                    className="num"
                    style={{ color: p.stock_available <= p.reorder_level ? 'var(--red)' : undefined }}
                  >
                    <strong>{p.stock_available}</strong> {p.unit}
                  </td>
                  <td className="num">{p.reorder_level}</td>
                  <td className="num">
                    <button className="btn btn-ghost" onClick={() => setEditing(p)}>Edit</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <EditProduct
        product={editing}
        onClose={() => setEditing(null)}
        onSave={save}
      />

      <AddProduct
        open={adding}
        onClose={() => setAdding(false)}
        onDone={(msg) => { setAdding(false); setNotice(msg); load(); }}
        onError={setError}
      />
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
    <Modal open title={product.name} onClose={onClose}>
      <div className="field">
        <label htmlFor="pr">Price (UGX)</label>
        <input id="pr" type="number" value={price} onChange={(e) => setPrice(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="st">In stock ({product.unit})</label>
        <input id="st" type="number" value={stock} onChange={(e) => setStock(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="ro">Reorder level</label>
        <input id="ro" type="number" value={reorder} onChange={(e) => setReorder(e.target.value)} />
        <div className="page-meta">Below this, the product shows as low stock on the dashboard.</div>
      </div>
      <div className="btn-row">
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button
          className="btn btn-ghost"
          onClick={() => onSave(product.id, { active: !product.active }, product.active ? 'Retired.' : 'Back on sale.')}
        >
          {product.active ? 'Retire' : 'Put back on sale'}
        </button>
        <button
          className="btn btn-primary"
          onClick={() => onSave(
            product.id,
            { price: Number(price), stockAvailable: Number(stock), reorderLevel: Number(reorder) },
            `${product.name} updated.`
          )}
        >
          Save
        </button>
      </div>
    </Modal>
  );
}

function AddProduct({ open, onClose, onDone, onError }) {
  const [form, setForm] = useState({ name: '', code: '', price: '', stockAvailable: '', unit: 'pc', reorderLevel: '' });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit() {
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
      setForm({ name: '', code: '', price: '', stockAvailable: '', unit: 'pc', reorderLevel: '' });
    } catch (e) { onError(e.message); }
  }

  return (
    <Modal open={open} title="Add a product" onClose={onClose}>
      <div className="field">
        <label htmlFor="nm">Name</label>
        <input id="nm" value={form.name} onChange={set('name')} placeholder="Hima Cement 50kg" />
      </div>
      <div className="field">
        <label htmlFor="cd">Code (SKU)</label>
        <input id="cd" value={form.code} onChange={set('code')} placeholder="AH-CEM-001" />
        <div className="page-meta">This is what the app and the pick list show.</div>
      </div>
      <div className="field">
        <label htmlFor="un">Unit</label>
        <input id="un" value={form.unit} onChange={set('unit')} placeholder="bag, length, tin, pc" />
      </div>
      <div className="field">
        <label htmlFor="pc">Price (UGX)</label>
        <input id="pc" type="number" value={form.price} onChange={set('price')} />
      </div>
      <div className="field">
        <label htmlFor="sq">Opening stock</label>
        <input id="sq" type="number" value={form.stockAvailable} onChange={set('stockAvailable')} />
      </div>
      <div className="field">
        <label htmlFor="rl">Reorder level</label>
        <input id="rl" type="number" value={form.reorderLevel} onChange={set('reorderLevel')} />
      </div>
      <div className="btn-row">
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button
          className="btn btn-primary"
          disabled={!form.name.trim() || !form.code.trim() || !form.price}
          onClick={submit}
        >
          Add product
        </button>
      </div>
    </Modal>
  );
}
