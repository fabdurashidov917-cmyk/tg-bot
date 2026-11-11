import { Composer, InlineKeyboard } from 'grammy';
import { cancelKb, mainMenu } from '../lib/keyboards.js';
import { esc } from '../lib/utils.js';
import * as Channels from '../services/channels.js';
import { setState, clearState } from '../lib/state.js';

export const adminChannelsHandler = new Composer();

const show = async (ctx, text, kb) => {
  const opts = { parse_mode: 'HTML', reply_markup: kb, link_preview_options: { is_disabled: true } };
  if (ctx.callbackQuery) { try { return await ctx.editMessageText(text, opts); } catch { /* ignore */ } }
  return ctx.reply(text, opts);
};

async function channelsView(ctx) {
  const list = await Channels.allChannels();
  let text = `📢 <b>Majburiy obuna kanallari</b> — ${list.length} ta\n\n`;
  if (!list.length) text += '<i>Kanal yo\'q. Majburiy obuna ishlamaydi.</i>\n';
  const kb = new InlineKeyboard();
  for (const ch of list) {
    const link = Channels.channelLink(ch);
    text += `${ch.is_required ? '✅' : '⏸'} <b>${esc(ch.title || ch.chat_id)}</b>\n   <code>${esc(ch.chat_id)}</code>${link ? '' : ' ⚠️ havola yo\'q'}\n`;
    kb.text(`${ch.is_required ? '⏸' : '✅'} ${(ch.title || ch.chat_id).slice(0, 14)}`, `a:chtoggle:${ch.id}`)
      .text('🔗', `a:chlink:${ch.id}`)
      .text('🗑', `a:chdel:${ch.id}`)
      .row();
  }
  kb.text('➕ Kanal qo\'shish', 'a:chadd').row().text('◀️ Orqaga', 'a:home');
  return show(ctx, text, kb);
}

adminChannelsHandler.callbackQuery('a:channels', async (ctx) => { await ctx.answerCallbackQuery(); await channelsView(ctx); });

adminChannelsHandler.callbackQuery('a:chadd', async (ctx) => {
  await ctx.answerCallbackQuery();
  await setState(ctx.from.id, { step: 'channel_add' });
  await show(
    ctx,
    '➕ <b>Kanal qo\'shish</b>\n\nQuyidagilardan birini yuboring:\n' +
    '• <code>@kanal_username</code>\n• <code>https://t.me/kanal_username</code>\n• Yopiq kanal ID si: <code>-1001234567890</code>\n\n' +
    '⚠️ Bot shu kanalda <b>admin</b> bo\'lishi shart!',
    cancelKb(),
  );
});

adminChannelsHandler.callbackQuery(/^a:chtoggle:(\d+)$/, async (ctx) => {
  const ch = await Channels.toggleRequired(Number(ctx.match[1]));
  await ctx.answerCallbackQuery({ text: ch.is_required ? 'Majburiy qilindi' : 'Vaqtincha o\'chirildi' });
  await channelsView(ctx);
});

adminChannelsHandler.callbackQuery(/^a:chdel:(\d+)$/, async (ctx) => {
  await Channels.deleteChannel(Number(ctx.match[1]));
  await ctx.answerCallbackQuery({ text: 'O\'chirildi' });
  await channelsView(ctx);
});

adminChannelsHandler.callbackQuery(/^a:chlink:(\d+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  await setState(ctx.from.id, { step: 'channel_link', id: Number(ctx.match[1]) });
  await show(ctx, '🔗 Kanalning taklif havolasini yuboring (<code>https://t.me/+...</code>):', cancelKb());
});

/** Matnli qadamlar */
export async function handleChannelText(ctx, state, text) {
  if (state.step === 'channel_add') {
    try {
      const ch = await Channels.addChannel(ctx.api, text);
      await clearState(ctx.from.id);
      const link = Channels.channelLink(ch);
      await ctx.reply(
        `✅ <b>${esc(ch.title)}</b> qo'shildi.\n<code>${esc(ch.chat_id)}</code>\n` +
        (link ? `🔗 ${esc(link)}` : '⚠️ Havola topilmadi — 🔗 tugmasi bilan qo\'lda qo\'shing.'),
        { parse_mode: 'HTML', reply_markup: mainMenu(true) },
      );
    } catch (e) {
      const d = String(e?.description || e.message);
      await ctx.reply(
        `❌ Qo'shilmadi: ${esc(d)}\n\n💡 Tekshiring:\n• Bot kanalda admin mi?\n• Username to'g'ri yozildimi?\n• Yopiq kanal bo'lsa ID (-100...) yuboring.`,
        { parse_mode: 'HTML', reply_markup: cancelKb() },
      );
    }
    return true;
  }

  if (state.step === 'channel_link') {
    if (!/^https?:\/\/t\.me\//i.test(text.trim())) { await ctx.reply('❌ To\'g\'ri havola yuboring (https://t.me/...).'); return true; }
    await Channels.setInviteLink(state.id, text.trim());
    await clearState(ctx.from.id);
    await ctx.reply('✅ Havola saqlandi.', { reply_markup: mainMenu(true) });
    return true;
  }

  return false;
}
