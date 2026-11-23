'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { list } from '@/lib/format';
import {
  Alert, Button, Card, CardHead, CardTitle, Chip, Empty, Field, Input, Loading,
  Modal, PageHead, Select, Stat, Stats, Table, TableWrap, Td, Th, Tr,
} from '@/components/ui';

const ROLE_LABEL = {
  cashier: 'Cashier',
  accounts: 'Accounts',
  store: 'Store Manager',
  manager: 'Manager',
};

const REACH = [
  ['Cashier', 'The payment queue, receipts, the cash book (read-only), end of day'],
  ['Accounts', 'Verifying payments, the cash book, reconciliation, reports'],
  ['Store Manager', 'Approved orders, the pick list, releasing goods — on the app'],
  ['Manager', 'Everything, plus products, staff, customers and the audit trail'],
];

/**
 * Who works here and at which desk.
 *
 * Staff accounts are WordPress users, so they are created there —
 * Users → Add New, with the right role. This screen is the register:
 * who exists, what they can reach, and whether they are still active.
 */
export default function ManagerStaff() {
  const [staff, setStaff] = useState(null);
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
      setStaff([]);
      setError(e.message);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const count = (role) => (staff || []).filter((s) => s.role === role).length;

  return (
    <>
      <PageHead
        title="Staff"
        sub="Everyone with a desk, and what each one can reach."
      >
        <Button onClick={() => setHiring(true)}>Hire someone</Button>
      </PageHead>

      <Alert>{error}</Alert>
      <Alert kind="ok" onDone={() => setNotice('')}>{notice}</Alert>

      <Stats>
        {Object.keys(ROLE_LABEL).map((r) => (
          <Stat key={r} label={ROLE_LABEL[r]} value={count(r)} />
        ))}
      </Stats>

      <Card className="mb-4">
        <CardHead><CardTitle>Everyone with a desk</CardTitle></CardHead>
        {!staff ? (
          <Loading>Loading staff…</Loading>
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
                <tr><Th>Name</Th><Th>Desk</Th><Th>Phone</Th><Th>Email</Th><Th>Status</Th><Th /></tr>
              </thead>
              <tbody>
                {staff.map((s) => (
                  <Tr key={s.id}>
                    <Td className="font-semibold text-ink">{s.fullName}</Td>
                    <Td>{ROLE_LABEL[s.role] || s.role}</Td>
                    <Td className="tnum">{s.phone || '—'}</Td>
                    <Td>{s.email || '—'}</Td>
                    <Td>
                      <Chip tone={s.status === 'active' ? 'good' : 'grey'}>
                        {s.status === 'active' ? 'Active' : 'Suspended'}
                      </Chip>
                    </Td>
                    <Td className="text-right">
                      <Button variant="outline" size="sm" onClick={() => setChanging(s)}>
                        Change
                      </Button>
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
 * Put somebody on a desk.
 *
 * No password field, on purpose. A manager typing a password for
 * somebody else means two people know it, and the first thing that
 * person does is carry on using it. They are texted and sign in with a
 * code, which is how the desks are meant to be opened anyway.
 */
function HireDialog({ onClose, onDone }) {
  const [form, setForm] = useState({ fullName: '', phone: '', email: '', desk: 'cashier' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const r = await api('/api/manager/staff/create', { method: 'POST', body: form });
      onDone(`${r.staff.fullName} added to the ${DESKS.find(([v]) => v === form.desk)?.[1]} desk. They have been texted.`);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Hire someone"
      description="This sets up their sign-in and texts them how to use it."
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="hire" disabled={busy || !form.fullName.trim() || !form.phone.trim()}>
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

        <p className="text-[12.5px] leading-relaxed text-ink-muted">
          No password is set here. They are texted and sign in with a code — which means
          nobody but them ever knows it.
        </p>
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
