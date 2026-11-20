import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

fs.mkdirSync(path.dirname(config.dbFile), { recursive: true });

export const db = new DatabaseSync(config.dbFile);
db.exec('PRAGMA foreign_keys = ON;');

/** Create tables if they do not exist yet. Safe to call on every boot. */
export function migrate() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  db.exec(sql);
}

/** Rows for a SELECT. */
export function all(sql, params = []) {
  return db.prepare(sql).all(...params);
}

/** First row for a SELECT, or undefined. */
export function get(sql, params = []) {
  return db.prepare(sql).get(...params);
}

/** Run an INSERT/UPDATE/DELETE. Returns { changes, lastInsertRowid }. */
export function run(sql, params = []) {
  return db.prepare(sql).run(...params);
}

/** Wrap fn in a transaction; rolls back when fn throws. */
export function tx(fn) {
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

/** Atomically take the next value of a named counter. */
export function nextCounter(name) {
  run('UPDATE counters SET value = value + 1 WHERE name = ?', [name]);
  const row = get('SELECT value FROM counters WHERE name = ?', [name]);
  if (!row) throw new Error(`Unknown counter: ${name}`);
  return row.value;
}

export const nextOrderNo = () => `AH-${nextCounter('order')}`;
export const nextReceiptNo = () => `R-${String(nextCounter('receipt')).padStart(5, '0')}`;
