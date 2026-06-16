import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { mkdirSync } from "node:fs";
import path from "node:path";
import * as schema from "./schema";

/**
 * SQLite on local disk — correct for v1, swappable at scale: Drizzle keeps the
 * Postgres/Turso migration to a dialect change (see README "Scaling posture").
 * The DB only serves auth, moderation, and saves; library reads are static/ISR.
 */
const DATA_DIR = process.env.RK8_DATA_DIR ?? path.join(process.cwd(), "data");
mkdirSync(DATA_DIR, { recursive: true });

const sqlite = new Database(path.join(DATA_DIR, "rk8.db"));
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

/**
 * Idempotent bootstrap so `npm install && npm run dev` boots with zero steps.
 * Must stay in sync with schema.ts; `npm run db:push` is the dev workflow for
 * schema changes, this just guarantees first boot.
 */
sqlite.exec(`
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  hash TEXT,
  name TEXT,
  avatar_url TEXT,
  email_verified INTEGER NOT NULL DEFAULT 0,
  role TEXT NOT NULL DEFAULT 'user',
  strikes INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  banned_at INTEGER
);
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS oauth_accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  provider_sub TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS oauth_provider_sub_idx ON oauth_accounts(provider, provider_sub);
CREATE INDEX IF NOT EXISTS oauth_user_idx ON oauth_accounts(user_id);
CREATE TABLE IF NOT EXISTS games (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  alt_titles TEXT,
  system_id TEXT NOT NULL,
  engine TEXT NOT NULL,
  year INTEGER,
  publisher TEXT,
  genre TEXT,
  players INTEGER,
  region TEXT,
  description TEXT NOT NULL DEFAULT '',
  cover_path TEXT,
  rom_path TEXT NOT NULL,
  rom_sha256 TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  license_class TEXT NOT NULL DEFAULT 'unverified',
  license_note TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  reject_reason TEXT,
  submitted_by TEXT REFERENCES users(id),
  play_count INTEGER NOT NULL DEFAULT 0,
  staff_pick INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  published_at INTEGER,
  takedown_at INTEGER,
  takedown_reason TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS games_sha_idx ON games(rom_sha256);
CREATE UNIQUE INDEX IF NOT EXISTS games_system_slug_idx ON games(system_id, slug);
CREATE INDEX IF NOT EXISTS games_status_idx ON games(status);
CREATE INDEX IF NOT EXISTS games_system_idx ON games(system_id);
CREATE INDEX IF NOT EXISTS games_status_play_idx ON games(status, play_count);
CREATE INDEX IF NOT EXISTS games_status_pub_idx ON games(status, published_at);
CREATE INDEX IF NOT EXISTS games_submitter_idx ON games(submitted_by);
CREATE TABLE IF NOT EXISTS save_states (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  slot INTEGER NOT NULL,
  blob_path TEXT NOT NULL,
  screenshot_path TEXT,
  created_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS save_user_game_slot_idx ON save_states(user_id, game_id, slot);
CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  reporter_email TEXT,
  type TEXT NOT NULL,
  body TEXT NOT NULL,
  dmca_deadline_at INTEGER,
  status TEXT NOT NULL DEFAULT 'open',
  created_at INTEGER NOT NULL,
  resolved_at INTEGER
);
CREATE INDEX IF NOT EXISTS reports_status_idx ON reports(status);
CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  actor_id TEXT REFERENCES users(id),
  action TEXT NOT NULL,
  target TEXT NOT NULL,
  meta_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL
);
`);

export const db = drizzle(sqlite, { schema });
export { schema };
