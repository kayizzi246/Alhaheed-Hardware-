'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { api, peek } from '@/lib/api';
import { usePoll } from '@/lib/live';
import { money, shortMoney, dateTime, methodLabel, list } from '@/lib/format';
import {
  Alert, Button, Card, CardHead, CardTitle, Chip, Empty, Fresh, Loading,
  Modal, PageHead, Stat, Stats, Table, TableWrap, Td, Th, Tr,
} from '@/components/ui';
import { Icon } from '@/components/icons';
import { PasswordField, SignInCard, passwordProblem } from '@/components/StaffBits';

const ROLE_LABEL = { cashier: 'Cashier', accounts: 'Accounts', store: 'Store Manager', manager: 'Manager' };

// What the audit trail calls things, in the words the shop uses.
const ACTION_LABEL = {
  payment_received: 'Took a payment',
  verified: 'Verified a payment',
  rejected: 'Sent a payment back',
  released: 'Released goods',
  cancelled: 'Cancelled an order',
  placed: 'Placed an order',
  staff_added: 'Hired',
  staff_suspended: 'Suspended',
  staff_restored: 'Let back in',
  staff_moved: 'Moved desk',
  staff_password_set: 'Set a password for',
  expense_raised: 'Asked for money',
  expense_approved: 'Approved spending',
  expense_declined: 'Declined spending',
  expense_paid: 'Paid out',
};
const say = (a) => ACTION_LABEL[a] || a.replace(/_/g, ' ');

const STATE = {
  verified: ['good', 'Verified'],
  rejected: ['bad', 'Sent back'],
  waiting: ['warn', 'With Accounts'],
};

/**
 * One member of staff, and what they have been doing.
 *
 * Read from the records the work already leaves behind — receipts,
 * verifications, releases, the audit trail — so nothing extra is
 * tracked to make it. Refreshes itself, because the point is to see
 * what is going on now, not when the page was opened.
 */
