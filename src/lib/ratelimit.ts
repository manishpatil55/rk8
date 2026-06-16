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

/** best-effort client IP from proxy headers (for anonymous-endpoint limiting) */
export function clientIp(req: Request): string {
  const h = req.headers;
  return (
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    "local"
  );
}
