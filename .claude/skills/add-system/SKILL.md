---
name: add-system
description: Add a new gaming system/console to the RK8 matrix end-to-end (config entry, engine core, detection, BIOS, verification). Use when the user wants to support a new platform.
---

# Add a system to the RK8 matrix

`src/config/systems.config.ts` is the single source of truth — one entry flows to
nav, filters, upload validation, BIOS manager, and engine routing.

## Steps
1. **Add the `SystemDef`** to `SYSTEMS` in `src/config/systems.config.ts`:
   - `id` (stable url segment), `name`, `shortName` (HUD badge), `manufacturer`
     (existing `ManufacturerId`), `engine` (`ejs`/`ruffle`/`jsdos`), `core` (+
     `fallbackCore` if any), `extensions` (lowercase, with dot), `yearIntro`, `order`.
   - Flags as honest: `experimental`, `heavy` ("desktop recommended"),
     `romsetSensitive` (arcade zips). BIOS systems: add `bios: { files: [...], note }`
     with known-good SHA-256 hashes — NEVER bundle BIOS.
2. **Provision the core**: `npm run setup:engines`. It parses cores from the config
   and mirrors the wasm; it WARNS if a core has no published wasm — resolve before
   shipping or the system won't boot.
3. **Detection** (`src/lib/detect.ts`): if the format has a reliable header, add a
   `SIG` entry so upload + Local Play validate by magic bytes, not just extension.
4. **Seed** (optional): add a legal SeedEntry (see the `seed-game` skill).
5. **Verify**: `npx tsc --noEmit`, `npx next build`, then boot a game on that engine
   via Local Play or a seeded title. Confirm the mega-menu shows it under its
   manufacturer and `/library?system=<id>` filters to it.

## Don'ts
- Don't hardcode the core name anywhere outside the config.
- Don't add un-proxied third-party assets (COEP `require-corp` is on site-wide).