export default function StaffMember() {
  const { id } = useParams();
  const [data, setData] = useState(() => peek(`/api/manager/staff/${id}`));
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [resetting, setResetting] = useState(false);
  const [viewing, setViewing] = useState(null);
  const [busy, setBusy] = useState(false);
  const [allActs, setAllActs] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await api(`/api/manager/staff/${id}`));
      setError('');
    } catch (e) {
      setData((d) => d || { failed: true });
      setError(e.message);
    }
  }, [id]);

  const { at, failing } = usePoll(load, 15000);

  if (!data) return <Loading>Loading…</Loading>;
  if (data.failed) {
    return (
      <>
        <PageHead title="Staff member" />
        <Alert>{error}</Alert>
        <Link href="/manager/staff" className="text-[13px] font-semibold text-brand">Back to staff</Link>
      </>
    );
  }

  const s = data.staff;
  const suspended = s.status !== 'active';
  const t = data.takings || {};
  const c = data.checks || {};
  const acts = data.actions || {};
  const count = (period, key) => (acts[period] && acts[period][key]) || 0;
  const totalActs = (period) => Object.values(acts[period] || {}).reduce((a, b) => a + b, 0);
  const receipts = list(data.receipts);
  const recent = list(data.recent);
  const requests = list(data.requests);

  async function toggleSuspend() {
    setBusy(true);
    try {
      await api(`/api/manager/staff/${s.id}`, { method: 'PATCH', body: { status: suspended ? 'active' : 'suspended' } });
      setNotice(suspended ? `${s.fullName} can sign in again.` : `${s.fullName} is signed out and can no longer sign in.`);
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Link href="/manager/staff" className="mb-2 inline-block text-[12px] font-semibold text-brand hover:underline">
        ← All staff
      </Link>
      <PageHead
        title={s.fullName}
        sub={[
          ROLE_LABEL[s.desk] || s.desk,
          s.phone,
          s.lastSeen ? `last on ${dateTime(s.lastSeen)}` : 'not signed in yet',
        ].filter(Boolean).join(' · ')}
      >
        <Fresh at={at} failing={failing} />
        {s.canResetPassword && (
          <Button variant="outline" size="sm" onClick={() => setResetting(true)}>Set a new password</Button>
        )}
        {s.canResetPassword && (
          <Button variant={suspended ? 'good' : 'danger'} size="sm" disabled={busy} onClick={toggleSuspend}>
            {suspended ? 'Let them back in' : 'Suspend'}
          </Button>
        )}
      </PageHead>

      <Alert>{error}</Alert>
      <Alert kind="ok" onDone={() => setNotice('')}>{notice}</Alert>

      {suspended && (
        <Alert>Suspended. They cannot sign in. Everything they did is kept.</Alert>
      )}

      {/* The figures that matter for their desk. */}
      {s.desk === 'cashier' && (
        <Stats>
          <Stat label="Taken today" icon={Icon.cash()} value={shortMoney(t.today?.total)} note={`${t.today?.receipts || 0} receipts · ${money(t.today?.total)}`} lead />
          <Stat label="Taken this month" icon={Icon.chart()} tone="neutral" value={shortMoney(t.month?.total)} note={`${t.month?.receipts || 0} receipts`} />
          <Stat
            label="Mobile money this month" icon={Icon.phone()}
            value={shortMoney(t.month?.momo)}
            note={`cash ${shortMoney(t.month?.cash)} · card ${shortMoney(t.month?.card)}`}
          />
          <Stat
            label="Sent back by Accounts" icon={t.month?.sent_back ? Icon.close() : Icon.check()}
            value={t.month?.sent_back || 0}
            note="this month"
            tone={t.month?.sent_back ? 'bad' : 'ok'}
          />
        </Stats>
      )}
      {s.desk === 'accounts' && (
        <Stats>
          <Stat label="Verified today" icon={Icon.check()} value={c.today?.verified || 0} lead />
          <Stat label="Verified this month" icon={Icon.chart()} tone="neutral" value={c.month?.verified || 0} />
          <Stat label="Sent back today" icon={Icon.close()} tone="neutral" value={c.today?.rejected || 0} />
          <Stat label="Sent back this month" icon={Icon.close()} tone="neutral" value={c.month?.rejected || 0} />
        </Stats>
      )}
      {s.desk === 'store' && (
        <Stats>
          <Stat label="Released today" icon={Icon.box()} value={count('today', 'released')} lead />
          <Stat label="Released this month" icon={Icon.chart()} tone="neutral" value={count('month', 'released')} />
          <Stat label="Everything today" icon={Icon.clock()} tone="neutral" value={totalActs('today')} />
          <Stat label="Everything this month" icon={Icon.chart()} tone="neutral" value={totalActs('month')} />
        </Stats>
      )}
      {s.desk === 'manager' && (
        <Stats>
          <Stat label="Actions today" icon={Icon.clock()} value={totalActs('today')} lead />
          <Stat label="Actions this month" icon={Icon.chart()} tone="neutral" value={totalActs('month')} />
        </Stats>
      )}

      {/* Their money first, then everything else they did. */}
      <div className="mb-4 flex flex-col gap-4">
        <Card>
          <CardHead>
            <CardTitle>What they have been doing</CardTitle>
            <span className="text-[12px] text-ink-muted">latest first</span>
          </CardHead>
          {recent.length === 0 ? (
            <Empty title="Nothing recorded yet">Whatever they do at their desk appears here.</Empty>
          ) : (
            <ul className="divide-y divide-line">
              {(allActs ? recent : recent.slice(0, 12)).map((r, i) => (
                <li key={i} className="flex items-baseline gap-3 px-4 py-2.5 text-[12.5px]">
                  <span className="tnum w-[92px] shrink-0 text-[11.5px] text-ink-muted">{dateTime(r.at)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="font-medium text-ink">{say(r.action)}</span>
                    {r.orderNo && (
                      <>
                        {' · '}
                        <Link href={`/manager/orders/${r.orderId}`} className="tnum font-semibold text-brand hover:underline">
                          {r.orderNo}
                        </Link>
                      </>
                    )}
                    {r.notes && !r.orderNo && <span className="text-ink-muted"> · {r.notes}</span>}
                  </span>
                </li>
              ))}
              {recent.length > 12 && (
                <li className="px-4 py-2.5">
                  <button type="button" onClick={() => setAllActs((v) => !v)} className="text-[12px] font-semibold text-brand hover:underline">
                    {allActs ? 'Show fewer' : `Show all ${recent.length}`}
                  </button>
                </li>
              )}
            </ul>
          )}
        </Card>

        {(s.desk === 'cashier' || receipts.length > 0) && (
          <Card className="order-first">
            <CardHead>
              <CardTitle>Their receipts</CardTitle>
              <span className="text-[12px] text-ink-muted">and what Accounts made of each</span>
            </CardHead>
            {receipts.length === 0 ? (
              <Empty title="No payments taken yet" />
            ) : (
              <TableWrap>
                <Table>
                  <thead>
                    <tr><Th>Receipt</Th><Th>Order</Th><Th>Method</Th><Th num>Amount</Th><Th>Accounts</Th><Th /></tr>
                  </thead>
                  <tbody>
                    {receipts.map((r) => (
                      <Tr key={r.paymentId}>
                        <Td>
                          <span className="tnum whitespace-nowrap font-semibold text-ink">{r.receiptNo}</span>
                          <span className="tnum block whitespace-nowrap text-[11.5px] text-ink-muted">{dateTime(r.at)}</span>
                        </Td>
                        <Td className="tnum whitespace-nowrap">{r.orderNo}</Td>
                        <Td>
                          {methodLabel(r.method)}
                          {r.ref && <span className="tnum block text-[11.5px] text-ink-muted">{r.ref}</span>}
                        </Td>
                        <Td num className="whitespace-nowrap font-semibold text-ink">{money(r.amount)}</Td>
                        <Td className="whitespace-nowrap">
                          <Chip tone={STATE[r.state][0]}>{STATE[r.state][1]}</Chip>
                          {r.state === 'rejected' && r.remarks && (
                            <span className="mt-1 block text-[11.5px] text-ink-muted">&ldquo;{r.remarks}&rdquo;</span>
                          )}
                        </Td>
                        <Td>
                          {r.hasProof && (
                            <Button variant="ghost" size="sm" onClick={() => setViewing(r)}>Screenshot</Button>
                          )}
                        </Td>
                      </Tr>
                    ))}
                  </tbody>
                </Table>
              </TableWrap>
            )}
          </Card>
        )}
      </div>

      {requests.length > 0 && (
        <Card className="mb-4">
          <CardHead><CardTitle>Money they asked for</CardTitle></CardHead>
          <TableWrap>
            <Table>
              <thead><tr><Th>Ref</Th><Th>What for</Th><Th num>Amount</Th><Th>Status</Th><Th>When</Th></tr></thead>
              <tbody>
                {requests.map((r) => (
                  <Tr key={r.ref}>
                    <Td className="tnum font-semibold text-ink">{r.ref}</Td>
                    <Td>{r.details}</Td>
                    <Td num>{money(r.amount)}</Td>
                    <Td className="capitalize">{r.status}</Td>
                    <Td className="tnum text-ink-muted">{dateTime(r.created_at)}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        </Card>
      )}

      <p className="text-[12px] text-ink-muted">
        On the staff list since {dateTime(s.joined)}{s.hiredBy ? `, hired by ${s.hiredBy}` : ''}.
      </p>

      {resetting && (
        <ResetPassword
          person={s}
          onClose={() => setResetting(false)}
          onDone={(msg) => { setResetting(false); setNotice(msg); load(); }}
        />
      )}
      {viewing && <Screenshot receipt={viewing} onClose={() => setViewing(null)} />}
    </>
  );
}

function ResetPassword({ person, onClose, onDone }) {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(null);

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const r = await api(`/api/manager/staff/${person.id}/password`, { method: 'POST', body: { password } });
      setDone({ phone: r.signInWith || person.phone, password });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <Modal
        title="New password set"
        description={`${person.fullName} has been signed out everywhere. Hand these over in person.`}
        onClose={() => onDone(`New password set for ${person.fullName}.`)}
        footer={<Button onClick={() => onDone(`New password set for ${person.fullName}.`)}>Done</Button>}
      >
        <SignInCard phone={done.phone} password={done.password} />
      </Modal>
    );
  }

  return (
    <Modal
      title={`New password for ${person.fullName}`}
      description="Any screen they have open signs out straight away. Their history is not touched."
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="reset" disabled={busy || !password || !!passwordProblem(password)}>
            {busy ? 'Saving…' : 'Set password'}
          </Button>
        </>
      }
    >
      <form id="reset" onSubmit={save} className="space-y-4">
        <Alert>{error}</Alert>
        <PasswordField value={password} onChange={setPassword} autoFocus />
      </form>
    </Modal>
  );
}

function Screenshot({ receipt, onClose }) {
  const [src, setSrc] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    let url = '';
    let live = true;
    api(`/api/payments/${receipt.paymentId}/proof`, { raw: true })
      .then(async (res) => {
        if (!res.ok) throw new Error('The picture could not be loaded.');
        url = URL.createObjectURL(await res.blob());
        if (live) setSrc(url);
      })
      .catch((e) => live && setError(e.message));
    return () => { live = false; if (url) URL.revokeObjectURL(url); };
  }, [receipt.paymentId]);

  return (
    <Modal
      title={`${receipt.receiptNo} · ${receipt.orderNo}`}
      description={`${money(receipt.amount)} · ${methodLabel(receipt.method)}${receipt.ref ? ' · ' + receipt.ref : ''}`}
      onClose={onClose}
      footer={<Button variant="outline" onClick={onClose}>Close</Button>}
    >
      <Alert>{error}</Alert>
      {!src && !error && <Loading>Loading the picture…</Loading>}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {src && <img src={src} alt={`Screenshot for ${receipt.receiptNo}`} className="max-h-[60vh] w-full rounded-sm border border-line object-contain" />}
    </Modal>
  );
}
