import "server-only";
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import {
  DEV_AUTH,
  DEV_AUTH_EMAIL,
  DEV_AUTH_PASSWORD,
  type OAuthIdentity,
  type ProviderId,
} from "./config";
import { hashPassword, verifyPassword } from "./password";

const { users, oauthAccounts } = schema;
export type User = typeof users.$inferSelect;

/** typed auth failures so routes can map them to friendly redirects */
export class AuthError extends Error {
  constructor(public code: string) {
    super(code);
  }
}

async function getUserById(id: string): Promise<User | undefined> {
  const [u] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return u;
}

/**
 * Resolve an OAuth login to a user, creating or linking as needed.
 *
 * Identity is keyed by (provider, sub). A brand-new identity links to an
 * existing account ONLY by a provider-verified email match — never by an
 * unverified email — which closes the classic OAuth account-takeover hole.
 */
export async function upsertOAuthIdentity(
  provider: ProviderId,
  id: OAuthIdentity,
): Promise<User> {
  if (!id.email) throw new AuthError("email_required");
  if (!id.emailVerified) throw new AuthError("email_unverified");
  const email = id.email.toLowerCase();

  // 1. known identity → return its user
  const [link] = await db
    .select()
    .from(oauthAccounts)
    .where(
      and(
        eq(oauthAccounts.provider, provider),
        eq(oauthAccounts.providerSub, id.sub),
      ),
    )
    .limit(1);
  if (link) {
    const user = await getUserById(link.userId);
    if (!user) throw new AuthError("orphaned_identity");
    if (user.bannedAt) throw new AuthError("banned");
    return user;
  }

  // 2. new identity — link to an existing verified account by email, else create
  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  let user: User;
  if (existing) {
    if (existing.bannedAt) throw new AuthError("banned");
    // Anti-takeover: never AUTO-link a new provider into a privileged account.
    // Even though both emails are provider-verified, the weakest provider's
    // verification shouldn't be able to seize an admin/mod account. Privileged
    // accounts must link additional providers via an authenticated flow.
    if (existing.role !== "user") throw new AuthError("link_privileged");
    user = existing;
  } else {
    const [created] = await db
      .insert(users)
      .values({
        id: randomUUID(),
        email,
        name: id.name,
        avatarUrl: id.avatarUrl,
        emailVerified: true,
        role: "user",
        createdAt: new Date(),
      })
      .returning();
    if (!created) throw new AuthError("create_failed");
    user = created;
  }

  await db.insert(oauthAccounts).values({
    id: randomUUID(),
    userId: user.id,
    provider,
    providerSub: id.sub,
    createdAt: new Date(),
  });
  return user;
}

/* ── dev seeded-admin fallback (DEV_AUTH only) ──────────────────────────── */

async function ensureDevAdmin(): Promise<User> {
  const email = DEV_AUTH_EMAIL.toLowerCase();
  const [found] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (found) return found;
  const [created] = await db
    .insert(users)
    .values({
      id: randomUUID(),
      email,
      hash: hashPassword(DEV_AUTH_PASSWORD),
      name: "Dev Admin",
      emailVerified: true,
      role: "admin",
      createdAt: new Date(),
    })
    .returning();
  return created!;
}

/** dev-only email+password login. Throws unless DEV_AUTH is on. */
export async function devLogin(email: string, password: string): Promise<User> {
  if (!DEV_AUTH) throw new AuthError("dev_auth_disabled");
  if (email.toLowerCase() !== DEV_AUTH_EMAIL.toLowerCase())
    throw new AuthError("invalid_credentials");
  const admin = await ensureDevAdmin();
  if (!admin.hash || !verifyPassword(password, admin.hash))
    throw new AuthError("invalid_credentials");
  if (admin.bannedAt) throw new AuthError("banned");
  return admin;
}
