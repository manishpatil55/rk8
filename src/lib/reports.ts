import "server-only";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";
import { and, eq, isNotNull, lte, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { moderateGame } from "@/lib/moderation";
import { appUrl, mailer } from "@/lib/mailer";

/**
 * Reports + DMCA machinery (§8 / Phase 3d, hardened). Anyone — logged in or not
 * — can file a report from a public game page; rights-holders must not be forced
 * to register (the 2-minute-takedown acceptance test).
 *
 * THREAT MODEL (why this is shaped the way it is): the 72h auto-unpublish clock
 * is a powerful, anonymous-triggerable lever. If raw anonymous input could arm
 * it, anyone could script formal-looking notices and mass-suspend the library.
 * Three independent guards contain that:
 *   1. Only `type: "dmca"` arms the clock, and only with the sworn §512(c)(3)
 *      elements (contact email + signature + perjury affirmation).
 *   2. The clock is NOT armed at submission — the contact email must be
 *      round-trip VERIFIED (lib/mailer) first. So a notice now costs a
 *      controlled mailbox + a click, and ties to a reachable identity.
 *   3. The auto-takedown RETAINS the stored bytes (reversible): a wrongful
 *      auto-suspension can be restored by re-approving, unlike a manual
 *      moderator takedown which deletes bytes by design.
 * Casual broken/wrong_info/other reports never auto-act; a moderator triages.
 */

const { reports, games, auditLog } = schema;

const DMCA_WINDOW_MS = 72 * 60 * 60 * 1000; // §8: 72h, whichever comes first

export class ReportError extends Error {
  constructor(
    public code: string,
    message?: string,
  ) {
    super(message ?? code);
  }
}

export const ReportType = z.enum(["dmca", "broken", "wrong_info", "other"]);
export type ReportTypeT = z.infer<typeof ReportType>;

export const ReportSchema = z
  .object({
    gameId: z.string().min(1),
    type: ReportType,
    reporterEmail: z.string().trim().email().max(200).optional(),
    body: z.string().trim().min(1).max(4000),
    signature: z.string().trim().max(120).optional(),
    sworn: z.boolean().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.type !== "dmca") return;
    if (!v.reporterEmail)
      ctx.addIssue({ code: "custom", path: ["reporterEmail"], message: "contact email required for a DMCA notice" });
    if (!v.signature)
      ctx.addIssue({ code: "custom", path: ["signature"], message: "signature required for a DMCA notice" });
    if (!v.sworn)
      ctx.addIssue({ code: "custom", path: ["sworn"], message: "you must affirm the statutory statements" });
    if (v.body.trim().length < 30)
      ctx.addIssue({ code: "custom", path: ["body"], message: "describe the copyrighted work and the infringing material" });
  });

export type ReportInput = z.infer<typeof ReportSchema>;

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

