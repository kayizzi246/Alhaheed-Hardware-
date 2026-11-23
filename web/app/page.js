'use client';
import { ThemeToggle } from '@/components/Theme';
import { Alert, Button, Checkbox, Field, Input, Spinner } from '@/components/ui';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, setSession, getUser, clearSession } from '@/lib/api';
import { HOME } from '@/lib/roles';

/**
 * Signing in.
 *
 * Split screen: the shop on the left, the form on the right. The left
 * half is not decoration — it carries the three numbers that say the
 * system is alive and reachable, pulled from the only two endpoints
 * that need no account. If the API is down, that panel says so before
 * anybody types a password and wonders why it was rejected.
 *
 * Two ways in, because a cashier who has forgotten a password at seven
 * in the morning should not have to find the manager:
 *
 *   • phone or email, plus password
 *   • a six-digit code by SMS, to the number on the account
 *
 * Both end in the same place. The API decides which desk the person
 * belongs to; this page only knows where each desk lives.
 */
export default function LoginPage() {
  const router = useRouter();
  const firstField = useRef(null);

  const [mode, setMode] = useState('password'); // 'password' | 'code'
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);

  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [devCode, setDevCode] = useState('');

  const [shop, setShop] = useState(null);
  const [reachable, setReachable] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // ── Already signed in? ──────────────────────────────────────────────
  useEffect(() => {
    const u = getUser();
    if (!u) { firstField.current?.focus(); return; }
    if (!HOME[u.role]) { clearSession(); return; }
    router.replace(HOME[u.role]);
  }, [router]);

  // ── Is the shop there? ──────────────────────────────────────────────
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [health, products] = await Promise.all([
          api('/api/health'),
          api('/api/products'),
        ]);
        if (!alive) return;
        setShop({
          name: health.shop,
          currency: health.currency,
          products: products.products.length,
          inStock: products.products.filter((p) => p.stock_available > 0).length,
        });
        setReachable(true);
      } catch {
        if (alive) setReachable(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const land = useCallback((r) => {
    if (!HOME[r.user.role]) throw new Error('This account has no desk on the web panel.');
    setSession(r.token, r.user, { remember });
    router.replace(HOME[r.user.role]);
  }, [remember, router]);

  async function signInWithPassword(e) {
    e.preventDefault();
    setError(''); setBusy(true);
    try {
      land(await api('/api/auth/staff/login', {
        method: 'POST',
        body: { identifier: identifier.trim(), password },
      }));
    } catch (err) {
      setError(err.message);
      setBusy(false);
      setPassword('');   // never leave a wrong password sitting there
    }
  }

  async function requestCode(e) {
    e.preventDefault();
    setError(''); setBusy(true);
    try {
      const r = await api('/api/auth/otp/request', { method: 'POST', body: { phone: phone.trim() } });
      setCodeSent(true);
      setDevCode(r.devCode || '');
      setBusy(false);
    } catch (err) { setError(err.message); setBusy(false); }
  }

  async function signInWithCode(e) {
    e.preventDefault();
    setError(''); setBusy(true);
    try {
      land(await api('/api/auth/otp/verify', {
        method: 'POST',
        body: { phone: phone.trim(), code: code.trim() },
      }));
    } catch (err) { setError(err.message); setBusy(false); setCode(''); }
  }

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.08fr_1fr]">
      {/* ── The shop ─────────────────────────────────────────────── */}
      <aside className="relative hidden overflow-hidden bg-navy px-12 py-14 text-white lg:flex lg:items-center xl:px-16">
        {/* Two washes, not one. A single radial gradient reads as a
            spotlight; a warm one from the top-left with a cooler, wider
            one behind it gives the slab depth without becoming a
            pattern you notice. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(85%_65%_at_8%_-8%,rgba(232,134,42,.30),transparent_56%)]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(65%_50%_at_100%_105%,rgba(192,57,43,.18),transparent_60%)]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 w-px bg-gradient-to-b from-transparent via-brand/40 to-transparent"
        />

        <div className="relative w-full max-w-xl">
          <div className="mb-9 flex items-center gap-2.5">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand to-brand-dark text-[15px] font-extrabold shadow-lg">
              AH
            </span>
            <span className="font-display text-[13px] font-extrabold leading-[1.15] tracking-[.05em]">
              AL HADEED
              <br />
              <b className="text-brand">HARDWARE</b>
            </span>
          </div>

          <h2 className="font-display text-[46px] font-black leading-[1.03] tracking-[-.032em] xl:text-[58px]">
            Run the counter
            <br />
            <span className="bg-gradient-to-br from-brand to-[rgb(var(--red))] bg-clip-text text-transparent">
              without paper
            </span>
          </h2>

          <p className="mt-5 max-w-md text-[15.5px] leading-[1.65] text-white/65">
            Orders move from the customer&rsquo;s phone to the cashier, to accounts,
            to the store &mdash; and nobody writes a slip.
          </p>

          {/* What the shop has on the shelf, right now. Three figures
              on one rule rather than three boxes: boxes make them look
              like controls, and these are facts. */}
          <div className="mt-10 flex items-stretch divide-x divide-white/10 border-y border-white/10 py-5">
            <Figure value={shop ? String(shop.products) : '—'} label="Products" first />
            <Figure value={shop ? String(shop.inStock) : '—'} label="In stock" />
            <Figure value={shop?.currency ?? 'UGX'} label="Currency" />
          </div>

          <span className="mt-9 block font-display text-[10.5px] font-bold uppercase tracking-[.1em] text-white/35">
            How an order moves
          </span>

          {/* The four desks joined by a line, because it is a sequence
              and four separate rows do not say so. */}
          <ol className="relative mt-4">
            <span
              aria-hidden="true"
              className="absolute bottom-4 left-3 top-4 w-px bg-gradient-to-b from-brand/50 via-white/15 to-transparent"
            />
            {[
              ['Customer', 'orders on the app'],
              ['Cashier', 'takes the money'],
              ['Accounts', 'checks the till'],
              ['Store', 'releases the goods'],
            ].map(([who, what], i) => (
              <li key={who} className="relative flex items-center gap-3.5 py-[7px]">
                <span
                  className={[
                    'tnum relative z-[1] grid size-6 shrink-0 place-items-center rounded-full',
                    'text-[11px] font-extrabold ring-4 ring-navy',
                    i === 0 ? 'bg-brand text-white' : 'bg-white/10 text-white/70',
                  ].join(' ')}
                >
                  {i + 1}
                </span>
                <strong className="min-w-[92px] text-[14.5px] font-semibold">{who}</strong>
                <em className="text-[13.5px] not-italic text-white/55">{what}</em>
              </li>
            ))}
          </ol>

          <p className="mt-9 border-t border-white/10 pt-5 text-[13px] leading-relaxed text-white/50">
            <strong className="font-semibold text-white/80">
              Customers and the Store Manager use the phone app.
            </strong>
            <br />
            This panel is the Cashier, Accounts and Manager desks.
          </p>
        </div>
      </aside>

      {/* ── The form ─────────────────────────────────────────────── */}
      <main className="relative flex items-center justify-center bg-bg px-6 py-12">
        <div className="absolute right-5 top-5">
          <ThemeToggle />
        </div>

        <div className="w-full max-w-[404px]">
          {/* The brand only appears on this side when the dark panel
              is not there to carry it. */}
          <div className="mb-7 flex items-center gap-2.5 lg:hidden">
            <span className="grid size-10 shrink-0 place-items-center rounded-[11px] bg-gradient-to-br from-brand to-brand-dark text-sm font-extrabold text-white shadow-sm">
              AH
            </span>
            <span className="font-display text-[13px] font-extrabold leading-[1.15] tracking-[.04em] text-ink">
              AL HADEED
              <br />
              <b className="text-brand">HARDWARE</b>
            </span>
          </div>

          {/* A card, so the form reads as one object to fill in rather
              than fields floating on a page. */}
          <div className="rounded-lg border border-line bg-surface p-7 shadow-lg sm:p-8">
            <h1 className="text-[27px] leading-[1.14] text-ink">Sign in</h1>
            <p className="mb-7 mt-2 text-sm text-ink-muted">
              {shop?.name && shop.name !== 'My Blog' ? shop.name : 'Staff panel'}
              {reachable === true && (
                <span className="ml-2 inline-flex items-center gap-1.5 align-[1px] text-[12.5px] text-ok">
                  <span className="size-1.5 rounded-full bg-ok" />
                  online
                </span>
              )}
            </p>

            <div aria-live="polite">
              {error && <Alert>{error}</Alert>}
              {reachable === false && !error && (
                <Alert>Can&rsquo;t reach the shop. Check the connection, then try again.</Alert>
              )}
            </div>

            {mode === 'password' ? (
              <form onSubmit={signInWithPassword} noValidate className="space-y-4">
                <Field label="Phone or email">
                  <Input
                    id="identifier"
                    ref={firstField}
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="cashier@alhadeed.ug"
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck="false"
                    enterKeyHint="next"
                    required
                  />
                </Field>

                <Field label="Password">
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="current-password"
                      enterKeyHint="go"
                      className="pr-16"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((s) => !s)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      aria-pressed={showPassword}
                      tabIndex={-1}
                      className="absolute inset-y-0 right-0 px-3 text-xs font-semibold text-ink-muted transition-colors hover:text-ink"
                    >
                      {showPassword ? 'Hide' : 'Show'}
                    </button>
                  </div>
                </Field>

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Checkbox
                    label="Keep me signed in"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                  />
                  <button
                    type="button"
                    onClick={() => { setMode('code'); setError(''); }}
                    className="text-[13px] font-semibold text-brand-dark underline-offset-2 hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>

                <Button size="lg" block disabled={busy || !identifier.trim() || !password}>
                  {busy && <Spinner />}
                  {busy ? 'Signing in…' : 'Sign in'}
                </Button>
              </form>
            ) : (
              <form onSubmit={codeSent ? signInWithCode : requestCode} noValidate className="space-y-4">
                <Field label="Phone number on your account">
                  <Input
                    id="phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="0772 123 456"
                    inputMode="tel"
                    autoComplete="tel"
                    disabled={codeSent}
                    enterKeyHint="go"
                    required
                  />
                </Field>

                {codeSent && (
                  <Field
                    label="The 6-digit code we texted you"
                    hint={devCode ? `Test mode: your code is ${devCode}` : null}
                  >
                    <Input
                      id="code"
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      autoFocus
                      required
                      className="tnum text-center text-[22px] font-bold tracking-[.4em]"
                    />
                  </Field>
                )}

                <Button
                  size="lg"
                  block
                  disabled={busy || (codeSent ? code.length !== 6 : phone.trim().length < 9)}
                >
                  {busy && <Spinner />}
                  {busy ? 'Please wait…' : codeSent ? 'Verify and sign in' : 'Text me a code'}
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  block
                  onClick={() => {
                    if (codeSent) { setCodeSent(false); setCode(''); setDevCode(''); }
                    else { setMode('password'); }
                    setError('');
                  }}
                >
                  {codeSent ? 'Use a different number' : 'Back to password'}
                </Button>
              </form>
            )}

            {mode === 'password' && (
              <>
                <div className="my-5 flex items-center gap-3 text-xs text-ink-faint">
                  <span className="h-px flex-1 bg-line" />
                  or
                  <span className="h-px flex-1 bg-line" />
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  block
                  onClick={() => { setMode('code'); setError(''); }}
                >
                  <span aria-hidden="true">✆</span>
                  Sign in with a code by SMS
                </Button>
              </>
            )}
          </div>

          <p className="mt-6 text-center text-[12.5px] leading-relaxed text-ink-muted">
            No account? Ask the manager to add you under{' '}
            <b className="font-semibold text-ink-2">Users</b> in WordPress.
          </p>
        </div>
      </main>
    </div>
  );
}

/** One figure on the brand panel: the number, then what it counts. */
function Figure({ value, label, first }) {
  return (
    <div className={first ? 'pr-7' : 'px-7'}>
      <strong className="tnum block font-display text-[26px] font-extrabold leading-none">
        {value}
      </strong>
      <span className="mt-1.5 block text-[11.5px] text-white/50">{label}</span>
    </div>
  );
}
