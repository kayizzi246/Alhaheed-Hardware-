'use client';
import { useCallback, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, getUser, clearSession } from '@/lib/api';
import { getSocket, closeSocket } from '@/lib/socket';
import { NAV, HOME, DESK_LABEL } from '@/lib/roles';

/**
 * App chrome for every side: sidebar, role guard, live badge counts.
 *
 * `allow` lists the roles that may open this section. Anyone else is sent to
 * their own home page, so a cashier cannot reach the manager's reports by
 * typing the URL (the API enforces the same thing server side).
 */
export default function Shell({ allow, children }) {
  const pathname = usePathname();
  const router = useRouter();

  const [user, setUser] = useState(null);
  const [live, setLive] = useState(false);
  const [unread, setUnread] = useState(0);

  const loadUnread = useCallback(async () => {
    try {
      const r = await api('/api/notifications');
      setUnread(r.unread);
    } catch { /* a failed badge must never block the page */ }
  }, []);

  useEffect(() => {
    const u = getUser();
    if (!u) { router.replace('/'); return; }
    // No customer has a web side. A customer session can only be a stale one,
    // so it is cleared and sent back to the staff sign-in.
    if (!HOME[u.role]) { clearSession(); router.replace('/'); return; }
    if (allow && !allow.includes(u.role)) {
      router.replace(HOME[u.role]);
      return;
    }
    setUser(u);
    loadUnread();
  }, [allow, router, loadUnread]);

  useEffect(() => {
    const s = getSocket();
    if (!s) return;
    const on = () => setLive(true);
    const off = () => setLive(false);
    const onNotify = () => loadUnread();
    s.on('connect', on);
    s.on('disconnect', off);
    s.on('notification', onNotify);
    setLive(s.connected);
    return () => { s.off('connect', on); s.off('disconnect', off); s.off('notification', onNotify); };
  }, [loadUnread]);

  const signOut = () => {
    closeSocket();
    clearSession();
    router.replace('/');
  };

  if (!user) return <div className="loading">Loading…</div>;

  const items = NAV[user.role] || [];

  const badgeFor = (item) => {
    if (item.badge === 'alerts') return unread;
    return 0;
  };

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="l1">AL HADEED</div>
          <div className="l2">HARDWARE</div>
          <div className="l3">{DESK_LABEL[user.role]}</div>
        </div>

        <nav className="nav">
          {items.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== '/' && pathname.startsWith(item.href + '/'));
            const n = badgeFor(item);
            return (
              <Link key={item.href} href={item.href} className={active ? 'active' : ''}>
                {item.label}
                {n > 0 && <span className="nav-badge">{n}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-foot">
          <div className="who">
            <span className={`live-dot ${live ? '' : 'off'}`} />
            {user.fullName}
          </div>
          <div className="role">{user.role}</div>
          <button className="signout" onClick={signOut}>Sign out</button>
        </div>
      </aside>

      <main className="main">{children}</main>
    </div>
  );
}
