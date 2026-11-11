# Kinobot — @sizning_botingiz (Node.js + PostgreSQL)

Eski PHP (`bot.php` + `config.php`) botning to'liq qayta yozilgan versiyasi.

## Ishga tushirish

```bash
./setup-db.sh            # 1) baza va rol (sudo kerak, bir marta)
npm run migrate          # 2) jadvallar
npm run import           # 3) eski MySQL dumpdan ko'chirish
pm2 start ecosystem.config.cjs --update-env
./install-nginx.sh       # 4) webhook yo'li (sudo kerak, bir marta)
# .env da BOT_MODE=webhook qilib:
pm2 restart kinobot --update-env
```

## Foydali buyruqlar

```bash
pm2 logs kinobot --lines 50
node scripts/set-webhook.js info|set|delete
node scripts/import-mysql.js /yo'l/dump.sql     # boshqa dumpni ko'chirish
```

## .env

| Kalit | Izoh |
|---|---|
| `BOT_TOKEN` | Bot tokeni (kodda saqlanmaydi) |
| `ADMIN_IDS` | Asosiy adminlar, vergul bilan |
| `SECRET_CHANNEL` | Kinolar zaxirasi va DB zaxirasi tushadigan kanal |
| `SOURCE_CHANNEL` | Bo'sh bo'lmasa — shu kanalga tashlangan kino avtomatik bazaga tushadi |
| `BOT_MODE` | `webhook` yoki `polling` |
| `WEBHOOK_PATH` / `WEBHOOK_SECRET` | Maxfiy yo'l va Telegram secret_token |
| `WELCOME_IMAGE` | /start rasmi (bo'sh bo'lsa faqat matn) |

## Tuzilma

```
src/
  index.js        kirish nuqtasi (webhook/polling server + cron)
  bot.js          middleware lar, handler larni ulash, xato tutish
  config.js db.js
  lib/            utils, keyboards, send, state, cache, auth, notify
  services/       movies, users, channels, settings, requests
  handlers/       start, menu, search, inline, admin*, stateRouter
migrations/       001_init.sql, legacy-dump.sql
scripts/          migrate, import-mysql, set-webhook
```

## Funksiyalar

