-- So'rovlarga ovoz berish
ALTER TABLE requests ADD COLUMN IF NOT EXISTS title_norm text;

CREATE TABLE IF NOT EXISTS request_votes (
  request_id bigint NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  user_id    bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (request_id, user_id)
);
CREATE INDEX IF NOT EXISTS request_votes_req_idx ON request_votes (request_id);

-- Bir xil nomdagi so'rovlarni birlashtirish uchun
UPDATE requests SET title_norm = lower(btrim(text)) WHERE title_norm IS NULL;
CREATE INDEX IF NOT EXISTS requests_norm_idx ON requests (title_norm);
