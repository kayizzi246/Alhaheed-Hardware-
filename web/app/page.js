'use client';
import { ThemeToggle } from '@/components/Theme';
import { list } from '@/lib/format';
import { Alert, Button, Checkbox, Field, Input, Spinner } from '@/components/ui';
import { Icon } from '@/components/icons';
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
  const [slide, setSlide] = useState(0);
  const [reachable, setReachable] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [forgot, setForgot] = useState(false);

  // Sent here because a session ran out? Say so, instead of the person
  // wondering why the screen they were on has gone.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (new URLSearchParams(window.location.search).get('ended')) {
      setNote('Your session has ended. Sign in again to carry on.');
      window.history.replaceState(null, '', '/');
    }
  }, []);

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
        // One small request. The counts used to come from downloading
        // the whole product list — every name, price and picture — to
        // draw two numbers on a page whose job is to take a password.
        const health = await api('/api/health');
        if (!alive) return;
        let counts = { products: health.products, inStock: health.inStock };
        // A site still on the older plugin has no counts on /health.
        if (typeof counts.products !== 'number') {
          const products = list((await api('/api/products')).products);
          counts = { products: products.length, inStock: products.filter((x) => x.stock_available > 0).length };
        }
        if (!alive) return;
        setShop({ name: health.shop, currency: health.currency, ...counts });
        setReachable(true);
      } catch {
        if (alive) setReachable(false);
      }
    })();
    return () => { alive = false; };
  }, []);


  // The panel's line changes every seven seconds. Slow on purpose: a
  // login screen is looked at for ten seconds and anything livelier
  // than this is a distraction while somebody types a password. It
  // stops entirely for anyone who has asked their machine for less
  // motion, and clicking a dot takes over from it.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const t = setInterval(() => setSlide((n) => (n + 1) % SLIDES.length), 7000);
    return () => clearInterval(t);
  }, []);

  const land = useCallback((r) => {
    if (!HOME[r.user.role]) {
      // Say where to go, not just "no". A store manager hired a minute
      // ago has the right password and needs to hear it is the phone app.
      throw new Error(
        r.user.role === 'store'
          ? 'Store Manager accounts sign in on the Al Hadeed phone app, not here. Use the same number and password there.'
          : r.user.role === 'customer'
            ? 'This is a customer account. Customers order on the Al Hadeed phone app.'
            : 'This account has no desk on the staff panel.'
      );
    }
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
    <div className="grid min-h-dvh lg:grid-cols-[1fr_1.02fr]">
      {/* ── The form ─────────────────────────────────────────────── */}
      <main className="relative flex items-center justify-center bg-surface px-6 py-12 sm:px-10">
        <div className="absolute right-5 top-5">
          <ThemeToggle />
        </div>

        <div className="w-full max-w-[380px]">
          <div className="mb-9 flex items-center gap-2.5">
            <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-gradient-to-br from-fill to-fill-dark text-[13px] font-extrabold text-white shadow-sm">
              AH
            </span>
            <span className="font-display text-[15px] font-extrabold tracking-[-.01em] text-ink">
              Al Hadeed <span className="text-brand">Hardware</span>
            </span>
          </div>

          <h1 className="text-[28px] leading-[1.15] text-ink">Log in to your account</h1>
          <p className="mb-7 mt-2 text-sm text-ink-muted">
            {reachable === false
              ? 'The shop cannot be reached just now.'
              : 'Welcome back. Choose how you want to sign in:'}
          </p>

          {/* The two ways in, side by side. The reference puts Google
              and Facebook here; this shop has no such thing, and the
              honest equivalent is the two methods it does have. */}
          <div className="grid grid-cols-2 gap-3">
            <MethodButton
              on={mode === 'password'}
              onClick={() => { setMode('password'); setError(''); }}
              icon={Icon.key()}
              label="Password"
            />
            <MethodButton
              on={mode === 'code'}
              onClick={() => { setMode('code'); setForgot(false); setError(''); setNote(''); }}
              icon={Icon.phone()}
              label="SMS code"
            />
          </div>

          <div className="my-6 flex items-center gap-3 text-[12.5px] text-ink-faint">
            <span className="h-px flex-1 bg-line" />
            {mode === 'password' ? 'your phone number and password' : 'we will text a code to your phone'}
            <span className="h-px flex-1 bg-line" />
          </div>

          <div aria-live="polite">
            {note && !error && <Alert kind="ok">{note}</Alert>}
            {forgot && mode === 'code' && !error && (
              <p className="mb-4 rounded-sm border border-line bg-surface-2 px-3.5 py-3 text-[13px] leading-relaxed text-ink-2">
                No problem. Sign in with a code sent to your phone instead. Once you are in,
                ask the manager to set you a new password.
              </p>
            )}
            {error && <Alert>{error}</Alert>}
            {reachable === false && !error && (
              <Alert>Can&rsquo;t reach the shop. Check the connection, then try again.</Alert>
            )}
          </div>

          {mode === 'password' ? (
            <form onSubmit={signInWithPassword} noValidate className="space-y-3.5">
              <IconField icon={Icon.phone()}>
                <Input
                  id="identifier"
                  ref={firstField}
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="Phone number or email"
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck="false"
                  enterKeyHint="next"
                  className="bg-surface-2 pl-11"
                  required
                />
              </IconField>

              <IconField icon={Icon.lock()}>
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  autoComplete="current-password"
                  enterKeyHint="go"
                  className="bg-surface-2 pl-11 pr-11"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                  tabIndex={-1}
                  className="absolute inset-y-0 right-0 grid w-11 place-items-center text-ink-muted transition-colors hover:text-ink"
                >
                  {showPassword ? Icon.eyeOff() : Icon.eye()}
                </button>
              </IconField>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
                <Checkbox
                  label="Remember me"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                />
                <button
                  type="button"
                  onClick={() => { setMode('code'); setForgot(true); setError(''); setNote(''); }}
                  className="text-[13px] font-semibold text-brand-dark underline-offset-2 hover:underline"
                >
                  Forgot password?
                </button>
              </div>

              <Button size="lg" block className="mt-1.5" disabled={busy || !identifier.trim() || !password}>
                {busy && <Spinner />}
                {busy ? 'Signing in…' : 'Log in'}
              </Button>
            </form>
          ) : (
            <form onSubmit={codeSent ? signInWithCode : requestCode} noValidate className="space-y-3.5">
              <IconField icon={Icon.phone()}>
                <Input
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Phone number on your account"
                  inputMode="tel"
                  autoComplete="tel"
                  disabled={codeSent}
                  enterKeyHint="go"
                  className="bg-surface-2 pl-11"
                  required
                />
              </IconField>

              {codeSent && (
                <Field hint={devCode ? `Test mode: your code is ${devCode}` : 'The 6-digit code we just texted you'}>
                  <Input
                    id="code"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    autoFocus
                    required
                    className="tnum bg-surface-2 text-center text-[22px] font-bold tracking-[.4em]"
                  />
                </Field>
              )}

              <Button
                size="lg"
                block
                className="mt-1.5"
                disabled={busy || (codeSent ? code.length !== 6 : phone.trim().length < 9)}
              >
                {busy && <Spinner />}
                {busy ? 'Please wait…' : codeSent ? 'Verify and log in' : 'Text me a code'}
              </Button>

              {codeSent && (
                <Button
                  type="button"
                  variant="ghost"
                  block
                  onClick={() => { setCodeSent(false); setCode(''); setDevCode(''); setError(''); }}
                >
                  Use a different number
                </Button>
              )}
            </form>
          )}

          <p className="mt-7 text-center text-[13px] text-ink-muted">
            No account?{' '}
            <span className="font-semibold text-ink-2">
              Ask the manager to set you up.
            </span>
          </p>
        </div>
      </main>

      {/* ── The shop ─────────────────────────────────────────────── */}
      {/* A blue slab, not a near-black one. The two washes over it were
          orange and red — left from when the brand was warm — and on a
          navy they turned the whole panel muddy. They are light blue
          now, which is the same trick doing the job it was meant to:
          lifting the top-left so the panel is not a flat rectangle. */}
      <aside className="relative hidden overflow-hidden bg-gradient-to-br from-[rgb(var(--panel-from))] to-[rgb(var(--panel-to))] p-10 text-white lg:flex lg:flex-col lg:items-center lg:justify-center xl:p-14">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_50%_at_20%_0%,rgba(255,255,255,.20),transparent_60%)]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(55%_45%_at_90%_100%,rgba(125,211,252,.18),transparent_62%)]"
        />

        <div className="relative w-full max-w-[460px]">
          <OrderFlowArt />

          <h2 className="mt-12 text-center font-display text-[26px] font-extrabold leading-[1.2] tracking-[-.02em]">
            {SLIDES[slide].title}
          </h2>
          <p className="mx-auto mt-3 max-w-sm text-center text-[14.5px] leading-relaxed text-white/60">
            {SLIDES[slide].line}
          </p>

          <div className="mt-8 flex items-center justify-center gap-2">
            {SLIDES.map((s, i) => (
              <button
                key={s.title}
                type="button"
                onClick={() => setSlide(i)}
                aria-label={s.title}
                aria-current={i === slide}
                className={[
                  'h-1.5 rounded-full transition-all duration-300 ease-out',
                  i === slide ? 'w-6 bg-brand' : 'w-1.5 bg-white/25 hover:bg-white/40',
                ].join(' ')}
              />
            ))}
          </div>

          {/* The live figures stay: they are the one thing on this
              panel that proves the shop is actually there. */}
          <div className="mt-11 flex items-stretch justify-center divide-x divide-white/10 border-t border-white/10 pt-7">
            {/* Faded in once known, never a dash standing in for a
                number. Space is held, so nothing jumps when they land. */}
            <Figure value={shop?.products} label="Products" first />
            <Figure value={shop?.inStock} label="In stock" />
            <Figure value={shop?.currency ?? 'UGX'} label="Currency" />
          </div>
        </div>
      </aside>
    </div>
  );
}

