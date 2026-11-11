import * as Channels from '../services/channels.js';
import { getSetting } from '../services/settings.js';
import { one } from '../db.js';
import { subscribeKeyboard, movieKeyboard, botLink } from '../lib/keyboards.js';
import { sendMovie } from '../lib/send.js';
import { esc } from '../lib/utils.js';
import { notifyAdmins } from '../lib/notify.js';

/**
 * Majburiy obunani tekshiradi. Obuna bo'lmasa o'zi xabar yuboradi.
 * @returns {Promise<boolean>} true = ruxsat
 */
export async function requireSub(ctx, payload = '') {
  const userId = ctx.from.id;
  if (ctx.isAdmin) return true;

  const bypass = Number(await getSetting('ref_bypass', 0)) || 0;
  if (bypass > 0 && (ctx.user?.ref_count ?? 0) >= bypass) return true;

  const missing = await Channels.getUnsubscribed(ctx.api, userId);
  if (!missing.length) return true;

  let text = '🔒 <b>Kinolarni olish uchun quyidagi kanallarga obuna bo\'ling:</b>\n\n';
  const noLink = missing.filter((c) => !Channels.channelLink(c));
  for (const ch of missing) text += `• ${esc(ch.title || ch.chat_id)}\n`;
  text += '\n👇 Obuna bo\'lib, <b>✅ Tekshirish</b> tugmasini bosing.';
  if (bypass > 0) text += `\n\n💡 Yoki ${bypass} ta do'stingizni taklif qilsangiz, obunasiz foydalanasiz:\n<code>${botLink('ref_' + userId)}</code>`;
  if (noLink.length) {
    text += '\n\n⚠️ <i>Ba\'zi kanallarga havola topilmadi — admin sozlashi kerak.</i>';
    notifyAdmins(ctx.api, `⚠️ Kanal(lar)da taklif havolasi yo'q: ${noLink.map((c) => esc(c.title || c.chat_id)).join(', ')}\nAdmin panel → 📢 Kanallar bo'limida havolani qo'shing.`).catch(() => {});
  }

  await ctx.reply(text, { reply_markup: subscribeKeyboard(missing, payload), parse_mode: 'HTML' });
  return false;
}

/** Foydalanuvchining bugungi olingan kinolari soni */
export async function todayCount(userId) {
  const r = await one(
    `SELECT count(*)::int AS c FROM watch_log
      WHERE user_id = $1 AND source <> 'backup'
        AND created_at >= date_trunc('day', now() AT TIME ZONE 'Asia/Tashkent') AT TIME ZONE 'Asia/Tashkent'`,
    [userId],
  );
  return Number(r?.c || 0);
}

/** Kunlik limit tekshiruvi. @returns {Promise<boolean>} true = ruxsat */
export async function checkDailyLimit(ctx) {
  if (ctx.isAdmin) return true;
  const limit = Number(await getSetting('daily_limit', 0)) || 0;
  if (limit <= 0) return true;
  const Users = await import('../services/users.js');
  const bonus = await Users.giftBonusToday(ctx.from.id).catch(() => 0);
  const used = await todayCount(ctx.from.id);
  if (used < limit + bonus) return true;
  await ctx.reply(
    `🚦 <b>Bugungi limit tugadi.</b>\n\nKunda <b>${limit + bonus}</b> ta kino olish mumkin ` +
    `(bugun ${used} ta oldingiz).\n\nErtaga yana davom etasiz 🍿` +
    `\n\n💡 Do'stingizga kino sovg'a qilsangiz (🎁 tugmasi) limitingiz kengayadi.` +
    `\n💡 Do'st taklif qilish: /ref`,
    { parse_mode: 'HTML' },
  );
  return false;
}

/** Kinoni yuborish + xatolarni adminlarga bildirish */
export async function deliver(ctx, movie, source = 'search') {
  if (!(await checkDailyLimit(ctx))) return false;
  try {
    await sendMovie(ctx.api, ctx.chat.id, movie, { userId: ctx.from.id, source });
    return true;
  } catch (e) {
    if (e.message === 'BAD_FILE_ID') {
      await notifyAdmins(
        ctx.api,
        `🚫 <b>Fayl ishlamadi</b>\nKod: <code>${esc(movie.code)}</code>\nNomi: ${esc(movie.title || '-')}\nSabab: ${esc(e.cause)}\n\nFaylni qayta yuklang: Admin → 🎬 Kinolar → kodni tanlang → 🔄 Faylni almashtirish`,
      );
      return false;
    }
    throw e;
  }
}

export { movieKeyboard };
