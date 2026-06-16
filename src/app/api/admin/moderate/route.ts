import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/guards";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import {
  ModerateSchema,
  ModerationError,
  moderateGame,
} from "@/lib/moderation";

export const runtime = "nodejs";

/**
 * POST /api/admin/moderate — approve / reject / takedown a game. mod+ only.
 * SameSite=Lax on the session cookie blocks cross-site POSTs (CSRF); the
 * session + role are validated here regardless of the middleware cookie gate.
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "auth" }, { status: 401 });
  if (user.role !== "mod" && user.role !== "admin")
    return NextResponse.json({ error: "forbidden" }, { status: 403 });

  if (!rateLimit(`moderate:${user.id}:${clientIp(req)}`, 60, 60_000).ok)
    return NextResponse.json({ error: "rate" }, { status: 429 });

  const parsed = ModerateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: "invalid" }, { status: 400 });

  try {
    const result = await moderateGame({ actorId: user.id, ...parsed.data });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    if (e instanceof ModerationError)
      return NextResponse.json({ error: e.code, message: e.message }, { status: 400 });
    console.error("[moderate]", e);
    return NextResponse.json({ error: "server" }, { status: 500 });
  }
}
