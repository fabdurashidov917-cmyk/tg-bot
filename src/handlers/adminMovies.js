import { Composer, InlineKeyboard } from 'grammy';
import { adminMain, cancelKb, mainMenu } from '../lib/keyboards.js';
import { esc, nf, fmtDate, parseCaption } from '../lib/utils.js';
import * as Movies from '../services/movies.js';
import * as Requests from '../services/requests.js';
import { setState, clearState } from '../lib/state.js';
import { sendMovie } from '../lib/send.js';
import { isAdmin } from '../lib/auth.js';
import { config } from '../config.js';
import { allChannels } from '../services/channels.js';

export const adminMoviesHandler = new Composer();
const PER = 8;

const FILE_FIELDS = [
  ['video', (m) => m.video?.file_id],
  ['document', (m) => m.document?.file_id],
  ['photo', (m) => m.photo?.at(-1)?.file_id],
  ['audio', (m) => m.audio?.file_id],
  ['animation', (m) => m.animation?.file_id],
];

/** Xabardan fayl ajratib olish */
export function extractFile(msg) {
  for (const [type, get] of FILE_FIELDS) {
    const id = get(msg);
    if (id) {
      // Videoning nishonchasi (thumbnail) — keyinchalik poster o'rnida ishlatish uchun.
      // Bu ham file_id, fayl serverga tushmaydi.
      const thumb = msg.video?.thumbnail?.file_id || msg.document?.thumbnail?.file_id || msg.animation?.thumbnail?.file_id || null;
      return { fileType: type, fileId: id, thumbFileId: thumb };
    }
  }
  return null;
}

const show = async (ctx, text, kb) => {
  const opts = { parse_mode: 'HTML', reply_markup: kb, link_preview_options: { is_disabled: true } };
  if (ctx.callbackQuery) { try { return await ctx.editMessageText(text, opts); } catch { /* ignore */ } }
  return ctx.reply(text, opts);
};

// ---------- Kino qo'shish ----------
adminMoviesHandler.callbackQuery('a:addmovie', async (ctx) => {
  await ctx.answerCallbackQuery();
  await setState(ctx.from.id, { step: 'movie_file' });
  await show(
    ctx,
    '🎬 <b>Kino qo\'shish</b>\n\n1️⃣ Kino faylini yuboring (video / hujjat / rasm / audio).\n\n' +
    '💡 Agar faylni <b>izoh (caption) bilan</b> yuborsangiz, izoh avtomatik olinadi — keyin faqat kod so\'raladi.',
    cancelKb(),
  );
});

/** Fayl qabul qilish (state: movie_file | movie_editfile) */
export async function handleMovieFile(ctx, state) {
  const f = extractFile(ctx.message);
  if (!f) { await ctx.reply('❌ Bu fayl turi qo\'llanmaydi. Video, hujjat, rasm yoki audio yuboring.'); return true; }

  if (state.step === 'movie_editfile') {
    const m = await Movies.updateFile(state.id, f.fileId, f.fileType);
    await clearState(ctx.from.id);
    await ctx.reply(`✅ <code>${esc(m.code)}</code> kinosining fayli almashtirildi.`, { parse_mode: 'HTML', reply_markup: mainMenu(true) });
    return true;
  }

  const caption = ctx.message.caption?.trim();
  if (caption) {
    await setState(ctx.from.id, { step: 'movie_code', fileId: f.fileId, fileType: f.fileType, caption, thumbFileId: f.thumbFileId });
    const meta = parseCaption(caption);
    await ctx.reply(
      `✅ Fayl va izoh qabul qilindi.\n🎬 Aniqlangan nom: <b>${esc(meta.title || '—')}</b>` +
      (meta.year ? ` (${meta.year})` : '') +
      (meta.code ? `\n🔢 Izohdagi kod: <code>${esc(meta.code)}</code>` : '') +
      '\n\n🔢 Endi kino <b>kodini</b> yuboring:' +
      (meta.code ? `\n<i>(izohdagi kodni ishlatish uchun shuni yuboring: ${esc(meta.code)})</i>` : ''),
      { parse_mode: 'HTML', reply_markup: cancelKb() },
    );
    return true;
  }

  await setState(ctx.from.id, { step: 'movie_caption', fileId: f.fileId, fileType: f.fileType, thumbFileId: f.thumbFileId });
  await ctx.reply('✅ Fayl qabul qilindi.\n\n📝 Endi kino <b>izohini</b> yuboring (nom, davlat, janr, yil...):', {
    parse_mode: 'HTML', reply_markup: cancelKb(),
  });
  return true;
}

