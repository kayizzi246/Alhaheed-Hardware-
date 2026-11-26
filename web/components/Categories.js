'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, upload } from '@/lib/api';
import { list } from '@/lib/format';
import { cn } from '@/lib/cn';
import { shrinkImage } from '@/lib/ocr';
import { confirmAction } from '@/components/Confirm';
import { Alert, Button, Card, Empty, Input, Loading, LoadFailed } from '@/components/ui';

/**
 * Categories and their sub-categories, each with a picture the app
 * shows as a tile: Pipes, then Round pipes, Hollow sections…
 */
export default function Categories() {
  const [tree, setTree] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [newTop, setNewTop] = useState('');

  const load = useCallback(async () => {
    try {
      setTree(list((await api('/api/manager/categories')).categories));
      setError('');
    } catch (e) {
      setError(e.message);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function add(name, parent = 0) {
    if (!name.trim()) return false;
    try {
      const r = await api('/api/manager/categories', { method: 'POST', body: { name: name.trim(), parent } });
      setTree(list(r.categories));
      setNotice(`${name.trim()} added.`);
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    }
  }

  async function rename(c, name, parent) {
    try {
      const r = await api(`/api/manager/categories/${c.id}`, { method: 'POST', body: { name, parent } });
      setTree(list(r.categories));
    } catch (e) {
      setError(e.message);
    }
  }

  async function remove(c) {
    const yes = await confirmAction({
      title: `Delete ${c.name}?`,
      body: 'Only an empty category can be deleted.',
      points: ['Products in it must be moved first.', 'Sub-categories must be deleted or moved first.'],
      confirm: 'Delete',
      cancel: 'Keep it',
    });
    if (!yes) return;
    try {
      const r = await api(`/api/manager/categories/${c.id}/delete`, { method: 'POST', body: {} });
      setTree(list(r.categories));
      setNotice(`${c.name} deleted.`);
    } catch (e) {
      setError(e.message);
    }
  }

  if (!tree) return <Card>{error ? <LoadFailed onRetry={load}>{error}</LoadFailed> : <Loading>Loading categories…</Loading>}</Card>;

  return (
    <div className="space-y-4">
      <Alert>{error}</Alert>
      <Alert kind="ok" onDone={() => setNotice('')}>{notice}</Alert>

      <Card>
        <form
          className="flex flex-wrap items-center gap-3 p-4 sm:p-5"
          onSubmit={async (e) => { e.preventDefault(); if (await add(newTop)) setNewTop(''); }}
        >
          <Input value={newTop} onChange={(e) => setNewTop(e.target.value)} placeholder="New main category, e.g. Roofing" className="min-w-[220px] flex-1" />
          <Button type="submit" disabled={!newTop.trim()}>Add main category</Button>
        </form>
      </Card>

      {!tree.length ? (
        <Card><Empty title="No categories yet">Add one above.</Empty></Card>
      ) : (
        tree.map((c) => (
          <Card key={c.id}>
            <div className="flex flex-wrap items-center gap-4 border-b border-line p-4 sm:p-5">
              <Picture category={c} size="lg" onSaved={load} onError={setError} />
              <div className="min-w-[160px] flex-1">
                <Name category={c} onSave={(name) => rename(c, name, c.parent)} big />
                <p className="text-[12.5px] text-ink-muted">{c.products} {c.products === 1 ? 'product' : 'products'} directly · {c.children.length} sub-{c.children.length === 1 ? 'category' : 'categories'}</p>
              </div>
              <Button variant="ghost" size="sm" className="text-bad hover:bg-bad-bg" onClick={() => remove(c)}>Delete</Button>
            </div>
            <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-3">
              {c.children.map((s) => (
                <div key={s.id} className="flex items-center gap-3 rounded-xl border border-line p-3">
                  <Picture category={s} onSaved={load} onError={setError} />
                  <div className="min-w-0 flex-1">
                    <Name category={s} onSave={(name) => rename(s, name, c.id)} />
                    <p className="text-[12px] text-ink-muted">{s.products} {s.products === 1 ? 'product' : 'products'}</p>
                  </div>
                  <button type="button" onClick={() => remove(s)} className="text-[12.5px] font-semibold text-bad hover:underline">Delete</button>
                </div>
              ))}
              <AddSub onAdd={(name) => add(name, c.id)} parent={c.name} />
            </div>
          </Card>
        ))
      )}
    </div>
  );
}

function AddSub({ onAdd, parent }) {
  const [name, setName] = useState('');
  return (
    <form
      className="flex items-center gap-2 rounded-xl border border-dashed border-line p-3"
      onSubmit={async (e) => { e.preventDefault(); if (await onAdd(name)) setName(''); }}
    >
      <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={`New sub-category of ${parent}`} className="min-w-0 flex-1" />
      <Button type="submit" size="sm" disabled={!name.trim()}>Add</Button>
    </form>
  );
}

/** Click the name to rename it. */
function Name({ category, onSave, big }) {
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState(category.name);
  if (editing) {
    return (
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); setEditing(false); if (v.trim() && v.trim() !== category.name) onSave(v.trim()); }}>
        <Input value={v} onChange={(e) => setV(e.target.value)} autoFocus className="min-w-0 flex-1" />
        <Button type="submit" size="sm">Save</Button>
      </form>
    );
  }
  return (
    <button type="button" onClick={() => setEditing(true)} title="Rename" className={cn('text-left font-bold text-ink hover:text-brand', big ? 'text-[17px]' : 'text-[14px]')}>
      {category.name}
    </button>
  );
}

/** The category's picture: tap to add or replace. Shrunk before sending, so it is quick. */
function Picture({ category, size, onSaved, onError }) {
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(null);
  const shown = preview || category.picture;
  const box = size === 'lg' ? 'size-20' : 'size-14';

  async function pick(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) { onError('That is not a picture. Use a JPG, PNG or WEBP.'); return; }
    setPreview(URL.createObjectURL(file));
    setBusy(true);
    try {
      const small = await shrinkImage(file, 900);
      const body = new FormData();
      body.append('file', small, small.name || 'category.jpg');
      await upload(`/api/manager/categories/${category.id}/image`, body);
      onSaved();
    } catch (err) {
      onError(err.message);
      setPreview(null);
    }
    setBusy(false);
  }

  return (
    <label className={cn('relative grid shrink-0 cursor-pointer place-items-center overflow-hidden rounded-xl border border-line bg-surface-sunk text-center', box)} title="Add or replace the picture">
      {shown ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={shown} alt="" className={cn('size-full object-cover', busy && 'opacity-50')} />
      ) : (
        <span className="px-1 text-[11px] font-semibold leading-tight text-ink-muted">Add picture</span>
      )}
      {busy && <span className="absolute inset-0 grid place-items-center text-[11px] font-bold text-ink">Saving…</span>}
      <input type="file" accept="image/*" className="sr-only" onChange={pick} />
    </label>
  );
}