/* ── Pieces ───────────────────────────────────────────────────────── */

const SLIDES = [
  {
    title: 'Every order, end to end.',
    line: 'From the customer’s phone to the cashier, to accounts, to the store, and nobody writes a slip.',
  },
  {
    title: 'The till adds itself up.',
    line: 'Every payment lands in the cash book as it is taken, so the end of the day is a glance, not an evening.',
  },
  {
    title: 'Nothing leaves unrecorded.',
    line: 'Stock comes off the shelf when the goods do, and every move has a name and a time against it.',
  },
];

/** One of the two ways in. */
function MethodButton({ on, onClick, icon, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={[
        'flex items-center justify-center gap-2 rounded-sm border px-3 py-3 text-[13.5px] font-semibold',
        'transition-[border-color,background-color,color,transform] duration-150 ease-out active:scale-[.98]',
        on
          ? 'border-brand bg-brand-soft text-brand-dark'
          : 'border-line bg-surface text-ink-2 hover:border-line-firm hover:text-ink',
      ].join(' ')}
    >
      <span className={on ? 'text-brand' : 'text-ink-muted'}>{icon}</span>
      {label}
    </button>
  );
}

/** A field with a mark inside its left edge. */
function IconField({ icon, children }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-0 grid w-11 place-items-center text-ink-muted">
        {icon}
      </span>
      {children}
    </div>
  );
}

