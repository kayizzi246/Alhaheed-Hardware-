'use client';

import { useCallback, useState } from 'react';
import { api, peek } from '@/lib/api';
import { confirmAction } from '@/components/Confirm';
import { usePoll } from '@/lib/live';
import { dateTime, list } from '@/lib/format';
import { cn } from '@/lib/cn';
import {
  Alert, Button, Card, CardHead, CardTitle, Empty, Fresh, Loading, PageHead, LoadFailed } from '@/components/ui';

/**
 * The whole alert history.
 *
 * The bell in the top bar shows the last fifteen, which is what anyone
 * needs during a shift. This is the page for the other question —
 * "when did that order go out?" — so it goes back as far as the server
 * keeps.
 */
export default function NotificationsPage() {
  const [data, setData] = useState(() => peek('/api/notifications'));
  const [error, setError] = useState('');
  const [picked, setPicked] = useState(() => new Set());
  const [busy, setBusy] = useState(false);

  // Deleting clears this person's list only; the Audit Trail keeps it all.
  async function remove(body, ask) {
    if (ask && !(await confirmAction(ask))) return;
    setBusy(true);
    try {
      await api('/api/notifications/delete', { method: 'POST', body });
      setPicked(new Set());
      await load();
    } catch (e) {
      setError(e.message);
    }
    setBusy(false);
  }

  const load = useCallback(async () => {
    try {
      setData(await api('/api/notifications'));
      setError('');
    } catch (e) {
      // On failure, keep what was on screen; the error says it is stale.
      setError(e.message);
    }
  }, []);

  const { at, failing } = usePoll(load, 15000);

  async function markAllRead() {
    try {
      await api('/api/notifications/read-all', { method: 'POST' });
      load();
    } catch (e) {
      setError(e.message);
    }
  }

  if (!data) return error ? <LoadFailed onRetry={load}>{error}</LoadFailed> : <Loading>Loading alerts…</Loading>;

  const rows = list(data.notifications);

  return (
    <>
      <PageHead title="Alerts" sub="Everything the desks have done, newest first.">
        <Fresh at={at} failing={failing} />
        {data.unread > 0 && (
          <Button variant="outline" size="sm" onClick={markAllRead}>Mark all read</Button>
        )}
        {list(data.notifications).length > 0 && (
          <Button variant="outline" size="sm" className="text-bad" disabled={busy} onClick={() => remove({ all: true }, { title: 'Delete every alert?', body: 'Your alert list will be empty.', points: ['This only clears your list.', 'The Audit Trail still keeps every record.'], confirm: 'Delete all', cancel: 'Keep them' })}>
            Delete all
          </Button>
        )}
      </PageHead>

      <Alert>{error}</Alert>

      <Card>
        <CardHead>
          <label className="flex cursor-pointer items-center gap-3">
            {rows.length > 0 && (
              <input
                type="checkbox"
                aria-label="Select every alert"
                className="size-4 cursor-pointer accent-[rgb(var(--brand))]"
                checked={rows.length > 0 && rows.every((n) => picked.has(n.id))}
                onChange={(e) => setPicked(e.target.checked ? new Set(rows.map((n) => n.id)) : new Set())}
              />
            )}
            <CardTitle>{data.unread > 0 ? `${data.unread} unread` : 'All caught up'}</CardTitle>
          </label>
          {picked.size > 0 ? (
            <span className="flex items-center gap-3">
              <span className="text-[11.5px] font-semibold text-ink">{picked.size} selected</span>
              <Button size="sm" variant="danger" disabled={busy} onClick={() => remove({ ids: [...picked] })}>Delete {picked.size}</Button>
            </span>
          ) : (
            <span className="text-[11.5px] text-ink-muted">{rows.length} shown</span>
          )}
        </CardHead>

        {rows.length === 0 ? (
          <Empty title="Nothing yet">
            When an order moves between desks, it shows up here.
          </Empty>
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((n) => (
              <li
                key={n.id}
                className={cn('relative flex flex-wrap items-start gap-x-4 gap-y-1 py-3.5 pl-14 pr-5', !n.read && 'bg-brand-soft', picked.has(n.id) && 'bg-brand-soft/60')}
              >
                <input
                  type="checkbox"
                  aria-label={`Select ${n.title}`}
                  className="absolute left-5 top-[17px] size-4 cursor-pointer accent-[rgb(var(--brand))]"
                  checked={picked.has(n.id)}
                  onChange={(e) => setPicked((p) => { const x = new Set(p); if (e.target.checked) x.add(n.id); else x.delete(n.id); return x; })}
                />
                {/* A mark as well as a tint: colour alone is not a
                    difference everyone can see. */}
                {!n.read && <span className="absolute left-10 top-[21px] size-1.5 rounded-full bg-brand" />}
                <div className="min-w-0 flex-1">
                  <strong className="block text-[12.5px] font-semibold text-ink">{n.title}</strong>
                  {!!n.body && <span className="mt-0.5 block text-[11.5px] text-ink-muted">{n.body}</span>}
                </div>
                <div className="shrink-0 text-right">
                  <span className="tnum block text-[11.5px] text-ink-muted">{dateTime(n.created_at)}</span>
                  {!!n.order_no && <span className="tnum block text-[11.5px] text-ink-faint">{n.order_no}</span>}
                  <button type="button" disabled={busy} onClick={() => remove({ ids: [n.id] })} className="mt-1 text-[11.5px] font-semibold text-bad hover:underline">
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <p className="text-[11.5px] text-ink-muted">Deleting an alert only clears it from your list. The Audit Trail keeps a record of everything, so nothing can be hidden by deleting it.</p>
    </>
  );
}
