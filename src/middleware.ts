import { NextResponse, type NextRequest } from "next/server";

/**
 * Coarse, edge-safe gate: bounce anonymous users away from auth-only surfaces
 * before the page renders. This only checks for a session cookie's PRESENCE —
 * it can't hit the DB on the edge. Authoritative validation and role checks
 * happen server-side in the pages (requireUser / requireRole). Anonymous play
 * is never gated.
 */
const SESSION_COOKIE =
  process.env.NODE_ENV === "production" ? "__Host-rk8_session" : "rk8_session";

export function middleware(req: NextRequest) {
  if (req.cookies.has(SESSION_COOKIE)) return NextResponse.next();
  const url = req.nextUrl.clone();
  const next = req.nextUrl.pathname + req.nextUrl.search;
  url.pathname = "/login";
  url.search = `?next=${encodeURIComponent(next)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/contribute/:path*", "/admin/:path*", "/profile/:path*"],
};
