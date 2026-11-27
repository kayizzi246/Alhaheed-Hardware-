'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, getUser } from '@/lib/api';
import { money, list } from '@/lib/format';
import { cn } from '@/lib/cn';
import { Icon } from '@/components/icons';
import { MoneyField } from '@/components/Fields';
import {
  Alert, Button, Card, Checkbox, CardHead, CardTitle, Empty, Field, Input, Loading, LoadFailed, Modal, PageHead,
  Segmented, Select, Stat, Table, TableWrap, Td, Th, Tr,
} from '@/components/ui';

/**
 * Customers who buy on credit.
 *
 * Like the shop's notebook: who owes, how much, since when, and what came
 * in today. The manager opens credit, sets the limit and the days to pay,
 * and can stop it. The cashier takes payments on it. Every line is kept.
 */

const day = (d) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
const STATUS = { active: 'Active', hold: 'Stopped', closed: 'Closed', none: 'No account' };
const AGES = [
  ['current', 'Up to 7 days', '#92D050'],
  ['d30', '8 to 30 days', '#c9a227'],
  ['d60', '31 to 60 days', '#e08a1e'],
  ['d90', '61 to 90 days', '#d9622b'],
  ['over90', 'Over 90 days', '#b42318'],
];

function UsedBar({ owed, limit }) {
  const pct = limit > 0 ? Math.min(100, (owed / limit) * 100) : owed > 0 ? 100 : 0;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-line">
      <div
        className={cn('h-full rounded-full', pct >= 100 ? 'bg-bad' : pct >= 80 ? 'bg-warn' : 'bg-[#92D050]')}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function StatusChip({ a }) {
  const tone = a.status === 'hold' || a.status === 'closed'
    ? 'bg-bad-bg text-bad'
    : a.overdue > 0 ? 'bg-warn-bg text-warn'
    : a.status === 'active' ? 'bg-ok-bg text-ok' : 'bg-surface-sunk text-ink-muted';
  const label = a.status === 'active' && a.overdue > 0 ? 'Late' : STATUS[a.status] || a.status;
  return <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-bold', tone)}>{label}</span>;
}

/** The aging bar: how old the money owed is. */
function Aging({ aging, total }) {
  if (!total) return <p className="text-[12.5px] text-ink-muted">Nothing owed.</p>;
  return (
    <div>
      <div className="flex h-3 overflow-hidden rounded-full bg-line">
        {AGES.map(([k, , c]) => (aging[k] > 0 ? <span key={k} style={{ flexGrow: aging[k], background: c }} /> : null))}
      </div>
      <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[12px] sm:grid-cols-5">
        {AGES.map(([k, label, c]) => (
          <li key={k}>
            <span className="flex items-center gap-1.5 text-ink-muted"><i className="size-2 rounded-full" style={{ background: c }} />{label}</span>
            <b className="tnum text-[13px] text-ink">{money(aging[k] || 0)}</b>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────

export default function Credit() {
  const manager = getUser()?.role === 'manager';
  const [data, setData] = useState(null);
  const [days, setDays] = useState(null);
  const [error, setError] = useState('');
  const [show, setShow] = useState('owing');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(null); // customer id
  const [giving, setGiving] = useState(false);
  const [note, setNote] = useState('');

  const load = useCallback(async () => {
    try {
      setData(await api('/api/credit'));
      if (manager) setDays(list((await api('/api/manager/credit/days')).days));
      setError('');
    } catch (e) {
      setError(/no route/i.test(e.message) ? 'Credit needs the new plugin. Upload the zip to the website first.' : e.message);
    }
  }, [manager]);
  useEffect(() => { load(); }, [load]);

  const accounts = list(data?.accounts);
  const rows = useMemo(() => accounts.filter((a) => {
    if (show === 'owing' && a.owed <= 0) return false;
    if (show === 'late' && a.overdue <= 0) return false;
    if (show === 'near' && !(a.used >= 80)) return false;
    if (show === 'stopped' && a.status !== 'hold') return false;
    const t = q.trim().toLowerCase();
    return !t || `${a.name} ${a.phone}`.toLowerCase().includes(t);
  }), [accounts, show, q]);

  const s = data?.summary;

  return (
    <>
      <PageHead title="Credit" sub="Customers who buy now and pay later.">
        {manager && <SalesReportButton />}
        {manager && <Button size="sm" onClick={() => setGiving(true)}>Give credit</Button>}
      </PageHead>
      <Alert>{error}</Alert>
      {note && <Alert kind="ok" onDone={() => setNote('')}>{note}</Alert>}

      {!data && !error && <Card><Loading>Adding up who owes…</Loading></Card>}
      {!data && error && !manager && (
        <Card><p className="p-5 text-[13px] text-ink-2">Find the customer under <b>Customers</b> to take a payment on their credit.</p></Card>
      )}

      {s && (
        <>
          <div className="mb-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-6">
            <Stat hero label="Owed to the shop" value={money(s.owed)} note={`${s.owing} ${s.owing === 1 ? 'customer' : 'customers'}`} icon={Icon.cash()} />
            <Stat label="Late" value={money(s.overdue)} note={`${s.overdueCount} past their days`} tone={s.overdue ? 'bad' : 'ok'} icon={Icon.clock()} />
            <Stat label="Sold on credit today" value={money(s.soldToday)} note={`${money(s.soldMonth)} this month`} icon={Icon.receipt()} />
            <Stat label="Paid in today" value={money(s.paidToday)} note={`${money(s.paidMonth)} this month`} tone="ok" icon={Icon.check()} />
            <Stat label="Near the limit" value={String(s.nearLimit)} note="80% or more used" tone={s.nearLimit ? 'warn' : 'ok'} icon={Icon.scales()} />
            <Stat label="Credit given" value={money(s.limits)} note={`${s.customers} accounts · ${s.onHold} stopped`} icon={Icon.people()} />
          </div>

          <div className="mb-3 grid gap-3 xl:grid-cols-[1.2fr_1fr]">
            <Card>
              <CardHead><CardTitle>How old the money owed is</CardTitle></CardHead>
              <div className="p-4"><Aging aging={s.aging} total={s.owed} /></div>
            </Card>
            {manager && (
              <Card>
                <CardHead><CardTitle>Day by day</CardTitle><span className="text-[11.5px] text-ink-muted">like the notebook</span></CardHead>
                <TableWrap className="max-h-[230px] overflow-y-auto">
                  <Table>
                    <thead><tr><Th>Day</Th><Th num>Cash sales</Th><Th num>Credit sales</Th><Th num>Paid in</Th><Th num>Owed at end</Th></tr></thead>
                    <tbody>
                      {list(days).map((d) => (
                        <Tr key={d.day}>
                          <Td className="whitespace-nowrap text-ink">{day(d.day)}</Td>
                          <Td num>{money(d.cashSales)}</Td>
                          <Td num className="font-semibold text-ink">{money(d.creditSales)}</Td>
                          <Td num className="text-ok">{money(d.paidIn)}</Td>
                          <Td num className="font-semibold text-ink">{money(d.closing)}</Td>
                        </Tr>
                      ))}
                    </tbody>
                  </Table>
                </TableWrap>
              </Card>
            )}
          </div>

          <Card>
            <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-2.5">
              <Segmented
                label="Show"
                value={show}
                onChange={setShow}
                options={[
                  { value: 'owing', label: `Owing (${s.owing})` },
                  { value: 'late', label: `Late (${s.overdueCount})` },
                  { value: 'near', label: `Near limit (${s.nearLimit})` },
                  { value: 'stopped', label: `Stopped (${s.onHold})` },
                  { value: 'all', label: `All (${accounts.length})` },
                ]}
              />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name or phone" className="ml-auto w-[220px]" />
            </div>
            {!rows.length ? (
              <Empty title={accounts.length ? 'Nobody here' : 'No credit customers yet'}>
                {accounts.length ? 'Try another filter.' : manager ? 'Press Give credit to open an account for a customer.' : 'The manager opens credit for customers.'}
              </Empty>
            ) : (
              <TableWrap>
                <Table>
                  <thead>
                    <tr><Th>Customer</Th><Th num>Owes</Th><Th>Used of limit</Th><Th num>Late</Th><Th>Oldest bill</Th><Th>Last paid</Th><Th>Status</Th></tr>
                  </thead>
                  <tbody>
                    {rows.map((a) => (
                      <Tr key={a.customerId} onClick={() => setOpen(a.customerId)} className="cursor-pointer">
                        <Td>
                          <b className="block text-ink">{a.name}</b>
                          <span className="text-[11.5px] text-ink-muted">{a.phone}</span>
                        </Td>
                        <Td num className="font-bold text-ink">{money(a.owed)}</Td>
                        <Td className="min-w-[150px]">
                          <UsedBar owed={a.owed} limit={a.limit} />
                          <span className="tnum mt-1 block text-[11px] text-ink-muted">{money(a.available)} left of {money(a.limit)}</span>
                        </Td>
                        <Td num className={a.overdue ? 'font-semibold text-bad' : 'text-ink-faint'}>{a.overdue ? money(a.overdue) : '-'}</Td>
                        <Td className="whitespace-nowrap text-[12px]">{a.oldestBill ? `${a.oldestDays} days ago` : '-'}</Td>
                        <Td className="whitespace-nowrap text-[12px]">{a.lastPayment ? `${money(a.lastPayment.amount)} · ${day(a.lastPayment.date)}` : 'Never'}</Td>
                        <Td><StatusChip a={a} /></Td>
                      </Tr>
                    ))}
                  </tbody>
                </Table>
              </TableWrap>
            )}
          </Card>
        </>
      )}

      {open && (
        <CreditAccount
          customerId={open}
          onClose={() => setOpen(null)}
          onChanged={(msg) => { if (msg) setNote(msg); load(); }}
        />
      )}
      {giving && (
        <GiveCredit
          onClose={() => setGiving(false)}
          onDone={(id, msg) => { setGiving(false); setNote(msg); load(); setOpen(id); }}
        />
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────

/** Open credit for a customer: pick them, set the limit and days. */
function GiveCredit({ onClose, onDone }) {
  const [people, setPeople] = useState(null);
  const [q, setQ] = useState('');
  const [who, setWho] = useState(null);
  const [limit, setLimit] = useState('');
  const [terms, setTerms] = useState('30');
  const [opening, setOpening] = useState('');
  const [why, setWhy] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { api('/api/customers').then((r) => setPeople(list(r.customers))).catch((e) => setError(e.message)); }, []);
  const found = list(people).filter((c) => !q.trim() || `${c.fullName} ${c.phone}`.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 8);

  async function save() {
    setBusy(true);
    setError('');
    try {
      await api(`/api/manager/credit/${who.id}`, { method: 'POST', body: { limit: Number(limit), termsDays: Number(terms), openingBalance: Number(opening || 0), note: why } });
      onDone(who.id, `${who.fullName} can now buy on credit up to ${money(Number(limit))}.`);
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Give credit to a customer"
      description="They can buy now and pay later, up to the limit."
      onClose={onClose}
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button disabled={!who || !(Number(limit) > 0) || busy} onClick={save}>{busy ? 'Saving…' : 'Open credit'}</Button></>}
    >
      <div className="space-y-4">
        <Alert>{error}</Alert>
        {!who ? (
          <Field label="Which customer?" hint="Not in the list? Add them under Customers first.">
            <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name or phone" />
            <ul className="mt-2 max-h-56 divide-y divide-line overflow-y-auto rounded-lg border border-line">
              {!people && <li className="px-3 py-2 text-[12.5px] text-ink-muted">Loading…</li>}
              {found.map((c) => (
                <li key={c.id}>
                  <button type="button" onClick={() => setWho(c)} className="flex w-full items-center justify-between px-3 py-2 text-left text-[13px] hover:bg-surface-2">
                    <span><b className="text-ink">{c.fullName}</b> <span className="text-ink-muted">{c.phone}</span></span>
                    <span className="text-[11.5px] text-ink-muted">{c.orderCount || 0} orders</span>
                  </button>
                </li>
              ))}
            </ul>
          </Field>
        ) : (
          <div className="flex items-center justify-between rounded-xl border border-line bg-surface-2 px-4 py-3">
            <span><b className="text-ink">{who.fullName}</b> <span className="text-[12px] text-ink-muted">{who.phone}</span></span>
            <button type="button" onClick={() => setWho(null)} className="text-[12px] font-semibold text-brand hover:underline">Change</button>
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Most they may owe (limit)">
            <MoneyField value={limit} onChange={setLimit} placeholder="5,000,000" strong />
          </Field>
          <Field label="Days to pay each bill">
            <Select value={terms} onChange={(e) => setTerms(e.target.value)}>
              {[1, 3, 7, 14, 30, 45, 60, 90].map((d) => <option key={d} value={d}>{d} {d === 1 ? 'day' : 'days'}</option>)}
            </Select>
          </Field>
        </div>
        <Field label="Already owes from before? (optional)" hint="The balance from your notebook, carried forward.">
          <MoneyField value={opening} onChange={setOpening} placeholder="0" />
        </Field>
        <Field label="Note (optional)">
          <Input value={why} onChange={(e) => setWhy(e.target.value)} placeholder="Trader, buys plates every day, pays Fridays" />
        </Field>
      </div>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────

/**
 * One customer's credit: what they owe, the bills still open, the full
 * statement, and taking a payment. The manager can change the limit,
 * stop credit, and correct the balance.
 */
export function CreditAccount({ customerId, onClose, onChanged }) {
  const manager = getUser()?.role === 'manager';
  const [d, setD] = useState(null);
  const [error, setError] = useState('');
  const [mode, setMode] = useState(null); // 'pay' | 'edit' | 'adjust'

  const load = useCallback(() => {
    api(`/api/credit/${customerId}`).then(setD).catch((e) => setError(e.message));
  }, [customerId]);
  useEffect(() => { load(); }, [load]);

  const a = d?.account;
  const done = (msg) => { setMode(null); load(); onChanged?.(msg); };

  return (
    <Modal
      wide
      title={a ? a.name : 'Credit'}
      description={a ? `${a.phone || ''}${a.openedAt ? ` · credit since ${day(a.openedAt)}` : ''}` : null}
      onClose={onClose}
      footer={a && (
        <>
          {manager && (
            <div className="mr-auto flex flex-wrap gap-2">
              <Button variant="ghost" onClick={() => setMode('edit')}>Limit and days</Button>
              <Button variant="ghost" onClick={() => setMode('adjust')}>Correct balance</Button>
              <Button variant="ghost" onClick={() => exportStatement(customerId)}>Download statement</Button>
            </div>
          )}
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button onClick={() => setMode('pay')}>Take payment</Button>
        </>
      )}
    >
      <Alert>{error}</Alert>
      {!d && !error && <Loading>Opening the account…</Loading>}
      {a && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {[
              a.owed < 0 ? ['Paid in advance', money(-a.owed), 'text-ok'] : ['Owes', money(a.owed), a.owed > a.limit ? 'text-bad' : 'text-ink'],
              ['Limit', money(a.limit), 'text-ink'],
              ['Left to use', money(a.available), a.available > 0 ? 'text-ok' : 'text-bad'],
              ['Late', a.overdue ? money(a.overdue) : 'Nothing', a.overdue ? 'text-bad' : 'text-ok'],
            ].map(([k, v, c]) => (
              <div key={k} className="rounded-xl border border-line bg-surface-2 px-3.5 py-2.5">
                <span className="block text-[11.5px] font-semibold text-ink-muted">{k}</span>
                <b className={cn('tnum text-[16px]', c)}>{v}</b>
              </div>
            ))}
          </div>
          <div>
            <UsedBar owed={a.owed} limit={a.limit} />
            <p className="mt-1.5 flex flex-wrap gap-x-3 text-[12px] text-ink-muted">
              <StatusChip a={a} />
              <span>{a.termsDays} days to pay each bill</span>
              {a.nextDue && <span>Next due {day(a.nextDue)}</span>}
              {a.lastPayment && <span>Last paid {money(a.lastPayment.amount)} on {day(a.lastPayment.date)}</span>}
            </p>
            {a.blocked && <p className="mt-2 rounded-lg bg-warn-bg px-3 py-2 text-[12.5px] font-semibold text-warn">Cannot buy more on credit now: {a.blocked}</p>}
            {a.note && <p className="mt-2 text-[12.5px] text-ink-2">Note: {a.note}</p>}
          </div>

          {a.owed > 0 && <Aging aging={a.aging} total={a.owed} />}

          {list(d.bills).length > 0 && (
            <div>
              <h3 className="mb-1.5 text-[12px] font-bold uppercase tracking-wide text-ink-muted">Bills not yet paid</h3>
              <TableWrap className="rounded-lg border border-line">
                <Table>
                  <thead><tr><Th>Date</Th><Th>Receipt</Th><Th num>Bill</Th><Th num>Still owed</Th><Th>Due</Th></tr></thead>
                  <tbody>
                    {list(d.bills).map((b) => {
                      const late = b.due < new Date().toISOString().slice(0, 10);
                      return (
                        <Tr key={b.id}>
                          <Td className="whitespace-nowrap">{day(b.date)}</Td>
                          <Td className="tnum">{b.ref || '-'}</Td>
                          <Td num>{money(b.amount)}</Td>
                          <Td num className="font-semibold text-ink">{money(b.left)}</Td>
                          <Td className={cn('whitespace-nowrap', late && 'font-semibold text-bad')}>{late ? `Late since ${day(b.due)}` : day(b.due)}</Td>
                        </Tr>
                      );
                    })}
                  </tbody>
                </Table>
              </TableWrap>
            </div>
          )}

          <div>
            <h3 className="mb-1.5 text-[12px] font-bold uppercase tracking-wide text-ink-muted">Statement</h3>
            <TableWrap className="max-h-[320px] overflow-y-auto rounded-lg border border-line">
              <Table>
                <thead><tr><Th>Date</Th><Th>What</Th><Th>Ref</Th><Th num>Bought (debit)</Th><Th num>Paid (credit)</Th><Th num>Balance</Th></tr></thead>
                <tbody>
                  {list(d.statement).map((l) => (
                    <Tr key={l.id}>
                      <Td className="whitespace-nowrap">{day(l.date)}</Td>
                      <Td>
                        <span className="text-ink">{l.what}</span>
                        {(l.note || l.by) && <span className="block text-[11px] text-ink-muted">{[l.orderNo, l.note && l.note !== l.orderNo ? l.note : null, l.by].filter(Boolean).join(' · ')}</span>}
                      </Td>
                      <Td className="tnum text-[12px]">{l.ref || '-'}</Td>
                      <Td num className={l.debit ? 'text-ink' : 'text-ink-faint'}>{l.debit ? money(l.debit) : '-'}</Td>
                      <Td num className={l.credit ? 'font-semibold text-ok' : 'text-ink-faint'}>{l.credit ? money(l.credit) : '-'}</Td>
                      <Td num className="font-bold text-ink">{money(l.balance)}</Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          </div>
        </div>
      )}

      {mode === 'pay' && a && <TakePayment a={a} onClose={() => setMode(null)} onDone={done} />}
      {mode === 'edit' && a && <EditAccount a={a} onClose={() => setMode(null)} onDone={done} />}
      {mode === 'adjust' && a && <Adjust a={a} onClose={() => setMode(null)} onDone={done} />}
    </Modal>
  );
}

function TakePayment({ a, onClose, onDone }) {
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('cash');
  const [ref, setRef] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // Set when the server stops what looks like the same payment twice.
  const [twice, setTwice] = useState(false);
  const [again, setAgain] = useState(false);
  const n = Number(amount || 0);
  const needRef = method !== 'cash';

  async function go() {
    setBusy(true);
    setError('');
    try {
      const r = await api(`/api/credit/${a.customerId}/payment`, { method: 'POST', body: { amount: n, method, ref, note, again } });
      onDone(`${a.name} paid ${money(n)}. Receipt ${r.receiptNo}. Now owes ${money(r.account.owed)}.`);
    } catch (e) {
      if (e.code === 'ah_paid_twice') setTwice(true);
      setError(e.message);
      setBusy(false);
    }
  }

  return (
    <Modal
      title={`Payment from ${a.name}`}
      description={a.owed > 0 ? `Owes ${money(a.owed)}. The oldest bill is paid first.` : 'Owes nothing. A payment now is kept for their next credit order.'}
      onClose={onClose}
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button disabled={busy || n <= 0 || (needRef && ref.trim().length < 3)} onClick={go}>{busy ? 'Saving…' : `Receive ${money(n)}`}</Button></>}
    >
      <div className="space-y-4">
        <Alert>{error}</Alert>
        <Field label="Amount paid">
          <MoneyField value={amount} onChange={setAmount} placeholder="0" strong autoFocus />
        </Field>
        <div className="flex flex-wrap gap-2">
          {[a.owed, a.overdue, Math.round(a.owed / 2)].filter((v, i, x) => v > 0 && x.indexOf(v) === i).map((v) => (
            <button key={v} type="button" onClick={() => setAmount(String(v))} className="rounded-full border border-line px-3 py-1 text-[12px] font-semibold text-ink-2 hover:border-brand hover:text-brand">
              {v === a.owed ? 'All' : v === a.overdue ? 'Late part' : 'Half'} · {money(v)}
            </button>
          ))}
        </div>
        <Field label="How did they pay?">
          <Segmented label="Method" value={method} onChange={setMethod} options={[{ value: 'cash', label: 'Cash' }, { value: 'mobile_money', label: 'Mobile Money' }, { value: 'bank', label: 'Bank' }, { value: 'cheque', label: 'Cheque' }]} />
        </Field>
        {needRef && (
          <Field label={method === 'cheque' ? 'Cheque number' : 'Transaction ID'}>
            <Input value={ref} onChange={(e) => setRef(e.target.value)} />
          </Field>
        )}
        <Field label="Note (optional)"><Input value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        {twice && <Checkbox label="It is a second payment, not the same one again" checked={again} onChange={(e) => setAgain(e.target.checked)} />}
        {n > 0 && (
          <p className="rounded-lg bg-surface-2 px-3 py-2 text-[12.5px] text-ink-2">
            {a.owed - n >= 0
              ? <>After this they owe <b className="tnum text-ink">{money(a.owed - n)}</b>.</>
              : <>They owe nothing, and <b className="tnum text-ok">{money(n - a.owed)}</b> is kept for their next credit order.</>}
            {' '}It goes in the cash book with a receipt.
          </p>
        )}
      </div>
    </Modal>
  );
}

function EditAccount({ a, onClose, onDone }) {
  const [limit, setLimit] = useState(String(a.limit || ''));
  const [terms, setTerms] = useState(String(a.termsDays || 30));
  const [status, setStatus] = useState(a.status === 'none' ? 'active' : a.status);
  const [note, setNote] = useState(a.note || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function go() {
    setBusy(true);
    setError('');
    try {
      await api(`/api/manager/credit/${a.customerId}`, { method: 'POST', body: { limit: Number(limit), termsDays: Number(terms), status, note } });
      onDone(`${a.name}: saved.`);
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }

  return (
    <Modal title={`Credit for ${a.name}`} onClose={onClose} footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button disabled={busy || !(Number(limit) >= 0)} onClick={go}>{busy ? 'Saving…' : 'Save'}</Button></>}>
      <div className="space-y-4">
        <Alert>{error}</Alert>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Limit"><MoneyField value={limit} onChange={setLimit} strong /></Field>
          <Field label="Days to pay each bill">
            <Select value={terms} onChange={(e) => setTerms(e.target.value)}>
              {[...new Set([1, 3, 7, 14, 30, 45, 60, 90, Number(terms)])].sort((x, y) => x - y).map((d) => <option key={d} value={d}>{d} {d === 1 ? 'day' : 'days'}</option>)}
            </Select>
          </Field>
        </div>
        <Field label="Can they buy on credit?">
          <Segmented label="Status" value={status} onChange={setStatus} options={[{ value: 'active', label: 'Yes' }, { value: 'hold', label: 'Stop for now' }, { value: 'closed', label: 'Close account' }]} />
        </Field>
        <Field label="Note"><Input value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        <p className="text-[12px] text-ink-muted">Stopping or closing does not change what they owe. They can still pay.</p>
      </div>
    </Modal>
  );
}

function Adjust({ a, onClose, onDone }) {
  const [kind, setKind] = useState('adjustment');
  const [way, setWay] = useState('add');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const n = Number(amount || 0);
  const signed = kind === 'writeoff' ? -n : kind === 'opening' ? n : way === 'add' ? n : -n;

  async function go() {
    setBusy(true);
    setError('');
    try {
      await api(`/api/manager/credit/${a.customerId}/adjust`, { method: 'POST', body: { kind, amount: signed, reason } });
      onDone(`${a.name}: balance corrected by ${money(signed)}.`);
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }

  return (
    <Modal title={`Correct ${a.name}'s balance`} description={`Owes ${money(a.owed)} now. Every correction is kept with your name.`} onClose={onClose} footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button disabled={busy || n <= 0 || reason.trim().length < 3} onClick={go}>{busy ? 'Saving…' : 'Save'}</Button></>}>
      <div className="space-y-4">
        <Alert>{error}</Alert>
        <Field label="What is it?">
          <Segmented label="Kind" value={kind} onChange={setKind} options={[{ value: 'adjustment', label: 'Correction' }, { value: 'opening', label: 'Old balance' }, { value: 'writeoff', label: 'Write off' }]} />
        </Field>
        {kind === 'adjustment' && (
          <Segmented label="Way" value={way} onChange={setWay} options={[{ value: 'add', label: 'Add to what they owe' }, { value: 'take', label: 'Take off' }]} />
        )}
        <Field label="Amount"><MoneyField value={amount} onChange={setAmount} strong /></Field>
        <Field label="Why?"><Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={kind === 'writeoff' ? 'Customer left the country, cannot be found' : 'From the notebook, 25 Nov'} /></Field>
        {n > 0 && <p className="rounded-lg bg-surface-2 px-3 py-2 text-[12.5px] text-ink-2">After this they owe <b className="tnum text-ink">{money(a.owed + signed)}</b>.</p>}
      </div>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────

async function exportStatement(customerId) {
  const { exportCreditStatement } = await import('@/lib/exports');
  await exportCreditStatement(customerId);
}

/** The "Cash and Credit Sales Detailed Report", for any days. */
function SalesReportButton() {
  const [open, setOpen] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function go() {
    setBusy(true);
    setError('');
    try {
      const { exportSalesReport } = await import('@/lib/exports');
      await exportSalesReport({ from, to });
      setOpen(false);
    } catch (e) {
      setError(e.message);
    }
    setBusy(false);
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>Cash & credit report</Button>
      {open && (
        <Modal
          title="Cash and credit sales report"
          description="Every line sold, cash sales and credit sales apart, with totals."
          onClose={() => setOpen(false)}
          footer={<><Button variant="outline" onClick={() => setOpen(false)}>Close</Button><Button disabled={busy || from > to} onClick={go}>{busy ? 'Making it…' : 'Download'}</Button></>}
        >
          <Alert>{error}</Alert>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="From"><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
            <Field label="To"><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
          </div>
        </Modal>
      )}
    </>
  );
}
