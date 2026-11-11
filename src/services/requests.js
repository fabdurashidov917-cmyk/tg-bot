import { all, one, q } from '../db.js';

export async function addRequest(userId, text) {
  const clean = String(text).slice(0, 300);
  const norm = clean.trim().toLowerCase();
  // Shu nom allaqachon so'ralganmi? Unda yangi yozuv emas, ovoz qo'shamiz.
  const dup = await one(
    `SELECT * FROM requests WHERE title_norm = $1 AND status = 'new' ORDER BY id LIMIT 1`,
    [norm],
  );
  if (dup) {
    await voteRequest(dup.id, userId);
    return { ...dup, merged: true };
  }
  const r = await one(
    'INSERT INTO requests (user_id, text, title_norm) VALUES ($1,$2,$3) RETURNING *',
    [userId, clean, norm],
  );
  await voteRequest(r.id, userId);
  return r;
}

export const voteRequest = (id, userId) =>
  q('INSERT INTO request_votes (request_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [id, userId]);

export const hasVoted = async (id, userId) =>
  !!(await one('SELECT 1 FROM request_votes WHERE request_id = $1 AND user_id = $2', [id, userId]));

/** Eng ko'p so'ralgan kinolar (ovozlar bo'yicha) */
export const topRequests = (limit = 10, offset = 0) =>
  all(
    `SELECT r.*, (SELECT count(*)::int FROM request_votes v WHERE v.request_id = r.id) AS votes
       FROM requests r WHERE r.status = 'new'
      ORDER BY votes DESC, r.created_at DESC LIMIT $1 OFFSET $2`,
    [limit, offset],
  );

export const listRequests = (status = 'new', limit = 10, offset = 0) =>
  all(
    `SELECT r.*, u.username, u.first_name,
            (SELECT count(*)::int FROM request_votes v WHERE v.request_id = r.id) AS votes
       FROM requests r
     LEFT JOIN users u ON u.user_id = r.user_id
     WHERE ($1 = 'all' OR r.status = $1) ORDER BY votes DESC, r.created_at DESC LIMIT $2 OFFSET $3`,
    [status, limit, offset],
  );

export const countRequests = async (status = 'new') =>
  Number((await one(`SELECT count(*)::int AS c FROM requests WHERE ($1='all' OR status=$1)`, [status])).c);

export const setRequestStatus = (id, status) =>
  one('UPDATE requests SET status=$2, answered_at=now() WHERE id=$1 RETURNING *', [id, status]);

export const getRequest = (id) => one('SELECT * FROM requests WHERE id=$1', [id]);

/** Yangi kino qo'shilganda shu nomni so'ragan odamlarni topish */
export const findRequesters = (title) =>
  all(
    `SELECT DISTINCT user_id, id FROM requests
     WHERE status = 'new' AND lower(text) % lower($1) ORDER BY id DESC LIMIT 50`,
    [title],
  );
