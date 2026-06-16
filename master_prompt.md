# MASTER PROMPT — "ROMVAULT // NIGHT CITY ARCADE" Retro Gaming Platform

> Recommended: Opus / Fable 5 for Phase 0–1 architecture, Sonnet for iteration phases.

---

You are the lead engineer building **ROMVAULT** — a browser-based retro gaming platform covering the entire classic era: every major console, handheld, arcade board, home computer, DOS game, and Flash game, playable instantly with zero installs. Functionally it competes with retrogames.cc but with a deeper system matrix and a far better interface: the terminal-grade minimalism of the Hermes Agent site fused with the UI language of Cyberpunk 2077. Built by one gamer for other gamers — non-commercial, no ads, no harm.

Work in the phases at the bottom. Before any code, restate the architecture, list assumptions and risks, and present a Phase 0 plan. **Wait for my explicit approval before executing. Repeat this approve-then-execute gate at the start of every phase.**

---

## 1. PRODUCT VISION — THREE WAYS TO PLAY

1. **Library Play** — browse the full system matrix, click any game, playing within 3 seconds. The seed library ships only with legal content: homebrew, public-domain, and open-licensed games (NES/GB/Genesis homebrew scenes, PDRoms, Freedoom, OpenTyrian, public-domain Flash/DOS titles). Document every seed source + license in `SEED_LICENSES.md`.
2. **Local Play (zero-upload)** — drag any ROM from your own device into the browser; it loads entirely client-side (ArrayBuffer/object URL), never touches the server, is never stored or logged. Prominent feature, clearly explained: "Your file never leaves your device."
3. **Community Library** — registered users submit games (ROM + metadata + cover). Everything enters a moderation queue; nothing is public until admin-approved. Every public game page has a Report / Takedown button. Full DMCA machinery (§8).

## 2. THE SYSTEM MATRIX (this is the heart of the product — implement ALL of it)

Navigation is a manufacturer-level mega-menu (like the reference screenshots): hover/tap a manufacturer → dropdown grid of its systems. Multi-engine under the hood; the user never sees engine names, only systems.

### Engine A — EmulatorJS (self-hosted, libretro WASM) — the workhorse

| Manufacturer menu | System | EJS core | File types |
|---|---|---|---|
| **NINTENDO** | NES / Famicom | fceumm | .nes |
| | Famicom Disk System | fceumm (+ disksys.rom via BIOS manager) | .fds |
| | SNES / Super Famicom | snes9x | .sfc .smc |
| | Game Boy | gambatte | .gb |
| | Game Boy Color | gambatte | .gbc |
| | Game Boy Advance | mgba | .gba |
| | Virtual Boy | beetle_vb | .vb |
| | Nintendo 64 | mupen64plus_next (fallback parallel-n64) | .z64 .n64 .v64 |
| | Nintendo DS | melonds (fallback desmume2015) | .nds |
| **SEGA** | SG-1000 | genesis_plus_gx | .sg |
| | Master System | genesis_plus_gx | .sms |
| | Game Gear | genesis_plus_gx | .gg |
| | Genesis / Mega Drive | genesis_plus_gx | .md .gen .bin |
| | Sega 32X | picodrive | .32x |
| | Sega CD / Mega CD | genesis_plus_gx (BIOS required) | .cue/.bin .chd |
| | Saturn | yabause (label EXPERIMENTAL, desktop only) | .cue/.bin .chd |
| **NEC** | TurboGrafx-16 / PC Engine | mednafen_pce | .pce |
| | TurboGrafx-CD / PC Engine CD | mednafen_pce (BIOS required) | .cue .chd |
| | PC-FX | mednafen_pcfx (BIOS required) | .cue .chd |
| **ATARI** | Atari 2600 | stella2014 | .a26 .bin |
| | Atari 5200 | a5200 | .a52 |
| | Atari 7800 | prosystem | .a78 |
| | Atari Lynx | handy | .lnx |
| | Atari Jaguar | virtualjaguar (label EXPERIMENTAL) | .j64 .jag |
| **PLAYSTATION** | PlayStation 1 | pcsx_rearmed | .cue/.bin .chd .pbp |
| | PSP | ppsspp (desktop recommended) | .iso .cso |
| **ARCADE** | Arcade (FBNeo) | fbneo | .zip (romset-version sensitive — document) |
| | Arcade (MAME 2003+) | mame2003_plus | .zip |
| | Neo Geo AES/MVS | fbneo (neogeo.zip BIOS via manager) | .zip |
| | CPS-1 / CPS-2 | fbalpha2012_cps1 / cps2 | .zip |
| **HANDHELD / OTHER** | Neo Geo Pocket / Color | mednafen_ngp | .ngp .ngc |
| | WonderSwan / Color | mednafen_wswan | .ws .wsc |
| | ColecoVision | gearcoleco (BIOS required) | .col |
| **COMPUTERS** | Commodore 64 | vice_x64 | .d64 .t64 .prg |
| | Amiga | puae (Kickstart BIOS via manager) | .adf |
| | 3DO | opera (BIOS required) | .iso .chd |
| | DOOM engine | prboom | .wad (seed with Freedoom) |

