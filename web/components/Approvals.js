'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { money, list } from '@/lib/format';
import { cn } from '@/lib/cn';
import { Icon } from '@/components/icons';
import {
  Alert, Button, Card, CardHead, CardTitle, Checkbox, Empty, Field, Input, Loading, Modal, PageHead,
  Segmented, Stat, Table, TableWrap, Td, Th, Tr,
} from '@/components/ui';

/**
 * Owner approval.
 *
 * A cashier's sale on loan waits here until the owner (or someone the
 * owner trusts up to an amount) says yes or no. Nobody decides their own
 * request. The owner also sets, per employee, who may sell on loan, how
 * much they may finish without asking, and how much they may approve.
 */

const when = (s) => (s ? new Date(s.replace(' ', 'T')).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');
const day = (d) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
const KIND = { credit_sale: 'Sale on loan', supplier_payment: 'Supplier payment' };
const STATUS = {
  pending: ['Waiting', 'bg-warn-bg text-warn'],
  approved: ['Approved', 'bg-ok-bg text-ok'],
  rejected: ['Refused', 'bg-bad-bg text-bad'],
  withdrawn: ['Paid another way', 'bg-surface-sunk text-ink-muted'],
};
const Pill = ({ s }) => {
  const [l, t] = STATUS[s] || [s, 'bg-surface-sunk text-ink-muted'];
  return <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-bold', t)}>{l}</span>;
};

export default function Approvals() {
  const [tab, setTab] = useState('pending');
  const [d, setD] = useState(null);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [refusing, setRefusing] = useState(null);
  const [busy, setBusy] = useState(0);

  const load = useCallback(async () => {
    try {
      setD(await api(`/api/approvals?status=${tab}`));
      setError('');
    } catch (e) {
      setError(/no route/i.test(e.message) ? 'This page needs the new plugin. Upload the zip to the website first.' : e.message);
    }
  }, [tab]);
  useEffect(() => { setD(null); load(); }, [load]);

  async function decide(a, approve, why = '') {
    setBusy(a.id);
    setError('');
    try {
      const r = await api(`/api/approvals/${a.id}/decide`, { method: 'POST', body: { approve, note: why } });
      setNote(approve
        ? `Approved: ${money(a.amount)} for ${a.partyName}.${r.approval.receipt ? ` Receipt ${r.approval.receipt}.` : ''}`
        : `Refused: ${a.partyName}. ${a.requestedBy} has been told.`);
      setRefusing(null);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(0);
    }
  }

  const c = d?.counts || {};
  const n = (k) => c[k]?.count || 0;

  return (
    <>
      <PageHead title="Owner approval" sub="Loans and big supplier payments wait here for your yes or no." />
      <Alert>{error}</Alert>
      {note && <Alert kind="ok" onDone={() => setNote('')}>{note}</Alert>}

      <div className="mb-3 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <Stat hero label="Waiting for you" value={String(n('pending'))} note={money(c.pending?.amount || 0)} icon={Icon.clock()} />
        <Stat label="Approved" value={String(n('approved'))} note={money(c.approved?.amount || 0)} tone="ok" icon={Icon.check()} />
        <Stat label="Refused" value={String(n('rejected'))} note={money(c.rejected?.amount || 0)} tone={n('rejected') ? 'bad' : 'neutral'} icon={Icon.close()} />
        <Stat label="Paid another way" value={String(n('withdrawn'))} note="request no longer needed" tone="neutral" icon={Icon.cash()} />
      </div>

      <div className="mb-3">
        <Segmented
          label="Show"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'pending', label: `Waiting (${n('pending')})` },
            { value: 'approved', label: `Approved (${n('approved')})` },
            { value: 'rejected', label: `Refused (${n('rejected')})` },
            { value: 'all', label: 'All' },
          ]}
        />
      </div>

      {!d && !error && <Card><Loading /></Card>}
      {d && !d.approvals.length && (
        <Card><Empty title={tab === 'pending' ? 'Nothing waiting' : 'Nothing here'}>{tab === 'pending' ? 'When a cashier sells on loan, it comes here for you to decide.' : 'Try another tab.'}</Empty></Card>
      )}
      <div className="grid gap-3 xl:grid-cols-2">
        {list(d?.approvals).map((a) => (
          <Request key={a.id} a={a} busy={busy === a.id} onApprove={() => decide(a, true)} onRefuse={() => setRefusing(a)} />
        ))}
      </div>

      {d?.owner && <Rules />}

      {refusing && <Refuse a={refusing} busy={busy === refusing.id} onClose={() => setRefusing(null)} onDone={(why) => decide(refusing, false, why)} />}
    </>
  );
}

