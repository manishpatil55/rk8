import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import {
  MANUFACTURERS,
  SYSTEMS,
  type ManufacturerId,
} from "@/config/systems.config";

const { games } = schema;

export type Game = typeof games.$inferSelect;

const approved = eq(games.status, "approved");

export async function getStaffPicks(limit = 8): Promise<Game[]> {
  return db
    .select()
    .from(games)
    .where(and(approved, eq(games.staffPick, true)))
    .orderBy(desc(games.publishedAt))
    .limit(limit);
}

export async function getRecentlyInserted(limit = 8): Promise<Game[]> {
  return db
    .select()
    .from(games)
    .where(approved)
    .orderBy(desc(games.publishedAt))
    .limit(limit);
}

export async function getMostPlayed(limit = 8): Promise<Game[]> {
  return db
    .select()
    .from(games)
    .where(approved)
    // playCount is the rank; publishedAt breaks ties so the order is stable
    // (and newer arrivals edge out equally-unplayed older ones)
    .orderBy(desc(games.playCount), desc(games.publishedAt))
    .limit(limit);
}

export async function getApprovedCount(): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)` })
    .from(games)
    .where(approved);
  return row?.n ?? 0;
}

export async function getGameBySlug(
  systemId: string,
  slug: string,
): Promise<Game | undefined> {
  const [row] = await db
    .select()
    .from(games)
    .where(and(eq(games.systemId, systemId), eq(games.slug, slug)))
    .limit(1);
  return row;
}

/** any-status lookup by id — used by the public report form to label a ticket */
export async function getGameById(id: string): Promise<Game | undefined> {
  const [row] = await db.select().from(games).where(eq(games.id, id)).limit(1);
  return row;
}

export async function getRelatedGames(game: Game, limit = 4): Promise<Game[]> {
  return db
    .select()
    .from(games)
    .where(
      and(
        approved,
        eq(games.systemId, game.systemId),
        sql`${games.id} != ${game.id}`,
      ),
    )
    .orderBy(desc(games.playCount))
    .limit(limit);
}

export async function listApprovedGames(): Promise<Game[]> {
  return db.select().from(games).where(approved).orderBy(games.title);
}

/** a contributor's own submissions, any status, newest first (profile view) */
export async function getUserSubmissions(userId: string): Promise<Game[]> {
  return db
    .select()
    .from(games)
    .where(eq(games.submittedBy, userId))
    .orderBy(desc(games.createdAt));
}

export interface ManufacturerRail {
  id: ManufacturerId;
  label: string;
  games: Game[];
}

/**
 * Per-manufacturer home rails (§4.1). Manufacturer isn't on the game row —
 * it's derived from systemId via the matrix — so we group in memory. Only
 * manufacturers that actually have approved games surface, in nav order, top
 * `perRail` by play count.
 */
export async function getGamesByManufacturer(
  perRail = 8,
): Promise<ManufacturerRail[]> {
  const rows = await db
    .select()
    .from(games)
    .where(approved)
    .orderBy(desc(games.playCount), desc(games.publishedAt));

  const sysToMfr = new Map(SYSTEMS.map((s) => [s.id, s.manufacturer]));
  const byMfr = new Map<ManufacturerId, Game[]>();
  for (const g of rows) {
    const mfr = sysToMfr.get(g.systemId);
    if (!mfr) continue;
    const list = byMfr.get(mfr) ?? [];
    if (list.length < perRail) list.push(g);
    byMfr.set(mfr, list);
  }

  return MANUFACTURERS.filter((m) => (byMfr.get(m.id)?.length ?? 0) > 0).map(
    (m) => ({ id: m.id, label: m.label, games: byMfr.get(m.id)! }),
  );
}
