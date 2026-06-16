import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/db";
import { storage } from "@/lib/storage";
import { romFilename, streamStored } from "@/lib/rom-response";

/**
 * The ONLY public way ROM bytes leave the server. No directory listing, no
 * direct /storage paths, Content-Disposition inline. Approved games stream to
 * anyone (anonymous play is a feature); everything else 404s — pending games
 * are admin-previewable via the authed /api/admin/rom/[id] route.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const [game] = await db
    .select()
    .from(schema.games)
    .where(eq(schema.games.id, id))
    .limit(1);

  if (!game || game.status !== "approved" || !storage.exists(game.romPath)) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  // approved rom bytes are immutable (sha-identified) — cache hard, allow offload
  return streamStored(req, game.romPath, {
    filename: romFilename(game.slug, game.romPath),
    cacheControl: "public, max-age=86400, immutable",
  });
}
