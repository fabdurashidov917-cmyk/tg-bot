import { InlineKeyboard, Keyboard } from 'grammy';
import { channelLink } from '../services/channels.js';
import { config } from '../config.js';

export const BTN = {
  search: '🔍 Kino qidirish',
  series: '📺 Seriallar',
  random: '🎲 Tasodifiy kino',
  latest: '🆕 Yangi kinolar',
  top: '🔥 TOP 10',
  genres: '🎭 Janrlar',
  favs: '❤️ Sevimlilar',
  history: '🕘 Tarix',
  request: '📩 Kino so\'rash',
  help: 'ℹ️ Yordam',
  admin: '⚙️ Admin panel',
};

export function mainMenu(isAdmin = false) {
  const kb = new Keyboard()
    .text(BTN.search).text(BTN.series).row()
    .text(BTN.random).text(BTN.top).row()
    .text(BTN.latest).text(BTN.genres).row()
    .text(BTN.favs).text(BTN.history).row()
    .text(BTN.request).text(BTN.help);
  if (isAdmin) kb.row().text(BTN.admin);
  return kb.resized().persistent();
}

/** Majburiy obuna klaviaturasi */
export function subscribeKeyboard(missing, payload = '') {
  const kb = new InlineKeyboard();
  for (const ch of missing) {
    const url = channelLink(ch);
    if (url) kb.url(`📢 ${ch.title || ch.chat_id}`, url).row();
  }
  kb.text('✅ Tekshirish', `sub:check:${payload}`);
  return kb;
}

/** Kino yuborilgandagi tugmalar */
export function movieKeyboard(movie, isFav = false, opts = {}) {
  const { variants = [] } = opts;
  const kb = new InlineKeyboard()
    .text(isFav ? '💔 Sevimlidan olish' : '❤️ Sevimlilarga', `fav:${movie.id}`)
    .switchInline('📤 Ulashish', movie.code)
    .row();

  // Sifat / til variantlari
  variants.slice(0, 6).forEach((v, i) => {
    kb.text(`🎚 ${v.label}`, `mf:${v.id}`);
    if (i % 3 === 2) kb.row();
  });
  if (variants.length) kb.row();

  kb.text('🎁 Sovg\'a qilish', `gift:${movie.id}`).text('⏰ Eslat', `rem:${movie.id}`).row()
    .text('🎲 Tasodifiy', 'm:random').text('🔍 Yana qidirish', 'm:search');
  return kb;
}

export function listKeyboard(movies, { page = 0, pages = 1, prefix = 'list' } = {}) {
  const kb = new InlineKeyboard();
  movies.forEach((m, i) => {
    kb.text(`${i + 1}. ${(m.title || m.code).slice(0, 28)}`, `m:get:${m.code}`);
    if (i % 2 === 1) kb.row();
  });
  kb.row();
  if (pages > 1) {
    if (page > 0) kb.text('◀️', `${prefix}:${page - 1}`);
    kb.text(`${page + 1}/${pages}`, 'noop');
    if (page < pages - 1) kb.text('▶️', `${prefix}:${page + 1}`);
    kb.row();
  }
  kb.text('🏠 Bosh menyu', 'm:home');
  return kb;
}

export function adminMain() {
  return new InlineKeyboard()
    .text('📊 Statistika', 'a:stats').text('🎬 Kinolar', 'a:movies:0').row()
    .text('➕ Kino qo\'shish', 'a:addmovie').text('📺 Seriallar', 'a:series:0').row()
    .text('📢 Kanallar', 'a:channels').text('⚙️ Sozlamalar', 'a:settings').row()
    .text('📣 Xabar yuborish', 'a:bc').text('📩 So\'rovlar', 'a:req:0').row()
    .text('🔎 Qidiruv tahlili', 'a:searches').row()
    .text('👤 Adminlar', 'a:admins').text('💾 Zaxira', 'a:backup').row()
    .text('🔍 Bazani tekshir', 'a:check').text('🏆 Liga', 'a:league').row()
    .text('🏠 Bosh menyu', 'm:home');
}

export const cancelKb = () => new InlineKeyboard().text('✖️ Bekor qilish', 'a:cancel');

export const backAdmin = () => new InlineKeyboard().text('◀️ Admin panel', 'a:home');

export const botLink = (payload) =>
  `https://t.me/${config.username}${payload ? `?start=${payload}` : ''}`;
