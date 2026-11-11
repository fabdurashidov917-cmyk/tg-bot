import { Composer, InlineKeyboard } from 'grammy';
import { esc, movieLine } from '../lib/utils.js';
import * as Movies from '../services/movies.js';
import * as Series from '../services/series.js';
import * as Users from '../services/users.js';
import { listKeyboard, mainMenu } from '../lib/keyboards.js';
import { requireSub, deliver } from './common.js';
import { setState } from '../lib/state.js';

export const searchHandler = new Composer();

searchHandler.on('message:text', async (ctx) => {
  const text = ctx.message.text.trim();
  if (!text || text.startsWith('/')) return;
  if (text.length > 100) return ctx.reply('⚠️ Qidiruv matni juda uzun. Qisqaroq yozing.');

  if (!(await requireSub(ctx))) return;

  await Users.bumpSearch(ctx.from.id).catch(() => {});

  // Serial kodi aniq mos kelsa — serial kartochkasi
  const serExact = await Series.getByCode(text);
  if (serExact) {
    await Movies.logSearch(ctx.from.id, text, true).catch(() => {});
    const { seriesCard } = await import('./series.js');
    await seriesCard(ctx, serExact.id, 0);
    return;
  }

  const { exact, list } = await Movies.search(text, 12);
  const serHits = await Series.search(text, 5);
  await Movies.logSearch(ctx.from.id, text, !!(exact || list.length || serHits.length)).catch(() => {});

  if (exact) {
    await deliver(ctx, exact, 'search');
    if (serHits.length) {
      const kb = new InlineKeyboard();
      serHits.forEach((x) => kb.text(`📺 ${x.title.slice(0, 24)} (${x.ep_count} qism)`, `sr:${x.id}:0`).row());
      await ctx.reply('📺 Shu nom bo\'yicha <b>serial</b> ham bor:', { parse_mode: 'HTML', reply_markup: kb });
    }
    return;
  }

  if (!list.length && serHits.length === 1) {
    const { seriesCard } = await import('./series.js');
    await seriesCard(ctx, serHits[0].id, 0);
    return;
  }

  if (list.length || serHits.length) {
    let out = `🔍 <b>${list.length + serHits.length} ta natija</b> — «${esc(text)}»\n\n`;
    list.forEach((m, i) => { out += `${movieLine(m, i + 1)}\n`; });
    if (serHits.length) {
      out += '\n📺 <b>Seriallar:</b>\n';
      serHits.forEach((x) => { out += `• <b>${esc(x.title)}</b>${x.year ? ` (${x.year})` : ''} — ${x.ep_count} qism — <code>${esc(x.code)}</code>\n`; });
    }
    out += '\n💡 <b>Kodini</b> yuboring yoki tugmani bosing.';
    const kb = list.length ? listKeyboard(list, { page: 0, pages: 1, prefix: 'm:latest' }) : new InlineKeyboard();
    serHits.forEach((x) => kb.text(`📺 ${x.title.slice(0, 24)}`, `sr:${x.id}:0`).row());
    await ctx.reply(out, { parse_mode: 'HTML', reply_markup: kb, link_preview_options: { is_disabled: true } });
    return;
  }

  // Typo taklifi — "balki shuni izladingiz?"
  const isCode = /^\d{1,12}$/.test(text);
  if (!isCode) {
    const near = await Movies.suggestSimilar(text, 3);
    if (near.length) {
      const kb = new InlineKeyboard();
      near.forEach((m) => kb.text(`🎬 ${(m.title || m.code).slice(0, 30)}`, `m:get:${m.code}`).row());
      kb.text('📩 Yo\'q, shu kinoni so\'rang', `m:req:${Buffer.from(text).toString('base64url').slice(0, 50)}`);
      await ctx.reply(
        `🤔 «${esc(text)}» topilmadi. <b>Balki shuni izladingiz?</b>`,
        { parse_mode: 'HTML', reply_markup: kb },
      );
      return;
    }
  }

  await ctx.reply(
    (isCode
      ? `❌ <b>${esc(text)}</b> kodi bo'yicha kino topilmadi.`
      : `❌ «${esc(text)}» bo'yicha kino topilmadi.`) +
      '\n\n💡 Maslahat:\n• Kino nomini to\'liqroq yozing\n• Kodni kanaldagi post ostidan tekshiring\n• Yoki bizga so\'rov yuboring 👇',
    {
      parse_mode: 'HTML',
      reply_markup: new InlineKeyboard()
        .text('📩 Shu kinoni so\'rash', `m:req:${Buffer.from(text).toString('base64url').slice(0, 50)}`).row()
        .text('🆕 Yangi kinolar', 'm:latest:0').text('🎲 Tasodifiy', 'm:random'),
    },
  );
});

searchHandler.callbackQuery(/^m:req:(.*)$/, async (ctx) => {
  let text = '';
  try { text = Buffer.from(ctx.match[1], 'base64url').toString('utf8'); } catch { /* ignore */ }
  await ctx.answerCallbackQuery();
  const { handleRequestText } = await import('./menu.js');
  if (text) return handleRequestText(ctx, text);
  await setState(ctx.from.id, { step: 'request' });
  await ctx.reply('📩 Kino nomini yozib yuboring:', { reply_markup: mainMenu(ctx.isAdmin) });
});
