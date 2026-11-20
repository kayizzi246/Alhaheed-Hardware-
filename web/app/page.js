'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, setSession, getUser, clearSession } from '@/lib/api';
import { HOME } from '@/lib/roles';
import { Alert } from '@/components/ui';

/**
 * Staff sign-in for the web panel.
 *
 * The web panel is for the shop's desks only — Cashier, Accounts, Store
 * Manager and Manager. Customers order on the mobile app; there is no customer
 * sign-in here, and the API's staff login endpoint refuses customer accounts.
 */
export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const u = getUser();
    if (!u) return;
    // A customer session (for example left over from an older build) has no
    // home on the web panel, so it is cleared rather than followed.
    if (!HOME[u.role]) { clearSession(); return; }
    router.replace(HOME[u.role]);
  }, [router]);

  async function signIn(e) {
    e.preventDefault();
    setError(''); setBusy(true);
    try {
      const r = await api('/api/auth/staff/login', { method: 'POST', body: { identifier, password } });
      if (!HOME[r.user.role]) throw new Error('This account has no access to the web panel.');
      setSession(r.token, r.user);
      router.replace(HOME[r.user.role]);
    } catch (err) { setError(err.message); setBusy(false); }
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <h1>Al Hadeed Hardware</h1>
        <div className="tag">Cashier &amp; Accounts Panel</div>

        <Alert>{error}</Alert>

        <form onSubmit={signIn}>
          <div className="field">
            <label htmlFor="id">Phone or email</label>
            <input
              id="id"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="cashier@alhadeed.ug"
              autoComplete="username"
              required
            />
          </div>

          <div className="field">
            <label htmlFor="pw">Password</label>
            <input
              id="pw"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>

          <button className="btn btn-primary btn-block" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>

          <div className="hint">
            Cashier <code>cashier@alhadeed.ug</code> / <code>cashier123</code><br />
            Accounts <code>accounts@alhadeed.ug</code> / <code>accounts123</code>
          </div>

          <div className="sub" style={{ marginTop: 14, textAlign: 'center' }}>
            Customers, the Store Manager and the Manager use the Al Hadeed mobile app.
          </div>
        </form>
      </div>
    </div>
  );
}
