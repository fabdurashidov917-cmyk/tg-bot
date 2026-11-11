import { Composer, InlineKeyboard } from 'grammy';
import { BTN, mainMenu, listKeyboard, botLink } from '../lib/keyboards.js';
import { esc, movieLine, nf, chunk } from '../lib/utils.js';
import * as Movies from '../services/movies.js';
import * as Users from '../services/users.js';
import * as Channels from '../services/channels.js';
import * as Requests from '../services/requests.js';
import { setState, clearState } from '../lib/state.js';
import { requireSub, deliver } from './common.js';
import { notifyAdmins, fmtUser } from '../lib/notify.js';
import { config } from '../config.js';

export const menuHandler = new Composer();
const PAGE = 10;

async function sendList(ctx, { title, movies, page = 0, total = 0, prefix, empty }) {
  if (!movies.length) {
    const msg = empty || '📭 Hozircha bo\'sh.';
    return ctx.callbackQuery ? ctx.editMessageText(msg, { parse_mode: 'HTML' }).catch(() => ctx.reply(msg, { parse_mode: 'HTML' })) : ctx.reply(msg, { parse_mode: 'HTML' });
  }
  const pages = Math.max(1, Math.ceil(total / PAGE));
  let text = `${title}\n\n`;
  movies.forEach((m, i) => { text += `${movieLine(m, page * PAGE + i + 1)}\n`; });
  text += `\n💡 Kodni yuboring yoki pastdagi tugmani bosing.`;
  const kb = listKeyboard(movies, { page, pages, prefix });
  const opts = { parse_mode: 'HTML', reply_markup: kb, link_preview_options: { is_disabled: true } };
  if (ctx.callbackQuery) {
    return ctx.editMessageText(text, opts).catch(() => ctx.reply(text, opts));
  }
  return ctx.reply(text, opts);
}

// ---------- Reply klaviatura tugmalari ----------
menuHandler.hears(BTN.search, async (ctx) => {
  if (!(await requireSub(ctx))) return;
  await ctx.reply('🔍 Kino <b>kodini</b> yoki <b>nomini</b> yuboring:', { parse_mode: 'HTML' });
});

menuHandler.hears(BTN.help, (ctx) => ctx.reply(
  '<b>ℹ️ Yordam</b>\n\n• Kino kodi: <code>11</code>\n• Kino nomi: <code>malefisenta</code>\n' +
  `• Ulashish: <code>@${config.username} nom</code>\n\n📞 Aloqa: @admin_username`,
  { parse_mode: 'HTML', reply_markup: mainMenu(ctx.isAdmin) },
));

menuHandler.hears(BTN.random, (ctx) => showRandom(ctx));
menuHandler.hears(BTN.top, (ctx) => showTop(ctx));
menuHandler.hears(BTN.latest, (ctx) => showLatest(ctx, 0));
menuHandler.hears(BTN.genres, (ctx) => showGenres(ctx));
menuHandler.hears(BTN.favs, (ctx) => showFavs(ctx, 0));
menuHandler.hears(BTN.history, (ctx) => showHistory(ctx));

menuHandler.hears(BTN.request, async (ctx) => {
  await setState(ctx.from.id, { step: 'request' });
  await ctx.reply(
    '📩 <b>Qaysi kinoni qo\'shishimizni xohlaysiz?</b>\n\nKino nomini (va bo\'lsa yilini) yozib yuboring.\nBekor qilish: /menu',
    { parse_mode: 'HTML' },
  );
});

// ---------- Umumiy ko'rsatkichlar ----------
async function showRandom(ctx) {
  if (!(await requireSub(ctx))) return;
  const m = await Movies.random();
  if (!m) return ctx.reply('📭 Bazada hali kino yo\'q.');
  await deliver(ctx, m, 'menu');
}

async function showTop(ctx) {
  if (!(await requireSub(ctx))) return;
  const movies = await Movies.top(10);
  await sendList(ctx, {
    title: '🔥 <b>Eng ko\'p ko\'rilgan 10 kino</b>',
    movies, page: 0, total: movies.length, prefix: 'm:top',
    empty: '📭 Hali statistika yig\'ilmagan.',
  });
}

async function showLatest(ctx, page) {
  if (!(await requireSub(ctx))) return;
  const total = await Movies.countAll();
  const movies = await Movies.latest(PAGE, page * PAGE);
  await sendList(ctx, { title: '🆕 <b>Yangi qo\'shilgan kinolar</b>', movies, page, total, prefix: 'm:latest' });
}

async function showGenres(ctx) {
  if (!(await requireSub(ctx))) return;
  const rows = await Movies.genreList();
  if (!rows.length) return ctx.reply('📭 Janrlar topilmadi.');
  const kb = new InlineKeyboard();
  chunk(rows, 2).forEach((pair) => {
    pair.forEach((g) => kb.text(`${g.genre} (${g.c})`, `m:genre:${encodeURIComponent(g.genre)}:0`));
    kb.row();
  });
  kb.text('🏠 Bosh menyu', 'm:home');
  const text = '🎭 <b>Janrni tanlang:</b>';
  const opts = { parse_mode: 'HTML', reply_markup: kb };
  if (ctx.callbackQuery) return ctx.editMessageText(text, opts).catch(() => ctx.reply(text, opts));
  return ctx.reply(text, opts);
}

