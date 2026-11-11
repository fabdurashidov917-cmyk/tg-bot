import { Composer, InlineKeyboard } from 'grammy';
import { esc, nf, fmtDate, movieLine } from '../lib/utils.js';
import * as Users from '../services/users.js';
import * as Requests from '../services/requests.js';
import { listKeyboard, mainMenu } from '../lib/keyboards.js';
import { requireSub } from './common.js';

export const extrasHandler = new Composer();

// ================= 1. Kayfiyat bo'yicha tavsiya =================
const MOODS = {
  kulgi:    { label: '😂 Kulgili',     genres: ['Komediya'] },
  qorqinch: { label: '😱 Qo\'rqinchli', genres: ['Ujas', 'Triller'] },
  jangari:  { label: '💥 Jangari',     genres: ['Ekshen', 'Jangari'] },
  ogir:     { label: '🧠 Jiddiy drama', genres: ['Drama', 'Kriminal'] },
  romantik: { label: '❤️ Romantik',    genres: ['Romantika'] },
  oilaviy:  { label: '👨‍👩‍👧 Oilaviy',     genres: ['Oilaviy', 'Multfilm'] },
  kosmos:   { label: '🚀 Fantastika',  genres: ['Fantastika', 'Sarguzasht'] },
  sirli:    { label: '🕵️ Sirli',       genres: ['Detektiv', 'Triller', 'Kriminal'] },
};

function moodKeyboard() {
  const kb = new InlineKeyboard();
  const keys = Object.keys(MOODS);
  keys.forEach((k, i) => {
    kb.text(MOODS[k].label, `m:mood:${k}`);
    if (i % 2 === 1) kb.row();
  });
  kb.row().text('🏠 Bosh menyu', 'm:home');
  return kb;
}

const moodPrompt = '🎯 <b>Bugun qanday kino ko\'rmoqchisiz?</b>\n\nKayfiyatingizni tanlang — bazadan sizga mos kinolarni tanlab beraman:';

extrasHandler.command('tavsiya', async (ctx) => {
  if (!(await requireSub(ctx))) return;
  await ctx.reply(moodPrompt, { parse_mode: 'HTML', reply_markup: moodKeyboard() });
});

extrasHandler.callbackQuery('m:mood', async (ctx) => {
  await ctx.answerCallbackQuery();
  if (!(await requireSub(ctx))) return;
  const opts = { parse_mode: 'HTML', reply_markup: moodKeyboard() };
  try { await ctx.editMessageText(moodPrompt, opts); } catch { await ctx.reply(moodPrompt, opts); }
});

extrasHandler.callbackQuery(/^m:mood:(\w+)$/, async (ctx) => {
  const mood = MOODS[ctx.match[1]];
  await ctx.answerCallbackQuery();
  if (!mood) return;
  if (!(await requireSub(ctx))) return;

  const movies = await Users.moodPick(mood.genres, 5);
  if (!movies.length) {
    return ctx.reply(`😔 ${mood.label} turkumida hozircha kino yo'q.\n\nBoshqa kayfiyatni tanlang:`, { reply_markup: moodKeyboard() });
  }
  let text = `${mood.label} <b>kayfiyat uchun tanlovim:</b>\n\n`;
  movies.forEach((m, i) => { text += `${movieLine(m, i + 1)}\n`; });
  text += '\n💡 Tugmani bosing yoki kodni yuboring. Yana tanlov kerak bo\'lsa 🔄 ni bosing.';
  const kb = listKeyboard(movies, { page: 0, pages: 1, prefix: 'm:latest' });
  kb.text('🔄 Boshqa variantlar', `m:mood:${ctx.match[1]}`).row();
  const opts = { parse_mode: 'HTML', reply_markup: kb, link_preview_options: { is_disabled: true } };
  try { await ctx.editMessageText(text, opts); } catch { await ctx.reply(text, opts); }
});

