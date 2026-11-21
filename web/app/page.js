'use client';
import { ThemeToggle } from '@/components/Theme';
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
    <div className="auth">
      {/* ── The shop ─────────────────────────────────────────────── */}
      <aside className="auth-brand">
        <div className="auth-brand-inner">
          <span className="auth-badge">
            <i className={`auth-pulse ${reachable === false ? 'down' : ''}`} />
            {reachable === null && 'Connecting…'}
            {reachable === true && 'Shop online'}
            {reachable === false && 'Shop unreachable'}
          </span>

          <h2 className="auth-headline">
            Run the counter
            <br />
            <span>without paper</span>
          </h2>

          <p className="auth-lede">
            Orders move from the customer&rsquo;s phone to the cashier, to accounts,
            to the store &mdash; and nobody writes a slip.
          </p>

          <div className="auth-stats">
            <Figure value={shop ? String(shop.products) : '—'} label="Products" />
            <Figure value={shop ? String(shop.inStock) : '—'} label="In stock" />
            <Figure value={shop?.currency ?? 'UGX'} label="Currency" />
          </div>

          <span className="auth-k">How an order moves</span>
          <ol className="auth-flow">
            {[
              ['Customer', 'orders on the app'],
              ['Cashier', 'takes the money'],
              ['Accounts', 'checks the till'],
              ['Store', 'releases the goods'],
            ].map(([who, what], i) => (
              <li key={who}>
                <span className="auth-flow-n">{i + 1}</span>
                <strong>{who}</strong>
                <em>{what}</em>
              </li>
            ))}
          </ol>

          <div className="auth-note">
            <strong>Customers and the Store Manager use the phone app.</strong>
            <span>This panel is the Cashier, Accounts and Manager desks.</span>
          </div>
        </div>
      </aside>

      {/* ── The form ─────────────────────────────────────────────── */}
      <main className="auth-pane">
        <ThemeToggle />

        <div className="auth-form">
          <div className="auth-logo">
            <span className="auth-mark">AH</span>
            <span className="auth-word">
              AL HADEED <b>HARDWARE</b>
            </span>
          </div>

          <h1>Sign in to your account</h1>
          <p className="auth-tag">{shop?.name ?? 'Staff panel'}</p>

          <div aria-live="polite">
            {error && <div className="alert error">{error}</div>}
            {reachable === false && !error && (
              <div className="alert error">
                Can&rsquo;t reach the shop. Check the connection, then try again.
              </div>
            )}
          </div>

          {mode === 'password' ? (
            <form onSubmit={signInWithPassword} noValidate>
              <div className="field">
                <label htmlFor="identifier">Phone or email</label>
                <input
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
              </div>

              <div className="field">
                <label htmlFor="password">Password</label>
                <div className="input-affix">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    enterKeyHint="go"
                    required
                  />
                  <button
                    type="button"
                    className="affix-btn"
                    onClick={() => setShowPassword((s) => !s)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    aria-pressed={showPassword}
                    tabIndex={-1}
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>

              <div className="auth-row">
                <label className="check">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                  />
                  <span>Keep me signed in</span>
                </label>
                <button
                  type="button"
                  className="linkish inline"
                  onClick={() => { setMode('code'); setError(''); }}
                >
                  Forgot password?
                </button>
              </div>

              <button
                className="btn btn-navy btn-block btn-tall"
                disabled={busy || !identifier.trim() || !password}
              >
                {busy && <span className="spinner" aria-hidden="true" />}
                {busy ? 'Signing in…' : 'Sign in'}
              </button>
            </form>
          ) : (
            <form onSubmit={codeSent ? signInWithCode : requestCode} noValidate>
              <div className="field">
                <label htmlFor="phone">Phone number on your account</label>
                <input
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
              </div>

              {codeSent && (
                <div className="field">
                  <label htmlFor="code">The 6-digit code we texted you</label>
                  <input
                    id="code"
                    className="code-input"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    autoFocus
                    required
                  />
                  {devCode && (
                    <p className="field-note">Test mode: your code is <b>{devCode}</b></p>
                  )}
                </div>
              )}

              <button
                className="btn btn-navy btn-block btn-tall"
                disabled={busy || (codeSent ? code.length !== 6 : phone.trim().length < 9)}
              >
                {busy && <span className="spinner" aria-hidden="true" />}
                {busy ? 'Please wait…' : codeSent ? 'Verify and sign in' : 'Text me a code'}
              </button>

              <button
                type="button"
                className="linkish"
                onClick={() => {
                  if (codeSent) { setCodeSent(false); setCode(''); setDevCode(''); }
                  else { setMode('password'); }
                  setError('');
                }}
              >
                {codeSent ? 'Use a different number' : 'Back to password'}
              </button>
            </form>
          )}

          {mode === 'password' && (
            <>
              <div className="auth-or"><span>or</span></div>
              <button
                type="button"
                className="btn btn-ghost btn-block btn-tall"
                onClick={() => { setMode('code'); setError(''); }}
              >
                <span className="auth-sms" aria-hidden="true">✆</span>
                Sign in with a code by SMS
              </button>
            </>
          )}

          <p className="auth-foot">
            No account? Ask the manager to add you under <b>Users</b> in WordPress.
          </p>
        </div>
      </main>
    </div>
  );
}

function Figure({ value, label }) {
  return (
    <div className="auth-fig">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

