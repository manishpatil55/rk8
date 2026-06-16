---
name: security-audit
description: Run RK8's pre-ship security checklist before merging changes to auth, sessions, uploads, moderation, or serving. Use when finishing a security-sensitive phase or on request.
---

# RK8 security audit

For non-trivial security-sensitive changes, delegate the deep pass to the
`rk8-security-reviewer` subagent (adversarial, read-only). Use this checklist for
a fast self-review or to scope that agent.

## Checklist
- **Auth/OAuth**: state + PKCE verified on callback; `next` rejects `//`, `/\`,
  off-origin (`safeNextPath`); no auto-link into privileged accounts; provider
  email must be verified; identity keyed by `(provider, sub)`.
- **Sessions**: only SHA-256 of the token stored; ban/sign-out deletes the row;
  cookie `httpOnly` + `SameSite=Lax` + `Secure`/`__Host-` in prod.
- **Dev fallback**: 404 in prod (`NODE_ENV` + `DEV_AUTH`); rate-limited.
- **Every mutation**: Zod-validated + rate-limited (`src/lib/ratelimit.ts`).
- **Uploads**: auth + verified email + size cap (256MB) + extension allowlist +
  magic-byte (`checkMagic`) + SHA dedupe + pending cap; validate BEFORE writing
  bytes; storage keys pass `resolveKey` (no traversal).
- **Serving**: rom/cover/play approved-only; sanitize slug/filename in headers;
  `Range` handled; signed-URL hosts allowlisted if/when `streamUrl` is non-null.
- **Headers**: COOP/COEP/CORP + `nosniff` intact in `next.config.ts`; never add
  un-proxied third-party resources.

## Finish
Run `npx tsc --noEmit` and `npx next build`. For auth/upload changes, smoke-test
the real flow with `DEV_AUTH=1` (sign in, exercise the endpoint, confirm rejects).
