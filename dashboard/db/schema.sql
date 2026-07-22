CREATE TABLE IF NOT EXISTS posts (
  id             SERIAL PRIMARY KEY,
  slug           TEXT UNIQUE NOT NULL,
  title          TEXT,
  body           TEXT,
  platform       TEXT,
  pillar         TEXT,
  format         TEXT,
  cta_type       TEXT,
  tags           TEXT,
  status         TEXT NOT NULL DEFAULT 'draft',
  image_path     TEXT,
  fb_post_id     TEXT,
  scheduled_time BIGINT,
  source         TEXT NOT NULL DEFAULT 'dashboard',
  created_at     BIGINT NOT NULL,
  updated_at     BIGINT NOT NULL,
  posted_at         BIGINT,
  fb_likes          INTEGER NOT NULL DEFAULT 0,
  fb_comments       INTEGER NOT NULL DEFAULT 0,
  fb_shares         INTEGER NOT NULL DEFAULT 0,
  metrics_updated_at BIGINT,
  angle              TEXT
);

ALTER TABLE posts ADD COLUMN IF NOT EXISTS posted_at BIGINT;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS fb_likes INTEGER NOT NULL DEFAULT 0;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS fb_comments INTEGER NOT NULL DEFAULT 0;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS fb_shares INTEGER NOT NULL DEFAULT 0;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS metrics_updated_at BIGINT;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS angle TEXT;
-- Moc gio ban bai sang Make, de canh gac biet bai nao ket qua lau ma Make khong xac nhan
ALTER TABLE posts ADD COLUMN IF NOT EXISTS sent_to_make_at BIGINT;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS fb_reach INTEGER;
ALTER TABLE posts ALTER COLUMN fb_reach DROP NOT NULL;
ALTER TABLE posts ALTER COLUMN fb_reach DROP DEFAULT;

CREATE TABLE IF NOT EXISTS post_history (
  id          SERIAL PRIMARY KEY,
  post_id     INTEGER NOT NULL REFERENCES posts(id),
  event_type  TEXT NOT NULL,
  from_status TEXT,
  to_status   TEXT,
  note        TEXT,
  actor       TEXT NOT NULL DEFAULT 'phong',
  created_at  BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS image_library (
  id          SERIAL PRIMARY KEY,
  file_name   TEXT NOT NULL,
  folder      TEXT,
  url         TEXT NOT NULL,
  uploaded_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS credit_snapshots (
  id           SERIAL PRIMARY KEY,
  provider     TEXT NOT NULL,
  balance      REAL,
  raw_response TEXT,
  fetched_at   BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS bot_kv (
  key        TEXT PRIMARY KEY,
  value      JSONB NOT NULL,
  updated_at BIGINT NOT NULL
);

-- Nhieu ho so thuong hieu/persona (Phong Menly, Uyen Linh...) thay vi chi 1 ho so duy nhat.
CREATE TABLE IF NOT EXISTS brand_profiles (
  key         TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  text        TEXT NOT NULL,
  source_url  TEXT,
  updated_at  BIGINT NOT NULL
);

ALTER TABLE posts ADD COLUMN IF NOT EXISTS brand_key TEXT;
