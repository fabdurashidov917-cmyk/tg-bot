import { all, one, q } from '../db.js';
import { config } from '../config.js';

let cache = { set: null, at: 0 };

async function loadAdmins() {
  if (cache.set && Date.now() - cache.at < 30_000) return cache.set;
  const rows = await all('SELECT user_id FROM admins');
  const set = new Set([...config.adminIds, ...rows.map((r) => Number(r.user_id))]);
  cache = { set, at: Date.now() };
  return set;
}

export async function isAdmin(userId) {
  if (!userId) return false;
  if (config.adminIds.includes(Number(userId))) return true;
  return (await loadAdmins()).has(Number(userId));
}

export const isOwner = (userId) => config.adminIds.includes(Number(userId));

export async function adminList() {
  const rows = await all(
    `SELECT a.user_id, a.role, u.username, u.first_name
       FROM admins a LEFT JOIN users u ON u.user_id = a.user_id ORDER BY a.added_at`,
  );
  return [
    ...config.adminIds.map((id) => ({ user_id: id, role: 'owner', username: null, first_name: null, env: true })),
    ...rows.filter((r) => !config.adminIds.includes(Number(r.user_id))),
  ];
}

export async function addAdmin(userId, addedBy) {
  await q(
    `INSERT INTO admins (user_id, role, added_by) VALUES ($1,'admin',$2)
     ON CONFLICT (user_id) DO NOTHING`,
    [userId, addedBy],
  );
  cache = { set: null, at: 0 };
}

export async function removeAdmin(userId) {
  await q('DELETE FROM admins WHERE user_id = $1', [userId]);
  cache = { set: null, at: 0 };
}

export const allAdminIds = async () => [...(await loadAdmins())];
