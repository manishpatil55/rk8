import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

/**
 * RK8 data model. `systems` deliberately has no table — the system matrix
 * lives in src/config/systems.config.ts (single source of truth) and games
 * reference it by id.
 */

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  // nullable: OAuth-only users have no password. A hash is set only for the
  // dev seeded-admin fallback (scrypt). Production logins are OAuth.
  hash: text("hash"),
  name: text("name"),
  avatarUrl: text("avatar_url"),
  // we only ever create/link from a provider-verified email (anti-takeover)
  emailVerified: integer("email_verified", { mode: "boolean" })
    .notNull()
    .default(false),
  role: text("role", { enum: ["user", "mod", "admin"] })
    .notNull()
    .default("user"),
  strikes: integer("strikes").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  bannedAt: integer("banned_at", { mode: "timestamp" }),
});

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(), // sha256 of the bearer token — raw token never stored
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
});

/**
 * Federated identities. A user may link several (Discord + Google). Identity is
 * keyed by (provider, providerSub) — never by email — to prevent account
 * takeover; email is only used to link a new provider to an existing account
 * when BOTH sides are verified.
 */
export const oauthAccounts = sqliteTable(
  "oauth_accounts",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: text("provider", { enum: ["discord", "google"] }).notNull(),
    providerSub: text("provider_sub").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  },
  (t) => [
    uniqueIndex("oauth_provider_sub_idx").on(t.provider, t.providerSub),
    index("oauth_user_idx").on(t.userId),
  ],
);

export const games = sqliteTable(
  "games",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    altTitles: text("alt_titles"), // newline-separated, searchable
    systemId: text("system_id").notNull(), // → systems.config.ts
    engine: text("engine", { enum: ["ejs", "ruffle", "jsdos"] }).notNull(),
    year: integer("year"),
    publisher: text("publisher"),
    genre: text("genre"),
    players: integer("players"),
    region: text("region"),
    description: text("description").notNull().default(""),
    coverPath: text("cover_path"),
    romPath: text("rom_path").notNull(),
    romSha256: text("rom_sha256").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    licenseClass: text("license_class", {
      enum: ["homebrew", "public_domain", "open", "unverified"],
    })
      .notNull()
      .default("unverified"),
    licenseNote: text("license_note"), // source URL / license name for seed + verified games
    status: text("status", {
      enum: ["pending", "approved", "rejected", "takedown"],
    })
      .notNull()
      .default("pending"),
    rejectReason: text("reject_reason"),
    submittedBy: text("submitted_by").references(() => users.id),
    playCount: integer("play_count").notNull().default(0),
    staffPick: integer("staff_pick", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    publishedAt: integer("published_at", { mode: "timestamp" }),
    takedownAt: integer("takedown_at", { mode: "timestamp" }),
    takedownReason: text("takedown_reason"),
  },
  (t) => [
    uniqueIndex("games_sha_idx").on(t.romSha256),
    uniqueIndex("games_system_slug_idx").on(t.systemId, t.slug),
    index("games_status_idx").on(t.status),
    index("games_system_idx").on(t.systemId),
    // ranking/listing read paths — keep them index-served on Postgres at scale
    index("games_status_play_idx").on(t.status, t.playCount),
    index("games_status_pub_idx").on(t.status, t.publishedAt),
    index("games_submitter_idx").on(t.submittedBy),
  ],
);

export const saveStates = sqliteTable(
  "save_states",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    gameId: text("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    slot: integer("slot").notNull(), // 0–9: cap 10 slots per user per game
    blobPath: text("blob_path").notNull(),
    screenshotPath: text("screenshot_path"),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  },
  (t) => [uniqueIndex("save_user_game_slot_idx").on(t.userId, t.gameId, t.slot)],
);

export const reports = sqliteTable(
  "reports",
  {
    id: text("id").primaryKey(),
    gameId: text("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    reporterEmail: text("reporter_email"),
    type: text("type", {
      enum: ["dmca", "broken", "wrong_info", "other"],
    }).notNull(),
    body: text("body").notNull(),
    /**
     * formal DMCA notices auto-unpublish after 72h if not actioned sooner.
     * This is null until the notice is email-verified — an unverified anonymous
     * notice must NOT arm the auto-takedown clock (anti-griefing, see lib/reports).
     */
    dmcaDeadlineAt: integer("dmca_deadline_at", { mode: "timestamp" }),
    /** SHA-256 of the one-time email-verification token (dmca only) */
    verifyTokenHash: text("verify_token_hash"),
    /** set when the reporter clicks the verification link; arms the 72h clock */
    verifiedAt: integer("verified_at", { mode: "timestamp" }),
    status: text("status", { enum: ["open", "actioned", "dismissed"] })
      .notNull()
      .default("open"),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    resolvedAt: integer("resolved_at", { mode: "timestamp" }),
  },
  (t) => [
    index("reports_status_idx").on(t.status),
    // the DMCA auto-takedown sweep filters on (type, status, dmca_deadline_at);
    // keep this in sync with the hand-DDL in db/index.ts so a future db:push
    // / Postgres migration doesn't silently drop it.
    index("reports_type_status_deadline_idx").on(
      t.type,
      t.status,
      t.dmcaDeadlineAt,
    ),
  ],
);

export const auditLog = sqliteTable("audit_log", {
  id: text("id").primaryKey(),
  actorId: text("actor_id").references(() => users.id),
  action: text("action").notNull(), // approve | reject | takedown | ban | restore | ...
  target: text("target").notNull(), // "game:<id>" | "user:<id>" | "report:<id>"
  metaJson: text("meta_json").notNull().default("{}"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});
