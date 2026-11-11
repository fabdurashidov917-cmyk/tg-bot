import { Composer, InlineKeyboard } from 'grammy';
import * as Series from '../services/series.js';
import { esc, nf, fmtDate, chunk } from '../lib/utils.js';
import { cancelKb, mainMenu } from '../lib/keyboards.js';
import { setState, clearState } from '../lib/state.js';
import { extractFile } from './adminMovies.js';
import { config } from '../config.js';

export const adminSeriesHandler = new Composer();
const PER = 8;
const EP_PER = 30;

const show = async (ctx, text, kb) => {
  const opts = { parse_mode: 'HTML', reply_markup: kb, link_preview_options: { is_disabled: true } };
  if (ctx.callbackQuery) { try { return await ctx.editMessageText(text, opts); } catch { /* ignore */ } }
  return ctx.reply(text, opts);
};

// ==================== Ro'yxat ====================
adminSeriesHandler.callbackQuery(/^a:series:(\d+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const page = Number(ctx.match[1]);
  const total = await Series.countAll({ onlyActive: false });
  const list = await Series.listPage(PER, page * PER, { onlyActive: false });
  const st = await Series.stats();
  const pages = Math.max(1, Math.ceil(total / PER));

  let text = `📺 <b>Seriallar</b> — ${nf(st.total)} serial, ${nf(st.episodes)} qism\n\n`;
  if (!list.length) text += '<i>Serial yo\'q. ➕ tugmasi bilan qo\'shing.</i>\n';
  const kb = new InlineKeyboard();
  list.forEach((s) => {
    text += `${s.is_active ? '✅' : '🚫'} <b>${esc(s.title)}</b> — ${nf(s.ep_count)} qism • <code>${esc(s.code)}</code>\n`;
    kb.text(`${s.title.slice(0, 24)} (${s.ep_count})`, `a:sr:${s.id}`).row();
  });
  if (pages > 1) {
    if (page > 0) kb.text('◀️', `a:series:${page - 1}`);
    kb.text(`${page + 1}/${pages}`, 'noop');
    if (page < pages - 1) kb.text('▶️', `a:series:${page + 1}`);
    kb.row();
  }
  kb.text('➕ Yangi serial', 'a:sradd').row().text('◀️ Admin panel', 'a:home');
  await show(ctx, text, kb);
});

// ==================== Yangi serial ====================
adminSeriesHandler.callbackQuery('a:sradd', async (ctx) => {
  await ctx.answerCallbackQuery();
  await setState(ctx.from.id, { step: 'series_title' });
  await show(ctx, '📺 <b>Yangi serial</b>\n\n1️⃣ Serial <b>nomini</b> yuboring:', cancelKb());
});

