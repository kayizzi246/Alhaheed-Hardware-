'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { money, list, today, dateTime } from '@/lib/format';
import { cn } from '@/lib/cn';
import {
  Alert, Button, Card, CardHead, CardTitle, Chip, Empty, Field, Input, Loading, LoadFailed, Modal,
  PageHead, Select, Table, TableWrap, Td, Th, Tr } from '@/components/ui';

const signed = (n) => (n > 0 ? `+${n}` : `${n}`);

/**
 * Counting the shelf against the book.
 *
 * Start a count for a day, type what is on the shelf item by item (the
 * book figure is taken as each line is saved), then approve. Nothing
 * changes in the stock book until it is approved; then every difference
 * is posted as a "stock count" adjustment on the day of the count.
 */
export default function StockTake() {
  const [counts, setCounts] = useState(null);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(null);
  const [starting, setStarting] = useState(false);
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    try {
      const r = await api('/api/manager/stocktakes');
      setCounts(list(r.counts));
      setError('');
    } catch (e) {
      setError(e.message);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  if (open) {
    return (
      <CountSheet
        id={open}
        onBack={(msg) => { setOpen(null); if (msg) setNotice(msg); load(); }}
      />
    );
  }

  const draft = (counts || []).find((c) => c.status === 'draft');

  return (
    <>
      <PageHead title="Stock-take" sub="Count the shelf. Approved differences go into the stock book.">
        {draft
          ? <Button onClick={() => setOpen(draft.id)}>Carry on counting</Button>
          : <Button onClick={() => setStarting(true)}>Start a count</Button>}
      </PageHead>
      <Alert>{error}</Alert>
      <Alert kind="ok" onDone={() => setNotice('')}>{notice}</Alert>

      <Card>
        {!counts ? (
          error ? <LoadFailed onRetry={load}>{error}</LoadFailed> : <Loading>Loading the counts…</Loading>
        ) : !counts.length ? (
          <Empty title="No counts yet" action={<Button onClick={() => setStarting(true)}>Start a count</Button>}>
            The book says what should be on the shelf. A count says what is.
          </Empty>
        ) : (
          <TableWrap>
            <Table>
              <thead>
                <tr><Th>Date</Th><Th>Status</Th><Th num>Items counted</Th><Th num>Differ</Th><Th num>Short</Th><Th num>Over</Th><Th num>Net</Th><Th>By</Th></tr>
              </thead>
              <tbody>
                {counts.map((c) => (
                  <Tr key={c.id} className="cursor-pointer" onClick={() => setOpen(c.id)}>
                    <Td className="tnum font-semibold text-ink">{c.date}</Td>
                    <Td><Chip tone={c.status === 'approved' ? 'good' : 'pending'}>{c.status === 'approved' ? 'Approved' : 'Draft'}</Chip></Td>
                    <Td num>{c.counted}</Td>
                    <Td num>{c.differ}</Td>
                    <Td num className="text-bad">{c.shortValue ? money(c.shortValue) : ''}</Td>
                    <Td num className="text-ok">{c.overValue ? money(c.overValue) : ''}</Td>
                    <Td num className={cn('font-semibold', c.netValue < 0 ? 'text-bad' : 'text-ink')}>{money(c.netValue)}</Td>
                    <Td className="text-ink-muted">{c.approvedBy ? `${c.createdBy}, approved by ${c.approvedBy}` : c.createdBy}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </Card>

      {starting && (
        <StartCount
          onClose={() => setStarting(false)}
          onDone={(id) => { setStarting(false); setOpen(id); }}
        />
      )}
    </>
  );
}

function StartCount({ onClose, onDone }) {
  const [date, setDate] = useState(today());
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function go() {
    setBusy(true);
    setError('');
    try {
      const r = await api('/api/manager/stocktakes/start', { method: 'POST', body: { date, note } });
      onDone(r.count.id);
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Start a count"
      description="Pick the day the shelf is counted. You can count everything or just some items."
      onClose={onClose}
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button disabled={busy || !date} onClick={go}>{busy ? 'Starting…' : 'Start'}</Button></>}
    >
      <div className="space-y-4">
        <Alert>{error}</Alert>
        <Field label="Day of the count"><Input type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label="Note (optional)"><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="End of month, plates store" /></Field>
      </div>
    </Modal>
  );
}

function CountSheet({ id, onBack }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [typed, setTyped] = useState({}); // productId -> string, not yet saved
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [only, setOnly] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);

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
  const cats = useMemo(() => [...new Set(items.map((i) => i.category).filter(Boolean))].sort(), [items]);
  const draft = data?.count.status === 'draft';
  const dirty = Object.keys(typed).length;

  const shown = items.filter((i) => {
    if (cat && i.category !== cat) return false;
    if (only === 'counted' && i.counted === null) return false;
    if (only === 'differ' && !i.variance) return false;
    if (only === 'todo' && i.counted !== null) return false;
    const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return words.every((w) => `${i.name} ${i.code}`.toLowerCase().includes(w));
  });

  async function save() {
    setBusy(true);
    setError('');
    try {
      const lines = Object.entries(typed).map(([productId, v]) => ({ productId: Number(productId), counted: v.trim() === '' ? null : v.trim() }));
      const r = await api(`/api/manager/stocktakes/${id}/lines`, { method: 'POST', body: { lines } });
      setData(r);
      setTyped({});
    } catch (e) {
      setError(e.message);
    }
    setBusy(false);
  }

  async function approve() {
    setBusy(true);
    setError('');
    try {
      const r = await api(`/api/manager/stocktakes/${id}/approve`, { method: 'POST', body: {} });
      onBack(`Count approved. ${r.posted} ${r.posted === 1 ? 'difference' : 'differences'} posted to the stock book.`);
    } catch (e) {
      setError(e.message);
      setBusy(false);
      setConfirm(false);
    }
  }

  async function discard() {
    setBusy(true);
    try {
      await api(`/api/manager/stocktakes/${id}/delete`, { method: 'POST', body: {} });
      onBack('The draft count was deleted. The stock book is unchanged.');
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }

  if (!data) {
    return (
      <>
        <PageHead title="Stock-take" />
        <Card>{error ? <LoadFailed onRetry={load}>{error}</LoadFailed> : <Loading>Opening the count…</Loading>}</Card>
      </>
    );
  }

  const c = data.count;
  return (
    <>
      <PageHead title={`Count of ${c.date}`} sub={draft ? 'Type what is on the shelf. Save as you go.' : `Approved by ${c.approvedBy}, ${dateTime(c.approvedAt)}`}>
        <Button variant="outline" onClick={() => onBack()}>All counts</Button>
        {draft && <Button variant="outline" disabled={busy || !dirty} onClick={save}>{busy && dirty ? 'Saving…' : dirty ? `Save ${dirty}` : 'Saved'}</Button>}
        {draft && <Button disabled={busy || dirty > 0 || !c.counted} onClick={() => setConfirm(true)}>Approve and post</Button>}
      </PageHead>
      <Alert>{error}</Alert>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ['Counted', `${c.counted} of ${items.length}`],
          ['Differ', c.differ],
          ['Short, at cost', money(c.shortValue)],
          ['Net difference', money(c.netValue)],
        ].map(([k, v]) => (
          <div key={k} className="rounded-xl border border-line bg-surface px-4 py-3">
            <p className="text-[12px] text-ink-muted">{k}</p>
            <p className={cn('tnum text-[17px] font-bold', k === 'Net difference' && c.netValue < 0 ? 'text-bad' : 'text-ink')}>{v}</p>
          </div>
        ))}
      </div>

      <Card>
        <div className="flex flex-wrap items-end gap-3 border-b border-line px-4 py-3 sm:px-5">
          <Field label="Find" className="min-w-[200px] flex-1">
            <Input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name or code" />
          </Field>
          <Field label="Category" className="w-full sm:w-[200px]">
            <Select value={cat} onChange={(e) => setCat(e.target.value)}>
              <option value="">All</option>
              {cats.map((x) => <option key={x} value={x}>{x}</option>)}
            </Select>
          </Field>
          <Field label="Show" className="w-full sm:w-[200px]">
            <Select value={only} onChange={(e) => setOnly(e.target.value)}>
              <option value="">Everything</option>
              <option value="todo">Not counted yet</option>
              <option value="counted">Counted</option>
              <option value="differ">Differ from the book</option>
            </Select>
          </Field>
        </div>
        {!shown.length ? (
          <Empty title="Nothing matches">Try another search or filter.</Empty>
        ) : (
          <TableWrap>
            <Table>
              <thead>
                <tr><Th>Item</Th><Th num>Book</Th><Th num>Counted</Th><Th num>Difference</Th><Th num>Value</Th></tr>
              </thead>
              <tbody>
                {shown.map((i) => {
                  const v = typed[i.id] ?? (i.counted === null ? '' : String(i.counted));
                  const book = i.bookAtCount ?? i.bookNow ?? 0;
                  const diff = v === '' ? null : Number(v) - (typed[i.id] !== undefined ? (i.bookNow ?? 0) : book);
                  return (
                    <Tr key={i.id}>
                      <Td>
                        <span className="block font-semibold text-ink">{i.name}</span>
                        <span className="block text-xs text-ink-muted">{[i.code, i.category].filter(Boolean).join(' · ')}</span>
                      </Td>
                      <Td num className="text-ink-2">{typed[i.id] !== undefined ? i.bookNow : book} {i.unit}</Td>
                      <Td num>
                        {draft ? (
                          <Input
                            type="number"
                            inputMode="numeric"
                            min="0"
                            value={v}
                            onChange={(e) => setTyped((t) => ({ ...t, [i.id]: e.target.value }))}
                            aria-label={`Counted ${i.name}`}
                            className="tnum ml-auto w-[96px] text-right"
                          />
                        ) : (
                          <span className="font-semibold">{i.counted ?? ''}</span>
                        )}
                      </Td>
                      <Td num className={cn('font-bold', diff < 0 ? 'text-bad' : diff > 0 ? 'text-ok' : 'text-ink-muted')}>
                        {diff === null ? '' : diff === 0 ? 'Agrees' : signed(diff)}
                      </Td>
                      <Td num className={cn(diff < 0 ? 'text-bad' : 'text-ink-2')}>
                        {diff ? money(diff * (i.cost || 0)) : ''}
                      </Td>
                    </Tr>
                  );
                })}
              </tbody>
            </Table>
          </TableWrap>
        )}
        {draft && (
          <div className="flex justify-end border-t border-line px-4 py-3 sm:px-5">
            <Button variant="ghost" className="text-bad hover:bg-bad-bg hover:text-bad" disabled={busy} onClick={discard}>Delete this draft</Button>
          </div>
        )}
      </Card>

      {confirm && (
        <Modal
          title="Approve this count?"
          description={`Count of ${c.date}`}
          onClose={() => setConfirm(false)}
          footer={<><Button variant="outline" onClick={() => setConfirm(false)}>Not yet</Button><Button disabled={busy} onClick={approve}>{busy ? 'Posting…' : 'Approve and post'}</Button></>}
        >
          <p className="text-[13.5px] leading-relaxed text-ink">
            {c.differ} {c.differ === 1 ? 'item differs' : 'items differ'} from the book, {money(c.netValue)} at cost.
            Each difference goes into the stock book as a &ldquo;stock count&rdquo; adjustment dated {c.date}, and the count can no longer be changed.
          </p>
        </Modal>
      )}
    </>
  );
}
