-- Poster (rasm) — faqat Telegram file_id saqlanadi, fayl VPS ga tushmaydi
ALTER TABLE movies ADD COLUMN IF NOT EXISTS poster_file_id text;   -- admin qo'ygan poster
ALTER TABLE movies ADD COLUMN IF NOT EXISTS thumb_file_id  text;   -- videodan avtomatik olingan nishoncha
ALTER TABLE series ADD COLUMN IF NOT EXISTS poster_file_id text;
