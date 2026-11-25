'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api, peek } from '@/lib/api';
import { PasswordField, SignInCard, makePassword, passwordProblem } from '@/components/StaffBits';
import { cn } from '@/lib/cn';
import { list, dateTime } from '@/lib/format';
import {
  Alert, Button, Card, CardHead, CardTitle, Chip, Empty, Field, Input, Loading,
  Modal, PageHead, Select, Stat, Stats, Table, TableWrap, Td, Th, Tr, LoadFailed } from '@/components/ui';
import { Icon } from '@/components/icons';

const ROLE_LABEL = {
  cashier: 'Cashier',
  accounts: 'Accounts',
  store: 'Store Manager',
  manager: 'Manager',
};

const REACH = [
  ['Cashier', 'The payment queue, receipts, the cash book (read-only), end of day'],
  ['Accounts', 'Verifying payments, the cash book, reconciliation, reports'],
  ['Store Manager', 'Approved orders, the pick list, releasing goods (on the app)'],
  ['Manager', 'Everything, plus products, staff, customers and the audit trail'],
];

/**
 * Who works here and at which desk.
 *
 * Hire from here: name, number, desk and a password the manager hands
 * over in person. Open anyone to see what they have been doing.
 */
export default function ManagerStaff() {
  const [staff, setStaff] = useState(() => {
    const r = peek('/api/manager/staff');
    return r ? list(r.staff) : null;
  });
  const [hiring, setHiring] = useState(false);
  const [changing, setChanging] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    try {
      const r = await api('/api/manager/staff');
      setStaff(list(r.staff));
      setError('');
    } catch (e) {
      // On failure, keep what was on screen; the error says it is stale.
      setError(e.message);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const count = (role) => (staff || []).filter((s) => s.role === role).length;

  return (
    <>
      <PageHead
        title="Desk logins"
        sub="Everyone with a desk, and what each one can reach."
      >
        <Button onClick={() => setHiring(true)}>Hire someone</Button>
      </PageHead>

      <Alert>{error}</Alert>
      <Alert kind="ok" onDone={() => setNotice('')}>{notice}</Alert>

      <Stats>
        {Object.keys(ROLE_LABEL).map((r) => (
          <Stat key={r} label={ROLE_LABEL[r]} value={count(r)} icon={{ cashier: Icon.cash(), accounts: Icon.check(), store: Icon.box(), manager: Icon.user() }[r]} tone="neutral" />
        ))}
      </Stats>

      <Card className="mb-4">
        <CardHead><CardTitle>Everyone with a desk</CardTitle></CardHead>
        {!staff ? (
          error ? <LoadFailed onRetry={load}>{error}</LoadFailed> : <Loading>Loading staff…</Loading>
        ) : staff.length === 0 ? (
          <Empty
            title="No staff accounts yet"
            action={<Button onClick={() => setHiring(true)}>Hire someone</Button>}
          >
            A name, a phone number and a desk is all it takes.
          </Empty>
        ) : (
          <TableWrap>
            <Table>
              <thead>
                <tr><Th>Name</Th><Th>Desk</Th><Th>Phone</Th><Th>Last on</Th><Th>Status</Th><Th /></tr>
              </thead>
              <tbody>
                {staff.map((s) => (
                  <Tr key={s.id}>
                    <Td>
                      <Link href={`/manager/staff/${s.id}`} className="font-semibold text-ink hover:text-brand hover:underline">
                        {s.fullName}
                      </Link>
                    </Td>
                    <Td>{ROLE_LABEL[s.role] || s.role}</Td>
                    <Td className="tnum">{s.phone || ''}</Td>
                    <Td className="tnum text-ink-muted">{s.lastSeen ? dateTime(s.lastSeen) : 'not yet'}</Td>
                    <Td>
                      <Chip tone={s.status === 'active' ? 'good' : 'grey'}>
                        {s.status === 'active' ? 'Active' : 'Suspended'}
                      </Chip>
                    </Td>
                    <Td>
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => setChanging(s)}>
                          Change
                        </Button>
                        <Link
                          href={`/manager/staff/${s.id}`}
                          className="inline-flex h-8 items-center rounded-sm bg-fill px-3 text-[13px] font-semibold text-white hover:bg-fill-dark"
                        >
                          Open
                        </Link>
                      </div>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </Card>

      {hiring && (
        <HireDialog
          onClose={() => setHiring(false)}
          onDone={(msg) => { setHiring(false); setNotice(msg); load(); }}
        />
      )}

      {changing && (
        <ChangeDialog
          person={changing}
          onClose={() => setChanging(null)}
          onDone={(msg) => { setChanging(null); setNotice(msg); load(); }}
        />
      )}

      <Card>
        <CardHead><CardTitle>What each desk can reach</CardTitle></CardHead>
        <TableWrap>
          <Table>
            <tbody>
              {REACH.map(([desk, what]) => (
                <Tr key={desk}>
                  <Td className="w-[150px] align-top font-semibold text-ink">{desk}</Td>
                  <Td>{what}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </TableWrap>
      </Card>
    </>
  );
}

const DESKS = [
  ['cashier', 'Cashier'],
  ['accounts', 'Accounts'],
  ['store', 'Store Manager'],
  ['manager', 'Manager'],
];

/**
 * Put somebody on a desk, with a password the manager chooses.
 *
 * The manager hands it over in person, and can sign in as them with it
 * to see their screen. It is shown once, after saving, and never sent
 * by SMS.
 */
function HireDialog({ onClose, onDone }) {
  const [form, setForm] = useState({ fullName: '', phone: '', email: '', desk: 'cashier', password: makePassword() });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [hired, setHired] = useState(null);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const r = await api('/api/manager/staff/create', { method: 'POST', body: form });
      // Only a password the server says it saved is shown. A site still on
      // the older plugin ignores the field and makes its own; showing the
      // typed one there would hand the person a password that fails.
      setHired({
        name: r.staff.fullName,
        id: r.staff.id,
        phone: r.signInWith || r.staff.phone,
        password: r.passwordSet === true ? form.password : null,
      });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  const deskName = DESKS.find(([v]) => v === form.desk)?.[1];

  if (hired) {
    const finish = () => onDone(`${hired.name} is on the ${deskName} desk.`);
    return (
      <Modal
        title={`${hired.name} is on the ${deskName} desk`}
        description="Give them these. They have been texted that their account is ready, not the password."
        onClose={finish}
        footer={
          <>
            <Link
              href={`/manager/staff/${hired.id}`}
              className="inline-flex h-10 items-center rounded-sm border border-line px-4 text-sm font-semibold text-ink hover:bg-surface-2"
            >
              Open their page
            </Link>
            <Button onClick={finish}>Done</Button>
          </>
        }
      >
        {hired.password ? (
          <SignInCard phone={hired.phone} password={hired.password} />
        ) : (
          <p className="text-[13.5px] leading-relaxed text-ink-2">
            They sign in with <strong className="tnum">{hired.phone}</strong> and a code texted to that phone.
            This site is on an older version of the plugin, which does not take a password from here.
            Upload the latest one to set passwords when hiring.
          </p>
        )}
      </Modal>
    );
  }

  return (
    <Modal
      title="Hire someone"
      description="Their sign-in is ready as soon as you save. You hand them the password."
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            type="submit"
            form="hire"
            disabled={busy || !form.fullName.trim() || !form.phone.trim() || !form.password || !!passwordProblem(form.password)}
          >
            {busy ? 'Adding…' : 'Add them'}
          </Button>
        </>
      }
    >
      <form id="hire" onSubmit={submit} className="space-y-4">
        <Alert>{error}</Alert>

        <Field label="Their name">
          <Input value={form.fullName} onChange={set('fullName')} placeholder="Aisha Nakabugo" autoFocus />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Phone" hint="They sign in with this.">
            <Input value={form.phone} onChange={set('phone')} placeholder="0772 500 100" inputMode="tel" className="tnum" />
          </Field>
          <Field label="Email (optional)">
            <Input type="email" value={form.email} onChange={set('email')} placeholder="aisha@alhadeed.ug" />
          </Field>
        </div>

        <Field label="Which desk">
          <Select value={form.desk} onChange={set('desk')}>
            {DESKS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Select>
        </Field>

        <PasswordField
          value={form.password}
          onChange={(v) => setForm((f) => ({ ...f, password: v }))}
          hint="Already made for you. Change it if you like. You can set a new one later."
        />
      </form>
    </Modal>
  );
}

/** Move somebody to another desk, or stop them signing in. */
function ChangeDialog({ person, onClose, onDone }) {
  const [desk, setDesk] = useState(person.role);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const suspended = person.status !== 'active';

  async function save(body, msg) {
    setBusy(true);
    setError('');
    try {
      await api(`/api/manager/staff/${person.id}`, { method: 'PATCH', body });
      onDone(msg);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <Modal
      title={person.fullName}
      description={`${ROLE_LABEL[person.role] || person.role}${person.phone ? ' · ' + person.phone : ''}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            variant={suspended ? 'good' : 'danger'}
            disabled={busy}
            onClick={() =>
              save(
                { status: suspended ? 'active' : 'suspended' },
                suspended
                  ? `${person.fullName} can sign in again.`
                  : `${person.fullName} can no longer sign in.`
              )
            }
          >
            {suspended ? 'Let them back in' : 'Suspend'}
          </Button>
          <Button
            disabled={busy || desk === person.role}
            onClick={() => save({ desk }, `${person.fullName} moved to ${DESKS.find(([v]) => v === desk)?.[1]}.`)}
          >
            Move desk
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Alert>{error}</Alert>

        <Field label="Desk">
          <Select value={desk} onChange={(e) => setDesk(e.target.value)}>
            {DESKS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Select>
        </Field>

        <p className="text-[12.5px] leading-relaxed text-ink-muted">
          Suspending keeps the account and everything it has ever done. Deleting
          someone takes their name off the audit trail, which is the one record that
          answers &ldquo;who did that&rdquo;.
        </p>
      </div>
    </Modal>
  );
}
