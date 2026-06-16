import { and, eq, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/db";
import { clientIp, rateLimit } from "@/lib/ratelimit";

/**
 * Play-count beacon: one POST per boot, debounced client-side. Rate-limited per
 * IP+game so the unauthenticated counter can't be spammed to inflate rankings
 * or hammer SQLite's single write lock. At scale, move counts to Redis and
 * flush periodically rather than UPDATE-per-boot.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  // at most a handful of counted boots per IP per game per hour
  if (!rateLimit(`play:${clientIp(req)}:${id}`, 5, 60 * 60_000).ok) {
    return NextResponse.json({ ok: true, counted: false });
  }
  await db
    .update(schema.games)
    .set({ playCount: sql`${schema.games.playCount} + 1` })
    .where(and(eq(schema.games.id, id), eq(schema.games.status, "approved")));
  return NextResponse.json({ ok: true, counted: true });
}