// ================= 2. "Mening kino yilim" =================
async function meCard(ctx) {
  const s = await Users.personalStats(ctx.from.id);
  if (!s || !s.movies) {
    return ctx.reply(
      '📊 Hali statistika yo\'q — birinchi kinongizni ko\'ring!\n\nKod yoki nom yuboring 🍿',
      { reply_markup: mainMenu(ctx.isAdmin) },
    );
  }
  const hours = Math.round((s.total_views * 100) / 60) / 10; // ~100 daqiqa/kino
  const text =
    `📊 <b>${esc(ctx.from.first_name || 'Sizning')} kino hisobotingiz</b>\n\n` +
    `🎬 Ko'rilgan kinolar: <b>${nf(s.movies)}</b>\n` +
    `📅 Bu oyda: <b>${nf(s.this_month)}</b>  |  Bu yilda: <b>${nf(s.this_year)}</b>\n` +
    `⏱ Taxminan <b>${hours}</b> soat kino tomosha qilgansiz\n` +
    (s.top_genre ? `🎭 Sevimli janringiz: <b>${esc(s.top_genre)}</b>\n` : '') +
    `❤️ Sevimlilarda: <b>${nf(s.favorites)}</b> ta\n` +
    `👥 Taklif qilganlar: <b>${nf(s.refs)}</b>\n` +
    `🏆 Reyting: <b>${nf(s.rank)}</b>-o'rin (${nf(s.total_watchers)} tomoshabin ichida)\n` +
    (s.first_watch ? `🗓 Birinchi kinongiz: ${fmtDate(s.first_watch)}\n` : '');
  const kb = new InlineKeyboard()
    .switchInline('📤 Do\'stlarga ulashish', '')
    .text('🎯 Tavsiya oling', 'm:mood');
  await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb });
}

extrasHandler.command('men', meCard);
extrasHandler.callbackQuery('m:me', async (ctx) => { await ctx.answerCallbackQuery(); await meCard(ctx); });

// ================= 3. So'rovlar reytingi (ovoz berish) =================
const PER = 8;

async function reqTop(ctx, page = 0) {
  const list = await Requests.topRequests(PER, page * PER);
  if (!list.length) {
    const msg = '🗳 Hozircha so\'rov yo\'q.\n\n📩 <b>Kino so\'rash</b> tugmasi bilan birinchi bo\'lib so\'rang!';
    return ctx.callbackQuery
      ? ctx.editMessageText(msg, { parse_mode: 'HTML' }).catch(() => ctx.reply(msg, { parse_mode: 'HTML' }))
      : ctx.reply(msg, { parse_mode: 'HTML' });
  }
  let text = '🗳 <b>Eng ko\'p so\'ralgan kinolar</b>\n\n👍 bosib ovoz bering — ko\'p ovoz olgani birinchi qo\'shiladi.\n\n';
  const kb = new InlineKeyboard();
  list.forEach((r, i) => {
    text += `${page * PER + i + 1}. <b>${esc(r.text)}</b> — 👍 ${nf(r.votes)}\n`;
    kb.text(`👍 ${page * PER + i + 1}`, `m:vote:${r.id}`);
    if (i % 4 === 3) kb.row();
  });
  kb.row();
  if (page > 0) kb.text('◀️', `m:reqtop:${page - 1}`);
  if (list.length === PER) kb.text('▶️', `m:reqtop:${page + 1}`);
  kb.row().text('📩 Men ham so\'rayman', 'm:reqnew').text('🏠 Menyu', 'm:home');
  const opts = { parse_mode: 'HTML', reply_markup: kb, link_preview_options: { is_disabled: true } };
  return ctx.callbackQuery
    ? ctx.editMessageText(text, opts).catch(() => ctx.reply(text, opts))
    : ctx.reply(text, opts);
}

extrasHandler.command('sorovlar', (ctx) => reqTop(ctx, 0));
extrasHandler.callbackQuery(/^m:reqtop:(\d+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  await reqTop(ctx, Number(ctx.match[1]));
});

extrasHandler.callbackQuery(/^m:vote:(\d+)$/, async (ctx) => {
  const id = Number(ctx.match[1]);
  if (await Requests.hasVoted(id, ctx.from.id)) {
    return ctx.answerCallbackQuery({ text: '✅ Siz bu so\'rovga allaqachon ovoz bergansiz', show_alert: true });
  }
  await Requests.voteRequest(id, ctx.from.id);
  await ctx.answerCallbackQuery({ text: '👍 Ovozingiz qabul qilindi!' });
  await reqTop(ctx, 0);
});