/** Matnli qadamlar */
export async function handleSeriesText(ctx, state, text) {
  if (state.step === 'series_title') {
    const suggested = await Series.nextFreeCode();
    await setState(ctx.from.id, { step: 'series_code', title: text.slice(0, 150), suggested });
    await ctx.reply(
      `✅ Nom: <b>${esc(text)}</b>\n\n2️⃣ Serial <b>kodini</b> yuboring.\n` +
      `Tavsiya: <code>${suggested}</code> — shuni ishlatish uchun <b>ok</b> deb yozing.`,
      { parse_mode: 'HTML', reply_markup: cancelKb() },
    );
    return true;
  }

  if (state.step === 'series_code') {
    const code = /^ok$/i.test(text.trim()) ? state.suggested : text.trim();
    if (!/^[\w-]{1,20}$/.test(code)) { await ctx.reply('❌ Kod 1–20 belgi: harf, raqam, - , _'); return true; }
    if (await Series.getByCodeAny(code)) { await ctx.reply('❌ Bu kod boshqa serialda bor. Boshqa kod yuboring.'); return true; }
    const { getByCodeAny } = await import('../services/movies.js');
    if (await getByCodeAny(code)) { await ctx.reply('❌ Bu kod kinoda ishlatilgan. Boshqa kod yuboring.'); return true; }

    const s = await Series.createSeries({ code, title: state.title, caption: null, addedBy: ctx.from.id });
    await setState(ctx.from.id, { step: 'episode_bulk', seriesId: s.id, season: 1 });
    await ctx.reply(
      `✅ <b>${esc(s.title)}</b> seriali yaratildi (kod <code>${esc(s.code)}</code>).\n\n` +
      `3️⃣ Endi <b>qismlarni ketma-ket yuboring yoki kanaldan forward qiling</b> — har bir video avtomatik keyingi qism bo'ladi.\n` +
      `💡 Agar izohda «12-qism» yoki «S01E12» bo'lsa, shu raqam olinadi.\n\n` +
      `Tugatgach <b>✅ Tugatdim</b> tugmasini bosing.`,
      {
        parse_mode: 'HTML',
        reply_markup: new InlineKeyboard()
          .text('✅ Tugatdim', `a:srdone:${s.id}`)
          .text('📝 Izoh qo\'shish', `a:srcap:${s.id}`),
      },
    );
    return true;
  }

  if (state.step === 'series_editcap') {
    const s = await Series.updateCaption(state.id, text);
    await clearState(ctx.from.id);
    await ctx.reply(`✅ Izoh saqlandi. Janrlar: ${esc(s.genres?.join(', ') || '-')}`, { parse_mode: 'HTML', reply_markup: mainMenu(true) });
    return true;
  }

  if (state.step === 'series_edittitle') {
    const s = await Series.updateTitle(state.id, text.slice(0, 150));
    await clearState(ctx.from.id);
    await ctx.reply(`✅ Yangi nom: <b>${esc(s.title)}</b>`, { parse_mode: 'HTML', reply_markup: mainMenu(true) });
    return true;
  }

  if (state.step === 'series_editcode') {
    const code = text.trim();
    if (await Series.getByCodeAny(code)) { await ctx.reply('❌ Bu kod band.'); return true; }
    const s = await Series.updateCode(state.id, code);
    await clearState(ctx.from.id);
    await ctx.reply(`✅ Yangi kod: <code>${esc(s.code)}</code>`, { parse_mode: 'HTML', reply_markup: mainMenu(true) });
    return true;
  }

  // Bulk rejimda matn kelsa — fasl almashtirish ("fasl 2")
  if (state.step === 'episode_bulk') {
    const m = text.match(/^(?:fasl|season)\s*(\d{1,2})$/i);
    if (m) {
      await setState(ctx.from.id, { ...state, season: Number(m[1]) });
      await ctx.reply(`✅ Endi qismlar <b>${m[1]}-faslga</b> qo'shiladi.`, { parse_mode: 'HTML' });
      return true;
    }
    await ctx.reply(
      '📎 Qism faylini yuboring. Fasl almashtirish: <code>fasl 2</code>. Tugatish: /menu',
      { parse_mode: 'HTML' },
    );
    return true;
  }

  return false;
}

/** Bulk rejimda fayl qabul qilish */
export async function handleEpisodeFile(ctx, state) {
  const f = extractFile(ctx.message);
  if (!f) { await ctx.reply('❌ Video yoki hujjat yuboring.'); return true; }

  const caption = ctx.message.caption?.trim() || '';
  const parsed = Series.parseEpisodeNo(caption);
  const season = parsed.season || state.season || 1;
  const episode = parsed.episode || (await Series.nextEpisodeNo(state.seriesId, season));

  const ep = await Series.addEpisode({
    seriesId: state.seriesId, season, episode,
    fileId: f.fileId, fileType: f.fileType, caption: caption || null,
  });
  await setState(ctx.from.id, { ...state, season });

  const total = await Series.countEpisodes(state.seriesId);
  await ctx.reply(
    `✅ ${season > 1 ? `${season}-fasl ` : ''}<b>${ep.episode}-qism</b> qo'shildi (jami ${total})`,
    {
      parse_mode: 'HTML',
      reply_markup: new InlineKeyboard().text('✅ Tugatdim', `a:srdone:${state.seriesId}`),
    },
  );
  return true;
}

adminSeriesHandler.callbackQuery(/^a:srdone:(\d+)$/, async (ctx) => {
  await clearState(ctx.from.id);
  await ctx.answerCallbackQuery({ text: 'Tayyor' });
  await seriesAdminCard(ctx, Number(ctx.match[1]));
});

