import { all, one, q } from '../db.js';

export async function upsertUser(from, refBy = null) {
  const row = await one(
    `INSERT INTO users (user_id, username, first_name, last_name, ref_by)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (user_id) DO UPDATE
       SET username = EXCLUDED.username,
           first_name = EXCLUDED.first_name,
           last_name = EXCLUDED.last_name,
           is_stopped = false,
           last_seen_at = now()
     RETURNING *, (created_at > now() - interval '5 seconds') AS is_new`,
    [from.id, from.username || null, from.first_name || null, from.last_name || null, refBy],
  );
  if (row?.is_new && refBy && refBy !== from.id) {
    await q('UPDATE users SET ref_count = ref_count + 1 WHERE user_id = $1', [refBy]);
  }
  return row;
}

export const getUser = (id) => one('SELECT * FROM users WHERE user_id = $1', [id]);

export const markStopped = (id) =>
  q('UPDATE users SET is_stopped = true WHERE user_id = $1', [id]);

export const setBlocked = (id, v) =>
  q('UPDATE users SET is_blocked = $2 WHERE user_id = $1', [id, v]);

export const setLang = (id, lang) =>
  q('UPDATE users SET lang = $2 WHERE user_id = $1', [id, lang]);

export const toggleNotify = (id) =>
  one('UPDATE users SET notify = NOT notify WHERE user_id = $1 RETURNING notify', [id]);

export const bumpSearch = (id) =>
  q('UPDATE users SET search_count = search_count + 1, last_seen_at = now() WHERE user_id = $1', [id]);

export const bumpWatch = (id) =>
  q('UPDATE users SET watch_count = watch_count + 1 WHERE user_id = $1', [id]);

/** Broadcast uchun: faol foydalanuvchilar ID lari */
export async function activeUserIds({ onlyNotify = false } = {}) {
  const rows = await all(
    `SELECT user_id FROM users
     WHERE NOT is_stopped AND NOT is_blocked ${onlyNotify ? 'AND notify' : ''}
     ORDER BY user_id`,
  );
  return rows.map((r) => r.user_id);
}

export async function userStats() {
  return one(`
    SELECT
      (SELECT count(*) FROM users)::int AS total,
      (SELECT count(*) FROM users WHERE NOT is_stopped AND NOT is_blocked)::int AS active,
      (SELECT count(*) FROM users WHERE is_stopped)::int AS stopped,
      (SELECT count(*) FROM users WHERE is_blocked)::int AS blocked,
      (SELECT count(*) FROM users WHERE created_at >= date_trunc('day', now()))::int AS today,
      (SELECT count(*) FROM users WHERE created_at >= now() - interval '7 days')::int AS week,
      (SELECT count(*) FROM users WHERE last_seen_at >= now() - interval '1 day')::int AS dau
  `);
}

