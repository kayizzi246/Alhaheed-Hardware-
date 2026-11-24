'use client';

import { useState } from 'react';
import { Button, Field, Input } from '@/components/ui';

/**
 * Make a password a person can say out loud and type on a till.
 *
 * Two short words and a number, from a list with no lookalike letters:
 * "Cement-Lorry-48" survives being read across a counter in a way that
 * "x7#Qp!2v" does not. Random from the browser's crypto, not Math.random.
 */
const WORDS = [
  'Cement', 'Lorry', 'Hammer', 'Timber', 'Brick', 'Nails', 'Paint', 'Ladder', 'Shovel', 'Gravel',
  'Roofing', 'Steel', 'Drill', 'Bucket', 'Wheel', 'Spanner', 'Mango', 'Matoke', 'Nile', 'Jinja',
  'Kampala', 'Entebbe', 'Rhino', 'Crane', 'Falcon', 'Simba', 'Tiger', 'Zebra', 'Kettle', 'Basket',
];

export function makePassword() {
  const r = new Uint32Array(3);
  crypto.getRandomValues(r);
  const a = WORDS[r[0] % WORDS.length];
  let b = WORDS[r[1] % WORDS.length];
  if (b === a) b = WORDS[(r[1] + 7) % WORDS.length];
  return `${a}-${b}-${10 + (r[2] % 90)}`;
}

/** Same rules as the server, so the button only lights when it will be accepted. */
export function passwordProblem(p) {
  if (!p) return null;
  if (p.length < 8) return 'At least 8 characters.';
  if (!/[A-Za-z]/.test(p) || !/\d/.test(p)) return 'Use at least one letter and one number.';
  return null;
}

export function PasswordField({ value, onChange, label = 'Password', hint, autoFocus }) {
  const [shown, setShown] = useState(true);
  const problem = passwordProblem(value);
  return (
    <Field label={label} error={problem} hint={problem ? null : hint || 'At least 8 characters, with a letter and a number.'}>
      <div className="flex gap-2">
        <Input
          type={shown ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete="new-password"
          spellCheck={false}
          autoFocus={autoFocus}
          className="tnum flex-1"
          placeholder="Cement-Lorry-48"
        />
        <Button type="button" variant="outline" onClick={() => setShown((v) => !v)} className="shrink-0">
          {shown ? 'Hide' : 'Show'}
        </Button>
        <Button type="button" variant="outline" onClick={() => { onChange(makePassword()); setShown(true); }} className="shrink-0">
          Make one
        </Button>
      </div>
    </Field>
  );
}

/** What to tell the person, laid out to read aloud or copy. */
export function SignInCard({ phone, password }) {
  const [copied, setCopied] = useState(false);
  const text = `Al Hadeed staff panel\nSign in with: ${phone}\nPassword: ${password}`;
  return (
    <div className="space-y-3">
      <dl className="rounded-sm border border-line bg-surface-2 px-4 py-3 text-[14px]">
        <div className="flex justify-between gap-4 py-1">
          <dt className="text-ink-muted">Sign in with</dt>
          <dd className="tnum font-semibold text-ink">{phone}</dd>
        </div>
        <div className="flex justify-between gap-4 py-1">
          <dt className="text-ink-muted">Password</dt>
          <dd className="tnum whitespace-normal break-all font-semibold text-ink">{password}</dd>
        </div>
      </dl>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => navigator.clipboard?.writeText(text).then(() => setCopied(true)).catch(() => {})}
      >
        {copied ? 'Copied' : 'Copy sign-in details'}
      </Button>
      <p className="text-[12.5px] leading-relaxed text-ink-muted">
        Shown once. It is not sent by text message. An SMS sits on a phone for anyone to read.
        You can set a new one from their page at any time.
      </p>
    </div>
  );
}
