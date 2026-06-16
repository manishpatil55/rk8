import { NextResponse } from "next/server";
import { DEV_AUTH } from "@/lib/auth/config";
import {
  SESSION_COOKIE,
  createSession,
  sessionCookieAttributes,
} from "@/lib/auth/session";
import { AuthError, devLogin } from "@/lib/auth/users";
import { safeNextPath } from "@/lib/auth/redirect";
import { clientIp, rateLimit } from "@/lib/ratelimit";

export const runtime = "nodejs";

/** POST /api/auth/dev — dev seeded-admin login. 404 unless DEV_AUTH is on. */
export async function POST(req: Request) {
  const origin = new URL(req.url).origin;
  if (!DEV_AUTH) return new NextResponse("not found", { status: 404 });

  // brute-force throttle even on the dev path
  if (!rateLimit(`dev-login:${clientIp(req)}`, 10, 5 * 60_000).ok) {
    return NextResponse.redirect(new URL("/login?error=rate&dev=1", origin));
  }

  const form = await req.formData();
  const email = String(form.get("email") ?? "");
  const password = String(form.get("password") ?? "");
  const next = safeNextPath(form.get("next"));

  try {
    const user = await devLogin(email, password);
    const { token, expiresAt } = await createSession(user.id);
    const res = NextResponse.redirect(new URL(next, origin));
    res.cookies.set(SESSION_COOKIE, token, sessionCookieAttributes(expiresAt));
    return res;
  } catch (e) {
    const code = e instanceof AuthError ? e.code : "dev";
    return NextResponse.redirect(new URL(`/login?error=${code}&dev=1`, origin));
  }
}
