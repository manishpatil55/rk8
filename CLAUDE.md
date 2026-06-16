# RK8:// — project guide for Claude Code

Browser-native retro gaming platform. Multi-engine (EmulatorJS + Ruffle + js-dos),
38 systems, anonymous instant play, community uploads with moderation, full DMCA
machinery. Aesthetic: **Hermes Agent terminal minimalism × Cyberpunk 2077**.

Full product spec: `master_prompt.md`. **It mandates an approve-then-execute gate
before each phase — present a plan and wait for explicit go-ahead before writing
phase code.**

## Stack
Next.js 15 (App Router, RSC, route handlers), TypeScript strict, Tailwind 4
(CSS-var token system), Drizzle ORM + SQLite (`better-sqlite3`), Zod on every
mutation boundary. `npm install && npm run dev` must boot everything.

## Commands
- `npm run dev` — boot (DB auto-creates + self-heals on first import)
- `npm run setup:engines` — provision EmulatorJS/Ruffle/js-dos into `public/engines/` (never committed)
- `npm run seed` — mount the legal starter library (idempotent; writes `SEED_LICENSES.md`)
- `npx tsc --noEmit` && `npx next build` — the two green-checks before declaring done
- `DEV_AUTH=1` in `.env` + `admin@rk8.local` / `rk8admin` — sign in with zero OAuth setup

## Architecture invariants (do not break)
- **`src/config/systems.config.ts` is the single source of truth.** It drives nav,
  filters, upload validation, BIOS manager, engine routing. Adding a system = one
  entry here, then `npm run setup:engines` to fetch its core.
- **`EmulationEngine` interface** (`src/engines/types.ts`) with EJS/Ruffle/js-dos
  adapters. Player UI is written once against the interface. Unsupported ops throw
  and are gated by `capabilities`.
- **`StorageAdapter`** (`src/lib/storage.ts`) — ROMs/covers/saves never sit at
  guessable paths. `streamUrl()` returns null (proxy) locally, a signed URL at
  scale. ROMs leave ONLY via `/api/rom/[id]` (approved-only, `Range`-capable).
- **Auth = our own revocable sessions** (`src/lib/auth/*`), see `memory` +
  `master_prompt`. OAuth (Discord/Google) → opaque token (SHA-256 stored) in the
  `sessions` table; ban/sign-out deletes the row = instant revocation. No JWTs,
  no auth SaaS. `getCurrentUser`/`requireUser`/`requireRole` are authoritative;
  `middleware.ts` is coarse UX-only gating.
- **Every mutation: Zod + rate limit** (`src/lib/ratelimit.ts`). Uploads also do
  extension allowlist + magic-byte sniff (`src/lib/detect.ts`) + SHA dedupe.

## Security rules (non-negotiable)
- Never store passwords in prod (OAuth only; dev fallback uses Node scrypt).
- Link OAuth identities by `(provider, sub)`; never auto-link into a privileged
  account by email. Require provider-verified email.
- Cookies: `httpOnly` + `SameSite=Lax` + `Secure`/`__Host-` in prod.
- Never bundle/proxy BIOS files — users supply their own (`/bios`, IndexedDB only).
- Sanitize anything user-derived placed in headers (e.g. `Content-Disposition`).

## Design system — "HERMES // NIGHT CITY" (`src/app/globals.css`)
Near-black canvas, monospace (JetBrains Mono UI / IBM Plex Sans legal), 1px
hairlines, uppercase HUD micro-labels (`SYS // SNES`), lowercase command nav
(`> library`). Yellow `#FCEE0A` = THE accent (edges/text/bars, never fills). Cyan
`#00F0FF` = data. Red `#FF003C` = errors/takedowns only. Single notched corner per
element (`.notch-tr`/`.notch-bl`). Glitch in exactly 3 places (hero load / card
hover / player boot). **Everything respects `prefers-reduced-motion`. No looping
animations except the cursor.** Command palette = ⌘K.

## Phase status
Phases 0–2 (engines, matrix, library, BIOS, seed) + 3a (auth) + 3b (`/contribute`)
done. Next: 3c admin/moderation + audit, 3d reports/DMCA, 3e legal pages, 3f save
sync. Player polish carry-over: fast-forward/rewind UI, `?` legend, fallback-core
retry, FBNeo DAT, real BIOS hashes. README (§7.6) not yet written.

## Conventions
- Match surrounding style: terminal-laconic microcopy, comment the *why*.
- Memory lives in the user's `~/.claude/.../memory`, NOT in this repo.
- Don't commit secrets/DB/engines (see `.gitignore`).
