import { NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  invalidateSessionToken,
  readSessionToken,
  sessionCookieAttributes,
} from "@/lib/auth/session";

export const runtime = "nodejs";

/** POST /api/auth/signout — revoke the current session server-side + clear cookie */
export async function POST(req: Request) {
  const token = await readSessionToken();
  if (token) await invalidateSessionToken(token);
  const res = NextResponse.redirect(new URL("/", new URL(req.url).origin));
  res.cookies.set(SESSION_COOKIE, "", sessionCookieAttributes(new Date(0)));
  return res;
}