function Request({ a, busy, onApprove, onRefuse }) {
  const cu = a.customer;
  const over = cu && cu.after > cu.limit;
  return (
    <Card className={cn(a.status === 'pending' && 'ring-1 ring-warn/30')}>
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-2.5">
        <span className="rounded-full bg-surface-sunk px-2 py-0.5 text-[11px] font-semibold text-ink-muted">{KIND[a.kind] || a.kind}</span>
        <b className="text-[14px] text-ink">{a.partyName}</b>
        {a.orderNo && <span className="text-[12px] text-ink-muted">{a.orderNo}</span>}
        <span className="ml-auto"><Pill s={a.status} /></span>
      </div>
      <div className="space-y-3 p-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <span className="block text-[11.5px] text-ink-muted">{a.kind === 'credit_sale' ? 'To go on the loan' : 'To pay'}</span>
            <b className="tnum font-display text-[24px] font-extrabold text-ink">{money(a.amount)}</b>
            {a.kind === 'credit_sale' && a.paidNow > 0 && (
              <span className="block text-[12px] text-ink-2">Order {money(a.total)} · {money(a.paidNow)} paid now</span>
            )}
          </div>
          <div className="text-right text-[12px] text-ink-muted">
            Asked by <b className="text-ink">{a.requestedBy}</b><br />{when(a.requestedAt)}
          </div>
        </div>

        {cu && (
          <>
            <div className="grid grid-cols-2 gap-2 rounded-lg bg-surface-2 p-3 text-[12px] sm:grid-cols-4">
              <div><span className="block text-ink-muted">Owes now</span><b className="tnum text-[14px] text-ink">{money(cu.owed)}</b></div>
              <div><span className="block text-ink-muted">Limit</span><b className="tnum text-[14px] text-ink">{money(cu.limit)}</b></div>
              <div><span className="block text-ink-muted">Late</span><b className={cn('tnum text-[14px]', cu.overdue ? 'text-bad' : 'text-ok')}>{cu.overdue ? money(cu.overdue) : 'Nothing'}</b></div>
              <div><span className="block text-ink-muted">After this</span><b className={cn('tnum text-[14px]', over ? 'text-bad' : 'text-ink')}>{money(cu.after)}</b></div>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-line">
              <div className={cn('h-full rounded-full', over ? 'bg-bad' : cu.after > cu.limit * 0.8 ? 'bg-warn' : 'bg-[#92D050]')} style={{ width: `${Math.min(100, cu.limit ? (cu.after / cu.limit) * 100 : 100)}%` }} />
            </div>
            {(over || cu.overdue > 0) && (
              <p className="rounded-lg bg-bad-bg px-3 py-2 text-[12.5px] font-semibold text-bad">
                {[over && `This goes ${money(cu.after - cu.limit)} over the limit.`, cu.overdue > 0 && `${money(cu.overdue)} is already late (oldest bill ${cu.oldestDays} days).`].filter(Boolean).join(' ')}
              </p>
            )}
            <div>
              <p className="mb-1 text-[12px] font-semibold text-ink-2">How they have paid · {money(a.paidIn90 || 0)} paid in the last 90 days</p>
              {!list(a.history).length ? <p className="text-[12px] text-ink-muted">No loan payments or sales yet.</p> : (
                <ul className="divide-y divide-line rounded-lg border border-line text-[12px]">
                  {a.history.map((l) => (
                    <li key={l.id} className="flex justify-between gap-3 px-3 py-1.5">
                      <span className="text-ink-2">{day(l.date)} · {l.what}{l.ref ? ` · ${l.ref}` : ''}</span>
                      <b className={cn('tnum', l.credit ? 'text-ok' : 'text-ink')}>{l.credit ? `-${money(l.credit)}` : `+${money(l.debit)}`}</b>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
        {a.kind === 'supplier_payment' && (
          <p className="text-[12.5px] text-ink-2">By {a.method}{a.ref ? ` · ${a.ref}` : ''}</p>
        )}

        {a.status !== 'pending' && (
          <p className="rounded-lg bg-surface-2 px-3 py-2 text-[12.5px] text-ink-2">
            {a.status === 'withdrawn' ? 'The customer paid another way.' : `${a.status === 'approved' ? 'Approved' : 'Refused'} by ${a.decidedBy}, ${when(a.decidedAt)}.`}
            {a.note ? ` “${a.note}”` : ''}{a.receipt ? ` Receipt ${a.receipt}.` : ''}
          </p>
        )}

        {a.status === 'pending' && (a.canDecide ? (
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" disabled={busy} onClick={onRefuse}>Refuse</Button>
            <Button className="flex-[2]" disabled={busy} onClick={onApprove}>{busy ? 'Saving…' : `Approve ${money(a.amount)}`}</Button>
          </div>
        ) : (
          <p className="text-[12px] text-ink-muted">{a.mine ? 'You asked for this. The owner decides it.' : 'Above what you may approve. The owner decides it.'}</p>
        ))}
      </div>
    </Card>
  );
}

function Refuse({ a, busy, onClose, onDone }) {
  const [why, setWhy] = useState('');
  return (
    <Modal
      title={`Refuse ${a.partyName}?`}
      description={`${money(a.amount)} asked by ${a.requestedBy}. They read your reason.`}
      onClose={onClose}
      footer={<><Button variant="outline" onClick={onClose}>Back</Button><Button disabled={busy || why.trim().length < 3} onClick={() => onDone(why.trim())}>{busy ? 'Saving…' : 'Refuse'}</Button></>}
    >
      <Field label="Why?"><Input autoFocus value={why} onChange={(e) => setWhy(e.target.value)} placeholder="Pay the late bill first" /></Field>
    </Modal>
  );
}

/** The owner's rules: who may sell on loan, without asking up to how much, and who may approve. */
function Rules() {
  const [p, setP] = useState(null);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { api('/api/manager/approvals/policy').then(setP).catch((e) => setError(e.message)); }, []);
  if (!p) return error ? <Alert>{error}</Alert> : null;

  const set = (id, k, v) => setP((x) => ({ ...x, staff: x.staff.map((s) => (s.id === id ? { ...s, [k]: v } : s)) }));
  const owner = (id, on) => setP((x) => ({ ...x, owners: on ? [...new Set([...x.owners, id])] : x.owners.filter((o) => o !== id) }));
  async function save() {
    setBusy(true);
    setError('');
    try {
      setP(await api('/api/manager/approvals/policy', { method: 'POST', body: { owners: p.owners, supplierPayLimit: Number(p.supplierPayLimit) || 0, staff: p.staff } }));
      setSaved('Saved. The new rules work from now.');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const num = (v) => String(v || '').replace(/\D/g, '');

  return (
    <Card className="mt-4">
      <CardHead>
        <CardTitle>Who may do what</CardTitle>
        {p.canEdit && <Button size="sm" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save rules'}</Button>}
      </CardHead>
      <div className="space-y-3 p-4">
        <Alert>{error}</Alert>
        {saved && <Alert kind="ok" onDone={() => setSaved('')}>{saved}</Alert>}
        <p className="text-[12.5px] text-ink-2">
          0 means always ask. A loan is only finished without asking when it is under the amount <b>and</b> within the customer&apos;s own limit.
          {!p.owners.length && ' No owner is named yet, so every manager counts as owner.'}
        </p>
        <TableWrap>
          <Table>
            <thead><tr><Th>Person</Th><Th>Owner</Th><Th>May sell on loan</Th><Th>Finish without asking, up to</Th><Th>May approve others, up to</Th></tr></thead>
            <tbody>
              {p.staff.map((s) => (
                <Tr key={s.id}>
                  <Td><b className="block text-ink">{s.name}</b><span className="text-[11.5px] capitalize text-ink-muted">{s.desk}</span></Td>
                  <Td>{s.desk === 'manager' ? <Checkbox label="" checked={p.owners.includes(s.id)} disabled={!p.canEdit} onChange={(e) => owner(s.id, e.target.checked)} /> : <span className="text-ink-faint">-</span>}</Td>
                  <Td><Checkbox label={s.canRequest ? 'Yes' : 'No'} checked={!!s.canRequest} disabled={!p.canEdit} onChange={(e) => set(s.id, 'canRequest', e.target.checked)} /></Td>
                  <Td><Input className="tnum w-[150px]" inputMode="numeric" disabled={!p.canEdit} value={num(s.autoUpTo)} placeholder="0" onChange={(e) => set(s.id, 'autoUpTo', Number(num(e.target.value)) || 0)} /></Td>
                  <Td><Input className="tnum w-[150px]" inputMode="numeric" disabled={!p.canEdit} value={num(s.approveUpTo)} placeholder="0" onChange={(e) => set(s.id, 'approveUpTo', Number(num(e.target.value)) || 0)} /></Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </TableWrap>
        <Field label="Supplier payments above this need the owner (UGX)" hint="For managers who are not the owner. 0 means every supplier payment they make needs you.">
          <Input className="tnum w-[200px]" inputMode="numeric" disabled={!p.canEdit} value={num(p.supplierPayLimit)} placeholder="0" onChange={(e) => setP((x) => ({ ...x, supplierPayLimit: Number(num(e.target.value)) || 0 }))} />
        </Field>
        {!p.canEdit && <p className="text-[12px] text-ink-muted">Only the owner changes these.</p>}
      </div>
    </Card>
  );
}

/** For the dashboard: what is waiting, at a glance. Nothing when nothing waits. */
export function ApprovalsCard() {
  const [d, setD] = useState(null);
  useEffect(() => { api('/api/approvals?status=pending').then(setD).catch(() => {}); }, []);
  const rows = list(d?.approvals).filter((a) => a.canDecide);
  if (!rows.length) return null;
  return (
    <section className="mb-3 overflow-hidden rounded-xl border border-warn/40 bg-warn-bg/40">
      <div className="flex items-center justify-between border-b border-warn/30 px-3.5 py-2">
        <h2 className="text-[13.5px] font-bold text-ink">Waiting for your approval · {rows.length}</h2>
        <Link href="/manager/approvals" className="text-[12.5px] font-semibold text-brand-dark hover:underline">Decide →</Link>
      </div>
      <ul className="divide-y divide-warn/20">
        {rows.slice(0, 4).map((a) => (
          <li key={a.id} className="flex items-center gap-3 px-3.5 py-2 text-[12.5px]">
            <span className="min-w-0 flex-1 truncate text-ink-2"><b className="text-ink">{a.partyName}</b> · {KIND[a.kind]} · asked by {a.requestedBy}</span>
            {a.customer && a.customer.after > a.customer.limit && <span className="rounded-full bg-bad-bg px-2 py-0.5 text-[10.5px] font-bold text-bad">Over limit</span>}
            <b className="tnum text-ink">{money(a.amount)}</b>
          </li>
        ))}
      </ul>
    </section>
  );
}