### Engine B — Ruffle (WASM Flash Player) — **FLASH** menu
- Self-host the Ruffle web build; play `.swf` in the same themed player chrome
- Same library/detail/play pipeline as everything else — Flash games are first-class citizens
- Seed with open-licensed/public-domain SWFs

### Engine C — js-dos (DOSBox WASM) — **DOS** menu
- `.jsdos` bundles / zipped DOS games; virtual keyboard overlay on mobile
- Seed with legal classics: shareware-licensed episodes where redistribution is permitted, Freedoom, OpenTyrian, etc.

### Engine abstraction (critical architecture)
Build one `EmulationEngine` interface — `load(rom, system, options)`, `saveState()`, `loadState()`, `screenshot()`, `setControls()`, `dispose()` — with three adapters (EJS / Ruffle / js-dos). The play page, save-state system, and UI chrome are written once against the interface. System → engine + core mapping lives in a single typed config file (`systems.config.ts`) — single source of truth driving nav, filters, upload validation, badges, and engine routing. Adding a future system = one config entry.

### Detection
On upload/local-load: extension + magic-byte sniffing → suggested system, always user-overridable. Arcade zips: filename lookup against a bundled FBNeo DAT name index for title suggestions.

## 3. TECH STACK (exact, flag strong objections in Phase 0)

- **Next.js 14+** App Router, TypeScript strict, server actions for mutations
- **EmulatorJS + Ruffle + js-dos all self-hosted and version-pinned** (no CDN hotlinks; document upgrade paths)
- **SQLite + Drizzle ORM**; storage on local disk behind a `StorageAdapter` interface (S3/R2 swappable)
- **Auth:** Lucia or Auth.js — anonymous play always allowed; account needed only to contribute/comment/sync saves
- **Tailwind + CSS custom properties** for the §5 token system; **Zod** on every boundary
- No paid services. `npm install && npm run dev` must boot everything.

## 4. FEATURE SPEC

### 4.1 Discovery
- Home: hero (see §5 signature), STAFF PICKS rail, RECENTLY INSERTED, MOST PLAYED, manufacturer rails
- Mega-menu nav exactly per the reference screenshots' structure: NINTENDO · SEGA · NEC · ATARI · PLAYSTATION · ARCADE · COMPUTERS · HANDHELD · DOS · FLASH
- `/library` with filters (system, manufacturer, genre, year, players, region) + instant client-side fuzzy search over title/alt-titles; URL-state-synced filters
- Game page `/play/[system]/[slug]`: cover, system badge, metadata, dominant ▶ PLAY, play count, related games, report button

### 4.2 Player
- Full-bleed engine canvas in custom-skinned chrome (one skin across all three engines)
- **Save states:** IndexedDB per game (keyed by SHA-256 for local files so they survive reloads); logged-in users sync to server, cap 10 slots/game
- **Gamepad:** native detection, "controller linked" toast, remap UI exposed
- **Mobile:** virtual touch gamepad (EJS built-in; custom overlay for js-dos), landscape prompt for handhelds
- Fullscreen, mute, fast-forward, rewind where the core supports it, screenshot (`{slug}-{timestamp}.png`), keyboard legend on `?`
- Per-system performance notes surfaced honestly (N64/Saturn/Jaguar/PSP flagged "heavy — desktop recommended")

### 4.3 BIOS Manager (legal architecture, not an afterthought)
**Never bundle, download, or proxy BIOS files.** `/bios` page lists every system needing one (PS1, Sega CD, TG-CD, PC-FX, Neo Geo, FDS, Coleco, Amiga, 3DO); user supplies their own, verified by SHA-256 against known-good hashes, stored **only in the user's IndexedDB**, injected into the engine at runtime. One-sentence explanation on the page of why this is on them.

