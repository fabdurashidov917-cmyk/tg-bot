import { Composer, InlineKeyboard } from 'grammy';
import * as Series from '../services/series.js';
import { esc, nf, chunk } from '../lib/utils.js';
import { mainMenu, BTN } from '../lib/keyboards.js';
import { requireSub, checkDailyLimit } from './common.js';
import { sendEpisode } from '../lib/send.js';
import { config } from '../config.js';

export const seriesHandler = new Composer();
const PER = 8;            // ro'yxatdagi seriallar
const EP_PER_PAGE = 40;   // bir sahifadagi qism tugmalari

const show = async (ctx, text, kb) => {
  const opts = { parse_mode: 'HTML', reply_markup: kb, link_preview_options: { is_disabled: true } };
  if (ctx.callbackQuery) { try { return await ctx.editMessageText(text, opts); } catch { /* ignore */ } }
  return ctx.reply(text, opts);
};

// ==================== Seriallar ro'yxati ====================
async function listView(ctx, page = 0) {
  if (!(await requireSub(ctx))) return;
  const total = await Series.countAll();
  if (!total) {
    return show(ctx, '📺 Hozircha serial qo\'shilmagan.\n\nTez orada qo\'shiladi! 🍿', null);
  }
  const list = await Series.listPage(PER, page * PER);
  const pages = Math.max(1, Math.ceil(total / PER));
  const cont = await Series.continueList(ctx.from.id, 3);

  let text = `📺 <b>Seriallar</b> — ${nf(total)} ta\n\n`;
  list.forEach((s, i) => {
    text += `${page * PER + i + 1}. <b>${esc(s.title)}</b>${s.year ? ` (${s.year})` : ''}\n`;
    text += `     🎬 ${nf(s.ep_count)} qism • ${s.status === 'completed' ? '✅ tugagan' : '🔄 davom etmoqda'} • <code>${esc(s.code)}</code>\n`;
  });
  if (cont.length) {
    text += '\n▶️ <b>Siz to\'xtagan joylar:</b>\n';
    cont.forEach((c) => { text += `• ${esc(c.title)} — ${c.episode}-qism\n`; });
  }

  const kb = new InlineKeyboard();
  chunk(list, 2).forEach((pair) => {
    pair.forEach((s) => kb.text(`📺 ${s.title.slice(0, 22)}`, `sr:${s.id}:0`));
    kb.row();
  });
  if (pages > 1) {
    if (page > 0) kb.text('◀️', `srlist:${page - 1}`);
    kb.text(`${page + 1}/${pages}`, 'noop');
    if (page < pages - 1) kb.text('▶️', `srlist:${page + 1}`);
    kb.row();
  }
  if (cont.length) kb.text('▶️ Davom ettirish', 'srcont').row();
  kb.text('🏠 Bosh menyu', 'm:home');
  return show(ctx, text, kb);
}

seriesHandler.command('seriallar', (ctx) => listView(ctx, 0));
seriesHandler.hears(BTN.series, (ctx) => listView(ctx, 0));
seriesHandler.callbackQuery(/^srlist:(\d+)$/, async (ctx) => {
  await ctx.answerCallbackQuery(); await listView(ctx, Number(ctx.match[1]));
});

// ==================== Serial kartochkasi ====================
export async function seriesCard(ctx, seriesId, page = 0) {
  if (!(await requireSub(ctx))) return;
  const s = await Series.getById(seriesId);
  if (!s || !s.is_active) return show(ctx, '❌ Serial topilmadi.', null);

  const eps = await Series.listEpisodes(seriesId);
  const prog = await Series.getProgress(ctx.from.id, seriesId);
  const fav = await Series.isFavorite(ctx.from.id, seriesId);
  const seasons = await Series.seasonList(seriesId);

  let text = `📺 <b>${esc(s.title)}</b>${s.year ? ` (${s.year})` : ''}\n`;
  if (s.country) text += `🌐 ${esc(s.country)}\n`;
  if (s.lang) text += `🔊 ${esc(s.lang)}\n`;
  if (s.genres?.length) text += `🎭 ${esc(s.genres.join(', '))}\n`;
  if (s.quality) text += `💿 ${esc(s.quality)}\n`;
  text += `🎬 Qismlar: <b>${nf(eps.length)}</b>${seasons.length > 1 ? ` (${seasons.length} fasl)` : ''}\n`;
  text += `${s.status === 'completed' ? '✅ To\'liq' : '🔄 Davom etmoqda'} • 👁 ${nf(s.views)}\n`;
  text += `🔢 Kod: <code>${esc(s.code)}</code>\n`;
  if (s.caption) text += `\n${esc(s.caption).slice(0, 400)}\n`;
  if (prog) text += `\n▶️ Siz <b>${prog.episode}-qism</b>da to'xtagansiz.\n`;
  if (!eps.length) text += '\n<i>Qismlar hali yuklanmagan.</i>';

  const kb = new InlineKeyboard();
  if (prog) {
    const next = await Series.neighbourEpisode(seriesId, prog.season, prog.episode, 1);
    if (next) kb.text(`▶️ Davom ettirish (${next.episode}-qism)`, `ep:${next.id}`).row();
    else kb.text(`🔁 ${prog.episode}-qismni qayta ko'rish`, `ep:at:${seriesId}:${prog.season}:${prog.episode}`).row();
  } else if (eps.length) {
    kb.text(`▶️ 1-qismdan boshlash`, `ep:${eps[0].id}`).row();
  }

  const pageEps = eps.slice(page * EP_PER_PAGE, (page + 1) * EP_PER_PAGE);
  chunk(pageEps, 5).forEach((row) => {
    row.forEach((e) => kb.text(prog && e.episode <= prog.episode ? `✅${e.episode}` : String(e.episode), `ep:${e.id}`));
    kb.row();
  });
  const epPages = Math.max(1, Math.ceil(eps.length / EP_PER_PAGE));
  if (epPages > 1) {
    if (page > 0) kb.text('⬅️ qismlar', `sr:${seriesId}:${page - 1}`);
    kb.text(`${page + 1}/${epPages}`, 'noop');
    if (page < epPages - 1) kb.text('qismlar ➡️', `sr:${seriesId}:${page + 1}`);
    kb.row();
  }
  kb.text(fav ? '💔 Sevimlidan olish' : '❤️ Sevimlilarga', `srfav:${seriesId}`)
    .switchInline('📤 Ulashish', s.code).row()
    .text('📺 Seriallar', 'srlist:0').text('🏠 Menyu', 'm:home');

  return show(ctx, text, kb);
}