// ==================== Admin kartochkasi ====================
async function seriesAdminCard(ctx, id) {
  const s = await Series.getById(id);
  if (!s) return show(ctx, '❌ Serial topilmadi.', new InlineKeyboard().text('◀️ Ro\'yxat', 'a:series:0'));
  const eps = await Series.listEpisodes(id);
  const seasons = await Series.seasonList(id);

  const text =
    `📺 <b>${esc(s.title)}</b>\n` +
    `🔢 Kod: <code>${esc(s.code)}</code>\n` +
    `🎬 Qismlar: <b>${nf(eps.length)}</b>${seasons.length > 1 ? ` (${seasons.map((x) => `${x.season}-fasl: ${x.c}`).join(', ')})` : ''}\n` +
    `📅 Yil: ${s.year || '-'} | 🎭 ${esc(s.genres?.join(', ') || '-')}\n` +
    `📌 Holat: ${s.status === 'completed' ? '✅ tugagan' : '🔄 davom etmoqda'} | ${s.is_active ? '🟢 faol' : '🚫 o\'chirilgan'}\n` +
    `🖼 Poster: ${s.poster_file_id ? 'bor ✅' : 'yo\'q'}\n` +
    `👁 ${nf(s.views)} | 🕐 ${fmtDate(s.created_at)}`;

  const kb = new InlineKeyboard()
    .text('➕ Qism qo\'shish', `a:srep:${id}`).text('📋 Qismlar', `a:sreps:${id}:0`).row()
    .text('📝 Izoh', `a:srcap:${id}`).text('✏️ Nom', `a:srtitle:${id}`).text('🔢 Kod', `a:srcode:${id}`).row()
    .text(s.poster_file_id ? '🖼 Posterni almashtirish' : '🖼 Poster qo\'shish', `a:srposter:${id}`)
    .text(s.status === 'completed' ? '🔄 Davom etmoqda' : '✅ Tugagan deb belgilash', `a:srstatus:${id}`).row();
  if (s.poster_file_id) kb.text('🗑 Posterni o\'chirish', `a:srposterdel:${id}`).row();
  kb
    .text('📣 Kanalga e\'lon', `a:srpost:${id}`).text('📢 Xabar berish', `a:srnotify:${id}`).row()
    .text(s.is_active ? '🚫 O\'chirib qo\'yish' : '✅ Yoqish', `a:srtoggle:${id}`)
    .text('🗑 O\'chirish', `a:srdel:${id}`).row()
    .text('◀️ Ro\'yxat', 'a:series:0');
  return show(ctx, text, kb);
}

adminSeriesHandler.callbackQuery(/^a:sr:(\d+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  await seriesAdminCard(ctx, Number(ctx.match[1]));
});

adminSeriesHandler.callbackQuery(/^a:srep:(\d+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const id = Number(ctx.match[1]);
  const next = await Series.nextEpisodeNo(id, 1);
  await setState(ctx.from.id, { step: 'episode_bulk', seriesId: id, season: 1 });
  await show(
    ctx,
    `➕ <b>Qism qo'shish rejimi</b>\n\nQism fayllarini <b>ketma-ket yuboring yoki forward qiling</b> — ` +
    `keyingi qism raqami <b>${next}</b> dan boshlanadi.\n\n` +
    `💡 Izohda «12-qism» / «S02E05» bo'lsa, shu raqam olinadi.\n💡 Fasl almashtirish: <code>fasl 2</code> deb yozing.`,
    new InlineKeyboard().text('✅ Tugatdim', `a:srdone:${id}`),
  );
});

// ==================== Qismlar ro'yxati ====================
adminSeriesHandler.callbackQuery(/^a:sreps:(\d+):(\d+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const id = Number(ctx.match[1]);
  const page = Number(ctx.match[2]);
  const eps = await Series.listEpisodes(id);
  const s = await Series.getById(id);
  const slice = eps.slice(page * EP_PER, (page + 1) * EP_PER);
  const pages = Math.max(1, Math.ceil(eps.length / EP_PER));

  let text = `📋 <b>${esc(s?.title || '')}</b> — ${nf(eps.length)} qism\n\n🗑 uchun qism raqamini bosing:`;
  const kb = new InlineKeyboard();
  chunk(slice, 5).forEach((row) => {
    row.forEach((e) => kb.text(`🗑${e.season > 1 ? `${e.season}.` : ''}${e.episode}`, `a:srepdel:${e.id}`));
    kb.row();
  });
  if (pages > 1) {
    if (page > 0) kb.text('◀️', `a:sreps:${id}:${page - 1}`);
    kb.text(`${page + 1}/${pages}`, 'noop');
    if (page < pages - 1) kb.text('▶️', `a:sreps:${id}:${page + 1}`);
    kb.row();
  }
  kb.text('◀️ Serial', `a:sr:${id}`);
  await show(ctx, text, kb);
});

