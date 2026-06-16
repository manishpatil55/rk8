import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/guards";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import {
  SaveError,
  deleteSave,
  getSaveRow,
  putSave,
  validSlot,
} from "@/lib/saves";
import { storage } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ERR_STATUS: Record<string, number> = {
  bad_slot: 400,
  empty: 400,
  too_large: 413,
  shot_too_large: 413,
  game_not_found: 404,
};

async function ctx(params: Promise<{ gameId: string; slot: string }>) {
  const user = await getCurrentUser();
  const { gameId, slot } = await params;
  return { user, gameId, slot: Number(slot) };
}

/** PUT /api/saves/[gameId]/[slot] — upload (replace) a save slot. */
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ gameId: string; slot: string }> },
) {
  const { user, gameId, slot } = await ctx(params);
  if (!user) return NextResponse.json({ error: "auth" }, { status: 401 });
  if (!validSlot(slot)) return NextResponse.json({ error: "bad_slot" }, { status: 400 });
  if (!rateLimit(`save:${user.id}:${clientIp(req)}`, 60, 60_000).ok)
    return NextResponse.json({ error: "rate" }, { status: 429 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  const state = form.get("state");
  const shot = form.get("screenshot");
  if (!(state instanceof Blob))
    return NextResponse.json({ error: "invalid" }, { status: 400 });

  try {
    await putSave({
      userId: user.id,
      gameId,
      slot,
      state: Buffer.from(await state.arrayBuffer()),
      screenshot:
        shot instanceof Blob ? Buffer.from(await shot.arrayBuffer()) : null,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof SaveError)
      return NextResponse.json({ error: e.code }, { status: ERR_STATUS[e.code] ?? 400 });
    console.error("[saves PUT]", e);
    return NextResponse.json({ error: "server" }, { status: 500 });
  }
}

/** GET /api/saves/[gameId]/[slot] — download the save blob for resume. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ gameId: string; slot: string }> },
) {
  const { user, gameId, slot } = await ctx(params);
  if (!user) return NextResponse.json({ error: "auth" }, { status: 401 });
  if (!validSlot(slot)) return NextResponse.json({ error: "bad_slot" }, { status: 400 });

  const row = await getSaveRow(user.id, gameId, slot);
  if (!row || !storage.exists(row.blobPath))
    return NextResponse.json({ error: "not found" }, { status: 404 });

  return new Response(storage.stream(row.blobPath), {
    headers: {
      "Content-Type": "application/octet-stream",
      "Cache-Control": "private, no-store",
    },
  });
}

/** DELETE /api/saves/[gameId]/[slot] — eject a slot. */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ gameId: string; slot: string }> },
) {
  const { user, gameId, slot } = await ctx(params);
  if (!user) return NextResponse.json({ error: "auth" }, { status: 401 });
  if (!validSlot(slot)) return NextResponse.json({ error: "bad_slot" }, { status: 400 });

  await deleteSave(user.id, gameId, slot);
  return NextResponse.json({ ok: true });
}
