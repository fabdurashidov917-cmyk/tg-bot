-- ============ Seriallar ============
CREATE TABLE IF NOT EXISTS series (
  id          serial PRIMARY KEY,
  code        text NOT NULL UNIQUE,
  title       text NOT NULL,
  caption     text,
  year        integer,
  country     text,
  lang        text,
  quality     text,
  genres      text[] NOT NULL DEFAULT '{}',
  status      text NOT NULL DEFAULT 'ongoing',   -- ongoing | completed
  is_active   boolean NOT NULL DEFAULT true,
  views       integer NOT NULL DEFAULT 0,
  added_by    bigint,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS series_title_trgm ON series USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS series_created_idx ON series (created_at DESC);
CREATE INDEX IF NOT EXISTS series_genres_idx ON series USING gin (genres);

CREATE TABLE IF NOT EXISTS episodes (
  id         serial PRIMARY KEY,
  series_id  integer NOT NULL REFERENCES series(id) ON DELETE CASCADE,
  season     integer NOT NULL DEFAULT 1,
  episode    integer NOT NULL,
  title      text,
  file_id    text NOT NULL,
  file_type  text NOT NULL DEFAULT 'video',
  caption    text,
  views      integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (series_id, season, episode)
);
CREATE INDEX IF NOT EXISTS episodes_series_idx ON episodes (series_id, season, episode);

-- Foydalanuvchi qayerda to'xtagani ("davom ettirish")
CREATE TABLE IF NOT EXISTS watch_progress (
  user_id    bigint NOT NULL,
  series_id  integer NOT NULL REFERENCES series(id) ON DELETE CASCADE,
  season     integer NOT NULL DEFAULT 1,
  episode    integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, series_id)
);
CREATE INDEX IF NOT EXISTS watch_progress_user_idx ON watch_progress (user_id, updated_at DESC);

-- Serial qismlari uchun ko'rish jurnali
ALTER TABLE watch_log ADD COLUMN IF NOT EXISTS episode_id integer;

-- Serialni ham sevimlilarga qo'shish mumkin
CREATE TABLE IF NOT EXISTS series_favorites (
  user_id    bigint NOT NULL,
  series_id  integer NOT NULL REFERENCES series(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, series_id)
);
