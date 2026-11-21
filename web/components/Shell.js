'use client';
import { useCallback, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, getUser, clearSession } from '@/lib/api';
import { NAV, HOME, DESK_LABEL } from '@/lib/roles';
import { Icon } from '@/components/icons';
import { usePoll, freshness } from '@/lib/live';
import { time, list } from '@/lib/format';
import { ThemeChoice } from '@/components/Theme';

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

  // The alert count keeps itself current the same way the desks do.
  //
  // There is no websocket. The Node API had one; WordPress on shared
  // hosting does not, and a "Live" dot that could never go green is
  // worse than no dot at all — so the rail says when it last checked.
  const { at, failing } = usePoll(loadUnread, 20000);

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
    clearSession();
    router.replace('/');
  };

  if (!user) return <div className="boot"><span className="spinner dark" /></div>;

  const items = NAV[user.role] || [];
  // The longest matching nav item wins, not the first one found.
  // "/manager/orders" starts with "/manager/", so a first-match search
  // picked the dashboard and every sub-page was titled "Dashboard".
  const current = items
    .filter((i) => i.href && (pathname === i.href || (i.href !== '/' && pathname.startsWith(i.href + '/'))))
    .sort((a, b) => b.href.length - a.href.length)[0];
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
                <span>{item.label}</span>              </Link>
            )
          )}
        </nav>

        <div className="rail-foot">
          <span
            className={`conn ${failing ? 'off' : ''}`}
            title="These screens re-check the shop on their own"
          >
            <i />
            {freshness(at, failing)}
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
            <Alerts
              unread={unread}
              home={HOME[user.role]}
              onSeen={() => setUnread(0)}
            />

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
                  <ThemeChoice />
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

/**
 * The bell, and what is behind it.
 *
 * A separate page for "three things happened" is a page too many: you
 * glance, you see, you carry on. So the bell opens a panel in place and
 * the list is read where you are standing.
 *
 * The list is only fetched when the panel opens. A badge that polls is
 * cheap; forty rows of text pulled down every twenty seconds for a
 * panel nobody has opened is not.
 *
 * Opening it marks everything read, because opening it is what reading
 * means. The pip clears immediately rather than after the round trip —
 * if the call fails the next poll puts it back, and in the meantime the
 * screen has told the truth about what the person just did.
 */
function Alerts({ unread, home, onSeen }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState(null);
  const [failed, setFailed] = useState(false);

  const openPanel = async () => {
    setOpen(true);
    setFailed(false);
    try {
      const r = await api('/api/notifications');
      setRows(list(r.notifications));
      if (r.unread) {
        onSeen();
        api('/api/notifications/read-all', { method: 'POST' }).catch(() => {});
      }
    } catch {
      setFailed(true);
    }
  };

  // Clicking anywhere else, or pressing Escape, closes it — the two
  // things every menu on every other site does.
  useEffect(() => {
    if (!open) return;
    const away = () => setOpen(false);
    const key = (e) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('click', away);
    window.addEventListener('keydown', key);
    return () => {
      window.removeEventListener('click', away);
      window.removeEventListener('keydown', key);
    };
  }, [open]);

  return (
    <div className="alerts" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        className="icon-btn"
        onClick={() => (open ? setOpen(false) : openPanel())}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={unread ? `Alerts, ${unread} unread` : 'Alerts'}
      >
        {Icon.bell()}
        {unread > 0 && <b className="pip dot" aria-hidden="true">{unread}</b>}
      </button>

      {open && (
        <div className="alerts-panel" role="dialog" aria-label="Alerts">
          <div className="alerts-head">
            <div>
              <b>Alerts</b>
              <span className="alerts-count">
                {rows === null ? '' : rows.length === 0 ? 'nothing new' : `last ${Math.min(rows.length, SHOWN)}`}
              </span>
            </div>
            <button type="button" className="icon-btn sm" onClick={() => setOpen(false)} aria-label="Close">
              {Icon.close()}
            </button>
          </div>

          <div className="alerts-body">
            {rows === null && !failed && (
              <div className="alerts-loading">
                <span className="line" /><span className="line" /><span className="line" />
              </div>
            )}

            {failed && (
              <p className="alerts-empty">
                <b>Could not reach the shop.</b>
                <span>The alerts are still there. Try again in a moment.</span>
              </p>
            )}

            {rows !== null && rows.length === 0 && (
              <p className="alerts-empty">
                <b>Nothing to catch up on.</b>
                <span>When an order moves between desks, it shows up here.</span>
              </p>
            )}

            {rows !== null && rows.length > 0 && (
              <ul className="alerts-list">
                {groupByDay(rows.slice(0, SHOWN)).map(([day, items]) => (
                  <li key={day} className="alert-day">
                    <p className="alert-day-head">{day}</p>
                    <ul>
                      {items.map((n) => renderRow(n))}
                    </ul>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="alerts-foot">
            <Link href="/notifications" className="linkish" onClick={() => setOpen(false)}>
              See everything
            </Link>
          </div>
        </div>
      )}
    </div>
  );

  function renderRow(n) {
    const body = (
      <>
        <b>{n.title}</b>
        {n.body && <span className="alert-note">{n.body}</span>}
        <em>
          {n.order_no ? `${n.order_no} · ` : ''}
          {time(n.created_at)}
        </em>
      </>
    );
    return (
      <li key={n.id} className={n.read ? 'alert-row' : 'alert-row new'}>
        {n.order_id ? (
          <Link href={`${home}/orders/${n.order_id}`} onClick={() => setOpen(false)}>
            {body}
          </Link>
        ) : (
          <span>{body}</span>
        )}
      </li>
    );
  }
}

/** How many of the most recent alerts the panel shows. */
const SHOWN = 15;

/**
 * "Today", "Yesterday", then the date.
 *
 * Fifteen lines of timestamps is a wall. Grouped under the day they
 * happened, the same fifteen lines read as "this morning" and "last
 * night", which is how people actually ask about them.
 */
function groupByDay(rows) {
  const out = [];
  for (const n of rows) {
    const label = dayLabel(n.created_at);
    const last = out[out.length - 1];
    if (last && last[0] === label) last[1].push(n);
    else out.push([label, [n]]);
  }
  return out;
}

function dayLabel(stamp) {
  const d = asDate(stamp);
  if (!d) return 'Earlier';

  const midnight = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((midnight(new Date()) - midnight(d)) / 86400000);

  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return d.toLocaleDateString('en-GB', { weekday: 'long' });
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });
}

/** The API sends times in UTC without saying so. */
function asDate(stamp) {
  if (!stamp) return null;
  const s = String(stamp);
  const d = new Date(s.replace(' ', 'T') + (s.endsWith('Z') ? '' : 'Z'));
  return Number.isNaN(d.getTime()) ? null : d;
}


function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
}
