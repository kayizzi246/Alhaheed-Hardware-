'use client';

/**
 * Delete a customer account from the web.
 *
 * Google Play asks for an address that works without the app installed.
 * It keeps its own sign-in and never touches the staff session, so
 * opening it on a till computer signs nobody out.
 */
import { useState } from 'react';
import { API_BASE } from '@/lib/api';
import { Alert, Button, Card, CardBody, Field, Input, Segmented } from '@/components/ui';

async function post(path, body, token) {
  let res;
  try {
    res = await fetch(API_BASE + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error('The shop could not be reached. Check your connection and try again.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || data.message || 'That did not work. Please try again.');
  return data;
}

const WAYS = [
  { value: 'sms', label: 'SMS code' },
  { value: 'password', label: 'Password' },
];

export default function DeleteAccount() {
  const [way, setWay] = useState('sms');
  const [who, setWho] = useState('');
  const [secret, setSecret] = useState('');
  const [sent, setSent] = useState(false);
  const [account, setAccount] = useState(null); // { token, name }
  const [confirm, setConfirm] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const run = (job) => async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await job();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const signIn = run(async () => {
    if (way === 'sms' && !sent) {
      await post('/api/auth/otp/request', { phone: who });
      setSent(true);
      return;
    }
    const r = way === 'sms'
      ? await post('/api/auth/otp/verify', { phone: who, code: secret })
      : await post('/api/auth/login', { identifier: who, password: secret });
    setSecret('');
    if (r.user.role !== 'customer') throw new Error('This is a staff account. Ask the manager to close it.');
    setAccount({ token: r.token, name: r.user.fullName });
  });

  const remove = run(async () => {
    await post('/api/account/delete', { confirm }, account.token);
    setDone(true);
  });

  const needsSecret = way === 'password' || sent;

  return (
    <main className="mx-auto max-w-lg px-4 py-12 sm:py-16">
      <p className="text-[11.5px] font-semibold text-brand-dark">Al Hadeed Hardware</p>
      <h1 className="mt-1 text-[22px] leading-tight text-ink">Delete your account</h1>
      <p className="mt-3 text-[13px] leading-relaxed text-ink-2">
        For customers of the Al Hadeed Hardware app. You can also do this in the app, under{' '}
        <b>Account</b>, then <b>Delete account</b>.
      </p>

      <Card className="mt-4">
        <CardBody>
          <h2 className="text-[13.5px] font-bold text-ink">What happens</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-[12.5px] leading-relaxed text-ink-2">
            <li><b>Deleted at once:</b> your account, name, phone number, email, addresses and sign-in.</li>
            <li><b>Kept without your name:</b> past orders, receipts and payment records, because the shop must keep its accounts. A payment screenshot sent to the shop stays with its receipt.</li>
            <li><b>Orders you have not paid for</b> are cancelled. One you have paid for must be collected or refunded first.</li>
            <li>It cannot be undone.</li>
          </ul>
        </CardBody>
      </Card>

      <Card className="mt-5">
        <CardBody>
          <Alert>{error}</Alert>
          {done ? (
            <div role="status">
              <h2 className="text-[15px] font-bold text-ink">Your account has been deleted</h2>
              <p className="mt-2 text-[12.5px] text-ink-2">Thank you for shopping with us. You can make a new account any time.</p>
            </div>
          ) : account ? (
            <form onSubmit={remove} className="space-y-4">
              <p className="text-[12.5px] text-ink-2">Signed in as <b className="text-ink">{account.name}</b>.</p>
              <Field label="Type DELETE to confirm">
                <Input value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" autoCapitalize="characters" autoFocus />
              </Field>
              <Button type="submit" variant="danger" size="lg" block disabled={busy || confirm.trim().toUpperCase() !== 'DELETE'}>
                {busy ? 'Deleting…' : 'Delete my account for good'}
              </Button>
            </form>
          ) : (
            <form onSubmit={signIn} className="space-y-4">
              <p className="text-[12.5px] text-ink-2">Sign in first, so we know it is you.</p>
              <Segmented label="How to sign in" value={way} onChange={(v) => { setWay(v); setSent(false); setSecret(''); setError(''); }} options={WAYS} />
              <Field label={way === 'sms' ? 'Phone number' : 'Email or phone number'}>
                <Input
                  value={who}
                  onChange={(e) => { setWho(e.target.value); setSent(false); }}
                  type={way === 'sms' ? 'tel' : 'text'}
                  placeholder={way === 'sms' ? '0772 123 456' : ''}
                  autoComplete="username"
                />
              </Field>
              {needsSecret && (
                <Field label={way === 'sms' ? 'The 6-digit code we texted you' : 'Password'}>
                  <Input
                    value={secret}
                    onChange={(e) => setSecret(e.target.value)}
                    type={way === 'sms' ? 'text' : 'password'}
                    inputMode={way === 'sms' ? 'numeric' : undefined}
                    autoComplete={way === 'sms' ? 'one-time-code' : 'current-password'}
                  />
                </Field>
              )}
              <Button type="submit" size="lg" block disabled={busy || !who.trim() || (needsSecret && !secret)}>
                {busy ? 'One moment…' : needsSecret ? 'Continue' : 'Text me a code'}
              </Button>
            </form>
          )}
        </CardBody>
      </Card>
    </main>
  );
}
