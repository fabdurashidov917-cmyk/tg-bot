import { all, one, q } from '../db.js';
import { likeEscape, parseCaption } from '../lib/utils.js';

const COLS = 'id, code, title, caption, year, country, lang, quality, genres, status, is_active, views, created_at, poster_file_id';

// ---------------- Serial ----------------
export const getById = (id) => one(`SELECT ${COLS} FROM series WHERE id = $1`, [id]);
export const getByCode = (code) => one(`SELECT ${COLS} FROM series WHERE code = $1 AND is_active`, [String(code).trim()]);
export const getByCodeAny = (code) => one(`SELECT ${COLS} FROM series WHERE code = $1`, [String(code).trim()]);

/** Nom yoki kod bo'yicha qidirish */
export async function search(query, limit = 10) {
  const raw = String(query || '').trim();
  if (!raw) return [];
  const like = `%${likeEscape(raw)}%`;
  return all(
    `SELECT ${COLS}, GREATEST(similarity(title, $1), 0) AS sim,
            (SELECT count(*)::int FROM episodes e WHERE e.series_id = s.id) AS ep_count
       FROM series s
      WHERE is_active AND (code = $1 OR title ILIKE $2 ESCAPE '\\' OR caption ILIKE $2 ESCAPE '\\' OR title % $1)
      ORDER BY (code = $1) DESC, sim DESC, created_at DESC LIMIT $3`,
    [raw, like, limit],
  );
}

export const listPage = (limit = 10, offset = 0, { onlyActive = true } = {}) =>
  all(
    `SELECT ${COLS}, (SELECT count(*)::int FROM episodes e WHERE e.series_id = s.id) AS ep_count
       FROM series s ${onlyActive ? 'WHERE is_active' : ''}
      ORDER BY created_at DESC, id DESC LIMIT $1 OFFSET $2`,
    [limit, offset],
  );

export const countAll = async ({ onlyActive = true } = {}) =>
  Number((await one(`SELECT count(*)::int AS c FROM series ${onlyActive ? 'WHERE is_active' : ''}`)).c);

export async function nextFreeCode() {
  const r = await one(
    `SELECT coalesce(max(substring(code from 2)::bigint), 0) + 1 AS n FROM series WHERE code ~ '^s[0-9]+$'`,
  );
  return `s${r?.n ?? 1}`;
}

export async function createSeries({ code, title, caption, addedBy }) {
  const meta = parseCaption(caption || '');
  return one(
    `INSERT INTO series (code, title, caption, year, country, lang, quality, genres, added_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING ${COLS}`,
    [String(code).trim(), title, caption || null, meta.year, meta.country, meta.lang, meta.quality, meta.genres, addedBy],
  );
}

export async function updateCaption(id, caption) {
  const meta = parseCaption(caption || '');
  return one(
    `UPDATE series SET caption=$2, year=$3, country=$4, lang=$5, quality=$6, genres=$7, updated_at=now()
      WHERE id=$1 RETURNING ${COLS}`,
    [id, caption, meta.year, meta.country, meta.lang, meta.quality, meta.genres],
  );
}

export const updateTitle = (id, title) =>
  one(`UPDATE series SET title=$2, updated_at=now() WHERE id=$1 RETURNING ${COLS}`, [id, title]);

export const updateCode = (id, code) =>
  one(`UPDATE series SET code=$2, updated_at=now() WHERE id=$1 RETURNING ${COLS}`, [id, String(code).trim()]);

export const toggleActive = (id) =>
  one(`UPDATE series SET is_active = NOT is_active, updated_at=now() WHERE id=$1 RETURNING ${COLS}`, [id]);

export const toggleStatus = (id) =>
  one(
    `UPDATE series SET status = CASE WHEN status='ongoing' THEN 'completed' ELSE 'ongoing' END,
            updated_at=now() WHERE id=$1 RETURNING ${COLS}`,
    [id],
  );

export const deleteSeries = (id) => q('DELETE FROM series WHERE id = $1', [id]);

export const setPoster = (id, fileId) =>
  one(`UPDATE series SET poster_file_id = $2, updated_at = now() WHERE id = $1 RETURNING ${COLS}`, [id, fileId]);

export const clearPoster = (id) =>
  one(`UPDATE series SET poster_file_id = NULL, updated_at = now() WHERE id = $1 RETURNING ${COLS}`, [id]);

// ---------------- Qismlar ----------------
export const listEpisodes = (seriesId) =>
  all('SELECT * FROM episodes WHERE series_id = $1 ORDER BY season, episode', [seriesId]);

export const getEpisode = (id) => one('SELECT * FROM episodes WHERE id = $1', [id]);

export const getEpisodeAt = (seriesId, season, episode) =>
  one('SELECT * FROM episodes WHERE series_id=$1 AND season=$2 AND episode=$3', [seriesId, season, episode]);