/** Matnli qadamlar */
export async function handleMovieText(ctx, state, text) {
  if (state.step === 'movie_caption') {
    await setState(ctx.from.id, { ...state, step: 'movie_code', caption: text });
    const meta = parseCaption(text);
    await ctx.reply(
      `✅ Izoh saqlandi. Aniqlangan nom: <b>${esc(meta.title || '—')}</b>\n\n🔢 Endi kino <b>kodini</b> yuboring:`,
      { parse_mode: 'HTML', reply_markup: cancelKb() },
    );
    return true;
  }

  if (state.step === 'movie_code') {
    const code = text.trim();
    if (!/^[\w-]{1,20}$/.test(code)) { await ctx.reply('❌ Kod 1–20 belgidan iborat bo\'lsin (harf, raqam, - , _).'); return true; }
    const exists = await Movies.getByCodeAny(code);
    if (exists) {
      await ctx.reply(
        `⚠️ <code>${esc(code)}</code> kodi band: <b>${esc(exists.title || '-')}</b>\n\nBoshqa kod yuboring yoki almashtirishni tasdiqlang.`,
        { parse_mode: 'HTML', reply_markup: new InlineKeyboard().text('🔄 Eski kinoni almashtirish', `a:mvreplace:${exists.id}`).row().text('✖️ Bekor qilish', 'a:cancel') },
      );
      await setState(ctx.from.id, { ...state, pendingCode: code });
      return true;
    }
    const movie = await Movies.insertMovie({
      code, caption: state.caption, fileId: state.fileId, fileType: state.fileType,
      addedBy: ctx.from.id, thumbFileId: state.thumbFileId || null,
    });
    await clearState(ctx.from.id);
    await afterAdd(ctx, movie);
    return true;
  }

  if (state.step === 'movie_editcap') {
    const m = await Movies.updateCaption(state.id, text);
    await clearState(ctx.from.id);
    await ctx.reply(`✅ Izoh yangilandi. Nom: <b>${esc(m.title || '-')}</b>`, { parse_mode: 'HTML', reply_markup: mainMenu(true) });
    return true;
  }

  if (state.step === 'movie_editcode') {
    const code = text.trim();
    const exists = await Movies.getByCodeAny(code);
    if (exists && exists.id !== state.id) { await ctx.reply('❌ Bu kod band.'); return true; }
    const m = await Movies.updateCode(state.id, code);
    await clearState(ctx.from.id);
    await ctx.reply(`✅ Yangi kod: <code>${esc(m.code)}</code>`, { parse_mode: 'HTML', reply_markup: mainMenu(true) });
    return true;
  }

  if (state.step === 'movie_find') {
    await clearState(ctx.from.id);
    const { exact, list } = await Movies.search(text, 10);
    const found = exact ? [exact] : list;
    if (!found.length) { await ctx.reply('❌ Topilmadi.', { reply_markup: mainMenu(true) }); return true; }
    const kb = new InlineKeyboard();
    found.forEach((m) => kb.text(`${m.code} — ${(m.title || '').slice(0, 25)}`, `a:mv:${m.id}`).row());
    kb.text('◀️ Admin panel', 'a:home');
    await ctx.reply(`🔎 ${found.length} ta natija:`, { reply_markup: kb });
    return true;
  }

  return false;
}

/**
 * Kanalga e'lon posti. Faylning O'ZI yuborilmaydi (aks holda kanaldan yuklab olinadi),
 * faqat e'lon + poster rasmi + botga havola.
 * Poster ham Telegram `file_id` bilan ketadi — rasm VPS ga tushmaydi.
 */
