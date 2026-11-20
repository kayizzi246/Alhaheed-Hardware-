import { run } from '../db/index.js';
import { emitToUser, emitToRole } from '../realtime.js';

/** Notify one person (the customer who ordered, a company owner, ...). */
export function notifyUser(userId, { title, body, orderId }) {
  if (!userId) return;
  const res = run(
    'INSERT INTO notifications (user_id, title, body, order_id) VALUES (?, ?, ?, ?)',
    [userId, title, body || null, orderId || null]
  );
  emitToUser(userId, 'notification', {
    id: Number(res.lastInsertRowid),
    title,
    body,
    orderId,
    read: 0,
    created_at: new Date().toISOString(),
  });
}

/** Alert a whole desk that something landed in their queue. */
export function notifyRole(role, { title, body, orderId }) {
  const res = run(
    'INSERT INTO notifications (role, title, body, order_id) VALUES (?, ?, ?, ?)',
    [role, title, body || null, orderId || null]
  );
  emitToRole(role, 'notification', {
    id: Number(res.lastInsertRowid),
    title,
    body,
    orderId,
    read: 0,
    created_at: new Date().toISOString(),
  });
}
