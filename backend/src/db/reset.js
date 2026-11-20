/**
 * Empty the database and rebuild it with demo data.
 *
 * Drops every table this schema owns rather than deleting a file, since
 * the database may be a Postgres server somewhere else. CASCADE takes
 * the foreign keys with them, so the order does not matter.
 *
 * Destructive on purpose, and it refuses to touch production: a
 * DATABASE_URL that is not local has to be confirmed with
 * ALLOW_REMOTE_RESET=yes, because "rebuild with demo data" against the
 * shop's live database would be the worst possible afternoon.
 */
import { connect, close } from './index.js';
import { config } from '../config.js';

const TABLES = [
  'notifications', 'refunds', 'cash_book', 'payments',
  'order_events', 'order_items', 'stock_movements', 'orders',
  'price_changes', 'products', 'categories',
  'otp_codes', 'users', 'companies', 'counters',
];

const url = config.databaseUrl;
const remote = url && !/@(localhost|127\.0\.0\.1)[:/]/.test(url);

if (remote && process.env.ALLOW_REMOTE_RESET !== 'yes') {
  console.error(
    '\n  Refusing to reset a remote database.\n\n' +
    '  DATABASE_URL does not point at localhost, so this looks like a\n' +
    '  real deployment. Every order, receipt and cash-book line would\n' +
    '  be destroyed.\n\n' +
    '  If you are certain, run it again with ALLOW_REMOTE_RESET=yes.\n'
  );
  process.exit(1);
}

const db = await connect();
await db.script(`DROP TABLE IF EXISTS ${TABLES.join(', ')} CASCADE`);
await db.script('DROP FUNCTION IF EXISTS now_text() CASCADE');
await db.script('DROP FUNCTION IF EXISTS today_text() CASCADE');
console.log('Database cleared.');

await close();
await import('./seed.js');
