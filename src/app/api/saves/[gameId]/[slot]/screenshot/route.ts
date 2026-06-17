import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/guards";
import { getSaveRow, validSlot } from "@/lib/saves";
import { storage } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/saves/[gameId]/[slot]/screenshot — the slot's thumbnail (owner only). */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ gameId: string; slot: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "auth" }, { status: 401 });
  const { gameId, slot } = await params;
  const n = Number(slot);
  if (!validSlot(n)) return NextResponse.json({ error: "bad_slot" }, { status: 400 });

  const row = await getSaveRow(user.id, gameId, n);
  if (!row?.screenshotPath || !storage.exists(row.screenshotPath))
    return NextResponse.json({ error: "not found" }, { status: 404 });

  return new Response(storage.stream(row.screenshotPath), {
    headers: {
      "Content-Type": "image/png",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