### 4.4 Community uploads
- `/contribute` (auth): ROM ≤256 MB, title, system (auto-detected, overridable), description, year, cover (else generate a styled placeholder), **mandatory attestation checkbox**: "I have the right to share this file (homebrew / public domain / open license) and accept the Submission Policy."
- Server: magic-byte + extension validation, SHA-256 dedupe, size limits, rate limit 3 pending/user
- Lifecycle `pending → approved | rejected(reason) | takedown`; submitter sees status on profile
- `/admin`: moderation queue with **in-browser preview-play before approving**, approve/reject/ban/takedown one-click, all actions → `audit_log`

### 4.5 Compliance (non-negotiable, §8 details)

### 4.6 Phase-5 extras (only after everything above is solid)
Leaderboards by play count, comments (auth + moderation), shareable save-state links, RSS of approved games, Konami-code easter egg (triggers a full-screen CRT glitch + secret homebrew game)

## 5. DESIGN SYSTEM — "HERMES // NIGHT CITY"

Two reference points, fused deliberately:
- **Hermes Agent (Nous Research):** near-black canvas, monospace-driven type, hairline rules, uppercase micro-labels, quiet precision-instrument confidence. This is the **skeleton** — spacing, structure, typographic discipline, restraint.
- **Cyberpunk 2077 UI:** the **skin** — its exact visual language, not a vague "neon" pastiche. That means: signal yellow as the primary accent, cyan as the data/secondary accent, glitch as a transition language, and the angular notched-corner geometry CD Projekt uses everywhere.

This must read like CDPR's UI team designed a terminal, not like a Tailwind neon template. Restraint everywhere; boldness in exactly the places defined below.

**Tokens:**
- `--bg: #0A0A0C` · `--surface: #101014` · `--surface-2: #16161C` · `--line: #2A2A33` (1px hairlines, used heavily)
- `--text: #E8E6E1` · `--dim: #8A8A95`
- `--cp-yellow: #FCEE0A` — THE accent. Primary actions (▶ PLAY), active nav, focus rings, selection. Never decorative fills; it appears as edges, text, and thin bars.
- `--cp-cyan: #00F0FF` — data/secondary: stats, system metadata, links, scanline tint, loading states
- `--cp-red: #FF003C` — exclusively errors, reports, takedowns, glitch artifacts
- Manufacturer chips: desaturated muted hues (Nintendo dusty red, Sega steel blue, Atari amber, Sony slate, SNK ivory), tiny, never loud

**Geometry — the CP2077 signature:** key containers (cards, primary buttons, the player frame, dropdown panels) get a single clipped corner — `clip-path: polygon(...)` notching the top-right or bottom-left at 45°, 10–14px. One notch per element, consistent direction per element class. Everything else is square, 0 radius. No drop shadows; depth = hairlines + the rare glow.

**Typography:**
- Display/UI: characterful monospace — Berkeley Mono → JetBrains Mono → IBM Plex Mono
- Body/longform + ALL legal pages: IBM Plex Sans (legal text must be genuinely readable)
- Conventions: uppercase wide-tracked micro-labels with HUD syntax (`SYS // SNES`, `STATUS // ONLINE`, `/// LIBRARY`), lowercase command nav (`> library`, `> local play`, `> contribute`), cyan data readouts (`326 GAMES INDEXED`)

**Glitch language (used in exactly three places, nowhere else):**
1. **Hero wordmark** on home: ROMVAULT renders with a one-time 600ms RGB-split glitch on load, then sits permanently still with a slow 4s cursor blink
2. **Card hover**: 120ms micro-glitch (2px RGB channel offset, one frame of slice displacement) as the card "powers on" — hairline turns yellow, 3%-opacity scanline overlay fades in
3. **Page transitions into the player**: 200ms scanline wipe, then the emulator canvas "boots" with a single CRT power-on flicker, then permanently quiet
`prefers-reduced-motion`: every glitch collapses to instant border-color/opacity changes. No looping animations anywhere on the site.

**Signature element (the one bold move):** the **player frame**. The emulator canvas sits inside a HUD bezel — hairline frame with notched corners, yellow corner brackets (like a targeting reticle), a live cyan status row beneath it (`SYS // GENESIS · CORE // GENESIS_PLUS_GX · STATE // SLOT 3 · FPS // 60`), and the save-state slots rendered as a row of cartridge icons that fill yellow when occupied. This frame is identical across EJS, Ruffle, and js-dos — the unifying identity of the whole product.

**Microcopy voice:** terminal-laconic, never cute. `mounting rom...` · `no cartridges found — adjust filters` · `controller linked` · `state saved // slot 2` · takedown tombstone: `THIS CARTRIDGE WAS EJECTED // rights-holder request`. Errors state what failed and the fix. DMCA/legal pages drop the voice completely — plain professional English.

