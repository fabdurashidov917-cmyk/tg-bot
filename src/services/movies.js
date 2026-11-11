import { all, one, q } from '../db.js';
import { likeEscape, parseCaption } from '../lib/utils.js';

const COLS = 'id, code, title, caption, file_id, file_type, year, country, lang, quality, rating, genres, views, is_active, created_at, poster_file_id, thumb_file_id';

export const getByCode = (code) =>
  one(`SELECT ${COLS} FROM movies WHERE code = $1 AND is_active`, [String(code).trim()]);

export const getById = (id) => one(`SELECT ${COLS} FROM movies WHERE id = $1`, [id]);

export const getByCodeAny = (code) =>
  one(`SELECT ${COLS} FROM movies WHERE code = $1`, [String(code).trim()]);

/**
 * Qidiruv: avval aniq kod, keyin nom/caption bo'yicha trigram + ILIKE.
 * @returns {Promise<{exact: object|null, list: object[]}>}
 */
export async function search(query, limit = 12) {
  const raw = String(query || '').trim();
  if (!raw) return { exact: null, list: [] };

  if (/^\d{1,12}$/.test(raw)) {
    const exact = await getByCode(raw);
    if (exact) return { exact, list: [] };
  }

  const like = `%${likeEscape(raw)}%`;
  const list = await all(
    `SELECT ${COLS},
            GREATEST(similarity(coalesce(title,''), $1), similarity(coalesce(caption,''), $1)) AS sim
       FROM movies
      WHERE is_active
        AND (title ILIKE $2 ESCAPE '\\' OR caption ILIKE $2 ESCAPE '\\' OR code = $1
             OR coalesce(title,'') % $1)
      ORDER BY (code = $1) DESC, sim DESC, views DESC, created_at DESC
      LIMIT $3`,
    [raw, like, limit],
  );
  if (list.length === 1) return { exact: list[0], list: [] };
  return { exact: null, list };
}

export const latest = (limit = 10, offset = 0) =>
  all(`SELECT ${COLS} FROM movies WHERE is_active ORDER BY created_at DESC, id DESC LIMIT $1 OFFSET $2`, [limit, offset]);

export const top = (limit = 10) =>
  all(`SELECT ${COLS} FROM movies WHERE is_active AND views > 0 ORDER BY views DESC, created_at DESC LIMIT $1`, [limit]);

export const random = () =>
  one(`SELECT ${COLS} FROM movies WHERE is_active ORDER BY random() LIMIT 1`);