adminSeriesHandler.callbackQuery(/^a:srepdel:(\d+)$/, async (ctx) => {
  const ep = await Series.getEpisode(Number(ctx.match[1]));
  if (!ep) return ctx.answerCallbackQuery({ text: 'Topilmadi', show_alert: true });
  await Series.deleteEpisode(ep.id);
  await ctx.answerCallbackQuery({ text: `🗑 ${ep.episode}-qism o'chirildi` });
  await ctx.api.sendMessage(ctx.chat.id, `🗑 ${ep.episode}-qism o'chirildi.`).catch(() => {});
});

// ==================== Tahrirlash ====================
const askText = (step, prompt) => async (ctx) => {
  await ctx.answerCallbackQuery();
  await setState(ctx.from.id, { step, id: Number(ctx.match[1]) });
  await show(ctx, prompt, cancelKb());
};

adminSeriesHandler.callbackQuery(/^a:srcap:(\d+)$/, askText('series_editcap',
  '📝 Serial izohini yuboring (davlat, janr, yil... — meta avtomatik ajratiladi):'));
adminSeriesHandler.callbackQuery(/^a:srtitle:(\d+)$/, askText('series_edittitle', '✏️ Yangi nomni yuboring:'));
adminSeriesHandler.callbackQuery(/^a:srcode:(\d+)$/, askText('series_editcode', '🔢 Yangi kodni yuboring:'));

adminSeriesHandler.callbackQuery(/^a:srtoggle:(\d+)$/, async (ctx) => {
  const s = await Series.toggleActive(Number(ctx.match[1]));
  await ctx.answerCallbackQuery({ text: s.is_active ? 'Yoqildi' : 'O\'chirildi' });
  await seriesAdminCard(ctx, s.id);
});

adminSeriesHandler.callbackQuery(/^a:srstatus:(\d+)$/, async (ctx) => {
  const s = await Series.toggleStatus(Number(ctx.match[1]));
  await ctx.answerCallbackQuery({ text: s.status === 'completed' ? '✅ Tugagan' : '🔄 Davom etmoqda' });
  await seriesAdminCard(ctx, s.id);
});

adminSeriesHandler.callbackQuery(/^a:srdel:(\d+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const s = await Series.getById(Number(ctx.match[1]));
  const n = await Series.countEpisodes(Number(ctx.match[1]));
  await show(
    ctx,
    `⚠️ <b>${esc(s?.title || '')}</b> seriali va uning <b>${n}</b> ta qismi butunlay o'chirilsinmi?`,
    new InlineKeyboard().text('🗑 Ha, o\'chirish', `a:srdelyes:${ctx.match[1]}`).text('✖️ Yo\'q', `a:sr:${ctx.match[1]}`),
  );
});

adminSeriesHandler.callbackQuery(/^a:srdelyes:(\d+)$/, async (ctx) => {
  await Series.deleteSeries(Number(ctx.match[1]));
  await ctx.answerCallbackQuery({ text: 'O\'chirildi' });
  await show(ctx, '🗑 Serial o\'chirildi.', new InlineKeyboard().text('◀️ Ro\'yxat', 'a:series:0'));
});

// ==================== Poster ====================
adminSeriesHandler.callbackQuery(/^a:srposter:(\d+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  await setState(ctx.from.id, { step: 'series_poster', id: Number(ctx.match[1]) });
  await ctx.reply(
    '🖼 <b>Serial posterini yuboring</b> (rasm sifatida).\n\n' +
    'ℹ️ Rasm serverga yuklanmaydi — faqat Telegram <code>file_id</code> saqlanadi.',
    { parse_mode: 'HTML', reply_markup: cancelKb() },
  );
});

adminSeriesHandler.callbackQuery(/^a:srposterdel:(\d+)$/, async (ctx) => {
  const s = await Series.clearPoster(Number(ctx.match[1]));
  await ctx.answerCallbackQuery({ text: '🗑 Poster olib tashlandi' });
  await ctx.reply(`🗑 <b>${esc(s.title)}</b> posteri olib tashlandi.`, { parse_mode: 'HTML' });
});