async function showGenre(ctx, genre, page) {
  if (!(await requireSub(ctx))) return;
  const total = await Movies.countByGenre(genre);
  const movies = await Movies.byGenre(genre, PAGE, page * PAGE);
  await sendList(ctx, {
    title: `🎭 <b>${esc(genre)}</b> janridagi kinolar`,
    movies, page, total, prefix: `m:genre:${encodeURIComponent(genre)}`,
    empty: 'Bu janrda kino topilmadi.',
  });
}

async function showFavs(ctx, page) {
  const total = await Users.countFavorites(ctx.from.id);
  const movies = await Users.listFavorites(ctx.from.id, PAGE, page * PAGE);
  const Series = await import('../services/series.js');
  const serFavs = page === 0 ? await Series.listFavorites(ctx.from.id, 10) : [];

  if (!movies.length && !serFavs.length) {
    const msg = '❤️ Sevimlilar bo\'sh.\n\nKino yoki serial ostidagi <b>❤️ Sevimlilarga</b> tugmasini bosing.';
    return ctx.callbackQuery
      ? ctx.editMessageText(msg, { parse_mode: 'HTML' }).catch(() => ctx.reply(msg, { parse_mode: 'HTML' }))
      : ctx.reply(msg, { parse_mode: 'HTML' });
  }

  const pages = Math.max(1, Math.ceil(total / PAGE));
  let text = '❤️ <b>Sevimlilaringiz</b>\n\n';
  movies.forEach((m, i) => { text += `${movieLine(m, page * PAGE + i + 1)}\n`; });
  if (serFavs.length) {
    text += '\n📺 <b>Seriallar:</b>\n';
    serFavs.forEach((x) => { text += `• <b>${esc(x.title)}</b> — ${x.ep_count} qism — <code>${esc(x.code)}</code>\n`; });
  }
  const kb = movies.length ? listKeyboard(movies, { page, pages, prefix: 'm:favs' }) : new InlineKeyboard();
  serFavs.forEach((x) => kb.text(`📺 ${x.title.slice(0, 24)}`, `sr:${x.id}:0`).row());
  if (!movies.length) kb.text('🏠 Bosh menyu', 'm:home');
  const opts = { parse_mode: 'HTML', reply_markup: kb, link_preview_options: { is_disabled: true } };
  return ctx.callbackQuery
    ? ctx.editMessageText(text, opts).catch(() => ctx.reply(text, opts))
    : ctx.reply(text, opts);
}

async function showHistory(ctx) {
  const movies = await Users.listHistory(ctx.from.id, 15);
  await sendList(ctx, {
    title: '🕘 <b>Oxirgi ko\'rganlaringiz</b>',
    movies, page: 0, total: movies.length, prefix: 'm:hist',
    empty: '🕘 Tarix bo\'sh.',
  });
}

// ---------- Callbacklar ----------
menuHandler.callbackQuery('noop', (ctx) => ctx.answerCallbackQuery());

menuHandler.callbackQuery('m:home', async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.reply('🏠 Bosh menyu', { reply_markup: mainMenu(ctx.isAdmin) });
});

menuHandler.callbackQuery('m:search', async (ctx) => {
  await ctx.answerCallbackQuery();
  if (!(await requireSub(ctx))) return;
  await ctx.reply('🔍 Kino <b>kodini</b> yoki <b>nomini</b> yuboring:', { parse_mode: 'HTML' });
});

menuHandler.callbackQuery('m:random', async (ctx) => { await ctx.answerCallbackQuery(); await showRandom(ctx); });
menuHandler.callbackQuery('m:top', async (ctx) => { await ctx.answerCallbackQuery(); await showTop(ctx); });
menuHandler.callbackQuery(/^m:latest:(\d+)$/, async (ctx) => {
  await ctx.answerCallbackQuery(); await showLatest(ctx, Number(ctx.match[1]));
});
menuHandler.callbackQuery(/^m:favs:(\d+)$/, async (ctx) => {
  await ctx.answerCallbackQuery(); await showFavs(ctx, Number(ctx.match[1]));
});
menuHandler.callbackQuery(/^m:hist:(\d+)$/, async (ctx) => { await ctx.answerCallbackQuery(); await showHistory(ctx); });
menuHandler.callbackQuery('m:genres', async (ctx) => { await ctx.answerCallbackQuery(); await showGenres(ctx); });
menuHandler.callbackQuery(/^m:genre:([^:]+):(\d+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  await showGenre(ctx, decodeURIComponent(ctx.match[1]), Number(ctx.match[2]));
});