export const neighbourEpisode = (seriesId, season, episode, dir = 1) =>
  one(
    dir > 0
      ? `SELECT * FROM episodes WHERE series_id=$1 AND (season, episode) > ($2, $3) ORDER BY season, episode LIMIT 1`
      : `SELECT * FROM episodes WHERE series_id=$1 AND (season, episode) < ($2, $3) ORDER BY season DESC, episode DESC LIMIT 1`,
    [seriesId, season, episode],
  );

export const countEpisodes = async (seriesId) =>
  Number((await one('SELECT count(*)::int AS c FROM episodes WHERE series_id = $1', [seriesId])).c);

export const seasonList = (seriesId) =>
  all('SELECT season, count(*)::int AS c FROM episodes WHERE series_id=$1 GROUP BY season ORDER BY season', [seriesId]);

export async function nextEpisodeNo(seriesId, season = 1) {
  const r = await one(
    'SELECT coalesce(max(episode), 0) + 1 AS n FROM episodes WHERE series_id=$1 AND season=$2',
    [seriesId, season],
  );
  return Number(r?.n ?? 1);
}

export const addEpisode = ({ seriesId, season = 1, episode, title, fileId, fileType, caption }) =>
  one(
    `INSERT INTO episodes (series_id, season, episode, title, file_id, file_type, caption)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     ON CONFLICT (series_id, season, episode)
       DO UPDATE SET file_id = EXCLUDED.file_id, file_type = EXCLUDED.file_type,
                     caption = EXCLUDED.caption, title = EXCLUDED.title
     RETURNING *`,
    [seriesId, season, episode, title || null, fileId, fileType, caption || null],
  );

export const deleteEpisode = (id) => q('DELETE FROM episodes WHERE id = $1', [id]);

export async function registerEpisodeView(userId, ep) {
  await q('UPDATE episodes SET views = views + 1 WHERE id = $1', [ep.id]);
  await q('UPDATE series SET views = views + 1 WHERE id = $1', [ep.series_id]);
  await q(
    `INSERT INTO watch_log (user_id, movie_id, episode_id, source) VALUES ($1, NULL, $2, 'series')`,
    [userId, ep.id],
  );
  await q(
    `INSERT INTO watch_progress (user_id, series_id, season, episode)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (user_id, series_id) DO UPDATE
       SET season = EXCLUDED.season, episode = EXCLUDED.episode, updated_at = now()`,
    [userId, ep.series_id, ep.season, ep.episode],
  );
}

// ---------------- Davom ettirish ----------------
export const getProgress = (userId, seriesId) =>
  one('SELECT * FROM watch_progress WHERE user_id=$1 AND series_id=$2', [userId, seriesId]);

export const continueList = (userId, limit = 10) =>
  all(
    `SELECT p.*, s.code, s.title, s.status,
            (SELECT count(*)::int FROM episodes e WHERE e.series_id = s.id) AS ep_count
       FROM watch_progress p JOIN series s ON s.id = p.series_id
      WHERE p.user_id = $1 AND s.is_active
      ORDER BY p.updated_at DESC LIMIT $2`,
    [userId, limit],
  );

// ---------------- Sevimlilar ----------------
export const isFavorite = async (userId, seriesId) =>
  !!(await one('SELECT 1 FROM series_favorites WHERE user_id=$1 AND series_id=$2', [userId, seriesId]));

export const addFavorite = (userId, seriesId) =>
  q('INSERT INTO series_favorites (user_id, series_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [userId, seriesId]);

export const removeFavorite = (userId, seriesId) =>
  q('DELETE FROM series_favorites WHERE user_id=$1 AND series_id=$2', [userId, seriesId]);

export const listFavorites = (userId, limit = 20) =>
  all(
    `SELECT s.*, (SELECT count(*)::int FROM episodes e WHERE e.series_id=s.id) AS ep_count
       FROM series_favorites f JOIN series s ON s.id = f.series_id
      WHERE f.user_id = $1 AND s.is_active ORDER BY f.created_at DESC LIMIT $2`,
    [userId, limit],
  );

/** Caption dan qism raqamini topish: "12-qism", "S01E12", "12 seriya" */
export function parseEpisodeNo(text) {
  const s = String(text || '');
  let m = s.match(/\bS(\d{1,2})\s*[\s·\-]?\s*E(\d{1,3})\b/i);
  if (m) return { season: Number(m[1]), episode: Number(m[2]) };
  m = s.match(/(\d{1,3})\s*[-–]?\s*(?:qism|seriya|epizod)/i);
  if (m) return { season: null, episode: Number(m[1]) };
  m = s.match(/(?:qism|seriya|epizod)\s*[:\-]?\s*(\d{1,3})/i);
  if (m) return { season: null, episode: Number(m[1]) };
  return { season: null, episode: null };
}

export const stats = () =>
  one(`SELECT (SELECT count(*)::int FROM series) AS total,
              (SELECT count(*)::int FROM series WHERE is_active) AS active,
              (SELECT count(*)::int FROM episodes) AS episodes,
              (SELECT coalesce(sum(views),0)::int FROM series) AS views`);
