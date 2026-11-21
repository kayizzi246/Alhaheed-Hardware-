'use client';
import { useCallback, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, getUser, clearSession } from '@/lib/api';
import { getSocket, closeSocket } from '@/lib/socket';
import { NAV, HOME, DESK_LABEL } from '@/lib/roles';
import { Icon } from '@/components/icons';

/**
 * The chrome every desk sits in: a light rail on the left, a bar across
 * the top, the work in the middle.
 *
 * `allow` lists the roles that may open this section. Anyone else is
 * sent to their own desk, so a cashier cannot reach the manager's
 * reports by typing the URL — and the API enforces the same thing
 * server-side, because a guard that only exists in the browser is not
 * a guard.
 *
 * The rail is light rather than dark. A counter screen is looked at for
 * eight hours; a slab of navy down one side of it is a lot of contrast
 * to sit beside all day, and it pushes every page into feeling like a
 * dialog. The brand lives in the mark and the one orange action.
 */
export default function Shell({ allow, children }) {
  const pathname = usePathname();
  const router = useRouter();

  const [user, setUser] = useState(null);
  const [live, setLive] = useState(false);
  const [unread, setUnread] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);   // the phone rail
  const [accountOpen, setAccountOpen] = useState(false);

  const loadUnread = useCallback(async () => {
    try {
      const r = await api('/api/notifications');
      setUnread(r.unread);
    } catch { /* a failed badge must never block the page */ }
  }, []);

  useEffect(() => {
    const u = getUser();
    if (!u) { router.replace('/'); return; }
    // A session with no home here can only be stale.
    if (!HOME[u.role]) { clearSession(); router.replace('/'); return; }
    if (allow && !allow.includes(u.role)) { router.replace(HOME[u.role]); return; }
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

  // A tap anywhere else closes the account menu, which is what every
  // menu on every other site does.
  useEffect(() => {
    if (!accountOpen) return;
    const close = () => setAccountOpen(false);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [accountOpen]);

  // Changing page closes the phone rail; leaving it open over the new
  // page is the classic mobile-nav bug.
  useEffect(() => { setMenuOpen(false); }, [pathname]);

  const signOut = () => {
    closeSocket();
    clearSession();
    router.replace('/');
  };

  if (!user) return <div className="boot"><span className="spinner dark" /></div>;

  const items = NAV[user.role] || [];
  const current = items.find(
    (i) => i.href && (pathname === i.href || (i.href !== '/' && pathname.startsWith(i.href + '/')))
  );
  const title = current?.label || DESK_LABEL[user.role];

  return (
    <div className={`shell ${menuOpen ? 'rail-open' : ''}`}>
      {/* ── The rail ──────────────────────────────────────────────── */}
      <aside className="rail">
        <div className="rail-brand">
          <span className="mark">AH</span>
          <span className="wordmark">
            AL HADEED<b>HARDWARE</b>
          </span>
        </div>

        <nav className="rail-nav">
          {items.map((item, i) =>
            item.group ? (
              <span className="rail-group" key={`g${i}`}>{item.group}</span>
            ) : (
              <Link
                key={item.href}
                href={item.href}
                className={item === current ? 'on' : ''}
                aria-current={item === current ? 'page' : undefined}
              >
                {Icon[item.icon]?.()}
                <span>{item.label}</span>
                {item.badge === 'alerts' && unread > 0 && <b className="pip">{unread}</b>}
              </Link>
            )
          )}
        </nav>

        <div className="rail-foot">
          <span className={`conn ${live ? '' : 'off'}`}>
            <i />
            {live ? 'Live' : 'Reconnecting…'}
          </span>
        </div>
      </aside>

      {/* ── The bar ───────────────────────────────────────────────── */}
      <div className="frame">
        <header className="topbar">
          <button
            type="button"
            className="icon-btn only-phone"
            onClick={() => setMenuOpen((m) => !m)}
            aria-label="Menu"
            aria-expanded={menuOpen}
          >
            {Icon.menu()}
          </button>

          <h1 className="topbar-title">{title}</h1>

          <div className="topbar-right">
            <Link
              href="/notifications"
              className="icon-btn"
              aria-label={unread ? `Alerts, ${unread} unread` : 'Alerts'}
            >
              {Icon.bell()}
              {unread > 0 && <b className="pip dot" aria-hidden="true">{unread}</b>}
            </Link>

            <div className="account" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                className="account-btn"
                onClick={() => setAccountOpen((o) => !o)}
                aria-expanded={accountOpen}
              >
                <span className="avatar">{initials(user.fullName)}</span>
                <span className="account-who">
                  <b>{user.fullName}</b>
                  <em>{DESK_LABEL[user.role]}</em>
                </span>
              </button>

              {accountOpen && (
                <div className="account-menu" role="menu">
                  <div className="account-head">
                    <b>{user.fullName}</b>
                    <span>{user.phone || user.email}</span>
                  </div>
                  <button type="button" className="account-item" onClick={signOut} role="menuitem">
                    {Icon.logout()} Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="main">{children}</main>
      </div>

      {menuOpen && <div className="rail-veil" onClick={() => setMenuOpen(false)} />}
    </div>
  );
}

function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
}
