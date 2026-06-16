import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/db";
import { getCurrentUser } from "@/lib/auth/guards";
import { storage } from "@/lib/storage";
import { romFilename, streamStored } from "@/lib/rom-response";

export const runtime = "nodejs";

/**
 * Authed ROM preview for the moderation queue. Unlike /api/rom this serves a
 * game in ANY status (the whole point is previewing `pending` before approval),
 * so it is gated to mod/admin and never cached or offloaded — unapproved bytes
 * must not end up in a shared cache or behind a signed URL.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "auth" }, { status: 401 });
  if (user.role !== "mod" && user.role !== "admin")
    return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id } = await params;
  const [game] = await db
    .select()
    .from(schema.games)
    .where(eq(schema.games.id, id))
    .limit(1);

  if (!game || !storage.exists(game.romPath))
    return NextResponse.json({ error: "not found" }, { status: 404 });

  return streamStored(req, game.romPath, {
    filename: romFilename(game.slug, game.romPath),
    cacheControl: "private, no-store",
    allowOffload: false,
  });
}
