import "server-only";

/**
 * Auth configuration — pluggable OAuth providers + the dev fallback flag.
 *
 * Production login is OAuth (Discord + Google), each minting our own
 * server-side session. A provider only appears in the UI when its
 * client id/secret are present, so a fresh clone still boots; the dev
 * seeded-admin path covers local/CI use with zero external setup.
 *
 * Adding a provider = one entry here. Nothing else hard-codes provider names.
 */

export type ProviderId = "discord" | "google";

/** normalized identity every provider must resolve to */
export interface OAuthIdentity {
  sub: string;
  email: string | null;
  emailVerified: boolean;
  name: string | null;
  avatarUrl: string | null;
}

export interface OAuthProvider {
  id: ProviderId;
  label: string;
  authUrl: string;
  tokenUrl: string;
  userinfoUrl: string;
  scope: string;
  clientId: string;
  clientSecret: string;
  /** whether credentials are configured (controls UI visibility) */
  configured: boolean;
  /** map the provider's userinfo payload to our normalized identity */
  mapUser: (raw: Record<string, unknown>) => OAuthIdentity;
}

/** dev-only seeded-admin login. Hard-off in production builds. */
export const DEV_AUTH =
  process.env.NODE_ENV !== "production" && process.env.DEV_AUTH === "1";
export const DEV_AUTH_EMAIL = process.env.DEV_AUTH_EMAIL ?? "admin@rk8.local";
export const DEV_AUTH_PASSWORD = process.env.DEV_AUTH_PASSWORD ?? "rk8admin";

const env = (k: string) => process.env[k] ?? "";

const PROVIDERS: Record<ProviderId, OAuthProvider> = {
  discord: {
    id: "discord",
    label: "Discord",
    authUrl: "https://discord.com/oauth2/authorize",
    tokenUrl: "https://discord.com/api/oauth2/token",
    userinfoUrl: "https://discord.com/api/users/@me",
    scope: "identify email",
    clientId: env("DISCORD_CLIENT_ID"),
    clientSecret: env("DISCORD_CLIENT_SECRET"),
    configured: !!(env("DISCORD_CLIENT_ID") && env("DISCORD_CLIENT_SECRET")),
    mapUser: (r) => {
      const id = String(r.id ?? "");
      const avatar = r.avatar ? String(r.avatar) : null;
      return {
        sub: id,
        email: r.email ? String(r.email) : null,
        emailVerified: r.verified === true,
        name: (r.global_name as string) || (r.username as string) || null,
        avatarUrl:
          avatar && id
            ? `https://cdn.discordapp.com/avatars/${id}/${avatar}.png`
            : null,
      };
    },
  },
  google: {
    id: "google",
    label: "Google",
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    userinfoUrl: "https://openidconnect.googleapis.com/v1/userinfo",
    scope: "openid email profile",
    clientId: env("GOOGLE_CLIENT_ID"),
    clientSecret: env("GOOGLE_CLIENT_SECRET"),
    configured: !!(env("GOOGLE_CLIENT_ID") && env("GOOGLE_CLIENT_SECRET")),
    mapUser: (r) => ({
      sub: String(r.sub ?? ""),
      email: r.email ? String(r.email) : null,
      // userinfo returns a real boolean; some flows stringify it
      emailVerified: r.email_verified === true || r.email_verified === "true",
      name: (r.name as string) || null,
      avatarUrl: (r.picture as string) || null,
    }),
  },
};

export function getProvider(id: string): OAuthProvider | undefined {
  return (PROVIDERS as Record<string, OAuthProvider>)[id];
}

/** providers with credentials present — the ones we show buttons for */
export function enabledProviders(): OAuthProvider[] {
  return Object.values(PROVIDERS).filter((p) => p.configured);
}
