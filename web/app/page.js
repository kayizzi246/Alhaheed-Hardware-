'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, setSession, getUser, clearSession } from '@/lib/api';
import { HOME } from '@/lib/roles';

/**
 * Signing in.
 *
 * One field, then another, then one button. A counter tool is opened at
 * seven in the morning by somebody who has not had tea yet, so there is
 * nothing on this page to read, decide or dismiss.
 *
 * The web panel is for the desks that work sitting down — Cashier,
 * Accounts and the Manager. Customers and the Store Manager are on the
 * phone, and the API's staff login turns their accounts away, so this
 * page never has to.
 */
export default function LoginPage() {
  const router = useRouter();
  const identifierRef = useRef(null);

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const u = getUser();
    if (!u) {
      // Straight into the first field: nobody opens this page to look
      // at it.
      identifierRef.current?.focus();
      return;
    }
    // A session with no home here can only be stale — clear it rather
    // than following it somewhere that does not exist.
    if (!HOME[u.role]) { clearSession(); return; }
    router.replace(HOME[u.role]);
  }, [router]);

  async function signIn(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const r = await api('/api/auth/staff/login', {
        method: 'POST',
        body: { identifier: identifier.trim(), password },
      });
      if (!HOME[r.user.role]) throw new Error('This account has no desk on the web panel.');
      setSession(r.token, r.user);
      router.replace(HOME[r.user.role]);
    } catch (err) {
      setError(err.message);
      setBusy(false);
      setPassword('');
    }
  }

  return (
    <div className="login-wrap">
      <main className="login-card">
        <div className="login-mark" aria-hidden="true">AH</div>

        <h1>Al Hadeed Hardware</h1>
        <p className="login-tag">Staff panel</p>

        {/* Announced to a screen reader the moment it appears, because
            a failed sign-in is the one message on this page. */}
        <div aria-live="polite">
          {error && <div className="alert error">{error}</div>}
        </div>

        <form onSubmit={signIn} noValidate>
          <div className="field">
            <label htmlFor="identifier">Phone or email</label>
            <input
              id="identifier"
              ref={identifierRef}
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

          <button
            className="btn btn-primary btn-block btn-tall"
            disabled={busy || !identifier.trim() || !password}
          >
            {busy ? <span className="spinner" aria-hidden="true" /> : null}
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="login-foot">
          Customers and the Store Manager use the Al&nbsp;Hadeed mobile app.
        </p>
      </main>
    </div>
  );
}