/**
 * The picture on the dark panel.
 *
 * Not a stock illustration of people pointing at a laptop: it is the
 * four desks an order actually passes through, drawn as the cards they
 * are on the screens behind this one. Somebody signing in for the
 * first time can read what the system does off it.
 */
function OrderFlowArt() {
  const desks = [
    ['Customer', 'orders on the app', 'AH-204'],
    ['Cashier', 'takes the money', 'UGX 185,000'],
    ['Accounts', 'checks the till', 'Verified'],
    ['Store', 'releases the goods', 'Collected'],
  ];

  return (
    <div className="relative mx-auto w-full max-w-[380px]" aria-hidden="true">
      <div className="absolute inset-x-8 inset-y-0 rounded-[28px] bg-white/[.04] blur-xl" />
      <ul className="relative space-y-2.5">
        {desks.map(([who, what, badge], i) => (
          <li
            key={who}
            className={[
              'flex items-center gap-3 rounded-xl border border-white/10 bg-white/[.06] px-3.5 py-3 backdrop-blur-sm',
              // A gentle stagger, so it reads as a sequence rather than a stack.
              i === 1 ? 'ml-6' : i === 2 ? 'ml-12' : i === 3 ? 'ml-[72px]' : '',
            ].join(' ')}
          >
            <span
              className={[
                'tnum grid size-7 shrink-0 place-items-center rounded-lg text-[11.5px] font-extrabold',
                i === 0 ? 'bg-fill text-on-fill' : 'bg-white/12 text-white/70',
              ].join(' ')}
            >
              {i + 1}
            </span>
            <span className="min-w-0 flex-1">
              <b className="block text-[13.5px] font-semibold leading-tight">{who}</b>
              <em className="block text-[11.5px] not-italic text-white/50">{what}</em>
            </span>
            <span className="tnum shrink-0 rounded-md bg-white/10 px-2 py-1 text-[11px] font-semibold text-white/75">
              {badge}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** One figure on the brand panel: the number, then what it counts. */
function Figure({ value, label, first }) {
  const known = value !== undefined && value !== null;
  return (
    <div className={first ? 'pr-6' : 'px-6'}>
      <strong
        className={[
          'tnum block min-h-[22px] text-center font-display text-[22px] font-extrabold leading-none',
          'transition-opacity duration-200 ease-out',
          known ? 'opacity-100' : 'opacity-0',
        ].join(' ')}
      >
        {known ? String(value) : ' '}
      </strong>
      <span className="mt-1.5 block text-center text-[11.5px] text-white/50">{label}</span>
    </div>
  );
}
