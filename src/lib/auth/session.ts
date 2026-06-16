import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { eq, lt } from "drizzle-orm";
import { db, schema } from "@/db";

/**
 * Server-side session layer. The cookie carries an opaque random token; only
 * its SHA-256 is stored (a DB leak can't be replayed as a live session). Bans
 * and sign-out delete the row → access dies on the very next request, which is
 * why we don't use stateless JWTs. The store is plain Drizzle today; the same
 * call sites work over Redis/Postgres at scale.
 */

const { sessions, users } = schema;

const PROD = process.env.NODE_ENV === "production";
// __Host- prefix hardens the cookie (requires Secure + path=/ + no Domain);
// dropped in dev because Secure cookies aren't sent over plain http.
export const SESSION_COOKIE = PROD ? "__Host-rk8_session" : "rk8_session";
const TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days, absolute

export type SessionUser = typeof users.$inferSelect;

const hashToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");

/** cookie attributes shared by the next/headers store and NextResponse.cookies */
export function sessionCookieAttributes(expires: Date) {
  return {
    httpOnly: true,
    sameSite: "lax" as const, // Lax: survives the OAuth redirect; blocks CSRF POSTs
    secure: PROD,
    path: "/",
    expires,
  };
}
const cookieOptions = sessionCookieAttributes;

/** mint a session for a user and return the raw token + expiry */
export async function createSession(
  userId: string,
): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + TTL_MS);
  await db.insert(sessions).values({
    id: hashToken(token),
    userId,
    expiresAt,
  });
  return { token, expiresAt };
}

export async function setSessionCookie(token: string, expiresAt: Date) {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, cookieOptions(expiresAt));
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.set(SESSION_COOKIE, "", cookieOptions(new Date(0)));
}

export async function readSessionToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(SESSION_COOKIE)?.value ?? null;
}

/**
 * Resolve a token to its user. Expired sessions are reaped; banned users are
 * rejected (and their sessions purged) regardless of token validity.
 */
export async function validateSessionToken(
  token: string,
): Promise<SessionUser | null> {
  const id = hashToken(token);
  const [row] = await db
    .select({ session: sessions, user: users })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(eq(sessions.id, id))
    .limit(1);

  if (!row) return null;
  if (row.session.expiresAt.getTime() <= Date.now()) {
    await db.delete(sessions).where(eq(sessions.id, id));
    return null;
  }
  if (row.user.bannedAt) {
    await db.delete(sessions).where(eq(sessions.userId, row.user.id));
    return null;
  }
  return row.user;
}

export async function invalidateSessionToken(token: string) {
  await db.delete(sessions).where(eq(sessions.id, hashToken(token)));
}

/** kill every session for a user — used on ban / strike-out / "sign out everywhere" */
export async function invalidateUserSessions(userId: string) {
  await db.delete(sessions).where(eq(sessions.userId, userId));
}

/** opportunistic GC of expired rows */
export async function reapExpiredSessions() {
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
}