extrasHandler.callbackQuery('m:reqnew', async (ctx) => {
  await ctx.answerCallbackQuery();
  const { setState } = await import('../lib/state.js');
  await setState(ctx.from.id, { step: 'request' });
  await ctx.reply('📩 Qaysi kinoni qo\'shaylik? Nomini yozib yuboring:', { parse_mode: 'HTML' });
});

// ================= 6. Trend (24 soat) =================
async function trendView(ctx) {
  if (!(await requireSub(ctx))) return;
  let movies = await (await import('../services/movies.js')).trending(24, 10);
  let title = '🔥 <b>Bugungi trend</b> — oxirgi 24 soatda eng ko\'p olingan';
  if (!movies.length) {
    movies = await (await import('../services/movies.js')).trending(24 * 7, 10);
    title = '🔥 <b>Haftaning trendi</b>';
  }
  if (!movies.length) {
    const msg = '📭 Hali statistika yig\'ilmagan — birinchi bo\'lib kino oling!';
    return ctx.callbackQuery ? ctx.editMessageText(msg).catch(() => ctx.reply(msg)) : ctx.reply(msg);
  }
  let text = `${title}\n\n`;
  movies.forEach((m, i) => { text += `${movieLine(m, i + 1)}${m.recent ? ` — 🔥 ${nf(m.recent)}` : ''}\n`; });
  const kb = listKeyboard(movies, { page: 0, pages: 1, prefix: 'm:latest' });
  kb.text('🏆 Umumiy TOP 10', 'm:top').row();
  const opts = { parse_mode: 'HTML', reply_markup: kb, link_preview_options: { is_disabled: true } };
  return ctx.callbackQuery ? ctx.editMessageText(text, opts).catch(() => ctx.reply(text, opts)) : ctx.reply(text, opts);
}

extrasHandler.command('trend', trendView);
extrasHandler.callbackQuery('m:trend', async (ctx) => { await ctx.answerCallbackQuery(); await trendView(ctx); });

// ================= 3. Sifat / til variantlari =================
extrasHandler.callbackQuery(/^mf:(\d+)$/, async (ctx) => {
  const Movies = await import('../services/movies.js');
  const v = await Movies.getVariant(Number(ctx.match[1]));
  if (!v) return ctx.answerCallbackQuery({ text: 'Variant topilmadi', show_alert: true });
  await ctx.answerCallbackQuery({ text: `🎚 ${v.label} yuborilmoqda...` });
  if (!(await requireSub(ctx))) return;
  const { checkDailyLimit } = await import('./common.js');
  if (!(await checkDailyLimit(ctx))) return;
  const movie = await Movies.getById(v.movie_id);
  const { sendVariant } = await import('../lib/send.js');
  await sendVariant(ctx.api, ctx.chat.id, movie, v, { userId: ctx.from.id });
});

// ================= 8. Do'stga sovg'a qilish =================
extrasHandler.callbackQuery(/^gift:(\d+)$/, async (ctx) => {
  const Movies = await import('../services/movies.js');
  const movie = await Movies.getById(Number(ctx.match[1]));
  if (!movie) return ctx.answerCallbackQuery({ text: 'Kino topilmadi', show_alert: true });
  const g = await Users.createGift(ctx.from.id, movie.id);
  await ctx.answerCallbackQuery({ text: '🎁 Sovg\'a havolasi tayyor' });
  const { config } = await import('../config.js');
  const link = `https://t.me/${config.username}?start=gift_${g.id}`;
  await ctx.reply(
    `🎁 <b>«${esc(movie.title || movie.code)}»</b> kinosini do'stingizga sovg'a qiling!\n\n` +
    `Shu havolani yuboring:\n<code>${link}</code>\n\n` +
    `✅ Do'stingiz havolani ochsa kinoni oladi, <b>sizga esa +1 bonus</b> beriladi (kunlik limitga qo'shiladi).`,
    {
      parse_mode: 'HTML',
      link_preview_options: { is_disabled: true },
      reply_markup: new InlineKeyboard().switchInline('📤 Do\'stga yuborish', `gift_${g.id}`),
    },
  );
});