**Quality floor (unannounced, always):** responsive to 360px, visible yellow focus rings, full keyboard navigation of the mega-menu, semantic HTML, reduced-motion respected, dark-only (no light mode — own it), Lighthouse perf ≥90 on the library page.

## 6. DATA MODEL (Drizzle/SQLite)

```
users        (id, email, hash, role[user|mod|admin], strikes, created_at, banned_at?)
systems      → from systems.config.ts, not DB (single source of truth)
games        (id, slug, title, alt_titles, system_id, engine, year?, publisher?, genre?,
              players?, region?, description, cover_path?, rom_path, rom_sha256 UNIQUE,
              size_bytes, license_class[homebrew|public_domain|open|unverified],
              status[pending|approved|rejected|takedown], submitted_by?, play_count,
              created_at, published_at?, takedown_at?, takedown_reason?)
save_states  (id, user_id, game_id, slot, blob_path, created_at)   -- cap 10/user/game
reports      (id, game_id, reporter_email?, type[dmca|broken|wrong_info|other], body,
              status[open|actioned|dismissed], created_at, resolved_at?)
audit_log    (id, actor_id, action, target, meta_json, created_at)
sessions     (auth-lib managed)
```

## 7. ENGINEERING RULES

1. ROMs served only via authenticated streaming route `/api/rom/[id]`, `Content-Disposition: inline`, no direct links, no `/storage` listing
2. All three engines self-hosted + version-pinned; README documents each upgrade path
3. Every mutation: Zod + rate limiting; uploads checked for magic-byte/extension mismatch
4. Every moderation action → `audit_log`
5. Seed script `npm run seed`: 15–20 legal games spanning at least 8 systems + 2 Flash + 2 DOS (Freedoom included), sources/licenses in `SEED_LICENSES.md` — the site must demo beautifully out of the box
6. README: setup, mermaid architecture diagram, engine-adapter docs, storage-swap guide, moderation runbook, and a clearly-marked block for the operator's DMCA agent details

## 8. COMPLIANCE LAYER (build it properly, not as decoration)

- `/dmca`: full takedown policy — valid-notice elements per 17 U.S.C. §512(c)(3), designated-agent placeholder, counter-notice procedure, repeat-infringer policy (3 strikes → termination)
- `/legal`: platform hosts community-submitted content; emulators are legal software; no commercial copyrighted ROMs are intentionally distributed; prompt takedown response; trademarks belong to their owners; non-commercial fan project — "from one gamer to another"
- Report form on every game page → admin ticket; formal DMCA notices auto-unpublish the game after admin confirmation or 72h, whichever first
- Takedown tombstone page (styled, §5 voice)
- Footer everywhere: DMCA · Legal · Contact · BIOS policy

## 9. EXECUTION PHASES (approval gate before each)

- **Phase 0 — Plan:** restate architecture; risks (core compatibility, WASM payload sizes, mobile perf); scaffold repo; design tokens + layout shell + mega-menu (empty states). STOP for review.
- **Phase 1 — Engine core (make-or-break):** `EmulationEngine` interface + EJS adapter; player frame UI; Local Play page; one seeded homebrew game playable end-to-end with save states. STOP.
- **Phase 2 — The matrix:** `systems.config.ts` complete for ALL §2 systems; Ruffle + js-dos adapters; BIOS manager; full seed library; library grid/filters/search; game pages. STOP.
- **Phase 3 — Community + compliance:** auth, contribute flow, moderation queue + preview-play, admin panel, reports, DMCA/legal pages, audit log, server save sync. STOP.
- **Phase 4 — Polish:** mobile touch tuning per engine, gamepad UX, screenshots/rewind, perf pass (lazy-load cores per system, Lighthouse ≥90), README. STOP.
- **Phase 5 — Extras:** leaderboards, comments, shareable states, RSS, Konami easter egg.

**Acceptance test:** a stranger on a phone opens the site, finds a game through the mega-menu in under 15 seconds, plays it with touch controls, saves state, returns next day and resumes — on a different system family than the first game tested. A rights holder can locate and use the takedown process in under two minutes. A Flash game, a DOS game, and an NES game all play inside the identical player frame.

Begin with Phase 0. Show me your plan.



note here is the hermis website link https://hermes-agent.nousresearch.com/ this is the design refrance note it should have same font ,layout and minimal theme, but remember you can change as per your requirment. and also the some cyberpunk 2077 vibe into it as per your choice make it out of this world 
and you can change the name from romvault to whatever you want. i am thinking about "rk8" its sounds like arcade like something new and cool.
