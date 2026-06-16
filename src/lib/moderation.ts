import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { desc, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { storage } from "@/lib/storage";
import { invalidateUserSessions } from "@/lib/auth/session";

/**
 * Moderation core (§4.5 / Phase 3c). Every state transition here also writes an
 * `audit_log` row in the same path — moderation is never silent. Approve/reject/
 * takedown move a game between the four `status` states; reject and takedown also
 * destroy the stored bytes (a rejected upload shouldn't linger; a takedown must
 * honor the rights-holder) while keeping the row as a record/tombstone.
 *
 * Role enforcement lives at the route boundary (admin-only ban, mod+ for the
 * rest) — these functions assume the caller is already authorized.
 */

const { games, users, auditLog, reports } = schema;

export class ModerationError extends Error {
  constructor(
    public code: string,
    message?: string,
  ) {
    super(message ?? code);
  }
}

export const GameAction = z.enum(["approve", "reject", "takedown"]);
export type GameActionT = z.infer<typeof GameAction>;

export const ModerateSchema = z.object({
  gameId: z.string().min(1),
  action: GameAction,
  reason: z.string().trim().max(500).optional(),
});

export const BanSchema = z.object({
  action: z.enum(["ban", "restore"]),
  reason: z.string().trim().max(500).optional(),
});

/** the status a game lands in after each action (used for optimistic UI) */
const RESULT_STATUS: Record<GameActionT, "approved" | "rejected" | "takedown"> = {
  approve: "approved",
  reject: "rejected",
  takedown: "takedown",
};

async function writeAudit(
  actorId: string,
  action: string,
  target: string,
  meta: Record<string, unknown>,
) {
  await db.insert(auditLog).values({
    id: randomUUID(),
    actorId,
    action,
    target,
    metaJson: JSON.stringify(meta),
    createdAt: new Date(),
  });
}

/** storage.delete already no-ops on a missing key; swallow the rest so a
 *  vanished file never blocks the state transition. */
async function dropBytes(key: string | null) {
  if (!key) return;
  try {
    await storage.delete(key);
  } catch {
    /* best-effort: the row transition is what matters */
  }
}

export async function moderateGame(opts: {
  actorId: string;
  gameId: string;
  action: GameActionT;
  reason?: string;
}): Promise<{ id: string; status: "approved" | "rejected" | "takedown" }> {
  const [game] = await db
    .select()
    .from(games)
    .where(eq(games.id, opts.gameId))
    .limit(1);
  if (!game) throw new ModerationError("not_found");

  const now = new Date();
  const reason = opts.reason?.trim();

  if (opts.action === "approve") {
    await db
      .update(games)
      .set({
        status: "approved",
        // first approval stamps publishedAt; re-approval keeps the original
        publishedAt: game.publishedAt ?? now,
        rejectReason: null,
      })
      .where(eq(games.id, game.id));
  } else if (opts.action === "reject") {
    if (!reason) throw new ModerationError("reason_required");
    await db
      .update(games)
      .set({ status: "rejected", rejectReason: reason })
      .where(eq(games.id, game.id));
    await dropBytes(game.romPath);
    await dropBytes(game.coverPath);
  } else {
    // takedown — permanent tombstone (the /play page renders "EJECTED")
    if (!reason) throw new ModerationError("reason_required");
    await db
      .update(games)
      .set({ status: "takedown", takedownAt: now, takedownReason: reason })
      .where(eq(games.id, game.id));
    await dropBytes(game.romPath);
    await dropBytes(game.coverPath);
  }

  await writeAudit(opts.actorId, opts.action, `game:${game.id}`, {
    from: game.status,
    slug: game.slug,
    systemId: game.systemId,
    ...(reason ? { reason } : {}),
  });

  return { id: game.id, status: RESULT_STATUS[opts.action] };
}

export async function setUserBan(opts: {
  actorId: string;
  targetId: string;
  action: "ban" | "restore";
  reason?: string;
}): Promise<{ id: string; banned: boolean }> {
  if (opts.targetId === opts.actorId) throw new ModerationError("self");

  const [target] = await db
    .select()
    .from(users)
    .where(eq(users.id, opts.targetId))
    .limit(1);
  if (!target) throw new ModerationError("not_found");
  // admins are never bannable from the UI — prevents a compromised/rogue mod
  // path and accidental lockout of the operator
  if (target.role === "admin") throw new ModerationError("protected");

  const now = new Date();
  const reason = opts.reason?.trim();

  if (opts.action === "ban") {
    if (!reason) throw new ModerationError("reason_required");
    await db
      .update(users)
      .set({ bannedAt: now, strikes: target.strikes + 1 })
      .where(eq(users.id, target.id));
    // instant revocation — drop every live session for this user
    await invalidateUserSessions(target.id);
  } else {
    await db
      .update(users)
      .set({ bannedAt: null })
      .where(eq(users.id, target.id));
  }

  await writeAudit(
    opts.actorId,
    opts.action === "ban" ? "ban" : "restore",
    `user:${target.id}`,
    reason ? { reason } : {},
  );

  return { id: target.id, banned: opts.action === "ban" };
}

/* ── read paths for the /admin views ──────────────────────────────────── */

export interface PendingRow {
  game: typeof games.$inferSelect;
  submitterId: string | null;
  submitterName: string | null;
  submitterEmail: string | null;
}

/** the moderation queue — pending submissions, oldest first (FIFO) */
export async function listPendingGames(limit = 100): Promise<PendingRow[]> {
  const rows = await db
    .select({
      game: games,
      submitterId: users.id,
      submitterName: users.name,
      submitterEmail: users.email,
    })
    .from(games)
    .leftJoin(users, eq(games.submittedBy, users.id))
    .where(eq(games.status, "pending"))
    .orderBy(games.createdAt)
    .limit(limit);
  return rows;
}

export interface AuditRow {
  log: typeof auditLog.$inferSelect;
  actorName: string | null;
  actorEmail: string | null;
}

export async function recentAuditLog(limit = 40): Promise<AuditRow[]> {
  return db
    .select({
      log: auditLog,
      actorName: users.name,
      actorEmail: users.email,
    })
    .from(auditLog)
    .leftJoin(users, eq(auditLog.actorId, users.id))
    .orderBy(desc(auditLog.createdAt))
    .limit(limit);
}

export async function moderationStats(): Promise<{
  pending: number;
  openReports: number;
}> {
  const [p] = await db
    .select({ n: sql<number>`count(*)` })
    .from(games)
    .where(eq(games.status, "pending"));
  const [r] = await db
    .select({ n: sql<number>`count(*)` })
    .from(reports)
    .where(eq(reports.status, "open"));
  return { pending: p?.n ?? 0, openReports: r?.n ?? 0 };
}