// ================= 7. Eslatma =================
const REM_OPTS = {
  h3:  { label: '⏳ 3 soatdan keyin', ms: 3 * 3600e3 },
  eve: { label: '🌙 Bugun 21:00 da',  at: 21 },
  tom: { label: '📅 Ertaga 21:00 da', at: 21, day: 1 },
  d3:  { label: '🗓 3 kundan keyin',  ms: 3 * 24 * 3600e3 },
};

function remindAt(opt) {
  const o = REM_OPTS[opt];
  if (!o) return null;
  if (o.ms) return new Date(Date.now() + o.ms);
  // Toshkent vaqti bilan soat 21:00
  const now = new Date();
  const tz = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Tashkent' }));
  const diff = now.getTime() - tz.getTime();
  tz.setDate(tz.getDate() + (o.day || 0));
  tz.setHours(o.at, 0, 0, 0);
  let target = new Date(tz.getTime() + diff);
  if (target <= now) target = new Date(target.getTime() + 24 * 3600e3);
  return target;
}

extrasHandler.callbackQuery(/^rem:(\d+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const id = ctx.match[1];
  const kb = new InlineKeyboard();
  Object.entries(REM_OPTS).forEach(([k, o], i) => {
    kb.text(o.label, `rem:${id}:${k}`);
    if (i % 2 === 1) kb.row();
  });
  await ctx.reply('⏰ <b>Qachon eslatay?</b>', { parse_mode: 'HTML', reply_markup: kb });
});

extrasHandler.callbackQuery(/^rem:(\d+):(\w+)$/, async (ctx) => {
  const Movies = await import('../services/movies.js');
  const Reminders = await import('../services/reminders.js');
  const movie = await Movies.getById(Number(ctx.match[1]));
  const at = remindAt(ctx.match[2]);
  if (!movie || !at) return ctx.answerCallbackQuery({ text: 'Xato', show_alert: true });
  await Reminders.addReminder(ctx.from.id, movie.id, at);
  await ctx.answerCallbackQuery({ text: '⏰ Eslatma qo\'yildi' });
  await ctx.editMessageText(
    `⏰ <b>${esc(movie.title || movie.code)}</b> haqida ${fmtDate(at)} da eslatib qo'yaman.`,
    { parse_mode: 'HTML' },
  ).catch(() => {});
});

extrasHandler.command('eslatmalar', async (ctx) => {
  const Reminders = await import('../services/reminders.js');
  const list = await Reminders.myReminders(ctx.from.id);
  if (!list.length) {
    return ctx.reply('⏰ Eslatma yo\'q.\n\nKino kelganda <b>⏰ Eslat</b> tugmasini bossangiz, belgilangan vaqtda eslatib qo\'yaman.', { parse_mode: 'HTML' });
  }
  let text = '⏰ <b>Eslatmalaringiz:</b>\n\n';
  const kb = new InlineKeyboard();
  list.forEach((r, i) => {
    text += `${i + 1}. <b>${esc(r.title || r.code)}</b> — ${fmtDate(r.remind_at)}\n`;
    kb.text(`🗑 ${i + 1}`, `remdel:${r.id}`);
    if (i % 4 === 3) kb.row();
  });
  await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb });
});

extrasHandler.callbackQuery(/^remdel:(\d+)$/, async (ctx) => {
  const Reminders = await import('../services/reminders.js');
  await Reminders.cancelReminder(Number(ctx.match[1]), ctx.from.id);
  await ctx.answerCallbackQuery({ text: '🗑 O\'chirildi' });
  await ctx.editMessageReplyMarkup().catch(() => {});
});

