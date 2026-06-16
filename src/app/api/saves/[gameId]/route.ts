import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/guards";
import { listSaves } from "@/lib/saves";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/saves/[gameId] — this user's occupied save slots for the game. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ gameId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "auth" }, { status: 401 });
  const { gameId } = await params;
  const slots = await listSaves(user.id, gameId);
  return NextResponse.json({ slots });
}
