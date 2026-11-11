-- ============ 3) Sifat / til variantlari ============
CREATE TABLE IF NOT EXISTS movie_files (
  id         serial PRIMARY KEY,
  movie_id   integer NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
  label      text NOT NULL,                -- "720p", "Ruscha", "Original"...
  file_id    text NOT NULL,
  file_type  text NOT NULL DEFAULT 'video',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS movie_files_movie_idx ON movie_files (movie_id, sort_order);

-- ============ 4) Kun kinosi ============
CREATE TABLE IF NOT EXISTS daily_picks (
  movie_id  integer NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
  posted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (movie_id, posted_at)
);

-- ============ 7) Eslatmalar ============
CREATE TABLE IF NOT EXISTS reminders (
  id         bigserial PRIMARY KEY,
  user_id    bigint NOT NULL,
  movie_id   integer NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
  remind_at  timestamptz NOT NULL,
  sent       boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS reminders_due_idx ON reminders (sent, remind_at);

-- ============ 8) Sovg'alar ============
CREATE TABLE IF NOT EXISTS gifts (
  id         bigserial PRIMARY KEY,
  from_user  bigint NOT NULL,
  to_user    bigint,
  movie_id   integer NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
  claimed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS gifts_from_idx ON gifts (from_user, created_at);
CREATE INDEX IF NOT EXISTS gifts_to_idx ON gifts (to_user, created_at);

-- ============ 10) Janr bo'yicha bildirishnoma ============
ALTER TABLE users ADD COLUMN IF NOT EXISTS notify_genres text[] NOT NULL DEFAULT '{}';

-- ============ Yangi sozlamalar ============
INSERT INTO settings (key, value) VALUES
  ('daily_movie',           'false'::jsonb),
  ('daily_movie_hour',      '19'::jsonb),
  ('daily_movie_broadcast', 'false'::jsonb),
  ('weekly_top',            'false'::jsonb),
  ('ref_league',            'false'::jsonb),
  ('group_mode',            'true'::jsonb)
ON CONFLICT (key) DO NOTHING;
