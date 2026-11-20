/**
 * The database. PostgreSQL, through one of two drivers.
 *
 *   DATABASE_URL set   -> `pg`, talking to a real server (Supabase, Neon,
 *                         Render Postgres, your own). This is production.
 *   DATABASE_URL unset -> PGlite, which is PostgreSQL itself compiled to
 *                         WebAssembly and run in this process, storing to
 *                         a folder. No server to install, nothing to start.
 *                         This is local development and the test suite.
 *
 * Both are the same engine, so what passes the tests is what runs in the
 * shop — the point of not using SQLite in one and Postgres in the other.
 *
 * ── Everything here is async. ──
 * `node:sqlite` was synchronous and `pg` is not, so `all`, `get`, `run`
 * and `tx` all return promises and every caller awaits them. There is no
 * way around it and no synchronous Postgres driver worth having.
 *
 * Two conveniences are kept from the old module so the 230-odd call
 * sites did not all have to be rewritten:
 *
 *   • `?` placeholders are translated to `$1, $2, …`. String literals are
 *     skipped, so a question mark inside quotes is left alone.
 *   • `run()` returns `lastInsertRowid`. Postgres has no such thing, so
 *     an INSERT with no RETURNING clause of its own gets `RETURNING id`
 *     appended and the id is read back out.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AsyncLocalStorage } from 'node:async_hooks';
import { config } from '../config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------
// Placeholders: ? -> $n
// ---------------------------------------------------------------------

/**
 * Rewrites `?` to `$1, $2, …`, ignoring anything inside single or double
 * quotes. Doing it here means the SQL in the rest of the app reads the
 * way it always did.
 */
export function toPgPlaceholders(sql) {
  let out = '';
  let n = 0;
  let quote = null;

  for (let i = 0; i < sql.length; i++) {
    const c = sql[i];

    if (quote) {
      out += c;
      // '' and "" are escaped quotes inside a literal, not the end of it.
      if (c === quote) {
        if (sql[i + 1] === quote) { out += sql[++i]; } else { quote = null; }
      }
      continue;
    }

    if (c === "'" || c === '"') { quote = c; out += c; continue; }
    if (c === '?') { out += `$${++n}`; continue; }
    out += c;
  }

  return out;
}

// ---------------------------------------------------------------------
// The driver
// ---------------------------------------------------------------------

let backend = null; // { query(sql, params, client), reserve(), release(), close(), name }

async function openPg() {
  const pg = (await import('pg')).default;

  // COUNT() and SUM() come back as int8, which the driver hands over as a
  // string to avoid losing precision past 2^53. Every count and total in
  // this system is far below that, and the application expects numbers,
  // so they are parsed. Same for numeric.
  pg.types.setTypeParser(20, (v) => (v === null ? null : Number(v)));
  pg.types.setTypeParser(1700, (v) => (v === null ? null : Number(v)));

  const url = config.databaseUrl;
  const local = /@(localhost|127\.0\.0\.1)[:/]/.test(url);

  const pool = new pg.Pool({
    connectionString: url,
    // Hosted Postgres (Supabase, Neon, Render) requires TLS and presents
    // a certificate this client has no root for. Verification is off for
    // that reason, which is how every hosted-Postgres guide has it;
    // a local server needs no TLS at all.
    ssl: local ? false : { rejectUnauthorized: false },
    max: Number(process.env.PG_POOL_MAX || 10),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 15_000,
  });

  pool.on('error', (e) => console.error('  Postgres pool error:', e.message));

  return {
    name: 'postgres',
    query: (sql, params, client) => (client ?? pool).query(sql, params),
    // Several statements in one go, for the schema. The simple query
    // protocol allows it; a prepared statement does not.
    script: (sql) => pool.query(sql),
    reserve: () => pool.connect(),
    release: (client) => client.release(),
    close: () => pool.end(),
  };
}