export async function postToChannel(api, movie) {
  let target = config.postChannel;
  if (!target) {
    const chs = await allChannels();
    target = chs[0]?.chat_id;
  }
  if (!target) throw new Error('Kanal topilmadi. .env da POST_CHANNEL ni ko\'rsating yoki kanal qo\'shing.');

  const bits = [movie.year, movie.quality, movie.lang].filter(Boolean).join(' • ');
  const text =
    `🆕 <b>YANGI KINO</b>\n\n🎬 <b>${esc(movie.title || '-')}</b>\n` +
    (bits ? `${esc(bits)}\n` : '') +
    (movie.country ? `🌐 ${esc(movie.country)}\n` : '') +
    (movie.genres?.length ? `🎭 ${esc(movie.genres.join(', '))}\n` : '') +
    (movie.rating ? `⭐️ Reyting: ${esc(movie.rating)}\n` : '') +
    `\n🔢 <b>Kod:</b> <code>${esc(movie.code)}</code>\n\n` +
    `👇 Kinoni olish uchun tugmani bosing`;

  const keyboard = new InlineKeyboard()
    .url('🍿 Kinoni olish', `https://t.me/${config.username}?start=kino_${movie.code}`)
    .row()
    .url('🔍 Boshqa kinolar', `https://t.me/${config.username}?start=search`);

  const poster = Movies.posterOf(movie);
  if (poster) {
    try {
      return await api.sendPhoto(target, poster, {
        caption: text.slice(0, 1024),
        parse_mode: 'HTML',
        reply_markup: keyboard,
      });
    } catch (e) {
      // Poster ishlamasa (masalan nishoncha file_id qabul qilinmasa) — matnli e'lon
      console.warn(`[post] poster yuborilmadi (${movie.code}): ${e.description || e.message}`);
    }
  }

  return api.sendMessage(target, text, {
    parse_mode: 'HTML',
    link_preview_options: { is_disabled: true },
    reply_markup: keyboard,
  });
}

adminMoviesHandler.callbackQuery(/^a:mvpost:(\d+)$/, async (ctx) => {
  if (!(await isAdmin(ctx.from.id))) return ctx.answerCallbackQuery({ text: '⛔', show_alert: true });
  const m = await Movies.getById(Number(ctx.match[1]));
  if (!m) return ctx.answerCallbackQuery({ text: 'Topilmadi', show_alert: true });
  try {
    const res = await postToChannel(ctx.api, m);
    await ctx.answerCallbackQuery({ text: '📣 Kanalga joylandi' });
    await ctx.reply(`📣 Kanalga e'lon joylandi (post #${res.message_id}).`);
  } catch (e) {
    await ctx.answerCallbackQuery({ text: 'Xato', show_alert: false });
    await ctx.reply(`❌ Kanalga joylanmadi: ${esc(e.description || e.message)}\n\n💡 Bot kanalda <b>post yuborish</b> huquqiga ega admin bo'lishi kerak.`, { parse_mode: 'HTML' });
  }
});

async function afterAdd(ctx, movie) {
  const kb = new InlineKeyboard()
    .text('📣 Kanalga e\'lon', `a:mvpost:${movie.id}`).text('📢 Obunachilarga xabar', `a:mvnotify:${movie.id}`).row()
    .text('👁 Ko\'rib chiqish', `a:mvsend:${movie.id}`).text('✏️ Tahrirlash', `a:mv:${movie.id}`).row()
    .text('➕ Yana qo\'shish', 'a:addmovie').text('◀️ Admin panel', 'a:home');
  await ctx.reply(
    `✅ <b>Kino qo'shildi!</b>\n\n🎬 ${esc(movie.title || '-')}\n🔢 Kod: <code>${esc(movie.code)}</code>\n` +
    `${movie.year ? `📅 Yil: ${movie.year}\n` : ''}${movie.genres?.length ? `🎭 ${esc(movie.genres.join(', '))}\n` : ''}` +
    `\n🔗 Havola: <code>https://t.me/${config.username}?start=kino_${esc(movie.code)}</code>`,
    { parse_mode: 'HTML', reply_markup: kb },
  );

  // Maxfiy kanalga zaxira nusxa
  if (config.secretChannel) {
    try {
      await sendMovie(ctx.api, config.secretChannel, movie, { userId: ctx.from.id, source: 'backup', buttons: false });
    } catch (e) { console.warn('[addmovie] maxfiy kanalga yuborilmadi:', e.message); }
  }

  // Shu kinoni so'ragan odamlarga xabar
  await notifyRequesters(ctx, movie);
}

