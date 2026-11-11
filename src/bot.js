import { Bot, GrammyError, HttpError } from 'grammy';
import { config } from './config.js';
import { RateLimiter } from './lib/cache.js';
import { apiRetry, redactToken } from './lib/apiRetry.js';
import { isAdmin } from './lib/auth.js';
import { getSetting } from './services/settings.js';
import * as Users from './services/users.js';
import * as Movies from './services/movies.js';
import { parseCaption, esc } from './lib/utils.js';
import * as Channels from './services/channels.js';
import { notifyAdmins } from './lib/notify.js';
import { mainMenu, botLink } from './lib/keyboards.js';
import { startHandler } from './handlers/start.js';
import { stateRouter } from './handlers/stateRouter.js';
import { menuHandler } from './handlers/menu.js';
import { extrasHandler } from './handlers/extras.js';
import { searchHandler } from './handlers/search.js';
import { inlineHandler } from './handlers/inline.js';
import { adminHandler } from './handlers/admin.js';
import { adminMoviesHandler } from './handlers/adminMovies.js';
import { adminChannelsHandler } from './handlers/adminChannels.js';
import { adminSeriesHandler } from './handlers/adminSeries.js';
import { seriesHandler } from './handlers/series.js';
import { adminBroadcastHandler } from './handlers/adminBroadcast.js';
import { extractFile, quickAddHandler } from './handlers/adminMovies.js';

export const bot = new Bot(config.token);

// Tarmoq uzilishi / 429 / 5xx da avtomatik qayta urinish
bot.api.config.use(apiRetry({ maxAttempts: 3 }));

const limiter = new RateLimiter(6, 3000);

// ---------- 1. Kontekstni boyitish + himoya ----------
bot.use(async (ctx, next) => {
  if (!ctx.from || ctx.from.is_bot) return next();

  // Flood himoyasi
  if (!limiter.take(ctx.from.id)) {
    if (limiter.shouldWarn(ctx.from.id)) {
      await ctx.reply('⏳ Juda tez yozyapsiz. Bir nafas oling va qayta urinib ko\'ring.').catch(() => {});
    }
    return; // tashlab yuboramiz
  }

  // /start ref_<id> dan referalni ajratish
  let refBy = null;
  const t = ctx.message?.text;
  if (t?.startsWith('/start')) {
    const m = t.match(/^\/start(?:@\w+)?\s+ref_(\d+)$/);
    if (m) refBy = Number(m[1]);
  }

  try {
    const u = await Users.upsertUser(ctx.from, refBy && refBy !== ctx.from.id ? refBy : null);
    ctx.user = u;
    ctx.isNewUser = !!u?.is_new;
    ctx.refBy = refBy;
  } catch (e) {
    console.error('[user] upsert xato:', e.message);
  }

  ctx.isAdmin = await isAdmin(ctx.from.id).catch(() => false);

  if (ctx.user?.is_blocked && !ctx.isAdmin) {
    if (ctx.callbackQuery) await ctx.answerCallbackQuery({ text: '⛔ Siz bloklangansiz.', show_alert: true }).catch(() => {});
    return;
  }

  if (!ctx.isAdmin && (await getSetting('maintenance', false))) {
    if (ctx.callbackQuery) return ctx.answerCallbackQuery({ text: '🛠 Bot texnik xizmatda. Keyinroq urinib ko\'ring.', show_alert: true }).catch(() => {});
    if (ctx.message) return ctx.reply('🛠 <b>Bot texnik xizmatda.</b>\n\nTez orada qaytamiz — bir oz keyinroq urinib ko\'ring.', { parse_mode: 'HTML' }).catch(() => {});
    return;
  }

  return next();
});

