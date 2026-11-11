import { all, q } from '../db.js';

let cache = null;
let loadedAt = 0;
const TTL = 15_000;

export async function getSettings() {
  if (cache && Date.now() - loadedAt < TTL) return cache;
  const rows = await all('SELECT key, value FROM settings');
  cache = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  loadedAt = Date.now();
  return cache;
}

export async function getSetting(key, fallback = null) {
  const s = await getSettings();
  return s[key] ?? fallback;
}

export async function setSetting(key, value) {
  await q(
    `INSERT INTO settings (key, value, updated_at) VALUES ($1, $2::jsonb, now())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    [key, JSON.stringify(value)],
  );
  cache = null;
}

export async function toggleSetting(key) {
  const cur = await getSetting(key, false);
  await setSetting(key, !cur);
  return !cur;
}