adminMoviesHandler.callbackQuery(/^a:mvreplace:(\d+)$/, async (ctx) => {
  const { getState } = await import('../lib/state.js');
  const st = await getState(ctx.from.id);
  if (!st?.pendingCode) return ctx.answerCallbackQuery({ text: 'Muddati o\'tdi', show_alert: true });
  await Movies.updateFile(Number(ctx.match[1]), st.fileId, st.fileType);
  const m = await Movies.updateCaption(Number(ctx.match[1]), st.caption);
  await clearState(ctx.from.id);
  await ctx.answerCallbackQuery({ text: 'Almashtirildi' });
  await ctx.reply(`✅ <code>${esc(m.code)}</code> kinosi yangilandi.`, { parse_mode: 'HTML' });
});

// ---------- Kinolar ro'yxati ----------
adminMoviesHandler.callbackQuery(/^a:movies:(\d+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const page = Number(ctx.match[1]);
  const total = await Movies.countAll();
  const list = await Movies.listPage(PER, page * PER);
  const pages = Math.max(1, Math.ceil(total / PER));
  let text = `🎬 <b>Kinolar</b> — jami ${nf(total)} ta\n\n`;
  const kb = new InlineKeyboard();
  list.forEach((m) => {
    text += `${m.is_active ? '✅' : '🚫'} <code>${esc(m.code)}</code> — ${esc(m.title || '-')} • 👁 ${nf(m.views)}\n`;
    kb.text(`${m.code}`, `a:mv:${m.id}`);
  });
  kb.row();
  if (pages > 1) {
    if (page > 0) kb.text('◀️', `a:movies:${page - 1}`);
    kb.text(`${page + 1}/${pages}`, 'noop');
    if (page < pages - 1) kb.text('▶️', `a:movies:${page + 1}`);
    kb.row();
  }
  kb.text('🔎 Kod/nom bo\'yicha topish', 'a:mvfind').row();
  kb.text('➕ Qo\'shish', 'a:addmovie').text('◀️ Orqaga', 'a:home');
  await show(ctx, text, kb);
});

adminMoviesHandler.callbackQuery('a:mvfind', async (ctx) => {
  await ctx.answerCallbackQuery();
  await setState(ctx.from.id, { step: 'movie_find' });
  await show(ctx, '🔎 Kino kodi yoki nomini yuboring:', cancelKb());
});

adminMoviesHandler.callbackQuery(/^a:mv:(\d+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  await movieCard(ctx, Number(ctx.match[1]));
});

