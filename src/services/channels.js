import { all, one, q } from '../db.js';
import { TTLCache } from '../lib/cache.js';
import { getSetting } from './settings.js';

const subCache = new TTLCache(5 * 60 * 1000);   // user -> yetishmayotgan kanallar
let chCache = { data: null, at: 0 };

export async function requiredChannels() {
  if (chCache.data && Date.now() - chCache.at < 30_000) return chCache.data;
  const rows = await all('SELECT * FROM channels WHERE is_required ORDER BY sort_order, id');
  chCache = { data: rows, at: Date.now() };
  return rows;
}

export const allChannels = () => all('SELECT * FROM channels ORDER BY sort_order, id');

export function invalidateChannels() { chCache = { data: null, at: 0 }; subCache.clear(); }
export function invalidateSub(userId) { subCache.del(userId); }

export function channelLink(ch) {
  if (ch.invite_link) return ch.invite_link;
  const id = String(ch.chat_id);
  if (id.startsWith('@')) return `https://t.me/${id.slice(1)}`;
  return null;
}

const OK_STATUS = new Set(['member', 'administrator', 'creator', 'owner']);

/** Bitta kanal bo'yicha tekshirish. Sozlama xatosida `true` (fail-open) — bot o'lib qolmasligi uchun. */
async function isMember(api, chatId, userId) {
  try {
    const m = await api.getChatMember(chatId, userId);
    if (OK_STATUS.has(m.status)) return true;
    if (m.status === 'restricted') return m.is_member === true;
    return false;
  } catch (e) {
    const msg = String(e?.description || e?.message || '');
    if (/chat not found|bot is not a member|CHAT_ADMIN_REQUIRED|not enough rights|user not found/i.test(msg)) {
      console.warn(`[sub] ${chatId} tekshirilmadi (sozlama): ${msg}`);
      return true; // bloklab qo'ymaymiz
    }
    console.warn(`[sub] ${chatId} xato: ${msg}`);
    return true;
  }
}

/** @returns {Promise<object[]>} obuna bo'lmagan kanallar */
export async function getUnsubscribed(api, userId, { force = false } = {}) {
  if (!(await getSetting('force_sub', true))) return [];
  if (!force) {
    const hit = subCache.get(userId);
    if (hit !== undefined) return hit;
  }
  const channels = await requiredChannels();
  if (!channels.length) { subCache.set(userId, []); return []; }

  const results = await Promise.all(channels.map((ch) => isMember(api, ch.chat_id, userId)));
  const missing = channels.filter((_, i) => !results[i]);
  subCache.set(userId, missing, missing.length ? 60_000 : 5 * 60 * 1000);
  return missing;
}

/** Kanal qo'shish: @username, t.me havolasi yoki -100... ID */
export async function addChannel(api, input) {
  let raw = String(input).trim();
  let chatId;
  let inviteLink = null;

  const m = raw.match(/t\.me\/(?:\+|joinchat\/)?([\w+-]+)/i);
  if (/^https?:\/\/t\.me\/(\+|joinchat\/)/i.test(raw)) {
    throw new Error('Taklif havolasi bo\'yicha kanalni aniqlab bo\'lmaydi. Kanal ID sini (-100...) yuboring, keyin havolani qo\'shasiz.');
  }
  if (m) raw = '@' + m[1];

  if (/^-?\d{6,}$/.test(raw)) chatId = raw;
  else chatId = '@' + raw.replace(/^@/, '');

  const chat = await api.getChat(chatId);
  const title = chat.title || chat.username || String(chatId);

  if (!chat.username) {
    try { inviteLink = await api.exportChatInviteLink(chat.id); } catch { /* admin emas */ }
  }

  const row = await one(
    `INSERT INTO channels (chat_id, title, invite_link)
     VALUES ($1,$2,$3)
     ON CONFLICT (chat_id) DO UPDATE SET title = EXCLUDED.title,
            invite_link = COALESCE(EXCLUDED.invite_link, channels.invite_link)
     RETURNING *`,
    [chat.username ? '@' + chat.username : String(chat.id), title, inviteLink],
  );
  invalidateChannels();
  return row;
}

export async function setInviteLink(id, link) {
  const row = await one('UPDATE channels SET invite_link = $2 WHERE id = $1 RETURNING *', [id, link]);
  invalidateChannels();
  return row;
}

export async function toggleRequired(id) {
  const row = await one('UPDATE channels SET is_required = NOT is_required WHERE id = $1 RETURNING *', [id]);
  invalidateChannels();
  return row;
}

export async function deleteChannel(id) {
  await q('DELETE FROM channels WHERE id = $1', [id]);
  invalidateChannels();
}

export const getChannel = (id) => one('SELECT * FROM channels WHERE id = $1', [id]);