menuHandler.callbackQuery(/^m:get:(.+)$/, async (ctx) => {
  const code = ctx.match[1];
  await ctx.answerCallbackQuery();
  if (!(await requireSub(ctx, `kino_${code}`))) return;
  const movie = await Movies.getByCode(code);
  if (!movie) return ctx.reply('❌ Kino topilmadi.');
  await deliver(ctx, movie, 'menu');
});

menuHandler.callbackQuery(/^fav:(\d+)$/, async (ctx) => {
  const id = Number(ctx.match[1]);
  const movie = await Movies.getById(id);
  if (!movie) return ctx.answerCallbackQuery({ text: 'Kino topilmadi', show_alert: true });
  const fav = await Users.isFavorite(ctx.from.id, id);
  if (fav) {
    await Users.removeFavorite(ctx.from.id, id);
    await ctx.answerCallbackQuery({ text: '💔 Sevimlilardan olindi' });
  } else {
    await Users.addFavorite(ctx.from.id, id);
    await ctx.answerCallbackQuery({ text: '❤️ Sevimlilarga qo\'shildi' });
  }
  const { movieKeyboard } = await import('../lib/keyboards.js');
  const variants = await Movies.listVariants(movie.id).catch(() => []);
  await ctx.editMessageReplyMarkup({ reply_markup: movieKeyboard(movie, !fav, { variants }) }).catch(() => {});
});

menuHandler.callbackQuery(/^sub:check:?(.*)$/, async (ctx) => {
  const payload = ctx.match[1] || '';
  Channels.invalidateSub(ctx.from.id);
  const missing = await Channels.getUnsubscribed(ctx.api, ctx.from.id, { force: true });
  if (missing.length) {
    await ctx.answerCallbackQuery({
      text: `❗ Hali ${missing.length} ta kanalga obuna bo'lmagansiz:\n` + missing.map((c) => c.title).join(', '),
      show_alert: true,
    });
    return;
  }
  await ctx.answerCallbackQuery({ text: '✅ Obuna tasdiqlandi!' });
  await ctx.deleteMessage().catch(() => {});
  const code = (payload.match(/^kino_(.+)$/) || [])[1];
  if (code) {
    const movie = await Movies.getByCode(code);
    if (movie) { await deliver(ctx, movie, 'deeplink'); return; }
  }
  await ctx.reply('✅ <b>Obuna tasdiqlandi!</b>\n\nEndi kino kodini yoki nomini yuborishingiz mumkin 🍿', {
    parse_mode: 'HTML', reply_markup: mainMenu(ctx.isAdmin),
  });
});

menuHandler.callbackQuery('m:rules', async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.reply(
    '📋 <b>Qoidalar</b>\n\n' +
    '1️⃣ Kino olish uchun kanal(lar)ga obuna bo\'lish shart\n' +
    '2️⃣ Kino kodi yoki nomi bo\'yicha qidiriladi\n' +
    '3️⃣ Topilmagan kinoni 📩 <b>Kino so\'rash</b> orqali so\'rang\n' +
    '4️⃣ Botdan faqat shaxsiy maqsadda foydalanilsin\n' +
    '5️⃣ Spam qilganlar bloklanadi',
    { parse_mode: 'HTML' },
  );
});

menuHandler.callbackQuery('m:about', async (ctx) => {
  await ctx.answerCallbackQuery();
  const st = await Movies.movieStats();
  const us = await Users.userStats();
  await ctx.reply(
    'ℹ️ <b>Bot haqida</b>\n\n' +
    `🤖 @${config.username}\n` +
    `🎬 Kinolar: <b>${nf(st.active)}</b> ta\n` +
    `👥 Foydalanuvchilar: <b>${nf(us.total)}</b>\n` +
    `👁 Umumiy ko'rishlar: <b>${nf(st.views)}</b>\n` +
    '📅 Versiya: 4.0 (Node.js)\n' +
    '👨‍💻 Dasturchi: @admin_username',
    { parse_mode: 'HTML' },
  );
});

/** Kino so'rovi matni (state) */
export async function handleRequestText(ctx, text) {
  await clearState(ctx.from.id);
  const r = await Requests.addRequest(ctx.from.id, text);
  await ctx.reply(
    (r.merged
      ? '👍 <b>Bu kino allaqachon so\'ralgan — ovozingiz qo\'shildi!</b>\n\nKo\'p ovoz olgan kinolar birinchi qo\'shiladi.'
      : '✅ <b>So\'rovingiz qabul qilindi!</b>\n\nKino qo\'shilishi bilan sizga xabar beramiz.'),
    {
      parse_mode: 'HTML',
      reply_markup: new InlineKeyboard().text('🗳 So\'rovlar reytingi', 'm:reqtop:0').text('🏠 Menyu', 'm:home'),
    },
  );
  if (r.merged) return;
  await notifyAdmins(
    ctx.api,
    `📩 <b>Yangi kino so'rovi #${r.id}</b>\n\n${esc(text)}\n\n👤 ${fmtUser(ctx.from)}`,
    { reply_markup: new InlineKeyboard().text('✅ Bajarildi', `a:reqdone:${r.id}`).text('🗑 O\'chirish', `a:reqdel:${r.id}`) },
  );
}