async function movieCard(ctx, id) {
  const m = await Movies.getById(id);
  if (!m) return show(ctx, '❌ Kino topilmadi.', adminMain());
  const text =
    `🎬 <b>${esc(m.title || '-')}</b>\n` +
    `🔢 Kod: <code>${esc(m.code)}</code>\n` +
    `📅 Yil: ${m.year || '-'} | 💿 ${esc(m.quality || '-')}\n` +
    `🌐 ${esc(m.country || '-')} | 🔊 ${esc(m.lang || '-')}\n` +
    `🎭 ${esc(m.genres?.join(', ') || '-')}\n` +
    `👁 Ko'rilgan: <b>${nf(m.views)}</b>\n` +
    `📦 Fayl turi: ${m.file_type}\n` +
    `🖼 Poster: ${m.poster_file_id ? 'bor ✅' : 'yo\'q — e\'lon matnli chiqadi'}\n` +
    `🟢 Holat: ${m.is_active ? 'faol' : 'o\'chirilgan'}\n` +
    `🕐 ${fmtDate(m.created_at)}`;
  const kb = new InlineKeyboard()
    .text('👁 Ko\'rish', `a:mvsend:${m.id}`).text('📢 Xabar berish', `a:mvnotify:${m.id}`).row()
    .text('📣 Kanalga e\'lon', `a:mvpost:${m.id}`).row()
    .text('📝 Izoh', `a:mvcap:${m.id}`).text('🔢 Kod', `a:mvcode:${m.id}`).row()
    .text('🔄 Faylni almashtirish', `a:mvfile:${m.id}`).text('🎚 Variantlar', `a:mvvars:${m.id}`).row()
    .text(m.poster_file_id ? '🖼 Posterni almashtirish' : '🖼 Poster qo\'shish', `a:mvposter:${m.id}`);
  if (m.poster_file_id) kb.text('🗑 Posterni o\'chirish', `a:mvposterdel:${m.id}`);
  kb.row()
    .text(m.is_active ? '🚫 O\'chirib qo\'yish' : '✅ Yoqish', `a:mvtoggle:${m.id}`)
    .text('🗑 O\'chirish', `a:mvdel:${m.id}`).row()
    .text('◀️ Ro\'yxat', 'a:movies:0');
  return show(ctx, text, kb);
}

adminMoviesHandler.callbackQuery(/^a:mvsend:(\d+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const m = await Movies.getById(Number(ctx.match[1]));
  if (m) await sendMovie(ctx.api, ctx.chat.id, m, { userId: ctx.from.id, source: 'admin' }).catch((e) => ctx.reply(`❌ ${esc(e.message)}`, { parse_mode: 'HTML' }));
});

adminMoviesHandler.callbackQuery(/^a:mvcap:(\d+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  await setState(ctx.from.id, { step: 'movie_editcap', id: Number(ctx.match[1]) });
  await show(ctx, '📝 Yangi izohni yuboring:', cancelKb());
});

adminMoviesHandler.callbackQuery(/^a:mvcode:(\d+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  await setState(ctx.from.id, { step: 'movie_editcode', id: Number(ctx.match[1]) });
  await show(ctx, '🔢 Yangi kodni yuboring:', cancelKb());
});

adminMoviesHandler.callbackQuery(/^a:mvfile:(\d+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  await setState(ctx.from.id, { step: 'movie_editfile', id: Number(ctx.match[1]) });
  await show(ctx, '🔄 Yangi faylni yuboring:', cancelKb());
});

adminMoviesHandler.callbackQuery(/^a:mvtoggle:(\d+)$/, async (ctx) => {
  const m = await Movies.toggleActive(Number(ctx.match[1]));
  await ctx.answerCallbackQuery({ text: m.is_active ? 'Yoqildi' : 'O\'chirildi' });
  await movieCard(ctx, m.id);
});

adminMoviesHandler.callbackQuery(/^a:mvdel:(\d+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const m = await Movies.getById(Number(ctx.match[1]));
  await show(
    ctx,
    `⚠️ <b>${esc(m?.title || '')}</b> (<code>${esc(m?.code || '')}</code>) butunlay o'chirilsinmi?`,
    new InlineKeyboard().text('🗑 Ha, o\'chirish', `a:mvdelyes:${ctx.match[1]}`).text('✖️ Yo\'q', `a:mv:${ctx.match[1]}`),
  );
});

adminMoviesHandler.callbackQuery(/^a:mvdelyes:(\d+)$/, async (ctx) => {
  await Movies.deleteMovie(Number(ctx.match[1]));
  await ctx.answerCallbackQuery({ text: 'O\'chirildi' });
  await show(ctx, '🗑 Kino o\'chirildi.', new InlineKeyboard().text('◀️ Ro\'yxat', 'a:movies:0'));
});