seriesHandler.callbackQuery(/^sr:(\d+):(\d+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  await seriesCard(ctx, Number(ctx.match[1]), Number(ctx.match[2]));
});

seriesHandler.callbackQuery(/^srfav:(\d+)$/, async (ctx) => {
  const id = Number(ctx.match[1]);
  const fav = await Series.isFavorite(ctx.from.id, id);
  if (fav) { await Series.removeFavorite(ctx.from.id, id); await ctx.answerCallbackQuery({ text: '💔 Olindi' }); }
  else { await Series.addFavorite(ctx.from.id, id); await ctx.answerCallbackQuery({ text: '❤️ Qo\'shildi' }); }
  await seriesCard(ctx, id, 0);
});

// ==================== Qismni yuborish ====================
async function deliverEpisode(ctx, ep) {
  const s = await Series.getById(ep.series_id);
  if (!s) return;
  if (!(await requireSub(ctx))) return;
  if (!(await checkDailyLimit(ctx))) return;

  const prev = await Series.neighbourEpisode(s.id, ep.season, ep.episode, -1);
  const next = await Series.neighbourEpisode(s.id, ep.season, ep.episode, 1);
  const kb = new InlineKeyboard();
  if (prev) kb.text(`⏮ ${prev.episode}-qism`, `ep:${prev.id}`);
  if (next) kb.text(`⏭ ${next.episode}-qism`, `ep:${next.id}`);
  kb.row().text('📋 Barcha qismlar', `sr:${s.id}:0`).text('🏠 Menyu', 'm:home');

  await sendEpisode(ctx.api, ctx.chat.id, s, ep, kb, { userId: ctx.from.id });
  await Series.registerEpisodeView(ctx.from.id, ep).catch(() => {});

  if (!next && s.status === 'completed') {
    await ctx.reply('🎉 Serial tugadi! Boshqa seriallarni ko\'rish uchun 📺 <b>Seriallar</b> tugmasini bosing.', { parse_mode: 'HTML' });
  }
}

seriesHandler.callbackQuery(/^ep:(\d+)$/, async (ctx) => {
  const ep = await Series.getEpisode(Number(ctx.match[1]));
  if (!ep) return ctx.answerCallbackQuery({ text: 'Qism topilmadi', show_alert: true });
  await ctx.answerCallbackQuery({ text: `${ep.episode}-qism yuborilmoqda...` });
  await deliverEpisode(ctx, ep);
});

seriesHandler.callbackQuery(/^ep:at:(\d+):(\d+):(\d+)$/, async (ctx) => {
  const ep = await Series.getEpisodeAt(Number(ctx.match[1]), Number(ctx.match[2]), Number(ctx.match[3]));
  if (!ep) return ctx.answerCallbackQuery({ text: 'Qism topilmadi', show_alert: true });
  await ctx.answerCallbackQuery();
  await deliverEpisode(ctx, ep);
});

// ==================== Davom ettirish ====================
async function continueView(ctx) {
  const list = await Series.continueList(ctx.from.id, 10);
  if (!list.length) {
    return show(ctx, '▶️ Hali birorta serial ko\'rmagansiz.\n\n📺 <b>Seriallar</b> bo\'limidan boshlang!', null);
  }
  let text = '▶️ <b>Davom ettirish</b>\n\n';
  const kb = new InlineKeyboard();
  for (const c of list) {
    const left = Math.max(0, c.ep_count - c.episode);
    text += `📺 <b>${esc(c.title)}</b> — ${c.episode}/${nf(c.ep_count)} qism` + (left ? ` (${left} ta qoldi)` : ' ✅') + '\n';
    const next = await Series.neighbourEpisode(c.series_id, c.season, c.episode, 1);
    kb.text(next ? `▶️ ${c.title.slice(0, 18)} — ${next.episode}-qism` : `📋 ${c.title.slice(0, 20)}`,
      next ? `ep:${next.id}` : `sr:${c.series_id}:0`).row();
  }
  kb.text('📺 Seriallar', 'srlist:0').text('🏠 Menyu', 'm:home');
  return show(ctx, text, kb);
}

seriesHandler.command('davom', continueView);
seriesHandler.callbackQuery('srcont', async (ctx) => { await ctx.answerCallbackQuery(); await continueView(ctx); });

// ==================== Inline/qidiruvdan foydalanish uchun ====================
export async function seriesByCodeOrTitle(query) {
  const raw = String(query || '').trim();
  const exact = await Series.getByCode(raw);
  if (exact) return [exact];
  return Series.search(raw, 5);
}

export { Series };
