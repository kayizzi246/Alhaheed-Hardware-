'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, getUser, clearSession, peek } from '@/lib/api';
import { NAV, HOME, DESK_LABEL } from '@/lib/roles';
import { Icon } from '@/components/icons';
import { usePoll, freshness } from '@/lib/live';
import { time, list } from '@/lib/format';
import { ThemeChoice } from '@/components/Theme';
import { cn } from '@/lib/cn';
import { Button, IconButton, Spinner } from '@/components/ui';

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
  const [unread, setUnread] = useState(() => peek('/api/notifications')?.unread ?? 0);
  const [menuOpen, setMenuOpen] = useState(false); // the phone rail
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

  if (!user) {
    return (
      <div className="grid min-h-dvh place-items-center text-ink-muted">
        <Spinner className="size-6" />
      </div>
    );
  }

  const items = NAV[user.role] || [];

  // The longest matching nav item wins, not the first one found.
  // "/manager/orders" starts with "/manager/", so a first-match search
  // picked the dashboard and every sub-page was titled "Dashboard".
  const current = items
    .filter((i) => i.href && (pathname === i.href || (i.href !== '/' && pathname.startsWith(i.href + '/'))))
    .sort((a, b) => b.href.length - a.href.length)[0];

  const title = current?.label || DESK_LABEL[user.role];

  return (
    <div className="min-h-dvh lg:pl-rail">
      {/* ── The rail ──────────────────────────────────────────────── */}
      {/* The rail is the shop's dark warm navy, the same slab the
          sign-in page wears, so the brand is on screen the whole shift
          rather than only at the door. Everything inside it is set in
          white at varying strength — the orange is kept for the one
          row you are standing on, which is the only thing in here that
          needs to be found at a glance. */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-rail flex-col border-r border-black/20 bg-navy',
          'transition-transform duration-200 ease-out',
          'max-lg:shadow-lg',
          menuOpen ? 'max-lg:translate-x-0' : 'max-lg:-translate-x-full'
        )}
      >
        <div className="flex items-center h-16 shrink-0 gap-3 border-b border-white/10 px-5">
          <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-gradient-to-br from-fill to-fill-dark text-[13px] font-extrabold text-white shadow-sm">
            AH
          </span>
          <span className="font-display text-[12.5px] font-extrabold leading-[1.15] tracking-[.04em] text-white">
            AL HADEED
            <br />
            <b className="text-blue-300">HARDWARE</b>
          </span>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {items.map((item, i) =>
            item.group ? (
              <p
                key={`g${i}`}
                className="mb-2 mt-6 px-3 font-display text-[10.5px] font-bold uppercase tracking-[.08em] text-white/60"
              >
                {item.group}
              </p>
            ) : (
              <Link
                key={item.href}
                href={item.href}
                aria-current={item === current ? 'page' : undefined}
                className={cn(
                  'relative mb-0.5 flex items-center gap-3 rounded-lg px-3 py-2.5',
                  'font-display text-[14.5px] font-medium transition-colors duration-150 ease-out',
                  item === current
                    ? 'bg-[linear-gradient(90deg,rgb(var(--brand)/0.30),rgb(var(--brand)/0.06))] font-semibold text-white shadow-[inset_0_0_0_1px_rgb(255_255_255/0.07)]'
                    : 'text-white/75 hover:bg-white/[.06] hover:text-white'
                )}
              >
                {/* A bar as well as a tint, so the current row is still
                    obvious to anyone who cannot pick the tint out. */}
                {item === current && (
                  <span className="absolute inset-y-2 left-0 w-[3px] rounded-r bg-brand shadow-[0_0_12px_rgb(var(--brand))]" />
                )}
                <span className={cn('shrink-0 transition-colors duration-150', item === current ? 'text-white' : 'text-white/65')}>
                  {Icon[item.icon]?.()}
                </span>
                {item.label}
              </Link>
            )
          )}
        </nav>

        <div className="border-t border-white/10 px-6 py-4">
          <span
            title="These screens re-check the shop on their own"
            className={cn('inline-flex items-center gap-2 text-xs', failing ? 'text-bad' : 'text-white/65')}
          >
            <i className={cn('size-1.5 rounded-full', failing ? 'bg-bad' : 'bg-ok')} />
            {freshness(at, failing)}
          </span>
        </div>
      </aside>

      {/* ── The bar ───────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 flex items-center h-16 gap-3 border-b border-line/80 bg-surface/85 px-4 backdrop-blur-xl backdrop-saturate-150 lg:px-8">
        <IconButton className="lg:hidden" onClick={() => setMenuOpen((m) => !m)} aria-label="Menu" aria-expanded={menuOpen}>
          {Icon.menu()}
        </IconButton>

        <h1 className="min-w-0 flex-1 truncate font-display text-[18px] font-bold tracking-[-.015em] text-ink">{title}</h1>

        <div className="flex items-center gap-2">
          <Alerts unread={unread} home={HOME[user.role]} onSeen={() => setUnread(0)} />

          <div className="relative" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setAccountOpen((o) => !o)}
              aria-expanded={accountOpen}
              className={cn(
                'flex items-center gap-2.5 rounded-full border border-line bg-surface py-1 pl-1 pr-2.5',
                'transition-[border-color,transform] duration-150 ease-out hover:border-line-firm active:scale-[.98]'
              )}
            >
              <span className="grid size-[30px] shrink-0 place-items-center rounded-full bg-navy text-[11.5px] font-bold text-white">
                {initials(user.fullName)}
              </span>
              <span className="hidden flex-col text-left leading-[1.25] sm:flex">
                <b className="text-[13px] font-semibold text-ink">{user.fullName}</b>
                <em className="text-[11.5px] not-italic text-ink-muted">{DESK_LABEL[user.role]}</em>
              </span>
            </button>

            {accountOpen && (
              <div
                role="menu"
                className="absolute right-0 top-[calc(100%+8px)] z-30 w-56 origin-top-right animate-pop-in overflow-hidden rounded-lg border border-line bg-surface shadow-lg"
              >
                <div className="border-b border-line px-4 py-3">
                  <b className="block text-[13.5px] font-semibold text-ink">{user.fullName}</b>
                  <span className="text-xs text-ink-muted">{user.phone || user.email}</span>
                </div>

                <ThemeChoice />

                <button
                  type="button"
                  role="menuitem"
                  onClick={signOut}
                  className="flex w-full items-center gap-2.5 px-4 py-3 text-left text-[13.5px] font-medium text-bad transition-colors hover:bg-surface-2"
                >
                  {Icon.logout()} Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <Offline />
      <main className="mx-auto max-w-[1800px] px-4 pb-16 pt-6 lg:px-8 lg:pt-8">{children}</main>

      {/* The veil only exists on a phone, where the rail slides over. */}
      {menuOpen && (
        <div
          className="fixed inset-0 z-30 bg-navy-deep/40 backdrop-blur-[1px] lg:hidden"
          onClick={() => setMenuOpen(false)}
        />
      )}
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
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <IconButton
        onClick={() => (open ? setOpen(false) : openPanel())}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={unread ? `Alerts, ${unread} unread` : 'Alerts'}
      >
        {Icon.bell()}
        {unread > 0 && (
          <b
            aria-hidden="true"
            className="tnum absolute right-[3px] top-[4px] grid h-[17px] min-w-[17px] place-items-center rounded-full border-2 border-surface bg-fill px-1 text-[10px] font-bold text-white"
          >
            {unread}
          </b>
        )}
      </IconButton>

      {open && (
        <div
          role="dialog"
          aria-label="Alerts"
          className="absolute right-0 top-[calc(100%+8px)] z-30 w-[370px] max-w-[calc(100vw-28px)] origin-top-right animate-pop-in overflow-hidden rounded-lg border border-line bg-surface shadow-lg"
        >
          <div className="flex items-center justify-between border-b border-line bg-surface-2 py-3 pl-4 pr-2.5">
            <div>
              <b className="font-display text-[14.5px] font-bold text-ink">Alerts</b>
              <span className="ml-2 text-[11.5px] text-ink-faint">
                {rows === null ? '' : rows.length === 0 ? 'nothing new' : `last ${Math.min(rows.length, SHOWN)}`}
              </span>
            </div>
            <IconButton className="size-[30px]" onClick={() => setOpen(false)} aria-label="Close">
              {Icon.close()}
            </IconButton>
          </div>

          <div className="max-h-[min(60vh,420px)] overflow-y-auto">
            {rows === null && !failed && (
              <div className="space-y-2.5 px-4 py-4">
                <div className="h-3 animate-shimmer rounded bg-surface-sunk" />
                <div className="h-3 w-[72%] animate-shimmer rounded bg-surface-sunk" />
                <div className="h-3 w-[54%] animate-shimmer rounded bg-surface-sunk" />
              </div>
            )}

            {failed && (
              <p className="px-6 py-8 text-center">
                <b className="block text-sm font-semibold text-ink">Could not reach the shop.</b>
                <span className="mt-1.5 block text-[12.5px] leading-relaxed text-ink-muted">
                  The alerts are still there. Try again in a moment.
                </span>
              </p>
            )}

            {rows !== null && rows.length === 0 && (
              <p className="px-6 py-8 text-center">
                <b className="block text-sm font-semibold text-ink">Nothing to catch up on.</b>
                <span className="mt-1.5 block text-[12.5px] leading-relaxed text-ink-muted">
                  When an order moves between desks, it shows up here.
                </span>
              </p>
            )}

            {rows !== null && rows.length > 0 &&
              groupByDay(rows.slice(0, SHOWN)).map(([day, items]) => (
                <section key={day}>
                  <p className="sticky top-0 z-[1] border-y border-line bg-surface-2/90 px-4 py-1.5 font-display text-[10.5px] font-bold uppercase tracking-[.07em] text-ink-faint backdrop-blur">
                    {day}
                  </p>
                  {items.map((n) => {
                    const body = (
                      <>
                        <b className="block text-[13.5px] font-semibold leading-snug text-ink">{n.title}</b>
                        {n.body && <span className="mt-0.5 block text-[12.5px] leading-relaxed text-ink-muted">{n.body}</span>}
                        <em className="tnum mt-1 block text-[11.5px] not-italic text-ink-faint">
                          {n.order_no ? `${n.order_no} · ` : ''}
                          {time(n.created_at)}
                        </em>
                      </>
                    );
                    const inner = cn(
                      'block border-b border-line py-3.5 pl-8 pr-5 transition-colors duration-150',
                      !n.read && 'bg-brand-soft'
                    );
                    return (
                      <div key={n.id} className="relative">
                        {/* A mark as well as a tint: colour alone is not
                            a difference everyone can see. */}
                        {!n.read && <span className="absolute left-4 top-[21px] size-1.5 rounded-full bg-brand" />}
                        {n.order_id ? (
                          <Link href={`${home}/orders/${n.order_id}`} onClick={() => setOpen(false)} className={cn(inner, 'hover:bg-surface-2')}>
                            {body}
                          </Link>
                        ) : (
                          <span className={inner}>{body}</span>
                        )}
                      </div>
                    );
                  })}
                </section>
              ))}
          </div>

          <div className="border-t border-line bg-surface-2 px-4 py-2.5 text-center">
            <Button asChild variant="ghost" size="sm">
              <Link href="/notifications" onClick={() => setOpen(false)}>See everything</Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/** How many of the most recent alerts the panel shows. */
const SHOWN = 15;

/**
 * "Today", "Yesterday", then the day, then the date.
 *
 * Fifteen lines of timestamps is a wall. Grouped under the day they
 * happened, the same fifteen read as "this morning" and "last night",
 * which is how people actually ask about them.
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

/**
 * Lost the connection? Say so, once, at the top — before somebody
 * presses Confirm on a payment and wonders why nothing happened.
 *
 * The browser's own online/offline signal: it knows when the Wi-Fi or
 * the mobile data has dropped. It cannot know when the shop's server
 * is down; that is what each screen's own error message is for.
 */
function Offline() {
  const [down, setDown] = useState(false);
  const [back, setBack] = useState(false);

  useEffect(() => {
    if (typeof navigator === 'undefined') return undefined;
    setDown(navigator.onLine === false);
    let t;
    const off = () => { setDown(true); setBack(false); };
    const on = () => {
      setDown(false);
      setBack(true);
      clearTimeout(t);
      t = setTimeout(() => setBack(false), 4000);
    };
    window.addEventListener('offline', off);
    window.addEventListener('online', on);
    return () => {
      window.removeEventListener('offline', off);
      window.removeEventListener('online', on);
      clearTimeout(t);
    };
  }, []);

  if (!down && !back) return null;
  return (
    <div
      role="status"
      className={cn(
        'sticky top-16 z-20 px-4 py-2.5 text-center text-[13px] font-medium lg:px-8',
        down ? 'bg-warn-bg text-warn' : 'bg-ok-bg text-ok'
      )}
    >
      {down
        ? 'You are offline. Nothing you do now will save — it will work again once the internet is back.'
        : 'Back online.'}
    </div>
  );
}
