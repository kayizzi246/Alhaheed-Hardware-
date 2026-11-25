'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, peek } from '@/lib/api';
import { cn } from '@/lib/cn';
import { list, money, dateTime } from '@/lib/format';
import {
  Alert, Button, Card, CardHead, CardTitle, CardNote, Chip, Empty, Field, Input, Loading,
  LoadFailed, Modal, PageHead, Segmented, Select, Stat, Stats, Table, TableWrap, Td, Textarea, Th, Tr,
} from '@/components/ui';
import { Icon } from '@/components/icons';

const OLD_PLUGIN = 'Workers and salaries need the new plugin. Upload al-hadeed-hardware.zip (1.10.0) to the website first.';
const plain = (e) => (/no route/i.test(e?.message || '') ? OLD_PLUGIN : e?.message || 'Something went wrong.');

const METHODS = [
  ['cash', 'Cash'],
  ['mtn_momo', 'MTN Mobile Money'],
  ['airtel_money', 'Airtel Money'],
  ['bank', 'Bank transfer'],
  ['cheque', 'Cheque'],
];
const METHOD_LABEL = Object.fromEntries(METHODS);

const thisMonth = () => new Date().toISOString().slice(0, 7);
const monthName = (p) => {
  const [y, m] = String(p).split('-').map(Number);
  return y && m ? new Date(y, m - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }) : p;
};
const num = (v) => {
  const n = Number(String(v ?? '').replace(/[^0-9]/g, ''));
  return Number.isFinite(n) ? n : 0;
};

const SLIP_TONE = { draft: 'pending', approved: 'info', paid: 'good' };
const SLIP_WORD = { draft: 'Draft', approved: 'With the cashier', paid: 'Paid' };

/**
 * Everyone the shop pays, and what they are paid.
 *
 * Workers are not the same list as Staff: Staff is who can sign in to a
 * desk; Workers is everyone on the payroll, the loaders and the driver
 * included. A worker can be linked to a desk login.
 */
