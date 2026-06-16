import { NextResponse } from "next/server";
import { getProvider, type ProviderId } from "@/lib/auth/config";
import {
  OAUTH_TXN_COOKIE,
  exchangeCode,
  fetchIdentity,
  txnCookieAttributes,
  type OAuthTxn,
} from "@/lib/auth/oauth";
import {
  SESSION_COOKIE,
  createSession,
  sessionCookieAttributes,
} from "@/lib/auth/session";
import { AuthError, upsertOAuthIdentity } from "@/lib/auth/users";
import { safeNextPath } from "@/lib/auth/redirect";

export const runtime = "nodejs";

const fail = (origin: string, code: string) =>
  NextResponse.redirect(new URL(`/login?error=${code}`, origin));

/** GET /api/auth/callback/<provider> — finish OAuth, mint our session */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider: providerId } = await params;
  const url = new URL(req.url);
  const origin = url.origin;
  const provider = getProvider(providerId);
  if (!provider || !provider.configured) return fail(origin, "provider");

  // provider-side error (user denied, etc.)
  if (url.searchParams.get("error")) return fail(origin, "denied");

  // recover and clear the transaction cookie
  const raw = req.headers
    .get("cookie")
    ?.split(/;\s*/)
    .find((c) => c.startsWith(`${OAUTH_TXN_COOKIE}=`))
    ?.slice(OAUTH_TXN_COOKIE.length + 1);
  let txn: OAuthTxn | null = null;
  try {
    if (raw) txn = JSON.parse(decodeURIComponent(raw)) as OAuthTxn;
  } catch {
    txn = null;
  }

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  // CSRF: state must match, provider must match, code must exist
  if (!txn || !code || !state || txn.state !== state || txn.provider !== provider.id) {
    return fail(origin, "state");
  }

  try {
    const accessToken = await exchangeCode(provider, {
      code,
      redirectUri: `${origin}/api/auth/callback/${provider.id}`,
      codeVerifier: txn.verifier,
    });
    const identity = await fetchIdentity(provider, accessToken);
    const user = await upsertOAuthIdentity(provider.id as ProviderId, identity);

    const { token, expiresAt } = await createSession(user.id);
    // re-validate the stored next at use-time (defense in depth vs open-redirect)
    const res = NextResponse.redirect(new URL(safeNextPath(txn.next), origin));
    res.cookies.set(SESSION_COOKIE, token, sessionCookieAttributes(expiresAt));
    // expire the transaction cookie
    res.cookies.set(OAUTH_TXN_COOKIE, "", { ...txnCookieAttributes(0), maxAge: 0 });
    return res;
  } catch (e) {
    const code = e instanceof AuthError ? e.code : "exchange";
    return fail(origin, code);
  }
}
