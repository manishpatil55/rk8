import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/guards";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import {
  ReportError,
  actionReport,
  dismissReport,
} from "@/lib/reports";

export const runtime = "nodejs";

const Schema = z.object({
  reportId: z.string().min(1),
  action: z.enum(["action", "dismiss"]),
  reason: z.string().trim().max(500).optional(),
});

/**
 * POST /api/admin/reports — resolve a report ticket. mod+ only.
 * `action` takes the reported game down (and closes its sibling tickets);
 * `dismiss` closes the ticket with no game change. Both write audit rows.
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "auth" }, { status: 401 });
  if (user.role !== "mod" && user.role !== "admin")
    return NextResponse.json({ error: "forbidden" }, { status: 403 });

  if (!rateLimit(`reports:${user.id}:${clientIp(req)}`, 60, 60_000).ok)
    return NextResponse.json({ error: "rate" }, { status: 429 });

  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: "invalid" }, { status: 400 });

  try {
    if (parsed.data.action === "action") {
      await actionReport({
        actorId: user.id,
        reportId: parsed.data.reportId,
        reason: parsed.data.reason,
      });
    } else {
      await dismissReport({ actorId: user.id, reportId: parsed.data.reportId });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof ReportError)
      return NextResponse.json({ error: e.code, message: e.message }, { status: 400 });
    console.error("[admin/reports]", e);
    return NextResponse.json({ error: "server" }, { status: 500 });
  }
}