export const byGenre = (genre, limit = 10, offset = 0) =>
  all(
    `SELECT ${COLS} FROM movies WHERE is_active AND $1 = ANY (genres)
     ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
    [genre, limit, offset],
  );

export const countByGenre = async (genre) =>
  Number((await one('SELECT count(*)::int AS c FROM movies WHERE is_active AND $1 = ANY (genres)', [genre])).c);

export const genreList = () =>
  all(
    `SELECT g AS genre, count(*)::int AS c FROM movies m, unnest(m.genres) g
     WHERE m.is_active GROUP BY g HAVING count(*) > 0 ORDER BY c DESC, g LIMIT 30`,
  );

export const listPage = (limit, offset) =>
  all(`SELECT ${COLS} FROM movies ORDER BY id DESC LIMIT $1 OFFSET $2`, [limit, offset]);

export const countAll = async () =>
  Number((await one('SELECT count(*)::int AS c FROM movies')).c);

export async function insertMovie({ code, caption, fileId, fileType, addedBy, thumbFileId = null }) {
  const meta = parseCaption(caption);
  return one(
    `INSERT INTO movies (code, title, caption, file_id, file_type, year, country, lang, quality, rating, genres, added_by, thumb_file_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING ${COLS}`,
    [String(code).trim(), meta.title, caption, fileId, fileType, meta.year, meta.country,
     meta.lang, meta.quality, meta.rating, meta.genres, addedBy, thumbFileId],
  );
}

/** Poster: faqat Telegram file_id — fayl serverga yuklanmaydi */
export const setPoster = (id, fileId) =>
  one(`UPDATE movies SET poster_file_id = $2, updated_at = now() WHERE id = $1 RETURNING ${COLS}`, [id, fileId]);

export const clearPoster = (id) =>
  one(`UPDATE movies SET poster_file_id = NULL, updated_at = now() WHERE id = $1 RETURNING ${COLS}`, [id]);

export const setThumb = (id, fileId) =>
  q('UPDATE movies SET thumb_file_id = $2 WHERE id = $1 AND thumb_file_id IS NULL', [id, fileId]);

/**
 * E'lon uchun rasm — FAQAT admin qo'ygan poster.
 * DIQQAT: videoning nishonchasi (thumbnail) yaramaydi — Telegram uni sendPhoto da
 * qabul qilmaydi ("can't use file of type Thumbnail as Photo"), shuning uchun
 * `thumb_file_id` poster o'rnida ishlatilmaydi (jadvalda zaxira sifatida qoladi).
 */
export const posterOf = (m) => m?.poster_file_id || null;

export async function updateCaption(id, caption) {
  const meta = parseCaption(caption);
  return one(
    `UPDATE movies SET caption=$2, title=$3, year=$4, country=$5, lang=$6, quality=$7,
            rating=$8, genres=$9, updated_at=now() WHERE id=$1 RETURNING ${COLS}`,
    [id, caption, meta.title, meta.year, meta.country, meta.lang, meta.quality, meta.rating, meta.genres],
  );
}

export const updateCode = (id, code) =>
  one(`UPDATE movies SET code=$2, updated_at=now() WHERE id=$1 RETURNING ${COLS}`, [id, String(code).trim()]);

export const updateFile = (id, fileId, fileType) =>
  one(`UPDATE movies SET file_id=$2, file_type=$3, updated_at=now() WHERE id=$1 RETURNING ${COLS}`, [id, fileId, fileType]);

export const toggleActive = (id) =>
  one(`UPDATE movies SET is_active = NOT is_active, updated_at=now() WHERE id=$1 RETURNING ${COLS}`, [id]);

export const deleteMovie = (id) => q('DELETE FROM movies WHERE id = $1', [id]);

export async function registerView(userId, movieId, source = 'search') {
  await q('UPDATE movies SET views = views + 1 WHERE id = $1', [movieId]);
  await q('INSERT INTO watch_log (user_id, movie_id, source) VALUES ($1,$2,$3)', [userId, movieId, source]);
}

export const logSearch = (userId, query, found) =>
  q('INSERT INTO searches (user_id, query, found) VALUES ($1,$2,$3)', [userId, String(query).slice(0, 200), found]);

export const movieStats = () =>
  one(`
    SELECT (SELECT count(*) FROM movies)::int AS total,
           (SELECT count(*) FROM movies WHERE is_active)::int AS active,
           (SELECT coalesce(sum(views),0) FROM movies)::int AS views,
           (SELECT count(*) FROM watch_log WHERE created_at >= date_trunc('day', now()))::int AS watched_today,
           (SELECT count(*) FROM searches WHERE created_at >= date_trunc('day', now()))::int AS searches_today,
           (SELECT count(*) FROM searches WHERE NOT found AND created_at >= now() - interval '7 days')::int AS notfound_week
  `);

export const topSearches = (limit = 15) =>
  all(
    `SELECT lower(query) AS query, count(*)::int AS c, bool_or(found) AS found
     FROM searches WHERE created_at >= now() - interval '30 days'
     GROUP BY lower(query) ORDER BY c DESC LIMIT $1`,
    [limit],
  );

export const notFoundSearches = (limit = 20) =>
  all(
    `SELECT lower(query) AS query, count(*)::int AS c, max(created_at) AS last_at
     FROM searches WHERE NOT found AND created_at >= now() - interval '60 days'
     GROUP BY lower(query) ORDER BY c DESC, last_at DESC LIMIT $1`,
    [limit],
  );

// ==================== 6) Trend (24 soat) ====================
export const trending = (hours = 24, limit = 10) =>
  all(
    `SELECT m.*, count(*)::int AS recent FROM watch_log w JOIN movies m ON m.id = w.movie_id
      WHERE w.created_at >= now() - ($1 || ' hours')::interval AND w.source <> 'backup' AND m.is_active
      GROUP BY m.id ORDER BY recent DESC, m.views DESC LIMIT $2`,
    [String(hours), limit],
  );

/** Haftalik TOP — oxirgi 7 kunda eng ko'p olingan */
export const weeklyTop = (limit = 5) => trending(24 * 7, limit);

// ==================== 12) Typo taklifi ====================
/** Xato yozilgan nomga eng yaqin kinolar */
export const suggestSimilar = (query, limit = 3) =>
  all(
    `SELECT ${COLS}, similarity(coalesce(title,''), $1) AS sim FROM movies
      WHERE is_active AND coalesce(title,'') <> '' AND similarity(coalesce(title,''), $1) > 0.18
      ORDER BY sim DESC LIMIT $2`,
    [String(query).trim(), limit],
  );

// ==================== 3) Sifat / til variantlari ====================
export const listVariants = (movieId) =>
  all('SELECT * FROM movie_files WHERE movie_id = $1 ORDER BY sort_order, id', [movieId]);

export const getVariant = (id) => one('SELECT * FROM movie_files WHERE id = $1', [id]);

export const addVariant = (movieId, label, fileId, fileType) =>
  one(
    `INSERT INTO movie_files (movie_id, label, file_id, file_type, sort_order)
     VALUES ($1,$2,$3,$4,(SELECT coalesce(max(sort_order),0)+1 FROM movie_files WHERE movie_id=$1))
     RETURNING *`,
    [movieId, String(label).slice(0, 24), fileId, fileType],
  );

export const deleteVariant = (id) => q('DELETE FROM movie_files WHERE id = $1', [id]);

// ==================== 4) Kun kinosi ====================
/** 60 kun ichida tanlanmagan tasodifiy kino */
export const pickDaily = () =>
  one(
    `SELECT ${COLS} FROM movies m WHERE is_active
       AND NOT EXISTS (SELECT 1 FROM daily_picks d WHERE d.movie_id = m.id AND d.posted_at > now() - interval '60 days')
     ORDER BY random() LIMIT 1`,
  );

export const markDaily = (movieId) =>
  q('INSERT INTO daily_picks (movie_id) VALUES ($1)', [movieId]);

// ==================== 1) Kod avtomatik generatsiyasi ====================
export async function nextFreeCode() {
  const r = await one(
    `SELECT coalesce(max(code::bigint), 0) + 1 AS next FROM movies WHERE code ~ '^[0-9]{1,9}$'`,
  );
  return String(r?.next ?? 1);
}

// ==================== 2) Baza auditi ====================
export async function audit() {
  const dupTitles = await all(
    `SELECT title, array_agg(code ORDER BY code) AS codes FROM movies
      WHERE title IS NOT NULL GROUP BY title HAVING count(*) > 1 ORDER BY count(*) DESC LIMIT 20`,
  );
  const dupFiles = await all(
    `SELECT array_agg(code ORDER BY code) AS codes FROM movies GROUP BY file_id HAVING count(*) > 1 LIMIT 20`,
  );
  const noTitle = await all(`SELECT code FROM movies WHERE title IS NULL OR btrim(title) = '' LIMIT 20`);
  const noCode = await all(`SELECT code FROM movies WHERE caption IS NULL OR caption NOT ILIKE '%kod%' LIMIT 20`);
  const noMeta = await all(`SELECT code FROM movies WHERE year IS NULL OR genres = '{}' LIMIT 20`);
  const inactive = await all(`SELECT code FROM movies WHERE NOT is_active LIMIT 20`);
  const zero = await all(
    `SELECT code FROM movies WHERE is_active AND views = 0 AND created_at < now() - interval '14 days' LIMIT 20`,
  );
  return { dupTitles, dupFiles, noTitle, noCode, noMeta, inactive, zero };
}