async function writeAudit(
  actorId: string | null,
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

/**
 * File a report. Returns `{ id, verifying }` — `verifying:true` means a DMCA
 * verification email was dispatched and the 72h clock is NOT yet armed. `actorId`
 * is the logged-in reporter if any (audit only — never gates submission).
 */
export async function createReport(
  input: ReportInput,
  actorId: string | null,
): Promise<{ id: string; verifying: boolean }> {
  const [game] = await db
    .select({ id: games.id, slug: games.slug, title: games.title, status: games.status })
    .from(games)
    .where(eq(games.id, input.gameId))
    .limit(1);
  if (!game) throw new ReportError("not_found");
  if (game.status === "takedown") throw new ReportError("already_down");

  const now = new Date();
  const isDmca = input.type === "dmca";

  // self-contained ticket: keep the sworn signature alongside the notice body
  const body = isDmca
    ? `[SWORN DMCA NOTICE — signed: ${input.signature}]\n\n${input.body.trim()}`
    : input.body.trim();

  // dmca: mint a one-time verification token; store only its hash. The clock
  // (dmcaDeadlineAt) stays null until the email is verified.
  const token = isDmca ? randomBytes(32).toString("hex") : null;

  const id = randomUUID();
  await db.insert(reports).values({
    id,
    gameId: game.id,
    reporterEmail: input.reporterEmail ?? null,
    type: input.type,
    body,
    dmcaDeadlineAt: null,
    verifyTokenHash: token ? sha256(token) : null,
    verifiedAt: null,
    status: "open",
    createdAt: now,
  });

  await writeAudit(actorId, "report", `report:${id}`, {
    game: game.id,
    slug: game.slug,
    type: input.type,
    ...(isDmca ? { dmca: true, verified: false } : {}),
  });

  if (isDmca && token && input.reporterEmail) {
    const link = `${appUrl()}/api/report/verify?id=${id}&token=${token}`;
    await mailer.send({
      to: input.reporterEmail,
      subject: "Confirm your RK8 copyright takedown notice",
      text:
        `A DMCA takedown notice was submitted under your email for "${game.title}".\n\n` +
        `To confirm this notice and start the statutory review, open this link:\n${link}\n\n` +
        `Once confirmed, the listing is removed promptly and, if not actioned by a ` +
        `moderator sooner, automatically within 72 hours.\n\n` +
        `If you did not submit this notice, ignore this email — nothing happens ` +
        `until the link is opened.`,
    });
  }

  return { id, verifying: isDmca };
}

/**
 * Verify a DMCA notice via its emailed token. Arms the 72h clock. Idempotent:
 * a second click on an already-verified notice is a no-op success.
 */
export async function verifyReport(
  id: string,
  token: string,
): Promise<{ ok: true; alreadyVerified: boolean }> {
  const [r] = await db.select().from(reports).where(eq(reports.id, id)).limit(1);
  if (!r || r.type !== "dmca" || !r.verifyTokenHash)
    throw new ReportError("invalid_token");
  if (r.verifyTokenHash !== sha256(token)) throw new ReportError("invalid_token");
  if (r.verifiedAt) return { ok: true, alreadyVerified: true };

  const now = new Date();
  await db
    .update(reports)
    .set({ verifiedAt: now, dmcaDeadlineAt: new Date(now.getTime() + DMCA_WINDOW_MS) })
    .where(eq(reports.id, r.id));
  await writeAudit(null, "report_verify", `report:${r.id}`, { game: r.gameId });
  return { ok: true, alreadyVerified: false };
}

/* ── admin read + resolve paths ───────────────────────────────────────── */

export interface ReportRow {
  report: typeof reports.$inferSelect;
  gameSlug: string | null;
  gameTitle: string | null;
  gameSystemId: string | null;
  gameStatus: string | null;
}

/** open tickets; verified DMCA notices (soonest deadline) float to the top */
export async function listOpenReports(limit = 100): Promise<ReportRow[]> {
  return db
    .select({
      report: reports,
      gameSlug: games.slug,
      gameTitle: games.title,
      gameSystemId: games.systemId,
      gameStatus: games.status,
    })
    .from(reports)
    .leftJoin(games, eq(reports.gameId, games.id))
    .where(eq(reports.status, "open"))
    // SQLite sorts NULLs first on ASC, so push null-deadline (casual) tickets
    // last explicitly; among armed notices, soonest deadline first, then oldest.
    .orderBy(
      sql`${reports.dmcaDeadlineAt} is null`,
      reports.dmcaDeadlineAt,
      reports.createdAt,
    )
    .limit(limit);
}

export async function dismissReport(opts: {
  actorId: string;
  reportId: string;
}): Promise<void> {
  const [r] = await db
    .select()
    .from(reports)
    .where(eq(reports.id, opts.reportId))
    .limit(1);
  if (!r) throw new ReportError("not_found");
  if (r.status !== "open") throw new ReportError("not_open");

  await db
    .update(reports)
    .set({ status: "dismissed", resolvedAt: new Date() })
    .where(eq(reports.id, r.id));
  await writeAudit(opts.actorId, "report_dismiss", `report:${r.id}`, {
    game: r.gameId,
    type: r.type,
  });
}

/**
 * Action a ticket: take the game down (reusing the moderation path so a takedown
 * audit row is written) and resolve every open report on that game. A manual
 * moderator takedown deletes the stored bytes (default moderation behavior).
 */
export async function actionReport(opts: {
  actorId: string;
  reportId: string;
  reason?: string;
}): Promise<void> {
  const [r] = await db
    .select()
    .from(reports)
    .where(eq(reports.id, opts.reportId))
    .limit(1);
  if (!r) throw new ReportError("not_found");
  if (r.status !== "open") throw new ReportError("not_open");

  const reason =
    opts.reason?.trim() ||
    (r.type === "dmca"
      ? "DMCA takedown — rights-holder notice"
      : "removed following a report");

  await moderateGame({
    actorId: opts.actorId,
    gameId: r.gameId,
    action: "takedown",
    reason,
  });

  await resolveAllOpenForGame(r.gameId, opts.actorId);
}

/** close every open ticket on a game once it's down (manual or auto) */
async function resolveAllOpenForGame(
  gameId: string,
  actorId: string | null,
): Promise<void> {
  const res = await db
    .update(reports)
    .set({ status: "actioned", resolvedAt: new Date() })
    .where(and(eq(reports.gameId, gameId), eq(reports.status, "open")));
  // only log if something actually changed (avoids empty audit noise)
  if ((res as { changes?: number }).changes !== 0)
    await writeAudit(actorId, "report_action", `game:${gameId}`, {});
}

/**
 * The 72h teeth — but reversible. Any still-approved game carrying an open,
 * VERIFIED dmca report whose deadline has passed is auto-taken-down with its
 * stored bytes RETAINED (so a wrongful auto-suspension can be restored by
 * re-approval). Lazy by design — called from the play-page render and admin
 * reads. The public byte path does a cheaper read-only refusal (see
 * isDmcaSuspended) rather than this write, to avoid write-amplification on a
 * hot route. At scale, run this on a schedule and the call sites are a backstop.
 * Returns the number of games swept.
 */
export async function sweepExpiredDmca(): Promise<number> {
  const now = new Date();
  const due = await db
    .selectDistinct({ gameId: reports.gameId })
    .from(reports)
    .innerJoin(games, eq(reports.gameId, games.id))
    .where(
      and(
        eq(reports.type, "dmca"),
        eq(reports.status, "open"),
        isNotNull(reports.dmcaDeadlineAt),
        lte(reports.dmcaDeadlineAt, now),
        eq(games.status, "approved"),
      ),
    );

  for (const { gameId } of due) {
    await moderateGame({
      actorId: null, // automated sweep — system actor
      gameId,
      action: "takedown",
      reason: "DMCA notice — auto-removed after 72h (no moderator action)",
      retainBytes: true, // reversible: keep bytes for restoration/appeal
    });
    await resolveAllOpenForGame(gameId, null);
  }
  return due.length;
}

/**
 * Read-only check for the byte path: is this game past a verified DMCA deadline
 * (and thus must not be served), even if the row hasn't been swept to takedown
 * yet? No writes — safe to call on every ROM/Range request.
 */
export async function isDmcaSuspended(gameId: string): Promise<boolean> {
  const [row] = await db
    .select({ n: sql<number>`count(*)` })
    .from(reports)
    .where(
      and(
        eq(reports.gameId, gameId),
        eq(reports.type, "dmca"),
        eq(reports.status, "open"),
        isNotNull(reports.dmcaDeadlineAt),
        lte(reports.dmcaDeadlineAt, new Date()),
      ),
    );
  return (row?.n ?? 0) > 0;
}

export async function openReportCount(): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)` })
    .from(reports)
    .where(eq(reports.status, "open"));
  return row?.n ?? 0;
}
