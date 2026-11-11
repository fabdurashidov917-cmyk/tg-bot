import { GrammyError } from 'grammy';
import { esc } from './utils.js';
import { movieKeyboard } from './keyboards.js';
import { getSetting } from '../services/settings.js';
import * as Movies from '../services/movies.js';
import * as Users from '../services/users.js';

const SENDERS = {
  video: 'sendVideo',
  document: 'sendDocument',
  photo: 'sendPhoto',
  audio: 'sendAudio',
  animation: 'sendAnimation',
};

/** 403 (bot bloklangan) bo'lsa foydalanuvchini belgilaydi. */
export async function safeCall(fn, userId) {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof GrammyError && (e.error_code === 403 || /bot was blocked|user is deactivated/i.test(e.description))) {
      if (userId) await Users.markStopped(userId).catch(() => {});
      return null;
    }
    throw e;
  }
}

/**
 * Kinoni foydalanuvchiga yuborish. Barcha fayl turlarini qo'llaydi.
 */
export async function sendMovie(api, chatId, movie, { userId = chatId, source = 'search', buttons = true } = {}) {
  const method = SENDERS[movie.file_type] || 'sendDocument';
  const protect = !!(await getSetting('protect_content', false));
  const autoDel = Number(await getSetting('auto_delete_min', 0)) || 0;

  // DIQQAT: kanal chatida switch_inline_query tugmasiga Telegram ruxsat bermaydi,
  // shuning uchun arxiv/kanal nusxalari tugmasiz yuboriladi.
  const isArchive = !buttons || source === 'backup';
  const isFav = isArchive ? false : await Users.isFavorite(userId, movie.id).catch(() => false);
  const variants = isArchive ? [] : await Movies.listVariants(movie.id).catch(() => []);
  let caption = esc(movie.caption || `🎬 ${movie.title || ''}`).trim();
  caption += `\n\n🔢 Kod: <code>${esc(movie.code)}</code>`;
  if (autoDel > 0) caption += `\n⏳ <i>Bu fayl ${autoDel} daqiqadan so'ng o'chiriladi — saqlab oling.</i>`;
  if (caption.length > 1024) caption = caption.slice(0, 1015) + '…';

  let msg;
  try {
    msg = await api[method](chatId, movie.file_id, {
      caption,
      parse_mode: 'HTML',
      protect_content: protect,
      reply_markup: isArchive ? undefined : movieKeyboard(movie, isFav, { variants }),
    });
  } catch (e) {
    const d = String(e?.description || e.message);
    if (/wrong (file|remote file) identifier|failed to get http url content|file reference/i.test(d)) {
      console.error(`[send] ${movie.code} file_id ishlamadi: ${d}`);
      await api.sendMessage(chatId, '⚠️ Bu kino fayli eskirgan. Admin xabardor qilindi, tez orada tuzatiladi.');
      throw Object.assign(new Error('BAD_FILE_ID'), { movie, cause: d });
    }
    throw e;
  }

  if (source !== 'backup') {
    await Movies.registerView(userId, movie.id, source).catch(() => {});
    await Users.bumpWatch(userId).catch(() => {});
  }

  if (autoDel > 0 && msg && !isArchive) {
    setTimeout(() => {
      api.deleteMessage(chatId, msg.message_id).catch(() => {});
    }, autoDel * 60_000).unref?.();
  }
  return msg;
}

/** Sifat/til variantini yuborish */
export async function sendVariant(api, chatId, movie, variant, { userId = chatId } = {}) {
  const method = SENDERS[variant.file_type] || 'sendDocument';
  const protect = !!(await getSetting('protect_content', false));
  const caption =
    `🎬 <b>${esc(movie.title || movie.code)}</b>\n🎚 Variant: <b>${esc(variant.label)}</b>\n` +
    `🔢 Kod: <code>${esc(movie.code)}</code>`;
  const msg = await api[method](chatId, variant.file_id, {
    caption, parse_mode: 'HTML', protect_content: protect,
  });
  await Movies.registerView(userId, movie.id, 'variant').catch(() => {});
  return msg;
}

/** Serial qismini yuborish */
export async function sendEpisode(api, chatId, series, ep, keyboard, { userId = chatId } = {}) {
  const method = SENDERS[ep.file_type] || 'sendDocument';
  const protect = !!(await getSetting('protect_content', false));
  const autoDel = Number(await getSetting('auto_delete_min', 0)) || 0;

  let caption =
    `📺 <b>${esc(series.title)}</b>\n` +
    `🎬 ${ep.season > 1 ? `${ep.season}-fasl, ` : ''}<b>${ep.episode}-qism</b>` +
    (ep.title ? ` — ${esc(ep.title)}` : '') + '\n' +
    `🔢 Kod: <code>${esc(series.code)}</code>`;
  if (ep.caption) caption += `\n\n${esc(ep.caption).slice(0, 600)}`;
  if (autoDel > 0) caption += `\n\n⏳ <i>Bu fayl ${autoDel} daqiqadan so'ng o'chiriladi.</i>`;
  if (caption.length > 1024) caption = caption.slice(0, 1015) + '…';

  const msg = await api[method](chatId, ep.file_id, {
    caption, parse_mode: 'HTML', protect_content: protect, reply_markup: keyboard,
  });

  if (autoDel > 0 && msg) {
    setTimeout(() => { api.deleteMessage(chatId, msg.message_id).catch(() => {}); }, autoDel * 60_000).unref?.();
  }
  return msg;
}