export default function ManagerWorkers() {
  const [tab, setTab] = useState('workers');
  const [data, setData] = useState(() => peek('/api/manager/workers'));
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    try {
      setData(await api('/api/manager/workers'));
      setError('');
    } catch (e) {
      setError(plain(e));
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const s = data?.summary || {};

  return (
    <>
      <PageHead title="Workers & salaries" sub="Everyone the shop pays, their advances and the monthly payroll.">
        <Segmented
          label="Show"
          value={tab}
          onChange={setTab}
          options={[{ value: 'workers', label: 'Workers' }, { value: 'payroll', label: 'Payroll' }]}
        />
      </PageHead>

      <Alert>{error}</Alert>
      <Alert kind="ok" onDone={() => setNotice('')}>{notice}</Alert>

      <Stats>
        <Stat label="Working now" value={s.active ?? '…'} note={s.left ? `${s.left} have left` : 'on the payroll'} icon={Icon.people()} tone="neutral" />
        <Stat label="Monthly wage bill" value={data ? money(s.wageBill) : '…'} note="pay and allowances, before overtime" icon={Icon.cash()} hero />
        <Stat label="Advances owed" value={data ? money(s.advancesOwed) : '…'} note="taken back on the next payslips" icon={Icon.clock()} tone="neutral" />
        <Stat label="Paid by" value={data ? countMethods(list(data.workers)) : '…'} note="how the active workers are paid" icon={Icon.check()} tone="neutral" />
      </Stats>

      {tab === 'workers' ? (
        <WorkersTab data={data} error={error} reload={load} say={setNotice} />
      ) : (
        <PayrollTab workers={list(data?.workers)} reload={load} say={setNotice} />
      )}
    </>
  );
}

function countMethods(workers) {
  const active = workers.filter((w) => w.status === 'active');
  if (!active.length) return 'nobody yet';
  const cash = active.filter((w) => (w.payMethod || 'cash') === 'cash').length;
  if (cash === active.length) return 'all cash';
  if (cash === 0) return 'all by transfer';
  return `${cash} cash · ${active.length - cash} other`;
}

/* ── Workers ─────────────────────────────────────────────────────── */

function WorkersTab({ data, error, reload, say }) {
  const [q, setQ] = useState('');
  const [show, setShow] = useState('active');
  const [ticked, setTicked] = useState([]);
  const [editing, setEditing] = useState(null);
  const [advancing, setAdvancing] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const workers = list(data?.workers);
  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    return workers.filter((w) => {
      if (show !== 'all' && w.status !== show) return false;
      if (!term) return true;
      return [w.fullName, w.job, w.phone, w.idNumber].some((v) => String(v || '').toLowerCase().includes(term));
    });
  }, [workers, q, show]);

  const allOn = shown.length > 0 && shown.every((w) => ticked.includes(w.id));
  const toggle = (id) => setTicked((t) => (t.includes(id) ? t.filter((x) => x !== id) : [...t, id]));
  const toggleAll = () => setTicked(allOn ? [] : shown.map((w) => w.id));
  const chosen = workers.filter((w) => ticked.includes(w.id));

  return (
    <Card className="mb-4">
      <CardHead className="flex flex-wrap items-center justify-between gap-3">
        <CardTitle>The workers</CardTitle>
        <div className="flex flex-wrap items-center gap-2">
          {chosen.length > 0 && (
            <Button variant="danger" size="sm" onClick={() => setDeleting(chosen)}>
              Delete {chosen.length}
            </Button>
          )}
          <Button size="sm" onClick={() => setEditing({})}>Add worker</Button>
        </div>
      </CardHead>

      <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3 sm:px-5">
        <Input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name, job, phone…"
          className="h-10 w-full sm:w-72"
        />
        <Segmented
          label="Which workers"
          value={show}
          onChange={(v) => { setShow(v); setTicked([]); }}
          options={[{ value: 'active', label: 'Working' }, { value: 'left', label: 'Left' }, { value: 'all', label: 'All' }]}
        />
      </div>

      {!data ? (
        error ? <LoadFailed onRetry={reload}>{error}</LoadFailed> : <Loading>Loading workers…</Loading>
      ) : workers.length === 0 ? (
        <Empty title="Nobody on the payroll yet" action={<Button onClick={() => setEditing({})}>Add the first worker</Button>}>
          Add everyone the shop pays: desk staff, loaders, the driver, the guard.
        </Empty>
      ) : shown.length === 0 ? (
        <Empty title="Nobody matches">Try another search, or show everyone.</Empty>
      ) : (
        <TableWrap>
          <Table>
            <thead>
              <tr>
                <Th className="w-10">
                  <input type="checkbox" aria-label="Select all" checked={allOn} onChange={toggleAll} className="size-4 accent-[rgb(var(--fill))]" />
                </Th>
                <Th>Name</Th>
                <Th num>Pay</Th>
                <Th>Paid by</Th>
                <Th>Phone</Th>
                <Th num>Advance owed</Th>
                <Th>Status</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {shown.map((w) => (
                <Tr key={w.id} className={cn(ticked.includes(w.id) && 'bg-brand-soft/60')}>
                  <Td>
                    <input type="checkbox" aria-label={`Select ${w.fullName}`} checked={ticked.includes(w.id)} onChange={() => toggle(w.id)} className="size-4 accent-[rgb(var(--fill))]" />
                  </Td>
                  <Td>
                    <button type="button" onClick={() => setEditing(w)} className="text-left font-semibold text-ink hover:text-brand hover:underline">
                      {w.fullName}
                    </button>
                    <span className="block text-xs text-ink-muted">
                      {w.job || 'Worker'}{w.deskName ? ` · desk login: ${w.deskName}` : ''}
                    </span>
                  </Td>
                  <Td num className="tnum">
                    {money(w.basePay)}
                    <span className="block text-xs text-ink-muted">
                      {w.payBasis === 'daily' ? 'a day' : 'a month'}{w.allowance ? ` + ${money(w.allowance)}` : ''}
                    </span>
                  </Td>
                  <Td>
                    {w.methodLabel || 'Cash'}
                    {w.payNumber && <span className="block text-xs tnum text-ink-muted">{w.payNumber}</span>}
                  </Td>
                  <Td className="tnum">{w.phone || ''}</Td>
                  <Td num className={cn('tnum', w.advanceOwed > 0 ? 'font-semibold text-warn' : 'text-ink-muted')}>
                    {w.advanceOwed > 0 ? money(w.advanceOwed) : 'none'}
                  </Td>
                  <Td>
                    <Chip tone={w.status === 'active' ? 'good' : 'grey'}>{w.status === 'active' ? 'Working' : 'Left'}</Chip>
                  </Td>
                  <Td>
                    <div className="flex justify-end gap-2">
                      {w.status === 'active' && (
                        <Button variant="outline" size="sm" onClick={() => setAdvancing(w)}>Advance</Button>
                      )}
                      <Button variant="outline" size="sm" onClick={() => setEditing(w)}>Edit</Button>
                    </div>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </TableWrap>
      )}

      {editing && (
        <WorkerForm
          worker={editing}
          desks={list(data?.desks)}
          onClose={() => setEditing(null)}
          onDelete={() => { setDeleting([editing]); setEditing(null); }}
          onAdvance={() => { setAdvancing(editing); setEditing(null); }}
          onDone={(msg) => { setEditing(null); say(msg); reload(); }}
        />
      )}
      {advancing && (
        <AdvanceDialog
          worker={advancing}
          onClose={() => setAdvancing(null)}
          onDone={(msg) => { setAdvancing(null); say(msg); reload(); }}
        />
      )}
      {deleting && (
        <DeleteWorkers
          workers={deleting}
          onClose={() => setDeleting(null)}
          onDone={(msg) => { setDeleting(null); setTicked([]); say(msg); reload(); }}
        />
      )}
    </Card>
  );
}

const BLANK = {
  fullName: '', phone: '', job: '', idNumber: '', startedOn: '', address: '',
  payBasis: 'monthly', basePay: '', allowance: '', payMethod: 'cash', payNumber: '', bankName: '',
  kinName: '', kinPhone: '', notes: '', status: 'active', leftOn: '', userId: '',
};

function Section({ title, children }) {
  return (
    <section className="space-y-3">
      <h3 className="text-[12px] font-bold uppercase tracking-[.06em] text-ink-muted">{title}</h3>
      {children}
    </section>
  );
}

function WorkerForm({ worker, desks, onClose, onDone, onDelete, onAdvance }) {
  const editing = !!worker.id;
  const [f, setF] = useState(() => {
    const out = { ...BLANK };
    for (const k of Object.keys(BLANK)) if (worker[k] !== undefined && worker[k] !== null) out[k] = String(worker[k]);
    return out;
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [history, setHistory] = useState(null);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e?.target ? e.target.value : e }));

  useEffect(() => {
    if (!editing) return;
    api(`/api/manager/workers/${worker.id}`).then(setHistory).catch(() => setHistory({ payslips: [], payments: [] }));
  }, [editing, worker.id]);

  const daily = f.payBasis === 'daily';
  const monthly = (daily ? num(f.basePay) * 26 : num(f.basePay)) + num(f.allowance);
  const transfer = f.payMethod !== 'cash';

  // A desk person picked: fill the name and phone if they are empty.
  function pickDesk(e) {
    const id = e.target.value;
    const d = desks.find((x) => String(x.id) === String(id));
    setF((x) => ({
      ...x,
      userId: id,
      fullName: x.fullName || d?.name || '',
      phone: x.phone || d?.phone || '',
      job: x.job || d?.deskLabel || '',
    }));
  }

  async function save() {
    setBusy(true);
    setError('');
    try {
      const body = {
        ...f,
        basePay: num(f.basePay),
        allowance: num(f.allowance),
        userId: f.userId ? Number(f.userId) : 0,
        leftOn: f.status === 'left' ? f.leftOn : '',
      };
      await api(editing ? `/api/manager/workers/${worker.id}` : '/api/manager/workers', { method: 'POST', body });
      onDone(editing ? `${f.fullName} saved.` : `${f.fullName} added to the payroll.`);
    } catch (e) {
      setError(plain(e));
      setBusy(false);
    }
  }

  return (
    <Modal
      wide
      title={editing ? worker.fullName : 'Add a worker'}
      description={editing ? `${worker.job || 'Worker'} · on the payroll since ${worker.startedOn || worker.createdAt?.slice(0, 10) || 'their start'}` : 'Anyone the shop pays, with or without a desk login.'}
      onClose={onClose}
      footer={
        <div className="flex w-full flex-wrap items-center gap-2">
          {editing && <Button variant="danger" onClick={onDelete}>Delete</Button>}
          {editing && worker.status === 'active' && <Button variant="outline" onClick={onAdvance}>Give an advance</Button>}
          <span className="flex-1" />
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={busy || f.fullName.trim().length < 2 || num(f.basePay) < 1} onClick={save}>
            {busy ? 'Saving…' : editing ? 'Save changes' : 'Add worker'}
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        <Alert>{error}</Alert>

        <Section title="The person">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Full name"><Input value={f.fullName} onChange={set('fullName')} maxLength={191} autoFocus={!editing} /></Field>
            <Field label="Job"><Input value={f.job} onChange={set('job')} placeholder="Loader, driver, guard…" maxLength={120} /></Field>
            <Field label="Phone"><Input value={f.phone} onChange={set('phone')} inputMode="tel" placeholder="0772 123 456" maxLength={32} /></Field>
            <Field label="National ID number"><Input value={f.idNumber} onChange={set('idNumber')} maxLength={64} /></Field>
            <Field label="Started on"><Input type="date" value={f.startedOn} onChange={set('startedOn')} /></Field>
            <Field label="Where they live"><Input value={f.address} onChange={set('address')} maxLength={255} /></Field>
          </div>
        </Section>

        <Section title="Pay">
          <Segmented
            label="How they are paid"
            value={f.payBasis}
            onChange={set('payBasis')}
            options={[{ value: 'monthly', label: 'Monthly salary' }, { value: 'daily', label: 'By the day' }]}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={daily ? 'Pay for one day (UGX)' : 'Monthly salary (UGX)'}>
              <Input value={f.basePay} onChange={set('basePay')} inputMode="numeric" className="tnum" />
            </Field>
            <Field label="Monthly allowance (UGX)" hint="Transport, lunch, airtime. Leave empty if none.">
              <Input value={f.allowance} onChange={set('allowance')} inputMode="numeric" className="tnum" />
            </Field>
            <Field label="Paid by">
              <Select value={f.payMethod} onChange={set('payMethod')}>
                {METHODS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </Select>
            </Field>
            {transfer && (
              <Field label={f.payMethod === 'bank' ? 'Account number' : f.payMethod === 'cheque' ? 'Name on the cheque' : 'Mobile money number'}>
                <Input value={f.payNumber} onChange={set('payNumber')} maxLength={64} className="tnum" />
              </Field>
            )}
            {f.payMethod === 'bank' && (
              <Field label="Bank"><Input value={f.bankName} onChange={set('bankName')} maxLength={120} /></Field>
            )}
          </div>
          <p className="rounded-xl bg-surface-2 px-4 py-3 text-[13.5px] text-ink-2">
            About <b className="tnum text-ink">{money(monthly)}</b> a month
            {daily ? ' at 26 days' : ''}, before overtime, bonuses and deductions.
          </p>
        </Section>

        <Section title="Next of kin">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name"><Input value={f.kinName} onChange={set('kinName')} maxLength={191} /></Field>
            <Field label="Phone"><Input value={f.kinPhone} onChange={set('kinPhone')} inputMode="tel" maxLength={32} /></Field>
          </div>
        </Section>

        <Section title="Desk login and status">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Desk login" hint="Only if they sign in to a desk. Most workers do not.">
              <Select value={f.userId} onChange={pickDesk} placeholder="No desk login">
                <option value="">No desk login</option>
                {desks.map((d) => <option key={d.id} value={String(d.id)}>{`${d.name} (${d.deskLabel})`}</option>)}
              </Select>
            </Field>
            <Field label="Status">
              <Segmented
                label="Status"
                value={f.status}
                onChange={set('status')}
                options={[{ value: 'active', label: 'Working' }, { value: 'left', label: 'Has left' }]}
              />
            </Field>
            {f.status === 'left' && (
              <Field label="Left on"><Input type="date" value={f.leftOn} onChange={set('leftOn')} /></Field>
            )}
          </div>
          <Field label="Notes"><Textarea rows={2} value={f.notes} onChange={set('notes')} /></Field>
        </Section>

        {editing && (
          <Section title="Pay history">
            {!history ? (
              <Loading>Loading their pay…</Loading>
            ) : list(history.payslips).length === 0 && list(history.payments).length === 0 ? (
              <p className="text-[13.5px] text-ink-muted">No payslips or advances yet.</p>
            ) : (
              <div className="space-y-3">
                {worker.advanceOwed > 0 && (
                  <p className="text-[13.5px] text-warn">Still owes <b className="tnum">{money(worker.advanceOwed)}</b> in advances.</p>
                )}
                <TableWrap className="rounded-xl border border-line">
                  <Table>
                    <thead><tr><Th>When</Th><Th>What</Th><Th num>Amount</Th><Th>Status</Th></tr></thead>
                    <tbody>
                      {list(history.payslips).map((s) => (
                        <Tr key={`s${s.id}`}>
                          <Td className="tnum">{s.month}</Td>
                          <Td>Payslip{s.advanceRecovered ? ` · ${money(s.advanceRecovered)} advance taken back` : ''}</Td>
                          <Td num className="tnum">{money(s.net)}</Td>
                          <Td><Chip tone={SLIP_TONE[s.status]}>{SLIP_WORD[s.status] || s.status}</Chip></Td>
                        </Tr>
                      ))}
                      {list(history.payments).filter((p) => p.kind === 'advance').map((p) => (
                        <Tr key={`e${p.id}`}>
                          <Td className="tnum">{dateTime(p.paid_at || p.created_at)}</Td>
                          <Td>{p.ref} · {p.details}</Td>
                          <Td num className="tnum">{money(p.amount)}</Td>
                          <Td><Chip tone={p.status === 'paid' ? 'good' : 'info'}>{p.status === 'paid' ? 'Given' : 'With the cashier'}</Chip></Td>
                        </Tr>
                      ))}
                    </tbody>
                  </Table>
                </TableWrap>
              </div>
            )}
          </Section>
        )}
      </div>
    </Modal>
  );
}

function AdvanceDialog({ worker, onClose, onDone }) {
  const [amount, setAmount] = useState('');
  const [details, setDetails] = useState('');
  const [method, setMethod] = useState(worker.payMethod || 'cash');
  const [payRef, setPayRef] = useState('');
  const [settle, setSettle] = useState('paid');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const needRef = settle === 'paid' && method !== 'cash';

  async function go() {
    setBusy(true);
    setError('');
    try {
      const r = await api(`/api/manager/workers/${worker.id}/advance`, {
        method: 'POST',
        body: { amount: num(amount), details, method, payRef, payNumber: worker.payNumber || '', settle },
      });
      onDone(
        settle === 'paid'
          ? `${money(num(amount))} advance to ${worker.fullName} booked as ${r.expense?.ref}. It comes off their next payslip.`
          : `${money(num(amount))} advance to ${worker.fullName} sent to the cashier to pay out.`
      );
    } catch (e) {
      setError(plain(e));
      setBusy(false);
    }
  }

  return (
    <Modal
      title={`Advance to ${worker.fullName}`}
      description="Filed as an expense, and taken back from their next payslips."
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={busy || num(amount) < 1 || (needRef && payRef.trim().length < 3)} onClick={go}>
            {busy ? 'Saving…' : settle === 'paid' ? 'Book the advance' : 'Send to the cashier'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Alert>{error}</Alert>
        {worker.advanceOwed > 0 && (
          <p className="rounded-xl bg-warn-bg px-4 py-3 text-[13.5px] text-warn">
            They already owe <b className="tnum">{money(worker.advanceOwed)}</b>.
          </p>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Amount (UGX)"><Input autoFocus value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="numeric" className="tnum" /></Field>
          <Field label="What it is for"><Input value={details} onChange={(e) => setDetails(e.target.value)} placeholder="School fees, medical…" maxLength={160} /></Field>
        </div>
        <Field label="The money">
          <Segmented
            label="Has it been paid"
            value={settle}
            onChange={setSettle}
            options={[{ value: 'paid', label: 'I have given it' }, { value: 'approve', label: 'The cashier pays it' }]}
          />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Paid by">
            <Select value={method} onChange={(e) => setMethod(e.target.value)}>
              {METHODS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </Select>
          </Field>
          {needRef && (
            <Field label={method === 'cheque' ? 'Cheque number' : 'Transaction ID'}>
              <Input value={payRef} onChange={(e) => setPayRef(e.target.value)} maxLength={64} className="tnum" />
            </Field>
          )}
        </div>
      </div>
    </Modal>
  );
}

function DeleteWorkers({ workers, onClose, onDone }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const one = workers.length === 1;

  async function go() {
    setBusy(true);
    setError('');
    try {
      const r = await api('/api/manager/workers/delete', { method: 'POST', body: { ids: workers.map((w) => w.id) } });
      onDone(one ? `${workers[0].fullName} deleted.` : `${r.deleted ?? workers.length} workers deleted.`);
    } catch (e) {
      setError(plain(e));
      setBusy(false);
    }
  }

  return (
    <Modal
      title={one ? `Delete ${workers[0].fullName}?` : `Delete ${workers.length} workers?`}
      description="They come off the payroll. Salaries and advances already paid stay in the books under their name."
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Keep {one ? 'them' : 'them all'}</Button>
          <Button variant="danger" disabled={busy} onClick={go}>
            {busy ? 'Deleting…' : one ? 'Delete worker' : `Delete ${workers.length} workers`}
          </Button>
        </>
      }
    >
      <div className="space-y-4 text-[14px] text-ink-2">
        <Alert>{error}</Alert>
        <ul className="max-h-48 space-y-1 overflow-y-auto rounded-xl border border-line bg-surface-2 px-4 py-3">
          {workers.map((w) => (
            <li key={w.id} className="flex justify-between gap-3">
              <span className="font-medium text-ink">{w.fullName}</span>
              <span className="text-ink-muted">{w.job || 'Worker'}</span>
            </li>
          ))}
        </ul>
        {workers.some((w) => w.advanceOwed > 0) && (
          <p className="text-warn">Someone here still owes an advance. Deleting them writes it off.</p>
        )}
        <p className="text-ink-muted">If someone has simply left, Edit and mark them as left instead: they stay on record.</p>
      </div>
    </Modal>
  );
}

/* ── Payroll ─────────────────────────────────────────────────────── */

function PayrollTab({ workers, reload, say }) {
  const [period, setPeriod] = useState(thisMonth());
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [slip, setSlip] = useState(null);
  const [approving, setApproving] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await api(`/api/manager/payroll?period=${period}`));
      setError('');
    } catch (e) {
      setError(plain(e));
    }
  }, [period]);
  useEffect(() => { setData(null); load(); }, [load]);

  const slips = list(data?.slips);
  const missing = list(data?.missing);
  const t = data?.totals || {};
  const drafts = slips.filter((s) => s.status === 'draft');

  async function start() {
    setBusy(true);
    setError('');
    try {
      const r = await api('/api/manager/payroll/start', { method: 'POST', body: { period } });
      setData(r);
      say(r.made ? `${r.made} payslips drafted for ${monthName(period)}. Check them, then approve.` : 'Everyone already has a payslip this month.');
    } catch (e) {
      setError(plain(e));
    }
    setBusy(false);
  }

  function exportCsv() {
    const head = ['Worker', 'Job', 'Days', 'Base pay', 'Allowance', 'Overtime', 'Bonus', 'Gross', 'Deductions', 'Deduction note', 'Advance taken back', 'Net pay', 'Status'];
    const rows = slips.map((s) => [s.workerName, s.job || '', s.payBasis === 'daily' ? s.daysWorked : '', s.basePay, s.allowance, s.overtime, s.bonus, s.gross, s.deductions, s.deductionNote || '', s.advanceRecovered, s.net, SLIP_WORD[s.status] || s.status]);
    rows.push(['Total', '', '', '', '', '', '', t.gross, t.deductions, '', t.advances, t.net, '']);
    const csv = [head, ...rows].map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv' }));
    a.download = `payroll-${period}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <Card className="mb-4">
      <CardHead className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <CardTitle>Payroll for {monthName(period)}</CardTitle>
          <CardNote>Draft the payslips, adjust days, overtime and deductions, then approve. Approved salaries go to Expenses for the cashier to pay.</CardNote>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input type="month" value={period} onChange={(e) => e.target.value && setPeriod(e.target.value)} className="h-9 w-[170px]" aria-label="Month" />
          {slips.length > 0 && <Button variant="outline" size="sm" onClick={exportCsv}>Download</Button>}
          {slips.length > 0 && <Button variant="outline" size="sm" onClick={() => printSlips(slips, period)}>Print payslips</Button>}
          {missing.length > 0 && (
            <Button size="sm" variant={drafts.length ? 'outline' : 'primary'} disabled={busy} onClick={start}>
              {busy ? 'Drafting…' : slips.length ? `Add ${missing.length} missing` : `Draft ${missing.length} payslips`}
            </Button>
          )}
          {drafts.length > 0 && <Button size="sm" onClick={() => setApproving(true)}>Approve {drafts.length}</Button>}
        </div>
      </CardHead>

      <Alert>{error}</Alert>

      {!data ? (
        error ? <LoadFailed onRetry={load}>{error}</LoadFailed> : <Loading>Loading the payroll…</Loading>
      ) : slips.length === 0 ? (
        <Empty
          title={workers.some((w) => w.status === 'active') ? `No payslips for ${monthName(period)} yet` : 'Add workers first'}
          action={missing.length > 0 && <Button disabled={busy} onClick={start}>Draft {missing.length} payslips</Button>}
        >
          {missing.length > 0
            ? 'One payslip for each worker, filled from their pay, with any advance they owe taken back.'
            : 'The payroll is drafted from the workers list.'}
        </Empty>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 border-b border-line px-4 py-3 text-[13px] sm:grid-cols-4 sm:px-5">
            <Total label="Gross" value={t.gross} />
            <Total label="Deductions and advances" value={(t.deductions || 0) + (t.advances || 0)} />
            <Total label="Net to pay" value={t.net} strong />
            <Total label={t.toPay ? 'Still with the cashier' : 'Paid out'} value={t.toPay || t.paidValue} />
          </div>
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>Worker</Th><Th num>Base</Th><Th num>Extras</Th><Th num>Gross</Th>
                  <Th num>Deductions</Th><Th num>Advance back</Th><Th num>Net pay</Th><Th>Status</Th><Th />
                </tr>
              </thead>
              <tbody>
                {slips.map((s) => (
                  <Tr key={s.id}>
                    <Td>
                      <span className="font-semibold text-ink">{s.workerName}</span>
                      <span className="block text-xs text-ink-muted">
                        {s.job || 'Worker'}{s.payBasis === 'daily' ? ` · ${s.daysWorked} days at ${money(s.rate)}` : ''}
                      </span>
                    </Td>
                    <Td num className="tnum">{money(s.basePay)}</Td>
                    <Td num className="tnum text-ink-2">{s.allowance + s.overtime + s.bonus ? money(s.allowance + s.overtime + s.bonus) : ''}</Td>
                    <Td num className="tnum">{money(s.gross)}</Td>
                    <Td num className="tnum text-ink-2">
                      {s.deductions ? money(s.deductions) : ''}
                      {s.deductionNote && <span className="block text-xs text-ink-muted">{s.deductionNote}</span>}
                    </Td>
                    <Td num className="tnum text-ink-2">{s.advanceRecovered ? money(s.advanceRecovered) : ''}</Td>
                    <Td num className="tnum font-bold text-ink">{money(s.net)}</Td>
                    <Td><Chip tone={SLIP_TONE[s.status]}>{SLIP_WORD[s.status] || s.status}</Chip></Td>
                    <Td>
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => printSlips([s], period)}>Print</Button>
                        {s.status === 'draft' && <Button variant="outline" size="sm" onClick={() => setSlip(s)}>Edit</Button>}
                      </div>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
          {missing.length > 0 && (
            <p className="border-t border-line px-4 py-3 text-[13px] text-ink-muted sm:px-5">
              No payslip yet for {missing.map((w) => w.fullName).join(', ')}.
            </p>
          )}
        </>
      )}

      {slip && (
        <SlipDialog
          slip={slip}
          owed={(workers.find((w) => w.id === slip.workerId)?.advanceOwed) ?? slip.advanceRecovered}
          onClose={() => setSlip(null)}
          onDone={(msg) => { setSlip(null); say(msg); load(); }}
        />
      )}
      {approving && (
        <ApproveDialog
          period={period}
          drafts={drafts}
          onClose={() => setApproving(false)}
          onDone={(r, cash) => {
            setApproving(false);
            setData(r);
            reload();
            say(cash
              ? `${monthName(period)} salaries approved and booked as paid in cash.`
              : `${monthName(period)} salaries approved. They are in Expenses for the cashier to pay out.`);
          }}
        />
      )}
    </Card>
  );
}

function Total({ label, value, strong }) {
  return (
    <div className="min-w-0">
      <span className="block text-ink-muted">{label}</span>
      <span className={cn('tnum text-[15px]', strong ? 'font-bold text-brand-dark' : 'font-semibold text-ink')}>{money(value)}</span>
    </div>
  );
}

function SlipDialog({ slip, owed, onClose, onDone }) {
  const daily = slip.payBasis === 'daily';
  const [f, setF] = useState({
    daysWorked: String(slip.daysWorked),
    rate: String(slip.rate),
    basePay: String(slip.basePay),
    allowance: String(slip.allowance),
    overtime: slip.overtime ? String(slip.overtime) : '',
    bonus: slip.bonus ? String(slip.bonus) : '',
    deductions: slip.deductions ? String(slip.deductions) : '',
    deductionNote: slip.deductionNote || '',
    advanceRecovered: String(slip.advanceRecovered),
    note: slip.note || '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));

  const base = daily ? num(f.rate) * num(f.daysWorked) : num(f.basePay);
  const gross = base + num(f.allowance) + num(f.overtime) + num(f.bonus);
  const net = gross - num(f.deductions) - num(f.advanceRecovered);

  async function save() {
    setBusy(true);
    setError('');
    try {
      const body = Object.fromEntries(Object.entries(f).map(([k, v]) => [k, /Note$|^note$/.test(k) ? v : num(v)]));
      await api(`/api/manager/payroll/slips/${slip.id}`, { method: 'POST', body });
      onDone(`${slip.workerName}'s payslip saved: ${money(net)}.`);
    } catch (e) {
      setError(plain(e));
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await api(`/api/manager/payroll/slips/${slip.id}/delete`, { method: 'POST', body: {} });
      onDone(`${slip.workerName} taken off ${slip.month}'s payroll.`);
    } catch (e) {
      setError(plain(e));
      setBusy(false);
    }
  }

  return (
    <Modal
      wide
      title={`${slip.workerName}, ${slip.month}`}
      description={slip.job || 'Payslip'}
      onClose={onClose}
      footer={
        <div className="flex w-full flex-wrap items-center gap-2">
          <Button variant="danger" disabled={busy} onClick={remove}>Take off this payroll</Button>
          <span className="flex-1" />
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={busy || net < 0} onClick={save}>{busy ? 'Saving…' : 'Save payslip'}</Button>
        </div>
      }
    >
      <div className="space-y-5">
        <Alert>{error}</Alert>
        <div className="grid gap-3 sm:grid-cols-3">
          {daily ? (
            <>
              <Field label="Days worked"><Input value={f.daysWorked} onChange={set('daysWorked')} inputMode="numeric" className="tnum" /></Field>
              <Field label="Pay a day (UGX)"><Input value={f.rate} onChange={set('rate')} inputMode="numeric" className="tnum" /></Field>
            </>
          ) : (
            <Field label="Salary (UGX)" hint="Lower it for unpaid days off."><Input value={f.basePay} onChange={set('basePay')} inputMode="numeric" className="tnum" /></Field>
          )}
          <Field label="Allowance (UGX)"><Input value={f.allowance} onChange={set('allowance')} inputMode="numeric" className="tnum" /></Field>
          <Field label="Overtime (UGX)"><Input value={f.overtime} onChange={set('overtime')} inputMode="numeric" className="tnum" /></Field>
          <Field label="Bonus (UGX)"><Input value={f.bonus} onChange={set('bonus')} inputMode="numeric" className="tnum" /></Field>
          <Field label="Deductions (UGX)"><Input value={f.deductions} onChange={set('deductions')} inputMode="numeric" className="tnum" /></Field>
          <Field label="Why the deduction"><Input value={f.deductionNote} onChange={set('deductionNote')} placeholder="Shortage, damage, absence…" maxLength={255} /></Field>
          <Field label="Advance taken back (UGX)" hint={owed ? `They owe ${money(owed)}.` : 'They owe nothing.'}>
            <Input value={f.advanceRecovered} onChange={set('advanceRecovered')} inputMode="numeric" className="tnum" />
          </Field>
        </div>
        <Field label="Note on the payslip"><Textarea rows={2} value={f.note} onChange={set('note')} /></Field>
        <div className="grid grid-cols-3 gap-3 rounded-xl bg-surface-2 px-4 py-3 text-[13px]">
          <Total label="Gross" value={gross} />
          <Total label="Taken off" value={num(f.deductions) + num(f.advanceRecovered)} />
          <Total label="Net pay" value={net} strong />
        </div>
        {net < 0 && <p className="text-[13px] font-medium text-bad">What is taken off is more than the pay.</p>}
      </div>
    </Modal>
  );
}

function ApproveDialog({ period, drafts, onClose, onDone }) {
  const [settle, setSettle] = useState('approve');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const total = drafts.reduce((n, s) => n + s.net, 0);

  async function go() {
    setBusy(true);
    setError('');
    try {
      const r = await api('/api/manager/payroll/approve', { method: 'POST', body: { period, settle } });
      onDone(r, settle === 'cash');
    } catch (e) {
      setError(plain(e));
      setBusy(false);
    }
  }

  return (
    <Modal
      title={`Approve ${monthName(period)} salaries?`}
      description={`${drafts.length} payslips, ${money(total)} in all. Approved payslips can no longer be changed.`}
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Not yet</Button>
          <Button disabled={busy} onClick={go}>{busy ? 'Approving…' : `Approve ${money(total)}`}</Button>
        </>
      }
    >
      <div className="space-y-4 text-[14px] text-ink-2">
        <Alert>{error}</Alert>
        <Segmented
          label="Who pays"
          value={settle}
          onChange={setSettle}
          options={[{ value: 'approve', label: 'The cashier pays them' }, { value: 'cash', label: 'I paid them all in cash' }]}
        />
        <p className="text-ink-muted">
          {settle === 'cash'
            ? 'Each salary is booked as paid in cash today, in Expenses and the cash book.'
            : 'Each salary goes to Expenses, approved, for the cashier to pay out by each worker’s usual method. The cashier gets a text.'}
        </p>
        <ul className="max-h-48 space-y-1 overflow-y-auto rounded-xl border border-line bg-surface-2 px-4 py-3">
          {drafts.map((s) => (
            <li key={s.id} className="flex justify-between gap-3">
              <span className="font-medium text-ink">{s.workerName}</span>
              <span className="tnum">{money(s.net)}</span>
            </li>
          ))}
        </ul>
      </div>
    </Modal>
  );
}

