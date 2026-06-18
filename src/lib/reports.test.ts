import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import {
  ReportError,
  ReportSchema,
  createReport,
  dismissReport,
  isDmcaSuspended,
  openReportCount,
  verifyReport,
} from "@/lib/reports";

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

async function seedGame(over: Partial<typeof schema.games.$inferInsert> = {}) {
  const id = over.id ?? `game-${Math.random().toString(36).slice(2)}`;
  await db.insert(schema.games).values({
    id,
    slug: over.slug ?? `slug-${id}`,
    title: over.title ?? "Test Cartridge",
    systemId: "nes",
    engine: "ejs",
    romPath: `roms/${id}.nes`,
    romSha256: `sha-${id}`,
    sizeBytes: 1024,
    status: over.status ?? "approved",
    createdAt: new Date(),
    ...over,
  });
  return id;
}

/** insert a verified-or-not dmca report directly, returning its id + raw token */
async function seedDmcaReport(
  gameId: string,
  opts: { token: string; deadlineAt?: Date | null },
) {
  const id = `report-${Math.random().toString(36).slice(2)}`;
  await db.insert(schema.reports).values({
    id,
    gameId,
    reporterEmail: "rights@example.com",
    type: "dmca",
    body: "[SWORN DMCA NOTICE] the work and the infringing material described here.",
    dmcaDeadlineAt: opts.deadlineAt ?? null,
    verifyTokenHash: sha256(opts.token),
    verifiedAt: null,
    status: "open",
    createdAt: new Date(),
  });
  return id;
}

/** fetch a single report by id, asserting it exists (narrows for strict tsc) */
async function reportById(id: string) {
  const [r] = await db.select().from(schema.reports).where(eq(schema.reports.id, id));
  expect(r).toBeDefined();
  return r!;
}

beforeEach(async () => {
  // FK order: reports + audit reference games/users; clear children first
  await db.delete(schema.reports);
  await db.delete(schema.auditLog);
  await db.delete(schema.games);
  await db.delete(schema.users);
});

describe("ReportSchema (the sworn-DMCA gate)", () => {
  it("accepts a minimal casual report", () => {
    const r = ReportSchema.safeParse({ gameId: "g", type: "broken", body: "won't boot" });
    expect(r.success).toBe(true);
  });

  it("rejects a DMCA notice missing the sworn elements", () => {
    const r = ReportSchema.safeParse({
      gameId: "g",
      type: "dmca",
      body: "this is my copyrighted work being distributed without permission!!",
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      const paths = r.error.issues.map((i) => i.path.join("."));
      expect(paths).toContain("reporterEmail");
      expect(paths).toContain("signature");
      expect(paths).toContain("sworn");
    }
  });

  it("rejects a DMCA notice whose body is too thin to identify the work", () => {
    const r = ReportSchema.safeParse({
      gameId: "g",
      type: "dmca",
      reporterEmail: "a@b.com",
      signature: "A. Holder",
      sworn: true,
      body: "mine",
    });
    expect(r.success).toBe(false);
  });

  it("accepts a fully-sworn DMCA notice", () => {
    const r = ReportSchema.safeParse({
      gameId: "g",
      type: "dmca",
      reporterEmail: "a@b.com",
      signature: "A. Holder",
      sworn: true,
      body: "I own the copyright to this title and it is hosted here without a license.",
    });
    expect(r.success).toBe(true);
  });
});

describe("createReport", () => {
  it("files a casual report without arming any clock", async () => {
    const gameId = await seedGame();
    const res = await createReport(
      { gameId, type: "broken", body: "bad dump, crashes on level 2" },
      null,
    );
    expect(res.verifying).toBe(false);

    const [row] = await db.select().from(schema.reports).where(eq(schema.reports.gameId, gameId));
    expect(row?.status).toBe("open");
    expect(row?.dmcaDeadlineAt).toBeNull(); // never armed at submission
  });

  it("rejects a report against a missing game", async () => {
    await expect(
      createReport({ gameId: "nope", type: "broken", body: "x" }, null),
    ).rejects.toMatchObject({ code: "not_found" });
  });

  it("rejects a report against an already-down game", async () => {
    const gameId = await seedGame({ status: "takedown" });
    await expect(
      createReport({ gameId, type: "broken", body: "x" }, null),
    ).rejects.toBeInstanceOf(ReportError);
  });
});

describe("verifyReport → the 72h clock", () => {
  it("does not arm the clock until the email is verified", async () => {
    const gameId = await seedGame();
    await seedDmcaReport(gameId, { token: "tok" });
    expect(await isDmcaSuspended(gameId)).toBe(false);
  });

  it("rejects a bad token", async () => {
    const gameId = await seedGame();
    const id = await seedDmcaReport(gameId, { token: "tok" });
    await expect(verifyReport(id, "wrong")).rejects.toMatchObject({ code: "invalid_token" });
  });

  it("arms a ~72h deadline on the right token, and is idempotent", async () => {
    const gameId = await seedGame();
    const id = await seedDmcaReport(gameId, { token: "tok" });

    const first = await verifyReport(id, "tok");
    expect(first.alreadyVerified).toBe(false);

    const armed = await reportById(id);
    expect(armed.verifiedAt).not.toBeNull();
    expect(armed.dmcaDeadlineAt).not.toBeNull();
    expect(armed.dmcaDeadlineAt!.getTime()).toBeGreaterThan(Date.now() + 71 * 3600_000);

    // a future deadline does not yet suspend
    expect(await isDmcaSuspended(gameId)).toBe(false);

    // a second click is a no-op success and leaves the deadline intact
    const second = await verifyReport(id, "tok");
    expect(second.alreadyVerified).toBe(true);
    const again = await reportById(id);
    expect(again.dmcaDeadlineAt!.getTime()).toBe(armed.dmcaDeadlineAt!.getTime());
  });

  it("suspends serving once a verified deadline has passed", async () => {
    const gameId = await seedGame();
    const id = await seedDmcaReport(gameId, { token: "tok" });
    await verifyReport(id, "tok");
    // backdate the armed deadline into the past
    await db
      .update(schema.reports)
      .set({ dmcaDeadlineAt: new Date(Date.now() - 1000) })
      .where(eq(schema.reports.id, id));
    expect(await isDmcaSuspended(gameId)).toBe(true);
  });
});

describe("dismissReport + openReportCount", () => {
  it("counts open tickets and closes one on dismissal", async () => {
    await db.insert(schema.users).values({
      id: "mod-1",
      email: "mod@rk8.local",
      createdAt: new Date(),
    });
    const gameId = await seedGame();
    const { id } = await createReport(
      { gameId, type: "wrong_info", body: "wrong publisher listed" },
      null,
    );

    expect(await openReportCount()).toBe(1);

    await dismissReport({ actorId: "mod-1", reportId: id });
    expect(await openReportCount()).toBe(0);

    // dismissing a closed ticket is rejected
    await expect(dismissReport({ actorId: "mod-1", reportId: id })).rejects.toMatchObject({
      code: "not_open",
    });
  });
});
