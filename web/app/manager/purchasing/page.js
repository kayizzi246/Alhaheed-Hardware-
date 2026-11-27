'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { confirmAction } from '@/components/Confirm';
import { money, list, today } from '@/lib/format';
import { cn } from '@/lib/cn';
import {
  Alert, Button, Card, CardHead, CardTitle, Chip, Empty, Field, Input, Loading, LoadFailed, Modal,
  PageHead, Segmented, Select, Table, TableWrap, Td, Textarea, Th, Tr } from '@/components/ui';

const STATUS = {
  open: ['Ordered', 'info'],
  partial: ['Part delivered', 'pending'],
  received: ['All delivered', 'good'],
  closed: ['Closed', 'grey'],
  cancelled: ['Cancelled', 'grey'],
};

function Match({ m }) {
  if (!m) return null;
  if (m.state === 'matches') return <Chip tone="good">Bill is correct</Chip>;
  if (m.state === 'over_billed') return <Chip tone="bad">Bill is {money(m.diff)} too much</Chip>;
  if (m.state === 'under_billed') return <Chip tone="pending">Bill is {money(-m.diff)} less</Chip>;
  return <Chip tone="grey">No bill yet</Chip>;
}

/**
 * Buying from suppliers: order, receive what arrives, check the bill
 * against what arrived, pay, and send back what is wrong.
 */
