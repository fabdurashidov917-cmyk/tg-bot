-- Kinobot: boshlang'ich sxema
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE TABLE IF NOT EXISTS settings (
  key         text PRIMARY KEY,
  value       jsonb NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  user_id     bigint PRIMARY KEY,
  username    text,
  first_name  text,
  last_name   text,
  lang        text NOT NULL DEFAULT 'uz',
  is_blocked  boolean NOT NULL DEFAULT false,   -- bot tomonidan bloklangan
  is_stopped  boolean NOT NULL DEFAULT false,   -- foydalanuvchi botni bloklagan
  notify      boolean NOT NULL DEFAULT true,
  ref_by      bigint,
  ref_count   integer NOT NULL DEFAULT 0,
  search_count integer NOT NULL DEFAULT 0,
  watch_count integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS users_created_idx ON users (created_at);
CREATE INDEX IF NOT EXISTS users_active_idx  ON users (is_stopped, is_blocked);

CREATE TABLE IF NOT EXISTS admins (
  user_id   bigint PRIMARY KEY,
  role      text NOT NULL DEFAULT 'admin',  -- owner | admin
  added_by  bigint,
  added_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS channels (
  id           serial PRIMARY KEY,
  chat_id      text NOT NULL UNIQUE,          -- @username yoki -100...
  title        text,
  invite_link  text,                          -- yopiq kanallar uchun
  is_required  boolean NOT NULL DEFAULT true,
  sort_order   integer NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS movies (
  id          serial PRIMARY KEY,
  code        text NOT NULL UNIQUE,
  title       text,
  caption     text,
  file_id     text NOT NULL,
  file_type   text NOT NULL DEFAULT 'video',
  year        integer,
  country     text,
  lang        text,
  quality     text,
  rating      text,
  genres      text[] NOT NULL DEFAULT '{}',
  views       integer NOT NULL DEFAULT 0,
  is_active   boolean NOT NULL DEFAULT true,
  added_by    bigint,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS movies_title_trgm ON movies USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS movies_caption_trgm ON movies USING gin (caption gin_trgm_ops);
CREATE INDEX IF NOT EXISTS movies_code_idx ON movies (code);
CREATE INDEX IF NOT EXISTS movies_created_idx ON movies (created_at DESC);
CREATE INDEX IF NOT EXISTS movies_views_idx ON movies (views DESC);
CREATE INDEX IF NOT EXISTS movies_genres_idx ON movies USING gin (genres);

CREATE TABLE IF NOT EXISTS favorites (
  user_id    bigint NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  movie_id   integer NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, movie_id)
);

CREATE TABLE IF NOT EXISTS watch_log (
  id         bigserial PRIMARY KEY,
  user_id    bigint NOT NULL,
  movie_id   integer,
  source     text NOT NULL DEFAULT 'search',  -- search | inline | deeplink | menu
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS watch_user_idx ON watch_log (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS watch_created_idx ON watch_log (created_at);

CREATE TABLE IF NOT EXISTS searches (
  id         bigserial PRIMARY KEY,
  user_id    bigint NOT NULL,
  query      text NOT NULL,
  found      boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS searches_found_idx ON searches (found, created_at DESC);
CREATE INDEX IF NOT EXISTS searches_query_idx ON searches (lower(query));

CREATE TABLE IF NOT EXISTS requests (
  id          bigserial PRIMARY KEY,
  user_id     bigint NOT NULL,
  text        text NOT NULL,
  status      text NOT NULL DEFAULT 'new',   -- new | done | rejected
  created_at  timestamptz NOT NULL DEFAULT now(),
  answered_at timestamptz
);
CREATE INDEX IF NOT EXISTS requests_status_idx ON requests (status, created_at DESC);

CREATE TABLE IF NOT EXISTS states (
  user_id    bigint PRIMARY KEY,
  state      jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO settings (key, value) VALUES
  ('force_sub',       'true'::jsonb),
  ('protect_content', 'false'::jsonb),
  ('auto_delete_min', '0'::jsonb),
  ('maintenance',     'false'::jsonb),
  ('ref_bypass',      '0'::jsonb)
ON CONFLICT (key) DO NOTHING;