// ================= 10. Janr bo'yicha bildirishnoma =================
async function notifyView(ctx) {
  const Movies = await import('../services/movies.js');
  const user = await Users.getUser(ctx.from.id);
  const genres = (await Movies.genreList()).slice(0, 16);
  const chosen = user?.notify_genres || [];
  const kb = new InlineKeyboard();
  genres.forEach((g, i) => {
    kb.text(`${chosen.includes(g.genre) ? '✅' : '⬜️'} ${g.genre}`, `ng:${encodeURIComponent(g.genre)}`);
    if (i % 2 === 1) kb.row();
  });
  kb.row()
    .text(chosen.length ? '🌐 Hammasi' : '🌐 Hammasi ✅', 'ng:all')
    .text(user?.notify ? '🔕 Butunlay o\'chirish' : '🔔 Yoqish', 'ng:toggle');
  const text =
    '🔔 <b>Bildirishnoma sozlamalari</b>\n\n' +
    (user?.notify
      ? (chosen.length
          ? `Siz tanlagan janrlar: <b>${esc(chosen.join(', '))}</b>\nFaqat shu janrlarda yangi kino chiqsa xabar beraman.`
          : 'Hozir <b>barcha</b> yangi kinolar haqida xabar olasiz.\nFaqat kerakli janrlarni belgilab qo\'ysangiz, ortiqcha xabar kelmaydi.')
      : '🔕 Bildirishnoma <b>o\'chirilgan</b>.');
  const opts = { parse_mode: 'HTML', reply_markup: kb };
  return ctx.callbackQuery ? ctx.editMessageText(text, opts).catch(() => ctx.reply(text, opts)) : ctx.reply(text, opts);
}

extrasHandler.command('bildirishnoma', notifyView);
extrasHandler.callbackQuery('m:notify', async (ctx) => { await ctx.answerCallbackQuery(); await notifyView(ctx); });

extrasHandler.callbackQuery(/^ng:(.+)$/, async (ctx) => {
  const arg = ctx.match[1];
  const user = await Users.getUser(ctx.from.id);
  if (arg === 'all') {
    await Users.setNotifyGenres(ctx.from.id, []);
    await ctx.answerCallbackQuery({ text: '🌐 Barcha janrlar' });
  } else if (arg === 'toggle') {
    const r = await Users.toggleNotify(ctx.from.id);
    await ctx.answerCallbackQuery({ text: r?.notify ? '🔔 Yoqildi' : '🔕 O\'chirildi' });
  } else {
    const g = decodeURIComponent(arg);
    const cur = user?.notify_genres || [];
    const next = cur.includes(g) ? cur.filter((x) => x !== g) : [...cur, g];
    await Users.setNotifyGenres(ctx.from.id, next);
    await ctx.answerCallbackQuery({ text: next.includes(g) ? `✅ ${g}` : `⬜️ ${g}` });
  }
  await notifyView(ctx);
});

// ================= 9. Referal liga =================
extrasHandler.command('liga', async (ctx) => {
  const week = await Users.weeklyReferrers(10);
  const all = await Users.allTimeReferrers(5);
  const medal = (i) => ['🥇', '🥈', '🥉'][i] || `${i + 1}.`;
  let text = '🏆 <b>Referal liga</b>\n\n<b>Bu hafta:</b>\n';
  if (!week.length) text += '<i>hali hech kim taklif qilmagan — birinchi bo\'ling!</i>\n';
  week.forEach((r, i) => {
    text += `${medal(i)} ${r.username ? '@' + esc(r.username) : esc(r.first_name || 'Foydalanuvchi')} — <b>${nf(r.invited)}</b>\n`;
  });
  if (all.length) {
    text += '\n<b>Umumiy:</b>\n';
    all.forEach((r, i) => {
      text += `${medal(i)} ${r.username ? '@' + esc(r.username) : esc(r.first_name || 'Foydalanuvchi')} — <b>${nf(r.invited)}</b>\n`;
    });
  }
  const me = await Users.getUser(ctx.from.id);
  const { botLink } = await import('../lib/keyboards.js');
  text += `\n👤 Siz: <b>${nf(me?.ref_count || 0)}</b> ta taklif\n🔗 <code>${botLink('ref_' + ctx.from.id)}</code>`;
  await ctx.reply(text, {
    parse_mode: 'HTML',
    link_preview_options: { is_disabled: true },
    reply_markup: new InlineKeyboard().switchInline('📤 Havolani ulashish', ''),
  });
});
