'use client';

import { useCallback, useState } from 'react';
import { api } from '@/lib/api';
import { usePoll } from '@/lib/live';
import { dateTime, list } from '@/lib/format';
import { cn } from '@/lib/cn';
import {
  Alert, Button, Card, CardHead, CardTitle, Empty, Fresh, Loading, PageHead,
} from '@/components/ui';

/**
 * The whole alert history.
 *
 * The bell in the top bar shows the last fifteen, which is what anyone
 * needs during a shift. This is the page for the other question —
 * "when did that order go out?" — so it goes back as far as the server
 * keeps.
 */
export default function NotificationsPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setData(await api('/api/notifications'));
      setError('');
    } catch (e) {
      setData({ notifications: [], unread: 0 });
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

  if (!data) return <Loading>Loading alerts…</Loading>;

  const rows = list(data.notifications);

  return (
    <>
      <PageHead title="Alerts" sub="Everything the desks have done, newest first.">
        <Fresh at={at} failing={failing} />
        {data.unread > 0 && (
          <Button variant="outline" size="sm" onClick={markAllRead}>Mark all read</Button>
        )}
      </PageHead>

      <Alert>{error}</Alert>

      <Card>
        <CardHead>
          <CardTitle>{data.unread > 0 ? `${data.unread} unread` : 'All caught up'}</CardTitle>
          <span className="text-[12.5px] text-ink-muted">{rows.length} shown</span>
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
                className={cn('relative flex flex-wrap items-start gap-x-4 gap-y-1 py-3.5 pl-9 pr-5', !n.read && 'bg-brand-soft')}
              >
                {/* A mark as well as a tint: colour alone is not a
                    difference everyone can see. */}
                {!n.read && <span className="absolute left-4 top-[18px] size-1.5 rounded-full bg-brand" />}
                <div className="min-w-0 flex-1">
                  <strong className="block text-sm font-semibold text-ink">{n.title}</strong>
                  {!!n.body && <span className="mt-0.5 block text-[13px] text-ink-muted">{n.body}</span>}
                </div>
                <div className="shrink-0 text-right">
                  <span className="tnum block text-[12.5px] text-ink-muted">{dateTime(n.created_at)}</span>
                  {!!n.order_no && <span className="tnum block text-xs text-ink-faint">{n.order_no}</span>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
