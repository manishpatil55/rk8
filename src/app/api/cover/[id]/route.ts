import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/db";
import { storage } from "@/lib/storage";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const [game] = await db
    .select({ coverPath: schema.games.coverPath, status: schema.games.status })
    .from(schema.games)
    .where(eq(schema.games.id, id))
    .limit(1);

  if (
    !game ||
    game.status !== "approved" ||
    !game.coverPath ||
    !storage.exists(game.coverPath)
  ) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const type = game.coverPath.endsWith(".png") ? "image/png" : "image/jpeg";
  return new Response(storage.stream(game.coverPath), {
    headers: {
      "Content-Type": type,
      "Cache-Control": "public, max-age=86400, immutable",
    },
  });
}
