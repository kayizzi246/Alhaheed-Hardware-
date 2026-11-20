import { Router } from 'express';
import { all, run } from '../db/index.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

/** A person's own alerts plus anything broadcast to their desk. */
router.get('/', async (req, res) => {
  const notifications = await all(
    `SELECT n.*, o.order_no
       FROM notifications n LEFT JOIN orders o ON o.id = n.order_id
      WHERE n.user_id = ? OR (n.user_id IS NULL AND n.role = ?)
      ORDER BY n.created_at DESC LIMIT 100`,
    [req.user.id, req.user.role]
  );
  res.json({
    notifications,
    unread: notifications.filter((n) => !n.read).length,
  });
});

router.post('/:id/read', async (req, res) => {
  await run(
    `UPDATE notifications SET read = 1
      WHERE id = ? AND (user_id = ? OR (user_id IS NULL AND role = ?))`,
    [Number(req.params.id), req.user.id, req.user.role]
  );
  res.json({ ok: true });
});

router.post('/read-all', async (req, res) => {
  await run(
    `UPDATE notifications SET read = 1
      WHERE read = 0 AND (user_id = ? OR (user_id IS NULL AND role = ?))`,
    [req.user.id, req.user.role]
  );
  res.json({ ok: true });
});

export default router;
