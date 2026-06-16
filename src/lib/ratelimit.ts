import "server-only";

/**
 * In-memory sliding-window rate limiter. Single-instance by design (v1 runs one
 * Node process). At scale, reimplement this exact signature over Redis/Upstash —
 * call sites don't change. NOT a security boundary on its own; pair with auth.
 */
const hits = new Map<string, number[]>();

export interface RateResult {
  ok: boolean;
  remaining: number;
  retryAfterMs: number;
}

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateResult {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) {
    hits.set(key, recent);
    return { ok: false, remaining: 0, retryAfterMs: windowMs - (now - recent[0]!) };
  }
  recent.push(now);
  hits.set(key, recent);
  return { ok: true, remaining: limit - recent.length, retryAfterMs: 0 };
}

/**
 * Client IP for anonymous-endpoint limiting.
 *
 * `X-Forwarded-For` is attacker-controlled EXCEPT for the entries appended by
 * your own reverse proxy / load balancer. Trusting the LEFTMOST entry (as the
 * old code did) lets anyone rotate the value per request and bypass every
 * anonymous rate limit. We instead step in from the RIGHT by the number of
 * trusted proxy hops in front of the app, landing on the IP the outermost
 * trusted proxy actually observed.
 *
 * Set `TRUSTED_PROXY_HOPS` to match your deployment (Vercel/single nginx = 1,
 * which is the default; LB + ingress = 2; etc.). With no proxy and no header we
 * fall back to a constant — coarse, but never spoofable.
 */
const TRUSTED_PROXY_HOPS = Math.max(
  0,
  Number(process.env.TRUSTED_PROXY_HOPS ?? 1) || 0,
);

export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff && TRUSTED_PROXY_HOPS > 0) {
    const parts = xff
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length > 0) {
      // the rightmost TRUSTED_PROXY_HOPS were appended by our infra; the entry
      // just before them is the furthest-left value we can still trust.
      const idx = Math.max(0, parts.length - TRUSTED_PROXY_HOPS);
      return parts[idx] ?? parts[parts.length - 1]!;
    }
  }
  // x-real-ip is only meaningful if set by your own proxy
  return req.headers.get("x-real-ip")?.trim() || "local";
}