async function openPglite() {
  let PGlite;
  try {
    ({ PGlite } = await import('@electric-sql/pglite'));
  } catch {
    throw new Error(
      'No DATABASE_URL is set, and @electric-sql/pglite is not installed.\n' +
      'Set DATABASE_URL to a Postgres connection string, or run ' +
      '`npm install` to get the embedded database used for development.'
    );
  }

  const dir = config.dataDir;
  fs.mkdirSync(path.dirname(dir), { recursive: true });
  const lite = await PGlite.create(dir);

  // PGlite is a single connection, so a transaction simply runs on it;
  // there is nothing to reserve and nothing else can interleave.
  return {
    name: 'pglite',
    query: (sql, params) => lite.query(sql, params),
    // exec() takes a whole script; query() is one prepared statement.
    script: (sql) => lite.exec(sql),
    reserve: () => null,
    release: () => {},
    close: () => lite.close(),
  };
}

let opening = null;

/** Opens the database on first use and reuses it after. */
export async function connect() {
  if (backend) return backend;
  opening ??= (config.databaseUrl ? openPg() : openPglite()).then((b) => (backend = b));
  return opening;
}

export async function close() {
  if (!backend) return;
  const b = backend;
  backend = null;
  opening = null;
  await b.close();
}

// ---------------------------------------------------------------------
// Transactions
//
// `tx()` reserves one connection and puts it in async-local storage, so
// the `all`/`get`/`run` calls inside the callback use that connection
// without having to be passed it. Without this they would each take a
// different connection from the pool and the BEGIN would not apply.
// ---------------------------------------------------------------------

const current = new AsyncLocalStorage();

async function exec(sql, params = []) {
  const b = await connect();
  const text = toPgPlaceholders(sql);
  try {
    return await b.query(text, params, current.getStore());
  } catch (e) {
    // Without this, a failing query reports only "syntax error at or
    // near" with no indication of which of 230 queries it was.
    e.message = `${e.message}\n  SQL: ${text.trim().replace(/\s+/g, ' ').slice(0, 300)}`;
    throw e;
  }
}

/** Rows for a SELECT. */
export async function all(sql, params = []) {
  const r = await exec(sql, params);
  return r.rows;
}

/** First row for a SELECT, or undefined. */
export async function get(sql, params = []) {
  const r = await exec(sql, params);
  return r.rows[0];
}

/**
 * Run an INSERT/UPDATE/DELETE.
 *
 * Returns `{ changes, lastInsertRowid, rows }`. Postgres has no implicit
 * last insert id, so an INSERT without its own RETURNING gets
 * `RETURNING id` added and the value is read from the returned row.
 */
export async function run(sql, params = []) {
  let text = sql;
  const isInsert = /^\s*insert\s/i.test(sql);
  const hasReturning = /\sreturning\s/i.test(sql);
  if (isInsert && !hasReturning) text = `${sql.replace(/;\s*$/, '')} RETURNING id`;

  const r = await exec(text, params);
  return {
    changes: r.rowCount ?? 0,
    lastInsertRowid: r.rows?.[0]?.id,
    rows: r.rows ?? [],
  };
}

/**
 * Wrap fn in a transaction; rolls back when fn throws.
 *
 * Nested calls join the transaction already running rather than opening
 * a second one, so a service function that uses `tx` internally can
 * still be called from inside another `tx`.
 */
export async function tx(fn) {
  const b = await connect();

  if (current.getStore()) return fn(); // already inside one

  const client = await b.reserve();
  try {
    await b.query('BEGIN', [], client);
    const result = await current.run(client, fn);
    await b.query('COMMIT', [], client);
    return result;
  } catch (err) {
    try { await b.query('ROLLBACK', [], client); } catch { /* the error below matters more */ }
    throw err;
  } finally {
    if (client) b.release(client);
  }
}

// ---------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------

/** Create tables if they do not exist yet. Safe to call on every boot. */
export async function migrate() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  const b = await connect();
  await b.script(sql);
}

// ---------------------------------------------------------------------
// Order and receipt numbers
// ---------------------------------------------------------------------

/**
 * Atomically take the next value of a named counter.
 *
 * One statement, so two cashiers pressing the button at the same instant
 * cannot be handed the same receipt number — the row is locked by the
 * update and RETURNING gives back the value this caller won.
 */
export async function nextCounter(name) {
  const row = await get(
    'UPDATE counters SET value = value + 1 WHERE name = ? RETURNING value',
    [name]
  );
  if (!row) throw new Error(`Unknown counter: ${name}`);
  return row.value;
}

export const nextOrderNo = async () => `AH-${await nextCounter('order')}`;
export const nextReceiptNo = async () =>
  `R-${String(await nextCounter('receipt')).padStart(5, '0')}`;