**Seriallar:** 📺 serial + qismlar (fasllar bilan), qism tugmalari panjarasi, ▶️ «Davom ettirish»
(to'xtagan joyni eslab qoladi), ⏮/⏭ qism almashtirish, serialni sevimlilarga qo'shish,
`serial_<kod>` deep-link, kanalga e'lon. Admin tomonda: **qism qo'shish rejimi** — videolarni
ketma-ket yuborasiz/forward qilasiz, raqam izohdan («12-qism», «S01E12») yoki avtomatik ketma-ket
olinadi; `fasl 2` deb yozib faslni almashtirasiz.

**Foydalanuvchi:** kod/nom bo'yicha qidiruv, typo taklifi ("balki shuni izladingiz?"), 🎲 tasodifiy,
🔥 TOP 10 va 🔥 24 soat trendi, 🆕 yangi kinolar, 🎭 janrlar, 🎯 kayfiyat bo'yicha tavsiya,
❤️ sevimlilar, 🕘 tarix, ⏰ eslatma, 🎁 do'stga sovg'a (limit bonusi), 📩 kino so'rash +
🗳 so'rovlarga ovoz berish, 👥 referal va 🏆 liga, 🔔 janr bo'yicha bildirishnoma,
📊 shaxsiy hisobot (`/men`), inline rejim.

**Poster:** kino va serial e'lonlari uchun 🖼 poster. Admin botga rasm tashlaydi, bazaga faqat
Telegram `file_id` yoziladi — **rasm VPS ga yuklanmaydi**. Poster bo'lsa kanal e'loni `sendPhoto`
bilan (rasm + caption + tugma), bo'lmasa matnli `sendMessage` bilan ketadi. Video yoki qism fayli
kanalga **hech qachon** yuborilmaydi (aks holda kanaldan yuklab olinadi va `protect_content` ma'nosiz bo'ladi).

**Admin:** kino CRUD + 🎚 sifat/til variantlari, **forward bilan tezkor qo'shish**,
🔍 baza auditi (dublikat/nuqson topish), 📣 kanalga e'lon, 📢 obunachilarga xabar,
📣 ommaviy xabar (progress bilan), 📊 statistika, 🔎 qidiruv tahlili, 📩 so'rovlar,
📢 kanallar (yopiq kanal/invite link), ⚙️ sozlamalar, 👤 ko'p admin, 💾 zaxira.

**Avtomatik (cron, Asia/Tashkent):** 03:10 zaxira → maxfiy kanal, 09:00 kunlik hisobot,
🎬 kun kinosi (soati sozlanadi), yakshanba 20:00 haftalik TOP-5, 20:10 referal liga,
har 5 daqiqada eslatmalar, har soat eski holatlarni tozalash.

**Himoya:** `protect_content` (forward/saqlash bloki), avto-o'chirish, kunlik limit,
majburiy obuna (kesh + `chat_member` hodisasi), flood limiti, webhook `secret_token`.

## PHP versiyadagi tuzatilgan nuqsonlar

1. `?start=kino_<kod>` deep-link ishlamasligi (`$text === '/start'` sharti)
2. `?start=check_<kod>` umuman qo'llanmagani
3. Admin oddiy matn yozsa botning jim qolishi
4. `/start` rasmi 404 bo'lsa hech qanday javob kelmasligi
5. Inline qidiruvda har natija uchun obuna tekshirilib, Telegram timeout bo'lishi
6. Kod `caption` matnidan izlanib, `11` so'roviga `110` kelishi
7. HTML escape yo'qligi (`<` yuborilsa bot jim qolardi)
8. LIKE wildcard (`%`) zararsizlantirilmagani
9. Obuna bo'lgan foydalanuvchiga ham kanal tugmalari ko'rsatilishi
10. `channel_info_*` callback ishlovchisi yo'qligi
11. Yopiq kanal / taklif havolasi qo'llanmasligi
12. Admin wizardida "bekor qilish" yo'qligi
13. Kod takrorlanishi tekshirilmasligi, SQL xatosi chatga chiqishi
14. `users` jadvalida username yangilanmasligi
15. Kinoning `$user_id` ga yuborilishi (`$chat_id` o'rniga)
16. `getChatMember` xatosida hamma bloklanib qolishi (endi fail-open + adminga signal)
17. Obuna keshi yo'qligi (har xabarda N ta HTTP so'rov)
18. `temp_data_*.json` ning web-root da ochiq turishi (endi bazada)
19. Token/parolning kodda turishi (endi `.env`, 600 huquq)
20. Webhook `secret_token` yo'qligi — soxta update bilan admin panelga kirish mumkin edi
21. Flood himoyasi yo'qligi

## Node.js versiyasida topilgan va tuzatilgan nuqsonlar

- `bot.catch` **faqat polling**da ishlaydi: webhook da xato HTTP 500 bo'lib chiqib, Telegram
  update ni cheksiz qayta yuborardi → `handleBotError` webhook ishlovchisida chaqiriladi, 200 qaytadi.
- Kanal chatida `switch_inline_query` tugmasiga ruxsat yo'q → maxfiy kanalga zaxira nusxa
  yuborilmayotgan edi. Arxiv nusxalari endi tugmasiz (`buttons: false`) va `views` ni oshirmaydi.
- Webhook allaqachon o'rnatilgan bo'lsa `allowed_updates` yangilanmay qolardi → `index.js` endi
  ro'yxatni ham solishtiradi va kerak bo'lsa qayta ro'yxatdan o'tadi.
- `migrations/` dagi har qanday `.sql` migratsiya deb o'qilardi (MySQL dump ham) → faqat
  `^\d+...sql` o'qiladi, dump `data/` da.
- `"type": "module"` sababli pm2 konfiguratsiyasi `.cjs` bo'lishi shart.
- **`answerCallbackQuery` xatosi butun ishlovchini to'xtatardi**: tugma bosilganda birinchi qatordagi
  "ack" tarmoq uzilishi yoki "query is too old" sababli yiqilsa, asosiy ish (masalan zaxira olish)
  umuman bajarilmasdi. `src/lib/apiRetry.js` transformeri ack xatosini e'tiborsiz qoldiradi,
  tarmoq xatolarida 3 martagacha qayta uriniladi, 429 da `retry_after` kutiladi.
- **Video nishonchasi (thumbnail) poster bo'lolmaydi** — Telegram `sendPhoto` da uni rad etadi
  (`can't use file of type Thumbnail as Photo`). Shuning uchun `posterOf()` faqat admin qo'ygan
  posterni qaytaradi; `thumb_file_id` ustuni jadvalda qoladi, lekin ishlatilmaydi.
- Log faylida bot tokeni ochiq ko'rinardi (`node-fetch` xato matni URL ni chiqaradi) —
  `redactToken()` bilan yashiriladi.
