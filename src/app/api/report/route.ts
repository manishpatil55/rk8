import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/guards";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { ReportError, ReportSchema, createReport } from "@/lib/reports";

export const runtime = "nodejs";

/**
 * POST /api/report — file a report / DMCA notice on a public game page.
 * Intentionally open to anonymous callers (rights-holders won't register) so
 * the only abuse controls are: per-IP rate limit, strict Zod, and the fact
 * that a dmca report requires the sworn §512(c)(3) elements before its 72h
 * clock can start (see lib/reports). A logged-in reporter is recorded for the
 * audit trail but auth is never required.
 */
export async function POST(req: Request) {
  const ip = clientIp(req);
  // tight: a handful per IP per 10 min — generous for real reporters, hostile to spam
  if (!rateLimit(`report:${ip}`, 5, 10 * 60_000).ok)
    return NextResponse.json({ error: "rate" }, { status: 429 });

  const parsed = ReportSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: "invalid", issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );

  const user = await getCurrentUser();
  try {
    const result = await createReport(parsed.data, user?.id ?? null);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    if (e instanceof ReportError)
      return NextResponse.json({ error: e.code, message: e.message }, { status: 400 });
    console.error("[report]", e);
    return NextResponse.json({ error: "server" }, { status: 500 });
  }
}
