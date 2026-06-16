import "server-only";
import { createHash, randomBytes } from "node:crypto";
import type { OAuthIdentity, OAuthProvider } from "./config";

/**
 * Minimal, dependency-free OAuth 2.0 Authorization-Code + PKCE client.
 * One generic flow drives every provider in config.ts.
 */

const b64url = (b: Buffer) => b.toString("base64url");

/** random URL-safe token (state, nonce, PKCE verifier) */
export function randomUrlToken(bytes = 32): string {
  return b64url(randomBytes(bytes));
}

/** S256 PKCE challenge for a verifier */
export function pkceChallenge(verifier: string): string {
  return b64url(createHash("sha256").update(verifier).digest());
}

export function buildAuthorizeUrl(
  provider: OAuthProvider,
  opts: { redirectUri: string; state: string; codeChallenge: string },
): string {
  const u = new URL(provider.authUrl);
  u.searchParams.set("client_id", provider.clientId);
  u.searchParams.set("redirect_uri", opts.redirectUri);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("scope", provider.scope);
  u.searchParams.set("state", opts.state);
  // PKCE (S256) + state are the integrity controls for this auth-code flow;
  // the access token is bound to our verifier and identity comes from a
  // TLS-authenticated userinfo call. (No id_token validation, so no nonce —
  // shipping an unverified nonce would be misleading security theater.)
  u.searchParams.set("code_challenge", opts.codeChallenge);
  u.searchParams.set("code_challenge_method", "S256");
  if (provider.id === "google") {
    // ask for a refresh-free, account-chooser flow
    u.searchParams.set("prompt", "select_account");
  }
  return u.toString();
}

interface TokenResponse {
  access_token?: string;
  id_token?: string;
  error?: string;
  error_description?: string;
}

export async function exchangeCode(
  provider: OAuthProvider,
  opts: { code: string; redirectUri: string; codeVerifier: string },
): Promise<string> {
  const res = await fetch(provider.tokenUrl, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      accept: "application/json",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code: opts.code,
      redirect_uri: opts.redirectUri,
      client_id: provider.clientId,
      client_secret: provider.clientSecret,
      code_verifier: opts.codeVerifier,
    }),
  });
  const json = (await res.json()) as TokenResponse;
  if (!res.ok || !json.access_token) {
    throw new Error(
      `token exchange failed for ${provider.id}: ${json.error ?? res.status} ${
        json.error_description ?? ""
      }`,
    );
  }
  return json.access_token;
}

/* ── transaction cookie: carries state/nonce/PKCE across the redirect ────── */

// __Host- prefix in prod hardens against subdomain cookie-overwrite (login CSRF)
export const OAUTH_TXN_COOKIE =
  process.env.NODE_ENV === "production"
    ? "__Host-rk8_oauth_txn"
    : "rk8_oauth_txn";

export interface OAuthTxn {
  provider: string;
  state: string;
  verifier: string;
  next: string;
}

export function txnCookieAttributes(maxAgeSec = 600) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: maxAgeSec,
  };
}

export async function fetchIdentity(
  provider: OAuthProvider,
  accessToken: string,
): Promise<OAuthIdentity> {
  const res = await fetch(provider.userinfoUrl, {
    headers: { authorization: `Bearer ${accessToken}`, accept: "application/json" },
  });
  if (!res.ok) throw new Error(`userinfo failed for ${provider.id}: ${res.status}`);
  const raw = (await res.json()) as Record<string, unknown>;
  const id = provider.mapUser(raw);
  if (!id.sub) throw new Error(`userinfo missing subject for ${provider.id}`);
  return id;
}
