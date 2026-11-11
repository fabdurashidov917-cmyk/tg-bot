import fs from 'node:fs';
import path from 'node:path';
import { pool } from '../src/db.js';

const dir = new URL('../migrations/', import.meta.url);
const files = fs.readdirSync(dir).filter((f) => /^\d+.*\.sql$/.test(f)).sort();

for (const f of files) {
  const sql = fs.readFileSync(new URL(f, dir), 'utf8');
  process.stdout.write(`-> ${f} ... `);
  await pool.query(sql);
  console.log('ok');
}
console.log(`${files.length} ta migratsiya bajarildi`);
await pool.end();
