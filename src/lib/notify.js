import { allAdminIds } from './auth.js';
import { esc } from './utils.js';

/** Adminlarga texnik xabar */
export async function notifyAdmins(api, text, opts = {}) {
  const ids = await allAdminIds();
  for (const id of ids) {
    try {
      await api.sendMessage(id, text, { parse_mode: 'HTML', ...opts });
    } catch { /* admin botni bloklagan bo'lishi mumkin */ }
  }
}

export const fmtUser = (u) =>
  `${esc(u?.first_name || 'Foydalanuvchi')}${u?.username ? ` (@${esc(u.username)})` : ''} <code>${u?.user_id ?? u?.id}</code>`;
