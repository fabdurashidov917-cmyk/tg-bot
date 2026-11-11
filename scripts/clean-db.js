import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. Agar pg o'rnatilgan va baza ulangan bo'lsa, jonli PostgreSQL bazadagi jadvallarni tozalash
async function clearDatabase() {
  try {
    const { pool } = await import('../src/db.js');
    await pool.query(`
      TRUNCATE TABLE
        movie_files,
        daily_picks,
        favorites,
        gifts,
        reminders,
        request_votes,
        episodes,
        watch_progress,
        series_favorites,
        watch_log,
        movies,
        series
      RESTART IDENTITY CASCADE;

      UPDATE users SET watch_count = 0;
    `);
    console.log('[db] Jonli PostgreSQL bazadagi barcha kino va serial kodlari / yozuvlari tozalandi.');
    try { await pool.end(); } catch {}
  } catch (err) {
    console.log('[db] Jonli baza tozalanmadi (node_modules o\'rnatilmagan yoki DB ulanmagan).');
  }
}

// 2. db/kinobot.sql dump faylini tozalash (xavfsiz qatorma-qator tahlil)
function cleanDumpFile() {
  const filePath = path.join(__dirname, '..', 'db', 'kinobot.sql');
  if (!fs.existsSync(filePath)) {
    console.warn(`[dump] Fayl topilmadi: ${filePath}`);
    return;
  }

  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  const tablesToEmpty = new Set([
    'daily_picks',
    'episodes',
    'favorites',
    'gifts',
    'movie_files',
    'movies',
    'reminders',
    'request_votes',
    'series',
    'series_favorites',
    'watch_log',
    'watch_progress',
  ]);

  const outputLines = [];
  let inEmptyTable = false;
  let inUsersTable = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const matchCopy = line.match(/^COPY public\.(\w+)/);

    if (matchCopy) {
      const tbl = matchCopy[1];
      if (tablesToEmpty.has(tbl)) {
        inEmptyTable = true;
        outputLines.push(line);
        continue;
      } else if (tbl === 'users') {
        inUsersTable = true;
        outputLines.push(line);
        continue;
      }
    }

    if (line === '\\.') {
      if (inEmptyTable) {
        inEmptyTable = false;
        outputLines.push('\\.');
        continue;
      }
      if (inUsersTable) {
        inUsersTable = false;
        outputLines.push('\\.');
        continue;
      }
    }

    if (inEmptyTable) {
      // Kino/serialga tegishli qatorlarni tashlab yuboramiz
      continue;
    }

    if (inUsersTable) {
      // users jadvalidagi watch_count ni 0 ga tushiramiz
      const parts = line.split('\t');
      if (parts.length >= 12) {
        parts[11] = '0';
        outputLines.push(parts.join('\t'));
        continue;
      }
    }

    // Ketma-ketliklarni 1 ga qaytarish
    const seqMatch = line.match(/^SELECT pg_catalog\.setval\('public\.(\w+_id_seq)', \d+, (?:true|false)\);/);
    if (seqMatch) {
      const seq = seqMatch[1];
      const resetSeqs = new Set([
        'episodes_id_seq',
        'gifts_id_seq',
        'movie_files_id_seq',
        'movies_id_seq',
        'reminders_id_seq',
        'series_id_seq',
        'watch_log_id_seq',
      ]);
      if (resetSeqs.has(seq)) {
        outputLines.push(`SELECT pg_catalog.setval('public.${seq}', 1, false);`);
        continue;
      }
    }

    outputLines.push(line);
  }

  fs.writeFileSync(filePath, outputLines.join('\n'), 'utf8');
  console.log('[dump] db/kinobot.sql muvaffaqiyatli tozalandi va saqlandi.');
}

async function main() {
  await clearDatabase();
  cleanDumpFile();
  console.log('✅ Barcha bot kino va serial kodlari toʻliq tozalandi!');
}

main();