// ==================== Kanalga e'lon / xabar ====================
export async function postSeriesToChannel(api, s) {
  const { allChannels } = await import('../services/channels.js');
  let target = config.postChannel;
  if (!target) target = (await allChannels())[0]?.chat_id;
  if (!target) throw new Error('Kanal topilmadi');
  const n = await Series.countEpisodes(s.id);
  const text =
    `🆕 <b>YANGI SERIAL</b>\n\n📺 <b>${esc(s.title)}</b>${s.year ? ` (${s.year})` : ''}\n` +
    (s.country ? `🌐 ${esc(s.country)}\n` : '') +
    (s.genres?.length ? `🎭 ${esc(s.genres.join(', '))}\n` : '') +
    (s.quality ? `💿 ${esc(s.quality)}\n` : '') +
    `🎬 Qismlar: <b>${n}</b> ${s.status === 'completed' ? '(to\'liq ✅)' : '(davom etmoqda 🔄)'}\n` +
    `\n🔢 <b>Kod:</b> <code>${esc(s.code)}</code>\n\n👇 Barcha qismlarni botdan ko'ring:`;
  const keyboard = new InlineKeyboard()
    .url('📺 Serialni ko\'rish', `https://t.me/${config.username}?start=serial_${s.code}`).row()
    .url('🔍 Boshqa kinolar', `https://t.me/${config.username}?start=search`);

  if (s.poster_file_id) {
    try {
      return await api.sendPhoto(target, s.poster_file_id, {
        caption: text.slice(0, 1024), parse_mode: 'HTML', reply_markup: keyboard,
      });
    } catch (e) {
      console.warn(`[post] serial posteri yuborilmadi (${s.code}): ${e.description || e.message}`);
    }
  }

  return api.sendMessage(target, text, {
    parse_mode: 'HTML',
    link_preview_options: { is_disabled: true },
    reply_markup: keyboard,
  });
}

adminSeriesHandler.callbackQuery(/^a:srpost:(\d+)$/, async (ctx) => {
  const s = await Series.getById(Number(ctx.match[1]));
  if (!s) return ctx.answerCallbackQuery({ text: 'Topilmadi', show_alert: true });
  try {
    const r = await postSeriesToChannel(ctx.api, s);
    await ctx.answerCallbackQuery({ text: '📣 Joylandi' });
    await ctx.reply(`📣 Kanalga e'lon joylandi (post #${r.message_id}).`);
  } catch (e) {
    await ctx.answerCallbackQuery();
    await ctx.reply(`❌ ${esc(e.description || e.message)}`, { parse_mode: 'HTML' });
  }
});

adminSeriesHandler.callbackQuery(/^a:srnotify:(\d+)$/, async (ctx) => {
  const s = await Series.getById(Number(ctx.match[1]));
  if (!s) return ctx.answerCallbackQuery({ text: 'Topilmadi', show_alert: true });
  await ctx.answerCallbackQuery({ text: 'Yuborish boshlandi' });
  const Users = await import('../services/users.js');
  const { sleep } = await import('../lib/utils.js');
  const ids = await Users.notifyTargets(s.genres);
  const n = await Series.countEpisodes(s.id);
  const text =
    `🆕 <b>Yangi serial: ${esc(s.title)}</b>${s.year ? ` (${s.year})` : ''}\n` +
    (s.genres?.length ? `🎭 ${esc(s.genres.join(', '))}\n` : '') +
    `🎬 ${n} qism\n\n🔢 Kod: <code>${esc(s.code)}</code>`;
  const kb = new InlineKeyboard().text('📺 Ko\'rish', `sr:${s.id}:0`);
  let sent = 0;
  const status = await ctx.reply(`📤 0/${ids.length}`);
  for (let i = 0; i < ids.length; i++) {
    await ctx.api.sendMessage(ids[i], text, { parse_mode: 'HTML', reply_markup: kb })
      .then(() => { sent++; })
      .catch(async (e) => { if (e?.error_code === 403) await Users.markStopped(ids[i]).catch(() => {}); });
    if (i % 20 === 19) await sleep(1000);
  }
  await ctx.api.editMessageText(status.chat.id, status.message_id, `✅ Xabar yuborildi: ${sent} ta`).catch(() => {});
});
