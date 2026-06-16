import { NextResponse } from "next/server";
import { getProvider } from "@/lib/auth/config";
import {
  OAUTH_TXN_COOKIE,
  buildAuthorizeUrl,
  pkceChallenge,
  randomUrlToken,
  txnCookieAttributes,
  type OAuthTxn,
} from "@/lib/auth/oauth";
import { safeNextPath } from "@/lib/auth/redirect";
import { clientIp, rateLimit } from "@/lib/ratelimit";

export const runtime = "nodejs";

/** GET /api/auth/signin/<provider> — begin the OAuth dance */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider: providerId } = await params;
  const provider = getProvider(providerId);
  const origin = new URL(req.url).origin;

  if (!provider || !provider.configured) {
    return NextResponse.redirect(new URL("/login?error=provider", origin));
  }
  // throttle the start endpoint to blunt txn-cookie flooding / abuse
  if (!rateLimit(`signin:${clientIp(req)}`, 20, 60_000).ok) {
    return NextResponse.redirect(new URL("/login?error=rate", origin));
  }

  const state = randomUrlToken();
  const verifier = randomUrlToken();
  const redirectUri = `${origin}/api/auth/callback/${provider.id}`;
  const next = safeNextPath(new URL(req.url).searchParams.get("next"));

  const authorizeUrl = buildAuthorizeUrl(provider, {
    redirectUri,
    state,
    codeChallenge: pkceChallenge(verifier),
  });

  const res = NextResponse.redirect(authorizeUrl);
  const txn: OAuthTxn = { provider: provider.id, state, verifier, next };
  res.cookies.set(OAUTH_TXN_COOKIE, JSON.stringify(txn), txnCookieAttributes());
  return res;
}
