/**
 * Eski MySQL (phpMyAdmin) dumpini PostgreSQL ga ko'chirish.
 * Foydalanish: node scripts/import-mysql.js [dump.sql]
 * file_id lar o'zgarmaydi — kinolar qayta yuklanmaydi.
 */
import fs from 'node:fs';
import { pool } from '../src/db.js';
import { parseCaption } from '../src/lib/utils.js';
import { parseInserts as parseTable, val as cell } from './mysql-parse.js';

const file = process.argv[2] || new URL('../data/legacy-dump.sql', import.meta.url).pathname;
const sql = fs.readFileSync(file, 'utf8');

const parseInserts = (table) => parseTable(sql, table);
const val = (v) => { const x = cell(v); return x === '' ? null : x; };

const client = await pool.connect();
try {
  await client.query('BEGIN');

  // ---- channels ----
  const chRows = parseInserts('channels');
  let chCount = 0;
  for (const r of chRows) {
    const [, channel_id, title, created_at] = r;
    const cid = val(channel_id);
    if (!cid) continue;
    await client.query(
      `INSERT INTO channels (chat_id, title, created_at) VALUES ($1,$2,COALESCE($3::timestamptz, now()))
       ON CONFLICT (chat_id) DO UPDATE SET title = EXCLUDED.title`,
      [cid, val(title), val(created_at)],
    );
    chCount++;
  }

  // ---- users ----
  const uRows = parseInserts('users');
  let uCount = 0;
  for (const r of uRows) {
    const [, user_id, username, first_name, , created_at] = r;
    const uid = Number(val(user_id));
    if (!Number.isFinite(uid) || uid <= 0) continue;
    const uname = val(username);
    await client.query(
      `INSERT INTO users (user_id, username, first_name, created_at, last_seen_at)
       VALUES ($1,$2,$3,COALESCE($4::timestamptz, now()),COALESCE($4::timestamptz, now()))
       ON CONFLICT (user_id) DO UPDATE SET
         username = COALESCE(EXCLUDED.username, users.username),
         first_name = COALESCE(EXCLUDED.first_name, users.first_name),
         created_at = LEAST(users.created_at, EXCLUDED.created_at)`,
      [uid, uname || null, val(first_name), val(created_at)],
    );
    uCount++;
  }

  // ---- movies ----
  const mRows = parseInserts('movies');
  let mCount = 0;
  const codes = new Set();
  for (const r of mRows) {
    const [, code, file_id, created_at, caption, file_type] = r;
    const c = val(code);
    const fid = val(file_id);
    if (!c || !fid) continue;
    if (codes.has(c)) { console.warn(`  ⚠️ takroriy kod o'tkazib yuborildi: ${c}`); continue; }
    codes.add(c);
    const cap = val(caption);
    const meta = parseCaption(cap);
    await client.query(
      `INSERT INTO movies (code, title, caption, file_id, file_type, year, country, lang, quality, rating, genres, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,COALESCE($12::timestamptz, now()))
       ON CONFLICT (code) DO UPDATE SET
         title=EXCLUDED.title, caption=EXCLUDED.caption, file_id=EXCLUDED.file_id,
         file_type=EXCLUDED.file_type, year=EXCLUDED.year, country=EXCLUDED.country,
         lang=EXCLUDED.lang, quality=EXCLUDED.quality, rating=EXCLUDED.rating,
         genres=EXCLUDED.genres, updated_at=now()`,
      [c, meta.title, cap, fid, val(file_type) || 'video', meta.year, meta.country,
       meta.lang, meta.quality, meta.rating, meta.genres, val(created_at)],
    );
    mCount++;
  }

  await client.query('COMMIT');
  console.log(`\n✅ Ko'chirildi:\n  • kanallar: ${chCount}\n  • foydalanuvchilar: ${uCount}\n  • kinolar: ${mCount}`);

  const { rows } = await client.query(
    `SELECT code, title, year, array_to_string(genres,',') AS genres FROM movies ORDER BY created_at DESC LIMIT 5`,
  );
  console.log('\nNamuna (oxirgi 5):');
  for (const x of rows) console.log(`  ${x.code} — ${x.title} (${x.year ?? '-'}) [${x.genres}]`);
} catch (e) {
  await client.query('ROLLBACK');
  console.error('❌ Import xatosi:', e);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
