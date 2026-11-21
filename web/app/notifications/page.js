'use client';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { usePoll } from '@/lib/live';
import { dateTime } from '@/lib/format';
import { Card, Alert, Empty } from '@/components/ui';

/** Order status changes for customers, queue alerts for staff. */
export default function NotificationsPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try { setData(await api('/api/notifications')); setError(''); }
    catch (e) { setError(e.message); }
  }, []);

  // New alerts arrive as the desks work.
  const { at, failing } = usePoll(load, 10000);

  async function markAllRead() {
    try { await api('/api/notifications/read-all', { method: 'POST' }); load(); }
    catch (e) { setError(e.message); }
  }

  if (!data) return <div className="loading">Loading notifications…</div>;

  return (
    <>
      <div className="page-head">
        <h1>Notifications</h1>
        {data.unread > 0 && (
          <button className="btn btn-ghost" onClick={markAllRead}>Mark all read</button>
        )}
      </div>

      <Alert>{error}</Alert>

      <Card title={data.unread > 0 ? `${data.unread} unread` : 'All caught up'}>
        {data.notifications.length === 0 ? (
          <Empty>No notifications yet.</Empty>
        ) : (
          <table>
            <tbody>
              {data.notifications.map((n) => (
                <tr key={n.id} className={n.read ? '' : 'unread-row'}>
                  <td>
                    <strong>{n.title}</strong>
                    {!!n.body && <div className="sub">{n.body}</div>}
                  </td>
                  <td className="num" style={{ width: 170 }}>
                    {dateTime(n.created_at)}
                    {!!n.order_no && <div className="sub">#{n.order_no}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}
