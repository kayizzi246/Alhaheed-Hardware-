/** Drop the database file and rebuild it with seed data. */
import fs from 'node:fs';
import { config } from '../config.js';

for (const suffix of ['', '-wal', '-shm']) {
  const f = config.dbFile + suffix;
  if (fs.existsSync(f)) fs.rmSync(f);
}
console.log('Database cleared.');
await import('./seed.js');
