import { all, one, q } from '../db.js';

export const addReminder = (userId, movieId, remindAt) =>
  one(
    `INSERT INTO reminders (user_id, movie_id, remind_at) VALUES ($1,$2,$3) RETURNING *`,
    [userId, movieId, remindAt],
  );

/** Vaqti kelgan eslatmalar */
export const dueReminders = (limit = 50) =>
  all(
    `SELECT r.*, m.code, m.title FROM reminders r JOIN movies m ON m.id = r.movie_id
      WHERE NOT r.sent AND r.remind_at <= now() ORDER BY r.remind_at LIMIT $1`,
    [limit],
  );

export const markSent = (id) => q('UPDATE reminders SET sent = true WHERE id = $1', [id]);

export const myReminders = (userId) =>
  all(
    `SELECT r.*, m.code, m.title FROM reminders r JOIN movies m ON m.id = r.movie_id
      WHERE r.user_id = $1 AND NOT r.sent ORDER BY r.remind_at LIMIT 20`,
    [userId],
  );

export const cancelReminder = (id, userId) =>
  q('DELETE FROM reminders WHERE id = $1 AND user_id = $2', [id, userId]);
