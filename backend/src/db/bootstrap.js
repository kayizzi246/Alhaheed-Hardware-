/**
 * Make an empty database fit to run — safely, on every boot.
 *
 * This is what `db:reset` and `db:seed` are not: it never deletes
 * anything, never loads the demo cast, and does nothing at all once the
 * shop has real data in it. It is safe to run on every deploy, which is
 * exactly how the Render blueprint runs it.
 *
 * On a brand-new disk it:
 *   1. creates the tables, and
 *   2. creates one manager account, from ADMIN_PHONE / ADMIN_PASSWORD,
 *      so somebody can sign in and add the real staff and products.
 *
 * It deliberately does not fall back to a default password. A shop that
 * goes live with a guessable manager login is worse than one that will
 * not start, because nobody notices the first case until it is too late.
 */

import bcrypt from 'bcryptjs';
import { db, get, run, migrate } from './index.js';
import { config } from '../config.js';
import { normalisePhone } from '../utils/sms.js';

migrate();

const staff = get(`SELECT COUNT(*) AS n FROM users WHERE role <> 'customer'`);

if (staff.n > 0) {
  console.log(`  Database ready — ${staff.n} staff account(s) already exist.`);
} else {
  const phone = process.env.ADMIN_PHONE;
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME || 'Manager';
  const email = process.env.ADMIN_EMAIL || null;

  if (!phone || !password) {
    console.error(
      '\n  This database has no staff accounts, and no manager can be\n' +
      '  created because ADMIN_PHONE and ADMIN_PASSWORD are not set.\n\n' +
      '  Set both (ADMIN_PASSWORD at least 8 characters) and deploy again.\n' +
      '  Nobody would be able to sign in otherwise.\n'
    );
    process.exit(1);
  }

  if (password.length < 8) {
    console.error('\n  ADMIN_PASSWORD must be at least 8 characters.\n');
    process.exit(1);
  }

  run(
    `INSERT INTO users (full_name, phone, email, password_hash, role, account_type)
     VALUES (?, ?, ?, ?, 'manager', 'individual')`,
    [name, normalisePhone(phone), email, bcrypt.hashSync(password, 10)]
  );

  console.log(
    `\n  First run: created the manager account for ${normalisePhone(phone)}.\n` +
    `  Sign in, add your staff and products, then remove ADMIN_PASSWORD\n` +
    `  from the environment — it is not needed again.\n`
  );
}

// Seed the product categories if the shop has none, so the catalogue has
// its filters on day one. Products themselves are the manager's to add.
const categories = get('SELECT COUNT(*) AS n FROM categories');
if (categories.n === 0) {
  for (const name of [
    'Cement', 'Iron & Steel', 'Roofing', 'Paints',
    'Plumbing', 'Electricals', 'Tools',
  ]) {
    run('INSERT INTO categories (name) VALUES (?)', [name]);
  }
  console.log('  Added the seven starting categories.');
}

console.log(`  ${config.shopName} database: ${config.dbFile}\n`);
db.close();