// ---------- Yangi kino haqida xabar ----------
adminMoviesHandler.callbackQuery(/^a:mvnotify:(\d+)$/, async (ctx) => {
  if (!(await isAdmin(ctx.from.id))) return ctx.answerCallbackQuery({ text: '⛔', show_alert: true });
  const m = await Movies.getById(Number(ctx.match[1]));
  if (!m) return ctx.answerCallbackQuery({ text: 'Topilmadi', show_alert: true });
  await ctx.answerCallbackQuery({ text: 'Yuborish boshlandi' });
  const { broadcastNewMovie } = await import('./adminBroadcast.js');
  broadcastNewMovie(ctx, m).catch((e) => console.error('[notify]', e));
});

// ============ 1) Forward / caption bilan TEZKOR qo'shish ============
export const quickAddHandler = new Composer();

quickAddHandler.on('message', async (ctx, next) => {
  if (!ctx.isAdmin || ctx.chat?.type !== 'private') return next();
  const f = extractFile(ctx.message);
  if (!f) return next();

  const { getState } = await import('../lib/state.js');
  if (await getState(ctx.from.id)) return next();   // sehrgar ishlayotgan bo'lsa tegmaymiz

  const caption = ctx.message.caption?.trim();
  const forwarded = !!(ctx.message.forward_origin || ctx.message.forward_from_chat || ctx.message.forward_date);
  if (!caption && !forwarded) return next();        // izohsiz oddiy fayl — sehrgarga qoldiramiz

  const meta = parseCaption(caption || '');
  let code = meta.code && /^[\w-]{1,20}$/.test(meta.code) ? meta.code : null;
  let autoCode = false;
  if (!code) { code = await Movies.nextFreeCode(); autoCode = true; }

  const exists = await Movies.getByCodeAny(code);
  if (exists) {
    await ctx.reply(
      `⚠️ <code>${esc(code)}</code> kodi band: <b>${esc(exists.title || '-')}</b>`,
      {
        parse_mode: 'HTML',
        reply_markup: new InlineKeyboard()
          .text('🔄 Faylni almashtirish', `a:mvquickrep:${exists.id}:${f.fileType}`).row()
          .text('🆕 Yangi kod bilan qo\'shish', `a:mvquicknew:${exists.id}`),
      },
    );
    // fayl ma'lumotini vaqtincha saqlaymiz
    const { setState } = await import('../lib/state.js');
    await setState(ctx.from.id, { step: 'quick_conflict', fileId: f.fileId, fileType: f.fileType, caption: caption || '', thumbFileId: f.thumbFileId });
    return;
  }

  const movie = await Movies.insertMovie({
    code, caption: caption || `🎬 Kod: ${code}`, fileId: f.fileId, fileType: f.fileType,
    addedBy: ctx.from.id, thumbFileId: f.thumbFileId || null,
  });

  await ctx.reply(
    `✅ <b>${esc(movie.title || 'Nomsiz')}</b> qo'shildi\n` +
    `🔢 Kod: <code>${esc(movie.code)}</code>${autoCode ? ' <i>(avtomatik)</i>' : ''}` +
    `${movie.year ? ` • ${movie.year}` : ''}${movie.genres?.length ? ` • ${esc(movie.genres.join(', '))}` : ''}`,
    {
      parse_mode: 'HTML',
      reply_markup: new InlineKeyboard()
        .text('📣 Kanalga', `a:mvpost:${movie.id}`).text('📢 Xabar', `a:mvnotify:${movie.id}`)
        .text('✏️', `a:mv:${movie.id}`),
    },
  );

  if (config.secretChannel) {
    sendMovie(ctx.api, config.secretChannel, movie, { userId: ctx.from.id, source: 'backup', buttons: false })
      .catch((e) => console.warn('[quickadd] maxfiy kanal:', e.message));
  }
  await notifyRequesters(ctx, movie);
});

