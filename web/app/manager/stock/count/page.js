'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { confirmAction } from '@/components/Confirm';
import { money, list, today } from '@/lib/format';
import { cn } from '@/lib/cn';
import {
  Alert, Button, Card, CardHead, CardTitle, Chip, Empty, Field, Input, Loading, LoadFailed, Modal,
  PageHead, Table, TableWrap, Td, Th, Tr } from '@/components/ui';

const nice = (d) => (d ? new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' }) : '');

/** "2 short", "1 extra", "Matches", in words anyone reads at a glance. */
const q = (n) => String(Math.round(n * 100) / 100);

function verdict(diff, unit, cost) {
  if (diff === null || diff === undefined) return { text: 'Not counted yet', tone: 'text-ink-faint' };
  diff = Math.round(diff * 100) / 100;
  if (diff === 0) return { text: 'Same as system', tone: 'text-ok' };
  const v = cost ? ` · ${money(Math.abs(diff) * cost)}` : '';
  return diff < 0
    ? { text: `${q(-diff)} ${unit} short${v}`, tone: 'text-bad' }
    : { text: `${q(diff)} ${unit} extra${v}`, tone: 'text-warn' };
}

function Steps({ at }) {
  const steps = ['Count', 'Check', 'Approve'];
  return (
    <ol className="flex flex-wrap gap-2">
      {steps.map((s, i) => (
        <li
          key={s}
          className={cn(
            'flex items-center gap-2 rounded-full border px-3 py-1.5 text-[12px] font-semibold',
            i === at ? 'border-fill bg-fill text-on-fill' : i < at ? 'border-ok/30 bg-ok-bg text-ok' : 'border-line text-ink-muted'
          )}
        >
          <span className="grid size-5 place-items-center rounded-full bg-black/10 text-[11px]">{i < at ? '✓' : i + 1}</span>
          {s}
        </li>
      ))}
    </ol>
  );
}

/**
 * Counting the shelf, made simple.
 *
 *   1. Start: one button.
 *   2. Count: pick a category, type what is on the shelf for each item,
 *      or press "Matches" when it agrees with the book. Every number
 *      saves itself; Enter jumps to the next item.
 *   3. Check: only the items that differ, in plain words.
 *   4. Approve: the stock book is set to what was counted.
 */
export default function StockTake() {
  const [counts, setCounts] = useState(null);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(null);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [otherDay, setOtherDay] = useState(false);
  const [date, setDate] = useState(today());
  const [note, setNote] = useState('');

  const load = useCallback(async () => {
    try {
      const r = await api('/api/manager/stocktakes');
      const all = list(r.counts);
      setCounts(all);
      setError('');
      // A count in progress opens straight away: no hunting for it.
      const draft = all.find((c) => c.status === 'draft');
      if (draft) setOpen((o) => o ?? draft.id);
    } catch (e) {
      setError(e.message);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function start() {
    setBusy(true);
    setError('');
    try {
      const r = await api('/api/manager/stocktakes/start', { method: 'POST', body: { date, note } });
      setOpen(r.count.id);
    } catch (e) {
      setError(e.message);
    }
    setBusy(false);
  }

  if (open) {
    return <CountScreen id={open} onLeave={(msg) => { setOpen(null); if (msg) setNotice(msg); load(); }} />;
  }

  return (
    <>
      <PageHead title="Count stock" sub="Count what is on the shelf." />
      <Alert>{error}</Alert>
      <Alert kind="ok" onDone={() => setNotice('')}>{notice}</Alert>

      <Card>
        <div className="space-y-5 p-5 sm:p-7">
          <div>
            <h2 className="text-[18px] font-extrabold text-ink">Count the shelf</h2>
            <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-ink-2">
              Walk the shop. Type how many of each item you see.
              The system shows what is missing or extra. Nothing changes until you press Approve.
            </p>
          </div>
          <ol className="grid gap-3 sm:grid-cols-3">
            {[
              ['1', 'Count', 'Type the number on the shelf.'],
              ['2', 'Check', 'See only what is missing or extra.'],
              ['3', 'Approve', 'The stock is changed to your count.'],
            ].map(([n, t, d]) => (
              <li key={n} className="rounded-xl border border-line bg-surface-2 p-4">
                <span className="grid size-7 place-items-center rounded-full bg-fill text-[12px] font-bold text-on-fill">{n}</span>
                <p className="mt-2 font-bold text-ink">{t}</p>
                <p className="mt-1 text-[12px] leading-relaxed text-ink-2">{d}</p>
              </li>
            ))}
          </ol>
          <div className="flex flex-wrap items-end gap-3">
            <Button size="lg" disabled={busy} onClick={start}>{busy ? 'Starting…' : otherDay ? `Start counting for ${nice(date)}` : 'Start counting today'}</Button>
            <Field label="Note (optional)" className="min-w-[220px]">
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Month-end count, plates store" />
            </Field>
            {otherDay ? (
              <Field label="Day of the count"><Input type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} /></Field>
            ) : (
              <button type="button" onClick={() => setOtherDay(true)} className="pb-2 text-[12px] font-semibold text-brand hover:underline">
                Counting for an earlier day?
              </button>
            )}
          </div>
        </div>
      </Card>

      <Card>
        <CardHead><CardTitle>Past counts</CardTitle></CardHead>
        {!counts ? (
          error ? <LoadFailed onRetry={load}>{error}</LoadFailed> : <Loading>Loading…</Loading>
        ) : !counts.length ? (
          <Empty title="No counts yet">Your first count shows here once it is approved.</Empty>
        ) : (
          <TableWrap>
            <Table>
              <thead><tr><Th>Day</Th><Th>Status</Th><Th num>Items counted</Th><Th num>Differ</Th><Th num>Missing (value)</Th><Th>Approved by</Th></tr></thead>
              <tbody>
                {counts.map((c) => (
                  <Tr key={c.id} className="cursor-pointer" onClick={() => setOpen(c.id)}>
                    <Td className="font-semibold text-ink">{nice(c.date)}</Td>
                    <Td><Chip tone={c.status === 'approved' ? 'good' : 'pending'}>{c.status === 'approved' ? 'Approved' : 'Still counting'}</Chip></Td>
                    <Td num>{c.counted}</Td>
                    <Td num>{c.differ}</Td>
                    <Td num className={cn(c.shortValue < 0 && 'font-semibold text-bad')}>{c.shortValue ? money(-c.shortValue) : ''}</Td>
                    <Td className="text-ink-muted">{c.approvedBy}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </Card>
    </>
  );
}

function CountScreen({ id, onLeave }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [typed, setTyped] = useState({});      // productId -> text not saved yet
  const [saving, setSaving] = useState(false);
  const [cat, setCat] = useState('');
  const [q, setQ] = useState('');
  const [view, setView] = useState('count');   // count | check
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const timer = useRef(null);
  const pending = useRef({});
  const inputs = useRef({});
  const [filled, setFilled] = useState('');

  const load = useCallback(async () => {
    try {
      setData(await api(`/api/manager/stocktakes/${id}`));
      setError('');
    } catch (e) {
      setError(e.message);
    }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const items = list(data?.items);
  const draft = data?.count.status === 'draft';
  const cats = useMemo(() => {
    const m = {};
    for (const i of items) {
      const k = i.category || 'Other';
      m[k] = m[k] || { all: 0, done: 0 };
      m[k].all++;
      if (i.counted !== null) m[k].done++;
    }
    return Object.entries(m).sort((a, b) => a[0].localeCompare(b[0]));
  }, [items]);

  // Each number saves itself shortly after it is typed.
  const flush = useCallback(async () => {
    const lines = Object.entries(pending.current).map(([productId, v]) => ({ productId: Number(productId), counted: v === '' ? null : v }));
    if (!lines.length) return;
    pending.current = {};
    setSaving(true);
    try {
      const r = await api(`/api/manager/stocktakes/${id}/lines`, { method: 'POST', body: { lines } });
      setData(r);
      setTyped((t) => {
        const next = { ...t };
        for (const l of lines) delete next[l.productId];
        return next;
      });
      setError('');
    } catch (e) {
      setError(`Not saved: ${e.message}`);
    }
    setSaving(false);
  }, [id]);

  function put(productId, value) {
    setTyped((t) => ({ ...t, [productId]: value }));
    pending.current[productId] = value;
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, 700);
  }

  useEffect(() => () => clearTimeout(timer.current), []);

  const shown = items.filter((i) => {
    if (cat && (i.category || 'Other') !== cat) return false;
    const w = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return w.every((x) => `${i.name} ${i.code}`.toLowerCase().includes(x));
  });
  const differ = items.filter((i) => i.variance);
  const c = data?.count;
  const counted = c?.counted || 0;

  async function fillFromSheet(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError('');
    setSaving(true);
    try {
      const { readSheet } = await import('@/lib/sheet');
      const parsed = await readSheet(file);
      const byCode = new Map(items.map((i) => [String(i.code).trim().toLowerCase(), i]));
      const lines = [];
      const missing = [];
      for (const row of parsed.rows) {
        const item = byCode.get(String(row.code || '').trim().toLowerCase());
        const n = row.stock === '' || row.stock === undefined ? null : Number(row.stock);
        if (!item) { missing.push(row.code); continue; }
        if (n === null || Number.isNaN(n)) continue;
        lines.push({ productId: item.id, counted: Math.max(0, Math.round(n * 100) / 100) });
      }
      if (!lines.length) throw new Error('No rows matched an item. The sheet needs a Code (or SKU) column and a Counted column.');
      const r = await api(`/api/manager/stocktakes/${id}/lines`, { method: 'POST', body: { lines } });
      setData(r);
      setFilled(`${lines.length} items filled from ${file.name}.${missing.length ? ` ${missing.length} codes did not match an item: ${missing.slice(0, 8).join(', ')}${missing.length > 8 ? '…' : ''}` : ''} Check them, then approve.`);
    } catch (err) {
      setError(err.message);
    }
    setSaving(false);
  }

  async function approve() {
    setBusy(true);
    await flush();
    try {
      const r = await api(`/api/manager/stocktakes/${id}/approve`, { method: 'POST', body: {} });
      onLeave(`Count approved. ${r.posted} ${r.posted === 1 ? 'item was' : 'items were'} corrected in the stock book.`);
    } catch (e) {
      setError(e.message);
      setBusy(false);
      setConfirm(false);
    }
  }

  // An approved count already changed the stock: deleting it puts it back.
  async function deleteApproved() {
    const yes = await confirmAction({
      title: 'Delete this count?',
      body: 'The stock goes back to what it was before this count.',
      points: ['History keeps a record of the count and the delete.', 'You cannot undo this.'],
      confirm: 'Delete the count',
      cancel: 'Keep it',
    });
    if (!yes) return;
    setBusy(true);
    try {
      const r = await api(`/api/manager/stocktakes/${id}/delete`, { method: 'POST', body: {} });
      onLeave(`Count deleted. ${r.undone} ${r.undone === 1 ? 'item was' : 'items were'} put back.`);
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }

  async function discard() {
    const yes = await confirmAction({
      title: 'Delete this count?',
      body: 'Use this for a count started by mistake.',
      points: ['Every number typed in it is thrown away.', 'The stock book does not change.'],
      confirm: 'Delete the count',
      cancel: 'Keep counting',
    });
    if (!yes) return;
    setBusy(true);
    try {
      await api(`/api/manager/stocktakes/${id}/delete`, { method: 'POST', body: {} });
      onLeave('The count was deleted. The stock book is unchanged.');
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }

  if (!data) {
    return (
      <>
        <PageHead title="Count stock" />
        <Card>{error ? <LoadFailed onRetry={load}>{error}</LoadFailed> : <Loading>Opening the count…</Loading>}</Card>
      </>
    );
  }

  // ── Approved: what it found, read only ─────────────────────────────
  if (!draft) {
    return (
      <>
        <PageHead title={`Count of ${nice(c.date)}`} sub={`Approved by ${c.approvedBy}. The stock was changed to this count.`}>
          <Button variant="outline" onClick={() => onLeave()}>Back</Button>
          <Button variant="danger" disabled={busy} onClick={deleteApproved}>Delete</Button>
        </PageHead>
        <Summary c={c} total={items.length} />
        <Differences items={differ} />
      </>
    );
  }

  return (
    <>
      <PageHead title={`Counting · ${nice(c.date)}`} sub={saving ? 'Saving…' : 'Saved by itself.'}>
        <Button variant="outline" onClick={() => onLeave()}>Finish later</Button>
      </PageHead>
      <Steps at={view === 'count' ? 0 : 1} />
      <Alert>{error}</Alert>
      <Alert kind="ok" onDone={() => setFilled('')}>{filled}</Alert>

      {view === 'count' ? (
        <>
          <Card>
            <div className="space-y-3 p-4 sm:p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-[13.5px] font-bold text-ink">{counted} of {items.length} items counted</p>
                <p className="text-[12px] text-ink-muted">{differ.length ? `${differ.length} not the same` : 'All the same so far'}</p>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-surface-sunk">
                <div className="h-full rounded-full bg-fill transition-[width] duration-300" style={{ width: `${items.length ? (counted / items.length) * 100 : 0}%` }} />
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <CatChip on={!cat} onClick={() => setCat('')} label="Everything" sub={`${counted}/${items.length}`} />
                {cats.map(([k, v]) => (
                  <CatChip key={k} on={cat === k} onClick={() => setCat(k)} label={k} sub={`${v.done}/${v.all}`} done={v.done === v.all} />
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <Input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find an item by name or code" className="min-w-[200px] flex-1" />
                <label className="inline-flex h-11 cursor-pointer items-center rounded-sm border border-line bg-surface px-4 text-[12.5px] font-semibold text-ink hover:bg-surface-2">
                  Fill from a spreadsheet
                  <input type="file" accept=".xlsx,.xls,.csv" className="sr-only" onChange={fillFromSheet} />
                </label>
              </div>
              <p className="text-[12px] text-ink-muted">Have a spreadsheet? It needs a <b>Code</b> column and a <b>Counted</b> column.</p>
            </div>
          </Card>

          <Card>
            {!shown.length ? (
              <Empty title="Nothing here">Try another category or search.</Empty>
            ) : (
              <ul className="divide-y divide-line">
                {shown.map((i, n) => {
                  const unsaved = typed[i.id] !== undefined;
                  const v = unsaved ? typed[i.id] : i.counted === null ? '' : String(i.counted);
                  const book = unsaved || i.bookAtCount === null ? i.bookNow ?? 0 : i.bookAtCount;
                  const diff = v === '' ? null : Number(v) - book;
                  const say = verdict(diff, i.unit, i.cost);
                  return (
                    <li key={i.id} className={cn('flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5', diff === 0 && 'bg-ok-bg/40', diff && diff < 0 && 'bg-bad-bg/40')}>
                      <div className="min-w-[180px] flex-1">
                        <p className="font-semibold text-ink">{i.name}</p>
                        <p className="text-[12px] text-ink-muted">{i.code} · system says <b className="text-ink-2">{book} {i.unit}</b></p>
                        <p className={cn('text-[12px] font-semibold', say.tone)}>{unsaved ? 'Saving…' : say.text}</p>
                      </div>
                      <Input
                        ref={(el) => { inputs.current[n] = el; }}
                        type="number"
                        inputMode="decimal"
                        step="any"
                        min="0"
                        value={v}
                        onChange={(e) => put(i.id, e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); inputs.current[n + 1]?.focus(); } }}
                        aria-label={`How many ${i.name} are on the shelf`}
                        placeholder="On shelf"
                        className="tnum w-[110px] text-center text-[15px] font-bold"
                      />
                      {v !== '' && (
                        <button type="button" onClick={() => put(i.id, '')} className="text-[12px] font-semibold text-bad hover:underline" aria-label={`Clear the count for ${i.name}`}>
                          Clear
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <div className="sticky bottom-0 z-20 -mx-4 flex flex-wrap items-center justify-between gap-3 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-xl sm:border">
            <span className="text-[12.5px] text-ink-2">{counted} counted · {differ.length} differ</span>
            <div className="flex gap-2">
              <Button variant="ghost" className="text-bad hover:bg-bad-bg" disabled={busy} onClick={discard}>Delete this count</Button>
              <Button disabled={!counted || saving} onClick={async () => { await flush(); setView('check'); }}>Next: check</Button>
            </div>
          </div>
        </>
      ) : (
        <>
          <Summary c={c} total={items.length} />
          <Differences items={differ} />
          <div className="flex flex-wrap justify-between gap-2">
            <Button variant="outline" onClick={() => setView('count')}>Back to counting</Button>
            <Button size="lg" disabled={busy} onClick={() => setConfirm(true)}>Approve</Button>
          </div>
        </>
      )}

      {confirm && (
        <Modal
          title="Approve this count?"
          onClose={() => setConfirm(false)}
          footer={<><Button variant="outline" onClick={() => setConfirm(false)}>Not yet</Button><Button disabled={busy} onClick={approve}>{busy ? 'Updating the stock book…' : 'Yes, approve'}</Button></>}
        >
          <div className="space-y-2 text-[13px] leading-relaxed text-ink">
            <p>The stock book will be set to what you counted for the <b>{counted}</b> items you counted. Items you did not count stay as they are.</p>
            {differ.length ? (
              <p><b>{differ.length}</b> {differ.length === 1 ? 'item differs' : 'items differ'}. Shortages ({money(-c.shortValue)}) show as losses on Stock control.</p>
            ) : (
              <p>Everything you counted matches the book.</p>
            )}
            <p className="text-ink-muted">After this the count cannot be changed.</p>
          </div>
        </Modal>
      )}
    </>
  );
}

function CatChip({ on, onClick, label, sub, done }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-colors',
        on ? 'border-fill bg-fill text-on-fill' : done ? 'border-ok/30 bg-ok-bg text-ok' : 'border-line bg-surface text-ink-2 hover:bg-surface-2'
      )}
    >
      {label} <span className="tnum font-normal opacity-80">{sub}</span>
    </button>
  );
}

function Summary({ c, total }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {[
        ['Items counted', `${c.counted} of ${total}`, ''],
        ['Not the same', c.differ, c.differ ? 'text-warn' : 'text-ok'],
        ['Missing (value)', money(-c.shortValue), c.shortValue ? 'text-bad' : ''],
        ['Extra (value)', money(c.overValue), ''],
      ].map(([k, v, tone]) => (
        <div key={k} className="rounded-xl border border-line bg-surface px-4 py-3">
          <p className="text-[11.5px] text-ink-muted">{k}</p>
          <p className={cn('tnum text-[16px] font-bold text-ink', tone)}>{v}</p>
        </div>
      ))}
    </div>
  );
}

function Differences({ items }) {
  return (
    <Card>
      <CardHead><CardTitle>Not the same as the system</CardTitle></CardHead>
      {!items.length ? (
        <Empty title="Everything matches">Every item you counted agrees with the stock book.</Empty>
      ) : (
        <TableWrap>
          <Table>
            <thead><tr><Th>Item</Th><Th num>System said</Th><Th num>Counted</Th><Th>Result</Th><Th num>Value</Th></tr></thead>
            <tbody>
              {items.map((i) => {
                const say = verdict(i.variance, i.unit, 0);
                return (
                  <Tr key={i.id}>
                    <Td><span className="block font-semibold text-ink">{i.name}</span><span className="block text-[11.5px] text-ink-muted">{i.code}</span></Td>
                    <Td num>{i.bookAtCount}</Td>
                    <Td num className="font-bold text-ink">{i.counted}</Td>
                    <Td className={cn('font-semibold', say.tone)}>{say.text}</Td>
                    <Td num className={cn('font-semibold', i.varianceValue < 0 ? 'text-bad' : 'text-warn')}>{i.varianceValue ? money(i.varianceValue) : <span className="font-normal text-ink-muted">no buy price</span>}</Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
        </TableWrap>
      )}
    </Card>
  );
}
