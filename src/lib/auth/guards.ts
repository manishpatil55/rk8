import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { readSessionToken, validateSessionToken, type SessionUser } from "./session";

/**
 * Authoritative, server-side auth checks. Pages/actions/route handlers call
 * these; middleware only does coarse cookie-presence gating for UX. Anonymous
 * play never touches any of this — guards are opt-in per protected surface.
 */

/** the signed-in user for this request, or null. Deduped per request. */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const token = await readSessionToken();
  if (!token) return null;
  return validateSessionToken(token);
});

/** require any signed-in user; bounce to /login with a return path otherwise */
export async function requireUser(next?: string): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) {
    const q = next ? `?next=${encodeURIComponent(next)}` : "";
    redirect(`/login${q}`);
  }
  return user;
}

export type Role = SessionUser["role"];

/** require one of the given roles; mods/admins gate moderation surfaces */
export async function requireRole(
  roles: Role[],
  next?: string,
): Promise<SessionUser> {
  const user = await requireUser(next);
  if (!roles.includes(user.role)) redirect("/");
  return user;
}
