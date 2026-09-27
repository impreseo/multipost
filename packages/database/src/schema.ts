export const SCHEMA_VERSION = 1;

export const MIGRATION_SQL = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL,
  master_content TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_posts_status ON posts(status);
CREATE INDEX IF NOT EXISTS idx_posts_updated ON posts(updated_at DESC);

CREATE TABLE IF NOT EXISTS post_variants (
  id TEXT PRIMARY KEY NOT NULL,
  post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  platform_account_id TEXT,
  content TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft',
  approved_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(post_id, platform)
);

CREATE TABLE IF NOT EXISTS platform_accounts (
  id TEXT PRIMARY KEY NOT NULL,
  platform TEXT NOT NULL,
  account_name TEXT NOT NULL,
  account_id TEXT,
  auth_reference TEXT,
  connected_at TEXT,
  last_verified_at TEXT,
  status TEXT NOT NULL DEFAULT 'disconnected'
);

CREATE TABLE IF NOT EXISTS media (
  id TEXT PRIMARY KEY NOT NULL,
  filename TEXT NOT NULL,
  path TEXT NOT NULL,
  type TEXT NOT NULL,
  size INTEGER NOT NULL,
  width INTEGER,
  height INTEGER,
  category TEXT NOT NULL DEFAULT 'general',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS post_media (
  post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  media_id TEXT NOT NULL REFERENCES media(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (post_id, media_id)
);

CREATE TABLE IF NOT EXISTS post_destinations (
  post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  platform_account_id TEXT NOT NULL REFERENCES platform_accounts(id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, platform_account_id)
);

CREATE TABLE IF NOT EXISTS schedules (
  id TEXT PRIMARY KEY NOT NULL,
  post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  scheduled_at TEXT NOT NULL,
  timezone TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS publishing_jobs (
  id TEXT PRIMARY KEY NOT NULL,
  post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  platform_account_id TEXT NOT NULL REFERENCES platform_accounts(id),
  variant_id TEXT REFERENCES post_variants(id),
  platform_content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ready',
  scheduled_at TEXT,
  started_at TEXT,
  published_at TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  external_post_id TEXT,
  simulated INTEGER NOT NULL DEFAULT 0,
  idempotency_key TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_jobs_status ON publishing_jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_scheduled ON publishing_jobs(scheduled_at);

CREATE TABLE IF NOT EXISTS platform_results (
  id TEXT PRIMARY KEY NOT NULL,
  job_id TEXT NOT NULL REFERENCES publishing_jobs(id) ON DELETE CASCADE,
  post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  platform_account_id TEXT NOT NULL,
  status TEXT NOT NULL,
  external_post_id TEXT,
  response_meta TEXT,
  error TEXT,
  simulated INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS automation_runs (
  id TEXT PRIMARY KEY NOT NULL,
  job_id TEXT NOT NULL REFERENCES publishing_jobs(id) ON DELETE CASCADE,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  status TEXT NOT NULL,
  attempt INTEGER NOT NULL,
  error TEXT
);

CREATE TABLE IF NOT EXISTS automation_events (
  id TEXT PRIMARY KEY NOT NULL,
  job_id TEXT,
  level TEXT NOT NULL,
  message TEXT NOT NULL,
  meta TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS logs (
  id TEXT PRIMARY KEY NOT NULL,
  level TEXT NOT NULL,
  scope TEXT NOT NULL,
  message TEXT NOT NULL,
  meta TEXT,
  created_at TEXT NOT NULL
);
`;
