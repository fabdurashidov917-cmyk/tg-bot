import { one, q } from '../db.js';

/** Admin wizardlari uchun holat (PHP dagi temp_data_*.json o'rniga) */
export async function getState(userId) {
  const row = await one('SELECT state FROM states WHERE user_id = $1', [userId]);
  return row?.state ?? null;
}

export async function setState(userId, state) {
  await q(
    `INSERT INTO states (user_id, state, updated_at) VALUES ($1, $2::jsonb, now())
     ON CONFLICT (user_id) DO UPDATE SET state = EXCLUDED.state, updated_at = now()`,
    [userId, JSON.stringify(state)],
  );
}

export async function clearState(userId) {
  await q('DELETE FROM states WHERE user_id = $1', [userId]);
}

/** 6 soatdan oshgan yarim qolgan holatlarni tozalash */
export async function purgeStaleStates() {
  const r = await q("DELETE FROM states WHERE updated_at < now() - interval '6 hours'");
  return r.rowCount;
}
