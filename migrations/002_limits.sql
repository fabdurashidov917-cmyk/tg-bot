-- Kunlik kino limiti sozlamasi
INSERT INTO settings (key, value) VALUES ('daily_limit', '0'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Kunlik limit so'rovi uchun indeks
CREATE INDEX IF NOT EXISTS watch_user_day_idx ON watch_log (user_id, created_at);