/** Konflikt tugmalari */
adminMoviesHandler.callbackQuery(/^a:mvquickrep:(\d+):(\w+)$/, async (ctx) => {
  const { getState, clearState } = await import('../lib/state.js');
  const st = await getState(ctx.from.id);
  if (st?.step !== 'quick_conflict') return ctx.answerCallbackQuery({ text: 'Muddati o\'tdi', show_alert: true });
  await Movies.updateFile(Number(ctx.match[1]), st.fileId, st.fileType);
  if (st.caption) await Movies.updateCaption(Number(ctx.match[1]), st.caption);
  await clearState(ctx.from.id);
  await ctx.answerCallbackQuery({ text: '🔄 Almashtirildi' });
  await ctx.editMessageText('🔄 Fayl va izoh almashtirildi.').catch(() => {});
});

adminMoviesHandler.callbackQuery(/^a:mvquicknew:(\d+)$/, async (ctx) => {
  const { getState, clearState } = await import('../lib/state.js');
  const st = await getState(ctx.from.id);
  if (st?.step !== 'quick_conflict') return ctx.answerCallbackQuery({ text: 'Muddati o\'tdi', show_alert: true });
  const code = await Movies.nextFreeCode();
  const movie = await Movies.insertMovie({
    code, caption: st.caption || `🎬 Kod: ${code}`, fileId: st.fileId, fileType: st.fileType,
    addedBy: ctx.from.id, thumbFileId: st.thumbFileId || null,
  });
  await clearState(ctx.from.id);
  await ctx.answerCallbackQuery({ text: `✅ ${code}` });
  await ctx.editMessageText(
    `✅ <b>${esc(movie.title || 'Nomsiz')}</b> yangi kod bilan qo'shildi: <code>${esc(movie.code)}</code>`,
    { parse_mode: 'HTML', reply_markup: new InlineKeyboard().text('✏️ Tahrirlash', `a:mv:${movie.id}`) },
  ).catch(() => {});
});

/** So'ragan odamlarga xabar (afterAdd dan ajratildi) */
async function notifyRequesters(ctx, movie) {
  if (!movie.title) return;
  const reqs = await Requests.findRequesters(movie.title).catch(() => []);
  for (const r of reqs) {
    await ctx.api.sendMessage(
      r.user_id,
      `🎉 So'ragan kinongiz qo'shildi!\n\n🎬 <b>${esc(movie.title)}</b>\n🔢 Kod: <code>${esc(movie.code)}</code>`,
      { parse_mode: 'HTML', reply_markup: new InlineKeyboard().text('🍿 Olish', `m:get:${movie.code}`) },
    ).catch(() => {});
    await Requests.setRequestStatus(r.id, 'done').catch(() => {});
  }
}

// ============ 3) Sifat / til variantlari (admin) ============
adminMoviesHandler.callbackQuery(/^a:mvvars:(\d+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  await variantsView(ctx, Number(ctx.match[1]));
});

async function variantsView(ctx, movieId) {
  const m = await Movies.getById(movieId);
  const list = await Movies.listVariants(movieId);
  let text = `🎚 <b>${esc(m?.title || '')}</b> variantlari (${list.length} ta)\n\n`;
  if (!list.length) text += '<i>Variant yo\'q. Asosiy fayldan tashqari 720p/480p yoki ruscha dublyaj qo\'shishingiz mumkin.</i>\n';
  const kb = new InlineKeyboard();
  list.forEach((v) => {
    text += `• <b>${esc(v.label)}</b> (${v.file_type})\n`;
    kb.text(`🗑 ${v.label}`, `a:mvvardel:${v.id}`).row();
  });
  kb.text('➕ Variant qo\'shish', `a:mvvaradd:${movieId}`).row().text('◀️ Kino', `a:mv:${movieId}`);
  const opts = { parse_mode: 'HTML', reply_markup: kb };
  try { await ctx.editMessageText(text, opts); } catch { await ctx.reply(text, opts); }
}

adminMoviesHandler.callbackQuery(/^a:mvvaradd:(\d+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  await setState(ctx.from.id, { step: 'variant_file', id: Number(ctx.match[1]) });
  await ctx.reply('🎚 Variant faylini yuboring (masalan 720p yoki ruscha dublyaj):', { reply_markup: cancelKb() });
});

