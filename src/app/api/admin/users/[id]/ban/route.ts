import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/guards";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { BanSchema, ModerationError, setUserBan } from "@/lib/moderation";

export const runtime = "nodejs";

/**
 * POST /api/admin/users/[id]/ban — ban or restore a user. ADMIN ONLY (mods can
 * moderate content but not accounts). Banning purges the user's sessions, so
 * access dies on their next request.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "auth" }, { status: 401 });
  if (user.role !== "admin")
    return NextResponse.json({ error: "forbidden" }, { status: 403 });

  if (!rateLimit(`ban:${user.id}:${clientIp(req)}`, 30, 60_000).ok)
    return NextResponse.json({ error: "rate" }, { status: 429 });

  const { id } = await params;
  const parsed = BanSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: "invalid" }, { status: 400 });

  try {
    const result = await setUserBan({
      actorId: user.id,
      targetId: id,
      ...parsed.data,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    if (e instanceof ModerationError)
      return NextResponse.json({ error: e.code, message: e.message }, { status: 400 });
    console.error("[ban]", e);
    return NextResponse.json({ error: "server" }, { status: 500 });
  }
}