export const addFavorite = (userId, movieId) =>
  q('INSERT INTO favorites (user_id, movie_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [userId, movieId]);

export const removeFavorite = (userId, movieId) =>
  q('DELETE FROM favorites WHERE user_id = $1 AND movie_id = $2', [userId, movieId]);

export const isFavorite = async (userId, movieId) =>
  !!(await one('SELECT 1 FROM favorites WHERE user_id = $1 AND movie_id = $2', [userId, movieId]));

export const listFavorites = (userId, limit = 20, offset = 0) =>
  all(
    `SELECT m.* FROM favorites f JOIN movies m ON m.id = f.movie_id
     WHERE f.user_id = $1 AND m.is_active ORDER BY f.created_at DESC LIMIT $2 OFFSET $3`,
    [userId, limit, offset],
  );

export const countFavorites = async (userId) =>
  Number((await one('SELECT count(*)::int AS c FROM favorites WHERE user_id = $1', [userId])).c);

export const listHistory = (userId, limit = 15) =>
  all(
    `SELECT DISTINCT ON (m.id) m.*, w.created_at AS watched_at
     FROM watch_log w JOIN movies m ON m.id = w.movie_id
     WHERE w.user_id = $1 ORDER BY m.id, w.created_at DESC LIMIT $2`,
    [userId, limit],
  );

/** Foydalanuvchining shaxsiy statistikasi ("Mening kino yilim") */
export async function personalStats(userId) {
  return one(
    `WITH w AS (
        SELECT m.id, m.title, m.genres, w.created_at
          FROM watch_log w JOIN movies m ON m.id = w.movie_id
         WHERE w.user_id = $1 AND w.source <> 'backup'
     )
     SELECT
       (SELECT count(DISTINCT id)::int FROM w) AS movies,
       (SELECT count(*)::int FROM w) AS total_views,
       (SELECT count(DISTINCT id)::int FROM w WHERE created_at >= date_trunc('month', now())) AS this_month,
       (SELECT count(DISTINCT id)::int FROM w WHERE created_at >= date_trunc('year', now())) AS this_year,
       (SELECT g FROM w, unnest(w.genres) g GROUP BY g ORDER BY count(*) DESC LIMIT 1) AS top_genre,
       (SELECT min(created_at) FROM w) AS first_watch,
       (SELECT count(*)::int FROM favorites WHERE user_id = $1) AS favorites,
       (SELECT ref_count FROM users WHERE user_id = $1) AS refs,
       (SELECT count(*)::int + 1 FROM users u
          WHERE u.watch_count > (SELECT watch_count FROM users WHERE user_id = $1)) AS rank,
       (SELECT count(*)::int FROM users WHERE watch_count > 0) AS total_watchers
     `,
    [userId],
  );
}

/** Janrlar bo'yicha tasodifiy tanlov (kayfiyat tavsiyasi) */
export const moodPick = (genres, limit = 5) =>
  all(
    `SELECT id, code, title, year, quality, genres, views FROM movies
      WHERE is_active AND genres && $1::text[]
      ORDER BY random() LIMIT $2`,
    [genres, limit],
  );

// ==================== 10) Janr bo'yicha bildirishnoma ====================
export const setNotifyGenres = (userId, genres) =>
  one('UPDATE users SET notify_genres = $2, notify = true WHERE user_id = $1 RETURNING notify_genres', [userId, genres]);

/** Yangi kino xabari kimlarga ketadi: janr tanlamaganlar hammasini oladi */
export async function notifyTargets(genres) {
  const rows = await all(
    `SELECT user_id FROM users
      WHERE notify AND NOT is_stopped AND NOT is_blocked
        AND (notify_genres = '{}' OR notify_genres && $1::text[])
      ORDER BY user_id`,
    [genres?.length ? genres : ['__none__']],
  );
  return rows.map((r) => r.user_id);
}

// ==================== 8) Sovg'alar ====================
export const createGift = (fromUser, movieId) =>
  one('INSERT INTO gifts (from_user, movie_id) VALUES ($1,$2) RETURNING *', [fromUser, movieId]);

export const claimGift = (id, toUser) =>
  one(
    `UPDATE gifts SET to_user = $2, claimed_at = now()
      WHERE id = $1 AND claimed_at IS NULL AND from_user <> $2 RETURNING *`,
    [id, toUser],
  );

/** Bugun qabul qilingan sovg'alar soni — kunlik limitga bonus */
export const giftBonusToday = async (userId) => {
  const r = await one(
    `SELECT count(*)::int AS c FROM gifts
      WHERE from_user = $1 AND claimed_at >= date_trunc('day', now() AT TIME ZONE 'Asia/Tashkent') AT TIME ZONE 'Asia/Tashkent'`,
    [userId],
  );
  return Math.min(Number(r?.c || 0), 5);
};

// ==================== 9) Referal liga ====================
export const weeklyReferrers = (limit = 10) =>
  all(
    `SELECT u.ref_by AS user_id, r.username, r.first_name, count(*)::int AS invited
       FROM users u LEFT JOIN users r ON r.user_id = u.ref_by
      WHERE u.ref_by IS NOT NULL AND u.created_at >= now() - interval '7 days'
      GROUP BY u.ref_by, r.username, r.first_name ORDER BY invited DESC LIMIT $1`,
    [limit],
  );

export const allTimeReferrers = (limit = 10) =>
  all(
    `SELECT user_id, username, first_name, ref_count AS invited FROM users
      WHERE ref_count > 0 ORDER BY ref_count DESC LIMIT $1`,
    [limit],
  );