export default function Purchasing() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('orders');
  const [products, setProducts] = useState([]);
  const [dialog, setDialog] = useState(null); // { kind, ... }
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    try {
      setData(await api('/api/manager/purchasing'));
      setError('');
    } catch (e) {
      setError(e.message);
    }
  }, []);
  useEffect(() => { load(); }, [load]);
  const [listed, setListed] = useState([]);
  useEffect(() => {
    api('/api/manager/products').then((r) => setProducts(list(r.products).filter((p) => p.active))).catch(() => {});
    api('/api/suppliers').then((r) => setListed(list(r.suppliers).filter((x) => x.active !== false).map((x) => x.name))).catch(() => {});
  }, []);
  // One list for every drop-down: the Suppliers page first, then any
  // other name already used on an order or a product.
  const suppliers = useMemo(() => [...new Set([
    ...listed,
    ...list(data?.suppliers),
    ...products.map((p) => p.supplier).filter(Boolean),
  ].map((x) => String(x).trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b)), [listed, data, products]);

  const done = (msg) => { setDialog(null); setNotice(msg); load(); };
  const owed = list(data?.balances).reduce((s, b) => s + b.owed, 0);
  const overdue = list(data?.balances).reduce((s, b) => s + b.overdue, 0);

  return (
    <>
      <PageHead title="Buying" sub="Order from suppliers. Pay only for what came.">
        <Button variant="outline" onClick={() => setDialog({ kind: 'return' })}>Send goods back</Button>
        <Button variant="outline" onClick={() => setDialog({ kind: 'bill' })}>Record a bill</Button>
        <Button onClick={() => setDialog({ kind: 'po' })}>New purchase order</Button>
      </PageHead>
      <Alert>{error}</Alert>
      <Alert kind="ok" onDone={() => setNotice('')}>{notice}</Alert>

      {data && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ['Orders still coming', list(data.orders).filter((o) => ['open', 'partial'].includes(o.status)).length],
            ['Owed to suppliers', money(owed)],
            ['Overdue', money(overdue), overdue > 0 ? 'text-bad' : ''],
            ['Came with no order', data.receivedNoPo, data.receivedNoPo ? 'text-warn' : ''],
          ].map(([k, v, c]) => (
            <div key={k} className="rounded-xl border border-line bg-surface px-4 py-3">
              <p className="text-[11.5px] text-ink-muted">{k}</p>
              <p className={cn('tnum text-[16px] font-bold text-ink', c)}>{v}</p>
            </div>
          ))}
        </div>
      )}

      <Segmented
        label="Show"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'orders', label: 'Orders' },
          { value: 'bills', label: 'Bills & money owed' },
          { value: 'returns', label: 'Returns' },
        ]}
      />

      <Card>
        {!data ? (
          error ? <LoadFailed onRetry={load}>{error}</LoadFailed> : <Loading>Loading…</Loading>
        ) : tab === 'orders' ? (
          !list(data.orders).length ? (
            <Empty title="No purchase orders yet" action={<Button onClick={() => setDialog({ kind: 'po' })}>New purchase order</Button>}>
              Order from a supplier here, then receive against it when the goods arrive.
            </Empty>
          ) : (
            <TableWrap>
              <Table>
                <thead><tr><Th>Order</Th><Th>Supplier</Th><Th>Status</Th><Th num>Ordered</Th><Th num>Delivered</Th><Th num>Billed</Th><Th>Check</Th></tr></thead>
                <tbody>
                  {list(data.orders).map((o) => (
                    <Tr key={o.id} className="cursor-pointer" onClick={() => setDialog({ kind: 'show', id: o.id })}>
                      <Td className="tnum font-semibold text-brand">{o.poNo}<span className="block text-[11.5px] font-normal text-ink-muted">{o.createdAt?.slice(0, 10)}</span></Td>
                      <Td className="font-medium text-ink">{o.supplier}</Td>
                      <Td><Chip tone={(STATUS[o.status] || [])[1] || 'grey'}>{(STATUS[o.status] || [o.status])[0]}</Chip></Td>
                      <Td num>{money(o.ordered)}</Td>
                      <Td num>{money(o.received)}</Td>
                      <Td num>{o.billed ? money(o.billed) : ''}</Td>
                      <Td><Match m={o.match} /></Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          )
        ) : tab === 'bills' ? (
          <>
            <CardHead><CardTitle>What we owe each supplier</CardTitle></CardHead>
            {!list(data.balances).length ? (
              <Empty title="No bills yet">Record a supplier&rsquo;s invoice when it comes in.</Empty>
            ) : (
              <TableWrap>
                <Table>
                  <thead><tr><Th>Supplier</Th><Th num>Billed</Th><Th num>Credits</Th><Th num>Paid</Th><Th num>Owed</Th><Th num>Overdue</Th></tr></thead>
                  <tbody>
                    {list(data.balances).map((b) => (
                      <Tr key={b.supplier}>
                        <Td className="font-semibold text-ink">{b.supplier}</Td>
                        <Td num>{money(b.billed)}</Td>
                        <Td num className="text-ok">{b.credits ? money(b.credits) : ''}</Td>
                        <Td num>{money(b.paid)}</Td>
                        <Td num className="font-bold text-ink">{money(b.owed)}</Td>
                        <Td num className={cn(b.overdue > 0 && 'font-semibold text-bad')}>{b.overdue ? money(b.overdue) : ''}</Td>
                      </Tr>
                    ))}
                  </tbody>
                </Table>
              </TableWrap>
            )}
            <CardHead><CardTitle>Bills and credit notes</CardTitle></CardHead>
            {!!list(data.bills).length && (
              <TableWrap>
                <Table>
                  <thead><tr><Th>Date</Th><Th>Supplier</Th><Th>Invoice</Th><Th num>Amount</Th><Th num>Owed</Th><Th>Check</Th><Th /></tr></thead>
                  <tbody>
                    {list(data.bills).map((b) => (
                      <Tr key={b.id}>
                        <Td className="tnum whitespace-nowrap text-ink-muted">{b.date}{b.dueDate && <span className={cn('block text-[11.5px]', b.overdue && 'font-semibold text-bad')}>due {b.dueDate}</span>}</Td>
                        <Td className="font-medium text-ink">{b.supplier}</Td>
                        <Td>{b.kind === 'credit' ? <Chip tone="good">Credit</Chip> : b.invoiceNo}{b.poNo && <span className="block text-[11.5px] text-ink-muted">{b.poNo}</span>}{b.kind === 'credit' && <span className="block text-[11.5px] text-ink-muted">{b.note}</span>}</Td>
                        <Td num className={cn(b.amount < 0 && 'text-ok')}>{money(b.amount)}</Td>
                        <Td num className="font-semibold text-ink">{b.kind === 'bill' ? money(b.owed) : ''}</Td>
                        <Td>{b.kind === 'bill' && (b.poId ? <Match m={b.match} /> : <Chip tone="pending">No purchase order</Chip>)}</Td>
                        <Td>
                          <div className="flex justify-end gap-2">
                            {b.kind === 'bill' && b.owed > 0 && <Button size="sm" onClick={() => setDialog({ kind: 'pay', bill: b })}>Pay</Button>}
                            {b.kind === 'bill' && b.paid === 0 && (
                              <Button size="sm" variant="outline" className="text-bad" onClick={async () => {
                                if (!(await confirmAction({ title: `Delete invoice ${b.invoiceNo}?`, body: `From ${b.supplier}, for ${money(b.amount)}. Only for a bill typed by mistake.`, points: ['Nothing has been paid on it.', 'The Audit Trail keeps a record that it was deleted.'], confirm: 'Delete the bill', cancel: 'Keep it' }))) return;
                                try { await api(`/api/manager/supplier-bills/${b.id}/delete`, { method: 'POST', body: {} }); done(`Invoice ${b.invoiceNo} deleted.`); } catch (e) { setError(e.message); }
                              }}>Delete</Button>
                            )}
                          </div>
                        </Td>
                      </Tr>
                    ))}
                  </tbody>
                </Table>
              </TableWrap>
            )}
          </>
        ) : !list(data.returns).length ? (
          <Empty title="Nothing sent back" action={<Button onClick={() => setDialog({ kind: 'return' })}>Send goods back</Button>}>
            Wrong or damaged goods go back to the supplier here, with a credit note.
          </Empty>
        ) : (
          <TableWrap>
            <Table>
              <thead><tr><Th>Date</Th><Th>Item</Th><Th num>Qty</Th><Th>Supplier</Th><Th>Why</Th><Th num>Credit</Th><Th>By</Th></tr></thead>
              <tbody>
                {list(data.returns).map((r) => (
                  <Tr key={r.id}>
                    <Td className="tnum text-ink-muted">{r.day}</Td>
                    <Td className="font-semibold text-ink">{r.name}</Td>
                    <Td num>{r.qty}</Td>
                    <Td>{r.supplier}{r.ref && <span className="block text-[11.5px] text-ink-muted">{r.ref}</span>}</Td>
                    <Td className="text-ink-2">{r.note}</Td>
                    <Td num className="text-ok">{money(r.qty * r.unit_cost)}</Td>
                    <Td className="text-ink-muted">{r.user_name}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </Card>

      {dialog?.kind === 'po' && <NewPo suppliers={suppliers} products={products} onClose={() => setDialog(null)} onDone={done} />}
      {dialog?.kind === 'show' && <ShowPo id={dialog.id} onClose={() => { setDialog(null); load(); }} onBill={(po) => setDialog({ kind: 'bill', po })} />}
      {dialog?.kind === 'bill' && <NewBill po={dialog.po} suppliers={suppliers} orders={list(data?.orders)} onClose={() => setDialog(null)} onDone={done} />}
      {dialog?.kind === 'pay' && <PayBill bill={dialog.bill} onClose={() => setDialog(null)} onDone={done} />}
      {dialog?.kind === 'return' && <ReturnGoods suppliers={suppliers} products={products} onClose={() => setDialog(null)} onDone={done} />}
    </>
  );
}

function SupplierField({ suppliers, value, onChange }) {
  return (
    <Select value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{suppliers.length ? 'Choose the supplier' : 'Add suppliers on the Suppliers page first'}</option>
      {suppliers.map((s) => <option key={s} value={s}>{s}</option>)}
    </Select>
  );
}

/** The items this supplier sends: named on the product, or last bought from them. */
const fromSupplier = (products, name) => {
  const n = name.trim().toLowerCase();
  return products.filter((p) =>
    (p.supplier || '').trim().toLowerCase() === n || (p.last_buy?.supplier || '').trim().toLowerCase() === n);
};

function ProductPick({ products, value, onChange }) {
  const [q, setQ] = useState('');
  const shown = useMemo(() => {
    const w = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return products.filter((p) => w.every((x) => `${p.name} ${p.code}`.toLowerCase().includes(x))).slice(0, 60);
  }, [products, q]);
  const chosen = products.find((p) => p.id === value);
  return (
    <div className="space-y-1.5">
      <Input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={chosen ? chosen.name : 'Find the item by name or code'} />
      <Select value={value || ''} onChange={(e) => onChange(Number(e.target.value) || null)}>
        <option value="">{shown.length ? 'Choose the item' : 'Nothing matches'}</option>
        {(chosen && !shown.includes(chosen) ? [chosen, ...shown] : shown).map((p) => <option key={p.id} value={p.id}>{p.name} · {p.code}</option>)}
      </Select>
    </div>
  );
}

function NewPo({ suppliers, products, onClose, onDone }) {
  const [supplier, setSupplier] = useState('');
  const [expected, setExpected] = useState('');
  const [note, setNote] = useState('');
  const [lines, setLines] = useState([{ productId: null, qty: '', unitCost: '' }]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (i, k, v) => setLines((ls) => ls.map((l, n) => (n === i ? { ...l, [k]: v } : l)));
  const total = lines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.unitCost) || 0), 0);
  // Lines left without a quantity are skipped, so a supplier's whole
  // list can sit there and only what is needed gets ordered.
  const wanted = lines.filter((l) => l.productId && Number(l.qty) > 0);
  const ok = supplier && wanted.length && wanted.every((l) => Number(l.unitCost) > 0);
  const [auto, setAuto] = useState(0);

  function pickSupplier(name) {
    setSupplier(name);
    const theirs = fromSupplier(products, name);
    setAuto(theirs.length);
    if (!theirs.length) return;
    setLines(theirs
      .sort((a, b) => (a.state === 'out' ? 0 : a.state === 'low' ? 1 : 2) - (b.state === 'out' ? 0 : b.state === 'low' ? 1 : 2) || a.name.localeCompare(b.name))
      .map((p) => {
        const low = p.state === 'out' || p.state === 'low';
        // What is running low gets a suggested quantity; the rest waits.
        const suggest = low ? Math.max(p.reorder_qty || 0, (p.reorder_level || 0) * 2 - Math.max(0, p.stock_available || 0)) : 0;
        return { productId: p.id, auto: true, qty: suggest > 0 ? String(suggest) : '', unitCost: String(p.last_buy?.cost || p.cost || '') };
      }));
  }

  async function save() {
    setBusy(true);
    setError('');
    try {
      const r = await api('/api/manager/purchase-orders', { method: 'POST', body: { supplier, expectedOn: expected, note, lines: wanted.map((l) => ({ productId: l.productId, qty: Number(l.qty), unitCost: Number(l.unitCost) })) } });
      onDone(`${r.po.poNo} saved for ${supplier}: ${money(r.po.ordered)}.`);
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }

  return (
    <Modal wide title="New purchase order" description="What you are asking the supplier for, at the agreed price." onClose={onClose}
      footer={<><span className="mr-auto self-center text-[13px] font-semibold text-ink">Total {money(total)}</span><Button variant="outline" onClick={onClose}>Cancel</Button><Button disabled={!ok || busy} onClick={save}>{busy ? 'Saving…' : 'Save the order'}</Button></>}>
      <div className="space-y-4">
        <Alert>{error}</Alert>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Supplier"><SupplierField suppliers={suppliers} value={supplier} onChange={pickSupplier} /></Field>
          <Field label="Expected on (optional)"><Input type="date" value={expected} onChange={(e) => setExpected(e.target.value)} /></Field>
        </div>
        {supplier && (
          <p className="rounded-lg bg-surface-2 px-3 py-2 text-[12.5px] text-ink-2">
            {auto
              ? <>{auto} {auto === 1 ? 'item comes' : 'items come'} from {supplier}. Items running low already have a number. Type how many of the others you want; <b>leave it empty to skip it</b>.</>
              : <>No items are linked to {supplier} yet. Choose them below. Next time they fill in by themselves.</>}
          </p>
        )}
        {lines.some((l) => l.auto) && (
          <div className="overflow-hidden rounded-xl border border-line">
            <div className="grid grid-cols-[minmax(0,1fr)_96px_130px_28px] gap-2 border-b border-line bg-surface-2 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-ink-muted">
              <span>Item</span><span className="text-right">How many</span><span className="text-right">Price for one</span><span />
            </div>
            <ul className="max-h-[46vh] divide-y divide-line overflow-y-auto">
              {lines.map((l, i) => {
                if (!l.auto) return null;
                const p = products.find((x) => x.id === l.productId);
                return (
                  <li key={l.productId} className={cn('grid grid-cols-[minmax(0,1fr)_96px_130px_28px] items-center gap-2 px-3 py-1.5', Number(l.qty) > 0 && 'bg-brand-soft/40')}>
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-semibold text-ink">{p?.name}</span>
                      <span className="text-[11px] text-ink-muted">
                        {p?.code} · {p ? `${p.stock_available} ${p.unit} left` : ''}
                        {p && (p.state === 'out' || p.state === 'low') && <b className="ml-1 text-warn">{p.state === 'out' ? 'Out' : 'Low'}</b>}
                      </span>
                    </span>
                    <Input type="number" min="0" step="any" inputMode="decimal" value={l.qty} placeholder="0" onChange={(e) => set(i, 'qty', e.target.value)} className="tnum h-8 text-right" />
                    <Input type="number" min="1" inputMode="numeric" value={l.unitCost} onChange={(e) => set(i, 'unitCost', e.target.value)} className="tnum h-8 text-right" />
                    <button type="button" aria-label="Remove" onClick={() => setLines((ls) => ls.filter((_, n) => n !== i))} className="text-[16px] leading-none text-ink-faint hover:text-bad">×</button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        {lines.map((l, i) => l.auto ? null : (
          <div key={i} className={cn('grid gap-3 rounded-xl border p-3 sm:grid-cols-[minmax(0,1fr)_110px_150px_auto]', Number(l.qty) > 0 ? 'border-brand/40 bg-brand-soft/30' : 'border-line')}>
            <Field label="Item">
              <ProductPick products={products} value={l.productId} onChange={(id) => { set(i, 'productId', id); const p = products.find((x) => x.id === id); if (p?.cost && !l.unitCost) set(i, 'unitCost', String(p.cost)); }} />
            </Field>
            <Field label="Quantity"><Input type="number" min="0" step="any" inputMode="decimal" value={l.qty} onChange={(e) => set(i, 'qty', e.target.value)} className="tnum" /></Field>
            <Field label="Price for one (UGX)"><Input type="number" min="1" inputMode="numeric" value={l.unitCost} onChange={(e) => set(i, 'unitCost', e.target.value)} className="tnum" /></Field>
            <div className="flex items-end">
              <Button variant="ghost" className="text-bad" disabled={lines.length === 1 && !auto} onClick={() => setLines((ls) => ls.filter((_, n) => n !== i))}>Remove</Button>
            </div>
          </div>
        ))}
        <Button variant="outline" onClick={() => setLines((ls) => [...ls, { productId: null, qty: '', unitCost: '' }])}>Add another item</Button>
        <Field label="Note (optional)"><Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
      </div>
    </Modal>
  );
}

function ShowPo({ id, onClose, onBill }) {
  const [po, setPo] = useState(null);
  const [error, setError] = useState('');
  const [fdn, setFdn] = useState('');
  const [date, setDate] = useState(today());
  const [qty, setQty] = useState({});
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api(`/api/manager/purchase-orders/${id}`).then((r) => { setPo(r.po); setQty({}); }).catch((e) => setError(e.message));
  }, [id]);
  useEffect(load, [load]);

  const open = po && ['open', 'partial'].includes(po.status);
  const typed = Object.entries(qty).filter(([, v]) => Number(v) > 0);

  async function receive() {
    setBusy(true);
    setError('');
    try {
      const r = await api(`/api/manager/purchase-orders/${id}/receive`, { method: 'POST', body: { fdn, date, lines: typed.map(([lineId, v]) => ({ lineId: Number(lineId), qty: Number(v) })) } });
      setPo({ ...r.po });
      setQty({});
      setFdn('');
    } catch (e) {
      setError(e.message);
    }
    setBusy(false);
  }

  async function remove() {
    if (!(await confirmAction({ title: `Delete ${po.poNo}?`, body: `The order to ${po.supplier}. Only for an order typed by mistake.`, points: ['Nothing has been received or billed on it.', 'The Audit Trail keeps a record that it was deleted.'], confirm: 'Delete the order', cancel: 'Keep it' }))) return;
    setBusy(true);
    try {
      await api(`/api/manager/purchase-orders/${id}/delete`, { method: 'POST', body: {} });
      onClose();
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }

  async function close() {
    if (!(await confirmAction({ title: 'Close this order?', body: 'Nothing more is coming from the supplier on it.', points: ['What was not delivered will not be owed.', 'What did arrive stays in stock and in the books.'], confirm: 'Close the order', cancel: 'Keep it open', tone: 'ask' }))) return;
    setBusy(true);
    try {
      const r = await api(`/api/manager/purchase-orders/${id}/close`, { method: 'POST', body: { reason: 'Closed by the manager' } });
      setPo(r.po);
    } catch (e) {
      setError(e.message);
    }
    setBusy(false);
  }

  return (
    <Modal wide title={po ? `${po.poNo} · ${po.supplier}` : 'Purchase order'} description={po ? `${(STATUS[po.status] || [po.status])[0]} · ordered by ${po.createdBy}` : ''} onClose={onClose}
      footer={po && <>
        {po.received === 0 && po.billed === 0 && <Button variant="ghost" className="mr-auto text-bad hover:bg-bad-bg" disabled={busy} onClick={remove}>Delete</Button>}
        {open && <Button variant="ghost" className={po.received === 0 && po.billed === 0 ? '' : 'mr-auto'} disabled={busy} onClick={close}>Close the order</Button>}
        <Button variant="outline" onClick={() => onBill(po)}>Record the supplier&rsquo;s bill</Button>
        {open && <Button disabled={busy || !fdn.trim() || !typed.length} onClick={receive}>{busy ? 'Saving…' : 'Receive into stock'}</Button>}
      </>}>
      {!po ? (error ? <Alert>{error}</Alert> : <Loading>Opening…</Loading>) : (
        <div className="space-y-4">
          <Alert>{error}</Alert>
          <div className="flex flex-wrap items-center gap-2 text-[12.5px]">
            <span>Ordered <b>{money(po.ordered)}</b></span>·<span>Delivered <b>{money(po.received)}</b></span>·<span>Billed <b>{money(po.billed)}</b></span><Match m={po.match} />
          </div>
          {open && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Delivery note (FDN) no."><Input value={fdn} onChange={(e) => setFdn(e.target.value)} placeholder="FDN 10422" /></Field>
              <Field label="Delivery date"><Input type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} /></Field>
            </div>
          )}
          <TableWrap className="rounded-xl border border-line">
            <Table>
              <thead><tr><Th>Item</Th><Th num>Ordered</Th><Th num>Delivered</Th><Th num>Still to come</Th><Th num>Price</Th>{open && <Th num>Arrived now</Th>}</tr></thead>
              <tbody>
                {po.lines.map((l) => (
                  <Tr key={l.id}>
                    <Td className="font-semibold text-ink">{l.name}</Td>
                    <Td num>{l.ordered} {l.unit}</Td>
                    <Td num>{l.received}</Td>
                    <Td num className={cn(l.outstanding > 0 && 'font-semibold text-warn')}>{l.outstanding || ''}</Td>
                    <Td num>{money(l.unitCost)}</Td>
                    {open && (
                      <Td num>
                        {l.outstanding > 0 && (
                          <Input type="number" min="0" step="any" max={l.outstanding} inputMode="decimal" value={qty[l.id] ?? ''} onChange={(e) => setQty((q) => ({ ...q, [l.id]: e.target.value }))} placeholder={String(l.outstanding)} className="tnum ml-auto w-[90px] text-right" aria-label={`${l.name} arrived now`} />
                        )}
                      </Td>
                    )}
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
          {!!list(po.deliveries).length && (
            <div>
              <h3 className="mb-1 text-[11.5px] font-bold uppercase tracking-[0.06em] text-ink-muted">Deliveries</h3>
              <ul className="space-y-0.5 text-[12px] text-ink-2">
                {po.deliveries.map((d) => <li key={d.id}>{d.day} · {d.ref} · {d.qty} {d.name} · {d.user_name}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

function NewBill({ po, suppliers, orders, onClose, onDone }) {
  const [poId, setPoId] = useState(po?.id || '');
  const [supplier, setSupplier] = useState(po?.supplier || '');
  const [invoiceNo, setInvoiceNo] = useState('');
  const [billDate, setBillDate] = useState(today());
  const [dueDate, setDueDate] = useState('');
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const chosen = orders.find((o) => o.id === Number(poId));
  const diff = chosen && Number(amount) ? Number(amount) - chosen.received : null;

  async function save() {
    setBusy(true);
    setError('');
    try {
      await api('/api/manager/supplier-bills', { method: 'POST', body: { poId: Number(poId) || 0, supplier, invoiceNo, billDate, dueDate, amount: Number(amount) } });
      onDone(`Invoice ${invoiceNo} recorded.`);
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }

  return (
    <Modal title="Record a supplier's bill" description="Their invoice. It is checked against what actually arrived." onClose={onClose}
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button disabled={busy || !(supplier || poId) || !invoiceNo.trim() || !(Number(amount) > 0)} onClick={save}>{busy ? 'Saving…' : 'Record the bill'}</Button></>}>
      <div className="space-y-4">
        <Alert>{error}</Alert>
        <Field label="For purchase order">
          <Select value={poId} onChange={(e) => { setPoId(e.target.value); const o = orders.find((x) => x.id === Number(e.target.value)); if (o) setSupplier(o.supplier); }}>
            <option value="">No purchase order</option>
            {orders.filter((o) => o.status !== 'cancelled').map((o) => <option key={o.id} value={o.id}>{o.poNo} · {o.supplier} · delivered {money(o.received)}</option>)}
          </Select>
        </Field>
        {!poId && <Field label="Supplier"><SupplierField suppliers={suppliers} value={supplier} onChange={setSupplier} /></Field>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Their invoice no."><Input value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} /></Field>
          <Field label="Amount on the invoice (UGX)"><Input type="number" min="1" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} className="tnum" /></Field>
          <Field label="Invoice date"><Input type="date" value={billDate} max={today()} onChange={(e) => setBillDate(e.target.value)} /></Field>
          <Field label="Pay by (optional)"><Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></Field>
        </div>
        {diff !== null && diff !== 0 && (
          <p className={cn('rounded-sm px-3 py-2 text-[12px]', diff > 0 ? 'bg-bad-bg text-bad' : 'bg-warn-bg text-warn')}>
            {diff > 0 ? `This bill is ${money(diff)} more than the goods that arrived. Pay only for what came.` : `This bill is ${money(-diff)} less than the goods that arrived.`}
          </p>
        )}
      </div>
    </Modal>
  );
}

function PayBill({ bill, onClose, onDone }) {
  const [amount, setAmount] = useState(String(bill.owed));
  const [method, setMethod] = useState('bank');
  const [ref, setRef] = useState('');
  const [date, setDate] = useState(today());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const overPay = bill.match?.state === 'over_billed';

  async function save() {
    setBusy(true);
    setError('');
    try {
      await api(`/api/manager/supplier-bills/${bill.id}/pay`, { method: 'POST', body: { amount: Number(amount), method, ref, date } });
      onDone(`${money(Number(amount))} paid to ${bill.supplier}.`);
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }

  return (
    <Modal title={`Pay ${bill.supplier}`} description={`Invoice ${bill.invoiceNo} · ${money(bill.owed)} owed`} onClose={onClose}
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button disabled={busy || !(Number(amount) > 0) || (method !== 'cash' && !ref.trim())} onClick={save}>{busy ? 'Saving…' : 'Record the payment'}</Button></>}>
      <div className="space-y-4">
        <Alert>{error}</Alert>
        {overPay && <p className="rounded-sm bg-bad-bg px-3 py-2 text-[12px] text-bad">This bill charges {money(bill.match.diff)} more than was delivered. Pay only for what came.</p>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Amount (UGX)"><Input type="number" min="1" max={bill.owed} value={amount} onChange={(e) => setAmount(e.target.value)} className="tnum" /></Field>
          <Field label="Date paid"><Input type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label="How">
            <Select value={method} onChange={(e) => setMethod(e.target.value)}>
              <option value="bank">Bank transfer</option><option value="cheque">Cheque</option><option value="mtn_momo">MTN Mobile Money</option><option value="airtel_money">Airtel Money</option><option value="cash">Cash</option>
            </Select>
          </Field>
          <Field label={method === 'cheque' ? 'Cheque no.' : 'Transaction ID'}><Input value={ref} onChange={(e) => setRef(e.target.value)} placeholder={method === 'cash' ? 'Not needed for cash' : ''} /></Field>
        </div>
      </div>
    </Modal>
  );
}

function ReturnGoods({ suppliers, products, onClose, onDone }) {
  const [productId, setProductId] = useState(null);
  const [qty, setQty] = useState('');
  const [supplier, setSupplier] = useState('');
  const [ref, setRef] = useState('');
  const [reason, setReason] = useState('');
  const [date, setDate] = useState(today());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const p = products.find((x) => x.id === productId);

  async function save() {
    setBusy(true);
    setError('');
    try {
      const r = await api('/api/manager/supplier-returns', { method: 'POST', body: { productId, qty: Number(qty), supplier, ref, reason, date } });
      onDone(`${qty} ${p?.name} sent back to ${supplier}. Credit of ${money(r.credit)} recorded.`);
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }

  return (
    <Modal title="Send goods back to a supplier" description="Comes out of the stock book, and a credit note goes against the supplier." onClose={onClose}
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button disabled={busy || !productId || !(Number(qty) > 0) || !supplier || reason.trim().length < 3} onClick={save}>{busy ? 'Saving…' : 'Send back'}</Button></>}>
      <div className="space-y-4">
        <Alert>{error}</Alert>
        <Field label="Item"><ProductPick products={products} value={productId} onChange={setProductId} /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={`How many${p ? ` ${p.unit}` : ''}`} hint={p ? `${p.stock_available ?? 0} in stock` : undefined}><Input type="number" min="0" step="any" inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} className="tnum" /></Field>
          <Field label="Date"><Input type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label="Supplier"><SupplierField suppliers={suppliers} value={supplier} onChange={setSupplier} /></Field>
          <Field label="Return note no. (optional)"><Input value={ref} onChange={(e) => setRef(e.target.value)} /></Field>
        </div>
        <Field label="Why it is going back"><Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Wrong gauge delivered" /></Field>
      </div>
    </Modal>
  );
}
