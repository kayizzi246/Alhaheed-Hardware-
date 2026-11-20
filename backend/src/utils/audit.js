import { run } from '../db/index.js';

/**
 * Append one row to the order audit trail.
 * Every desk hand-off goes through here, so "who handled it and when"
 * can always be reconstructed.
 */
export function logEvent({ orderId, stage, action, fromStatus, toStatus, user, notes }) {
  run(
    `INSERT INTO order_events
       (order_id, stage, action, from_status, to_status, handled_by, handler_name, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      orderId,
      stage,
      action,
      fromStatus || null,
      toStatus || null,
      user?.id || null,
      user?.full_name || null,
      notes || null,
    ]
  );
}