// ---------- 2. Faqat shaxsiy chat (guruhlarda jim) ----------
bot.use(async (ctx, next) => {
  if (ctx.inlineQuery || ctx.chosenInlineResult || ctx.callbackQuery) return next();
  if (!ctx.chat) return next();
  if (ctx.chat.type === 'private') return next();
  if (ctx.chat.type === 'channel') return next();
  // ---- Guruh rejimi: kod yozilsa FAYL emas, HAVOLA tashlaymiz ----
  const gtext = (ctx.message?.text || '').trim();
  if (!gtext) return;

  if (/^\/(start|help|kino)(@\w+)?$/i.test(gtext)) {
    await ctx.reply(`🎬 Kino olish uchun botni shaxsiy yozing: ${botLink('search')}`).catch(() => {});
    return;
  }

  if (!(await getSetting('group_mode', true))) return;

  // "#kod 11", "/kino 11", "kod 11" yoki faqat raqam
  const m = gtext.match(/^(?:#?kod|\/kino(?:@\w+)?)\s*[:\s]\s*([\w-]{1,20})$/i) || gtext.match(/^(\d{1,9})$/);
  if (!m) return;

  const movie = await Movies.getByCode(m[1]).catch(() => null);
  if (!movie) return;   // guruhni keraksiz xabar bilan to'ldirmaymiz

  const { InlineKeyboard } = await import('grammy');
  await ctx.reply(
    `🎬 <b>${esc(movie.title || movie.code)}</b>${movie.year ? ` (${movie.year})` : ''}\n` +
    `🔢 Kod: <code>${esc(movie.code)}</code>\n\n👇 Kinoni botdan oling:`,
    {
      parse_mode: 'HTML',
      reply_parameters: { message_id: ctx.message.message_id, allow_sending_without_reply: true },
      reply_markup: new InlineKeyboard().url('🍿 Kinoni olish', botLink(`kino_${movie.code}`)),
    },
  ).catch(() => {});
  return;
});

// ---------- 3. Handlerlar ----------
bot.use(inlineHandler);
bot.use(startHandler);
bot.use(adminHandler);
bot.use(adminMoviesHandler);
bot.use(adminChannelsHandler);
bot.use(adminSeriesHandler);
bot.use(adminBroadcastHandler);
bot.use(quickAddHandler);
bot.use(stateRouter);
bot.use(seriesHandler);
bot.use(extrasHandler);
bot.use(menuHandler);
bot.use(searchHandler);

// ---------- 4. Kanal postidan avtomatik import ----------
bot.on('channel_post', async (ctx) => {
  if (!config.sourceChannel) return;
  const chatId = String(ctx.chat.id);
  const uname = ctx.chat.username ? '@' + ctx.chat.username : '';
  if (chatId !== String(config.sourceChannel) && uname !== String(config.sourceChannel)) return;

  const f = extractFile(ctx.channelPost);
  const caption = ctx.channelPost.caption;
  if (!f || !caption) return;
  const meta = parseCaption(caption);
  if (!meta.code) return; // kodsiz postlarni o'tkazib yuboramiz

  const exists = await Movies.getByCodeAny(meta.code);
  if (exists) return;
  const movie = await Movies.insertMovie({
    code: meta.code, caption, fileId: f.fileId, fileType: f.fileType, addedBy: 0,
  });
  await notifyAdmins(
    ctx.api,
    `🤖 <b>Kanaldan avtomatik qo'shildi</b>\n🎬 ${esc(movie.title || '-')}\n🔢 Kod: <code>${esc(movie.code)}</code>`,
  );
});

// ---------- 4b. Kanal a'zoligi o'zgarishi: obuna keshini yangilash ----------
bot.on('chat_member', async (ctx) => {
  try {
    const chatId = String(ctx.chat.id);
    const uname = ctx.chat.username ? '@' + ctx.chat.username : '';
    const chans = await Channels.allChannels();
    const isOurs = chans.some((c) => String(c.chat_id) === chatId || String(c.chat_id) === uname);
    if (!isOurs) return;
    const userId = ctx.chatMember.new_chat_member?.user?.id;
    if (userId) Channels.invalidateSub(userId);
  } catch (e) {
    console.warn('[chat_member]', e.message);
  }
});

// ---------- 5. Boshqa hamma narsa ----------
bot.on('message', async (ctx) => {
  if (ctx.chat?.type !== 'private') return;
  await ctx.reply(
    '🤔 Tushunmadim.\n\nKino <b>kodini</b> yoki <b>nomini</b> yuboring, yoki pastdagi menyudan foydalaning.',
    { parse_mode: 'HTML', reply_markup: mainMenu(ctx.isAdmin) },
  ).catch(() => {});
});

// ---------- 6. Xatolar ----------
/**
 * Xato ishlovchisi. DIQQAT: grammY da `bot.catch` faqat polling rejimida
 * chaqiriladi — webhook rejimida `bot.handleUpdate` xatoni yuqoriga uloqtiradi.
 * Shuning uchun shu funksiyani index.js dagi webhook ishlovchisi ham chaqiradi.
 */
export async function handleBotError(err) {
  const ctx = err?.ctx;
  const e = err?.error ?? err;
  const where = ctx?.update?.update_id ? `update ${ctx.update.update_id}` : 'noma\'lum';
  if (e instanceof GrammyError) {
    if (e.error_code === 403) {
      if (ctx?.from?.id) await Users.markStopped(ctx.from.id).catch(() => {});
      return;
    }
    if (/message is not modified|query is too old|message to delete not found|message can't be deleted/i.test(e.description)) return;
    console.error(`[bot] Telegram xatosi (${where}): ${redactToken(e.description)}`);
  } else if (e instanceof HttpError) {
    console.error(`[bot] Tarmoq xatosi (${where}): ${redactToken(e.message)}`);
  } else {
    console.error(`[bot] Xato (${where}): ${redactToken(e)}`);
  }
  try {
    if (ctx?.chat?.type === 'private') {
      await ctx.reply('⚠️ Kutilmagan xatolik yuz berdi. Qayta urinib ko\'ring yoki /start bosing.');
    }
  } catch { /* ignore */ }
}

bot.catch(handleBotError);