/** Payslips on paper: one to a page, in a window of their own. */
function printSlips(slips, period) {
  const esc = (v) => String(v ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const row = (k, v, b) => (v ? `<tr${b ? ' class="b"' : ''}><td>${esc(k)}</td><td>${esc(money(v))}</td></tr>` : '');
  const pages = slips.map((s) => `
    <section>
      <header><h1>AL HADEED</h1><p>Payslip · ${esc(monthName(period))}</p></header>
      <div class="who"><b>${esc(s.workerName)}</b><span>${esc(s.job || 'Worker')}</span></div>
      <table>
        ${row(s.payBasis === 'daily' ? `Pay, ${s.daysWorked} days at ${money(s.rate)}` : 'Salary', s.basePay)}
        ${row('Allowance', s.allowance)}
        ${row('Overtime', s.overtime)}
        ${row('Bonus', s.bonus)}
        ${row('Gross pay', s.gross, true)}
        ${row(`Deductions${s.deductionNote ? ` (${s.deductionNote})` : ''}`, s.deductions)}
        ${row('Advance taken back', s.advanceRecovered)}
        <tr class="net"><td>Net pay</td><td>${esc(money(s.net))}</td></tr>
      </table>
      ${s.note ? `<p class="note">${esc(s.note)}</p>` : ''}
      <p class="st">${esc(SLIP_WORD[s.status] || s.status)}${s.paidAt ? ` on ${esc(s.paidAt.slice(0, 10))}` : ''}</p>
      <footer><span>Received by</span><span>Manager</span></footer>
    </section>`).join('');
  const w = window.open('', '_blank', 'width=720,height=900');
  if (!w) return;
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Payslips ${esc(period)}</title><style>
    body{font:14px/1.45 system-ui,sans-serif;color:#0e201a;margin:0}
    section{max-width:560px;margin:32px auto;padding:28px;border:1px solid #d6e2dc;border-radius:12px;page-break-after:always}
    header{display:flex;justify-content:space-between;align-items:baseline;border-bottom:2px solid #15803d;padding-bottom:10px}
    h1{font-size:18px;letter-spacing:.04em;margin:0;color:#15803d}header p{margin:0;color:#475569}
    .who{display:flex;justify-content:space-between;margin:16px 0}.who span{color:#475569}
    table{width:100%;border-collapse:collapse}td{padding:7px 0;border-bottom:1px solid #e6eeea}td:last-child{text-align:right;font-variant-numeric:tabular-nums}
    tr.b td{font-weight:600}tr.net td{font-weight:800;font-size:16px;border-bottom:0;padding-top:12px}
    .note{color:#475569}.st{color:#166534;font-weight:600}
    footer{display:flex;justify-content:space-between;margin-top:48px;color:#475569}footer span{border-top:1px solid #94a3b8;padding-top:6px;width:40%}
  </style></head><body>${pages}<script>onload=()=>print()</script></body></html>`);
  w.document.close();
}
