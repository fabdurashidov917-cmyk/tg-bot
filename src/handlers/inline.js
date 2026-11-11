import { Composer, InlineKeyboard, InlineQueryResultBuilder } from 'grammy';
import { esc } from '../lib/utils.js';
import * as Movies from '../services/movies.js';
import * as Channels from '../services/channels.js';
import { botLink } from '../lib/keyboards.js';
import { config } from '../config.js';

export const inlineHandler = new Composer();
const LIMIT = 20;

const cut = (s, n) => (s && s.length > n ? s.slice(0, n - 1) + '…' : s || '');

function movieResult(m) {
  const title = m.title || `Kod ${m.code}`;
  const bits = [m.year, m.quality, m.lang].filter(Boolean).join(' • ');
  const text =
    `🎬 <b>${esc(title)}</b>\n` +
    (bits ? `${esc(bits)}\n` : '') +
    (m.genres?.length ? `🎭 ${esc(m.genres.join(', '))}\n` : '') +
    `\n🔢 Kod: <code>${esc(m.code)}</code>\n\n👇 Kinoni olish uchun tugmani bosing:`;

  return InlineQueryResultBuilder
    .article(`m${m.id}`, cut(`🎬 ${title}`, 60), {
      description: `Kod: ${m.code}${bits ? ' | ' + bits : ''}`,
      reply_markup: new InlineKeyboard()
        .url('🍿 Kinoni olish', botLink(`kino_${m.code}`))
        .switchInlineCurrent('🔍 Qidirish', ''),
    })
    .text(text, { parse_mode: 'HTML', link_preview_options: { is_disabled: true } });
}

inlineHandler.on('inline_query', async (ctx) => {
  const query = (ctx.inlineQuery.query || '').trim();
  const offset = Number(ctx.inlineQuery.offset || 0) || 0;

  // Obunani BIR MARTA tekshiramiz (PHP da har natija uchun tekshirilib, timeout bo'lardi)
  const missing = await Channels.getUnsubscribed(ctx.api, ctx.from.id).catch(() => []);
  if (missing.length) {
    return ctx.answerInlineQuery(
      [
        InlineQueryResultBuilder.article('sub', '🔒 Avval kanalga obuna bo\'ling', {
          description: 'Botni ochib obuna bo\'ling, keyin qidiring',
          reply_markup: new InlineKeyboard().url('✅ Botni ochish', botLink('search')),
        }).text(
          '🔒 <b>Kinolarni olish uchun kanalga obuna bo\'lish kerak.</b>\n\n👇 Botni ochib obuna bo\'ling:',
          { parse_mode: 'HTML' },
        ),
      ],
      { cache_time: 5, is_personal: true, button: { text: '✅ Obuna bo\'lish', start_parameter: 'search' } },
    );
  }

  let movies;
  if (!query) movies = await Movies.latest(LIMIT, offset);
  else {
    const { exact, list } = await Movies.search(query, LIMIT);
    movies = exact ? [exact, ...list] : list;
    if (offset) movies = [];
  }

  if (!movies.length) {
    if (offset) return ctx.answerInlineQuery([], { cache_time: 10, is_personal: true });
    return ctx.answerInlineQuery(
      [
        InlineQueryResultBuilder.article('nf', '❌ Kino topilmadi', {
          description: query ? `«${cut(query, 40)}» bo'yicha natija yo'q` : 'Bazada kino yo\'q',
          reply_markup: new InlineKeyboard().url('📩 So\'rov yuborish', botLink('search')),
        }).text(
          `❌ <b>«${esc(cut(query, 60))}»</b> bo'yicha kino topilmadi.\n\n👇 Botdan so'rov qoldirishingiz mumkin:`,
          { parse_mode: 'HTML' },
        ),
      ],
      { cache_time: 10, is_personal: true, button: { text: '🔍 Botda qidirish', start_parameter: 'search' } },
    );
  }

  await ctx.answerInlineQuery(movies.map(movieResult), {
    cache_time: 30,
    is_personal: true,
    next_offset: !query && movies.length === LIMIT ? String(offset + LIMIT) : '',
    button: { text: `🎬 ${config.username} — barcha kinolar`, start_parameter: 'search' },
  });
});

inlineHandler.on('chosen_inline_result', async () => { /* statistika kerak bo'lsa shu yerda */ });