adminMoviesHandler.callbackQuery(/^a:mvvardel:(\d+)$/, async (ctx) => {
  const v = await Movies.getVariant(Number(ctx.match[1]));
  await Movies.deleteVariant(Number(ctx.match[1]));
  await ctx.answerCallbackQuery({ text: '🗑 O\'chirildi' });
  if (v) await variantsView(ctx, v.movie_id);
});

// ============ Poster (kanal e'loni uchun rasm) ============
adminMoviesHandler.callbackQuery(/^a:mvposter:(\d+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  await setState(ctx.from.id, { step: 'movie_poster', id: Number(ctx.match[1]) });
  await ctx.reply(
    '🖼 <b>Poster rasmini yuboring</b> (oddiy rasm sifatida).\n\n' +
    'ℹ️ Rasm serverga yuklanmaydi — faqat Telegram <code>file_id</code> si saqlanadi.\n' +
    'Bu rasm kanalga chiqadigan e\'londa ko\'rinadi. Tik (portret) rasm chiroyli chiqadi.',
    { parse_mode: 'HTML', reply_markup: cancelKb() },
  );
});

adminMoviesHandler.callbackQuery(/^a:mvposterdel:(\d+)$/, async (ctx) => {
  const m = await Movies.clearPoster(Number(ctx.match[1]));
  await ctx.answerCallbackQuery({ text: '🗑 Poster olib tashlandi' });
  await ctx.reply(`🗑 <code>${esc(m.code)}</code> posteri olib tashlandi.`, { parse_mode: 'HTML' });
});

/** Poster faylini qabul qilish (stateRouter dan) */
export async function handlePosterFile(ctx, state) {
  const photo = ctx.message.photo?.at(-1)?.file_id;
  const docPhoto = ctx.message.document?.mime_type?.startsWith('image/') ? ctx.message.document.file_id : null;
  const fileId = photo || docPhoto;
  if (!fileId) {
    await ctx.reply('❌ Rasm yuboring (photo). Video yoki boshqa fayl poster bo\'lmaydi.');
    return true;
  }
  if (state.step === 'series_poster') {
    const Series = await import('../services/series.js');
    const s = await Series.setPoster(state.id, fileId);
    await clearState(ctx.from.id);
    await ctx.reply(`✅ <b>${esc(s.title)}</b> seriali posteri saqlandi.`, {
      parse_mode: 'HTML',
      reply_markup: new InlineKeyboard().text('📣 Kanalga e\'lon', `a:srpost:${s.id}`).text('◀️ Serial', `a:sr:${s.id}`),
    });
    return true;
  }
  const m = await Movies.setPoster(state.id, fileId);
  await clearState(ctx.from.id);
  await ctx.reply(`✅ <b>${esc(m.title || m.code)}</b> posteri saqlandi.`, {
    parse_mode: 'HTML',
    reply_markup: new InlineKeyboard().text('📣 Kanalga e\'lon', `a:mvpost:${m.id}`).text('◀️ Kino', `a:mv:${m.id}`),
  });
  return true;
}

/** Variant qadamlari (stateRouter dan chaqiriladi) */
export async function handleVariantFile(ctx, state) {
  const f = extractFile(ctx.message);
  if (!f) { await ctx.reply('📎 Fayl yuboring.'); return true; }
  await setState(ctx.from.id, { step: 'variant_label', id: state.id, fileId: f.fileId, fileType: f.fileType });
  await ctx.reply('🏷 Variant nomini yuboring (masalan: <code>720p</code>, <code>Ruscha</code>, <code>480p</code>):', {
    parse_mode: 'HTML', reply_markup: cancelKb(),
  });
  return true;
}

export async function handleVariantLabel(ctx, state, text) {
  const v = await Movies.addVariant(state.id, text, state.fileId, state.fileType);
  await clearState(ctx.from.id);
  await ctx.reply(`✅ <b>${esc(v.label)}</b> varianti qo'shildi.`, {
    parse_mode: 'HTML',
    reply_markup: new InlineKeyboard().text('🎚 Variantlar', `a:mvvars:${state.id}`),
  });
  return true;
}
