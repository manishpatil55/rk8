import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/guards";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { ContributeError, submitGame } from "@/lib/contribute";

export const runtime = "nodejs";

/**
 * POST /api/contribute — authenticated game submission. SameSite=Lax on the
 * session cookie blocks cross-site POSTs (CSRF), and the session is validated
 * server-side here regardless of the middleware cookie-presence gate.
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "auth" }, { status: 401 });
  if (user.bannedAt) return NextResponse.json({ error: "banned" }, { status: 403 });
  if (!user.emailVerified)
    return NextResponse.json({ error: "email" }, { status: 403 });

  // per-user submission throttle (the 3-pending cap is enforced in submitGame)
  if (!rateLimit(`contribute:${user.id}:${clientIp(req)}`, 5, 60_000).ok)
    return NextResponse.json({ error: "rate" }, { status: 429 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "form" }, { status: 400 });
  }

  const rom = form.get("rom");
  if (!(rom instanceof File))
    return NextResponse.json({ error: "no_rom" }, { status: 400 });
  const cover = form.get("cover");

  try {
    const result = await submitGame({
      userId: user.id,
      rom,
      cover: cover instanceof File ? cover : null,
      fields: {
        title: form.get("title"),
        systemId: form.get("systemId"),
        description: form.get("description"),
        year: form.get("year"),
        players: form.get("players"),
        licenseClass: form.get("licenseClass"),
      },
      attested: form.get("attestation") === "on",
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    if (e instanceof ContributeError)
      return NextResponse.json(
        { error: e.code, message: e.message },
        { status: 400 },
      );
    console.error("[contribute]", e);
    return NextResponse.json({ error: "server" }, { status: 500 });
  }
}
