/**
 * RK8 seed — mounts the starter library: legal homebrew / open-licensed /
 * freeware-with-permission games spanning 9 system families + DOS + Flash.
 *
 * Sources and licenses for every title are written to SEED_LICENSES.md.
 * Re-runnable: games are deduped by ROM SHA-256; existing rows are kept.
 *
 *   npm run seed
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { strToU8, unzipSync, zipSync } from "fflate";
import { db, schema } from "../src/db";
import { getSystem } from "../src/config/systems.config";
import { sql } from "drizzle-orm";

/** fixed bundle timestamp so .jsdos zips are byte-identical across seed runs
 *  (fflate defaults mtime to wall-clock, which would re-hash DOS games every run) */
const BUNDLE_MTIME = new Date("2000-01-01T00:00:00Z");

const ROOT = path.resolve(__dirname, "..");
const CACHE = path.join(ROOT, ".seed-cache");
const DATA_DIR = process.env.RK8_DATA_DIR ?? path.join(ROOT, "data");
const STORE = path.join(DATA_DIR, "storage");

interface SeedEntry {
  title: string;
  slug: string;
  systemId: string;
  url: string;
  /** pick a single file out of a downloaded zip */
  pick?: RegExp;
  /** build a .jsdos bundle from the zip; value = autoexec lines after mount */
  dosRun?: string[];
  coverUrl?: string;
  licenseClass: "homebrew" | "public_domain" | "open";
  /** human license line for SEED_LICENSES.md + game page */
  license: string;
  description: string;
  year?: number;
  publisher?: string;
  genre?: string;
  players?: number;
  staffPick?: boolean;
  /** skip silently if the URL has died */
  optional?: boolean;
}

const rb = (repo: string, file: string) =>
  `https://raw.githubusercontent.com/retrobrews/${repo}/master/${file}`;

const SEEDS: SeedEntry[] = [
  /* ── NES ── */
  {
    title: "Lan Master",
    slug: "lan-master",
    systemId: "nes",
    url: "https://shiru.untergrund.net/files/nes/lan_master.zip",
    pick: /\.nes$/i,
    licenseClass: "homebrew",
    license: "Freeware homebrew by Shiru — distributed free via the author's site (shiru.untergrund.net)",
    description: "Connect every node to the network before the timer runs out. A pure-logic puzzler and one of the most polished NES homebrews ever shipped.",
    year: 2011,
    publisher: "Shiru",
    genre: "Puzzle",
    players: 1,
    staffPick: true,
  },
  {
    title: "Zooming Secretary",
    slug: "zooming-secretary",
    systemId: "nes",
    url: "https://shiru.untergrund.net/files/nes/zooming_secretary.zip",
    pick: /\.nes$/i,
    licenseClass: "homebrew",
    license: "Freeware homebrew by Shiru & PinWizz — distributed free via the author's site",
    description: "Answer phones, match clients, climb the office ladder. Arcade chaos with a wonderfully dumb premise.",
    year: 2011,
    publisher: "Shiru / PinWizz",
    genre: "Arcade",
    players: 1,
  },
  {
    title: "Chase",
    slug: "chase",
    systemId: "nes",
    url: "https://shiru.untergrund.net/files/nes/chase.zip",
    pick: /\.nes$/i,
    licenseClass: "homebrew",
    license: "Freeware homebrew by Shiru — distributed free via the author's site",
    description: "Top-down maze pursuit. Grab the loot, dodge the guards, don't stop moving.",
    year: 2012,
    publisher: "Shiru",
    genre: "Arcade",
    players: 1,
  },
  {
    title: "Driar",
    slug: "driar",
    systemId: "nes",
    url: rb("nes-games", "driar.nes"),
    coverUrl: rb("nes-games", "driar.png"),
    licenseClass: "homebrew",
    license: "Free NES homebrew by Stefan Adolfsson & David Eriksson, distributed with permission via the retrobrews collection",
    description: "Pastel-soaked precision platformer. Deceptively cute, genuinely hard.",
    year: 2012,
    genre: "Platformer",
    players: 1,
  },

  /* ── GAME BOY COLOR ── */
  {
    title: "µCity",
    slug: "ucity",
    systemId: "gbc",
    url: "https://github.com/AntonioND/ucity/releases/download/v1.3/ucity.gbc",
    licenseClass: "open",
    license: "GPL-3.0+ — source at github.com/AntonioND/ucity (official release binary)",
    description: "A full city-builder on the Game Boy Color. Zone districts, balance the budget, survive disasters — SimCity in 32 kilobytes of RAM.",
    year: 2018,
    publisher: "AntonioND",
    genre: "Simulation",
    players: 1,
    staffPick: true,
  },
  {
    title: "Geometrix",
    slug: "geometrix",
    systemId: "gbc",
    url: rb("gbc-games", "geometrix.gbc"),
    coverUrl: rb("gbc-games", "geometrix.png"),
    licenseClass: "open",
    license: "Open-source homebrew by AntonioND, distributed via the retrobrews collection",
    description: "Match-three with falling shapes and a relentless speed curve.",
    genre: "Puzzle",
    players: 1,
  },

  /* ── GAME BOY ADVANCE ── */
  {
    title: "Anguna: Warriors of Virtue",
    slug: "anguna",
    systemId: "gba",
    url: rb("gba-games", "anguna.gba"),
    coverUrl: rb("gba-games", "anguna.png"),
    licenseClass: "open",
    license: "Open-source homebrew (GPL) by Nathan Tolbert (gauauu) — bitethechili.com/anguna",
    description: "A complete Zelda-like dungeon crawler: items, bosses, secrets. The benchmark GBA homebrew.",
    year: 2008,
    publisher: "Bite the Chili",
    genre: "Action RPG",
    players: 1,
    staffPick: true,
  },

  /* ── GENESIS / MEGA DRIVE ── */
  {
    title: "Dragon's Castle",
    slug: "dragons-castle",
    systemId: "genesis",
    url: rb("md-games", "dragonscastle.bin"),
    coverUrl: rb("md-games", "dragonscastle.png"),
    licenseClass: "homebrew",
    license: "Free homebrew by Sik (sikthehedgehog), distributed with permission via the retrobrews collection",
    description: "Castlevania-flavored action platformer built from scratch for the Mega Drive.",
    genre: "Platformer",
    players: 1,
    staffPick: true,
  },
  {
    title: "Miniplanets",
    slug: "miniplanets",
    systemId: "genesis",
    url: rb("md-games", "miniplanets.bin"),
    coverUrl: rb("md-games", "miniplanets.png"),
    licenseClass: "homebrew",
    license: "Free homebrew by Playmedusa, distributed with permission via the retrobrews collection",
    description: "Hop between tiny rotating planets collecting stars before the clock dies. Mario Galaxy logic, 16-bit body.",
    genre: "Arcade",
    players: 1,
  },

  /* ── MASTER SYSTEM ── */
  {
    title: "Astro Force",
    slug: "astro-force",
    systemId: "sms",
    url: rb("sms-games", "astroforce.sms"),
    coverUrl: rb("sms-games", "astroforce.png"),
    licenseClass: "homebrew",
    license: "Free homebrew (SMS Power! community release), distributed with permission via the retrobrews collection",
    description: "Full-length R-Type-school shmup for the Master System — weapons, stages, bosses, no mercy.",
    genre: "Shoot-em-up",
    players: 1,
  },
  {
    title: "Data Storm",
    slug: "data-storm",
    systemId: "sms",
    url: rb("sms-games", "datastorm.sms"),
    coverUrl: rb("sms-games", "datastorm.png"),
    licenseClass: "homebrew",
    license: "Free homebrew (SMS Power! community release), distributed with permission via the retrobrews collection",
    description: "Fast-scrolling data-run arcade action.",
    genre: "Arcade",
    players: 1,
  },

  /* ── ATARI 2600 ── */
  {
    title: "Anguna 2600",
    slug: "anguna-2600",
    systemId: "atari2600",
    url: rb("atari2600-games", "anguna.bin"),
    coverUrl: rb("atari2600-games", "anguna.png"),
    licenseClass: "open",
    license: "Open-source homebrew by Nathan Tolbert (gauauu) — the 2600 demake of Anguna",
    description: "The GBA dungeon crawler crushed into 4K of 6502. Somehow still a Zelda-like.",
    genre: "Adventure",
    players: 1,
  },
  {
    title: "Bit Quest",
    slug: "bit-quest",
    systemId: "atari2600",
    url: rb("atari2600-games", "bitquest.bin"),
    coverUrl: rb("atari2600-games", "bitquest.png"),
    licenseClass: "homebrew",
    license: "Free homebrew, distributed with permission via the retrobrews collection",
    description: "Minimalist open-world adventure for the 2600.",
    genre: "Adventure",
    players: 1,
  },

  /* ── DOOM ENGINE ── */
  {
    title: "Freedoom: Phase 1",
    slug: "freedoom-phase-1",
    systemId: "doom",
    url: "https://github.com/freedoom/freedoom/releases/download/v0.13.0/freedoom-0.13.0.zip",
    pick: /freedoom1\.wad$/i,
    licenseClass: "open",
    license: "BSD-style license — freedoom.github.io; entirely free content for the DOOM engine",
    description: "Four full episodes of free-content DOOM. The Freedoom project's complete replacement IWAD, episode one through four.",
    year: 2024,
    publisher: "Freedoom Project",
    genre: "FPS",
    players: 1,
    staffPick: true,
  },
  {
    title: "Freedoom: Phase 2",
    slug: "freedoom-phase-2",
    systemId: "doom",
    url: "https://github.com/freedoom/freedoom/releases/download/v0.13.0/freedoom-0.13.0.zip",
    pick: /freedoom2\.wad$/i,
    licenseClass: "open",
    license: "BSD-style license — freedoom.github.io",
    description: "Thirty-two maps of free-content DOOM II-style action.",
    year: 2024,
    publisher: "Freedoom Project",
    genre: "FPS",
    players: 1,
  },

  /* ── DOS ── */
  {
    title: "Tyrian 2.1",
    slug: "tyrian",
    systemId: "dos",
    url: "https://camanis.net/tyrian/tyrian21.zip",
    dosRun: ["cd tyrian21", "tyrian.exe"],
    licenseClass: "open",
    license: "Released as freeware in 2004 by Jason Emery with Epic's blessing — canonical copy at camanis.net/tyrian",
    description: "One of the greatest DOS shmups ever made, released as freeware by its creator. Buy the fruit. Trust us.",
    year: 1995,
    publisher: "Epic MegaGames",
    genre: "Shoot-em-up",
    players: 1,
    staffPick: true,
  },
  {
    title: "DOOM (Shareware)",
    slug: "doom-shareware",
    systemId: "dos",
    url: "https://archive.org/download/DoomsharewareEpisode/doom.ZIP",
    dosRun: ["doom.exe"],
    licenseClass: "open",
    license: "Official shareware episode — id Software's shareware license explicitly permits redistribution of the unmodified package",
    description: "Knee-Deep in the Dead, the original shareware episode, running on real DOS in your tab.",
    year: 1993,
    publisher: "id Software",
    genre: "FPS",
    players: 1,
  },

  /* ── FLASH ── */
  {
    title: "Every Day the Same Dream",
    slug: "every-day-the-same-dream",
    systemId: "flash",
    url: "https://www.molleindustria.org/everydaythesamedream/everydaythesamedream.swf",
    licenseClass: "open",
    license: "CC BY-NC-SA — Molleindustria (molleindustria.org); non-commercial redistribution permitted",
    description: "Five minutes, one gray morning, repeated. Molleindustria's anti-game classic about routine and escape.",
    year: 2009,
    publisher: "Molleindustria",
    genre: "Art game",
    players: 1,
    staffPick: true,
  },
  {
    title: "The Free Culture Game",
    slug: "free-culture-game",
    systemId: "flash",
    url: "https://www.molleindustria.org/en/freeculturegame/freeculturegame.swf",
    licenseClass: "open",
    license: "CC BY-NC-SA — Molleindustria (molleindustria.org); non-commercial redistribution permitted",
    description: "Keep ideas flowing through the commons while the Vectorialist tries to enclose them into private property. Molleindustria's playable essay on free culture.",
    year: 2008,
    publisher: "Molleindustria",
    genre: "Art game",
    players: 1,
  },
];

/* ── helpers ────────────────────────────────────────────────────────────── */

const log = (m: string) => console.log(`[rk8:seed] ${m}`);

async function fetchCached(url: string): Promise<Buffer> {
  mkdirSync(CACHE, { recursive: true });
  const key = createHash("sha1").update(url).digest("hex");
  const file = path.join(CACHE, key);
  if (existsSync(file)) return readFileSync(file);
  const res = await fetch(url, {
    redirect: "follow",
    headers: { "user-agent": "rk8-seed (non-commercial homebrew library)" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(file, buf);
  return buf;
}

/** retrobrews default branch fallback: master → main */
async function fetchRom(url: string): Promise<Buffer> {
  try {
    return await fetchCached(url);
  } catch (e) {
    if (url.includes("/master/")) return fetchCached(url.replace("/master/", "/main/"));
    throw e;
  }
}

function buildJsdosBundle(zip: Buffer, autoexec: string[]): Buffer {
  const files = unzipSync(new Uint8Array(zip));
  const out: Record<string, Uint8Array> = {};
  for (const [name, data] of Object.entries(files)) {
    if (name.endsWith("/")) continue;
    out[name] = data;
  }
  const conf = [
    "[sdl]",
    "autolock=true",
    "",
    "[cpu]",
    "core=auto",
    "cputype=auto",
    "cycles=max",
    "",
    "[autoexec]",
    "mount c .",
    "c:",
    ...autoexec,
    "",
  ].join("\n");
  out[".jsdos/dosbox.conf"] = strToU8(conf);
  return Buffer.from(zipSync(out, { level: 6, mtime: BUNDLE_MTIME }));
}

function storagePut(key: string, data: Buffer) {
  const file = path.join(STORE, key);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, data);
}

const sha256 = (b: Buffer) => createHash("sha256").update(b).digest("hex");

/* ── main ───────────────────────────────────────────────────────────────── */

(async () => {
  let inserted = 0;
  let skipped = 0;
  const licenseLines: string[] = [];

  for (const seed of SEEDS) {
    const system = getSystem(seed.systemId);
    if (!system) throw new Error(`unknown system ${seed.systemId} for ${seed.title}`);

    let raw: Buffer;
    try {
      raw = await fetchRom(seed.url);
    } catch (e) {
      if (seed.optional) {
        log(`skip (source offline): ${seed.title}`);
        continue;
      }
      throw new Error(`${seed.title}: ${(e as Error).message}`);
    }

    /* transform: zip-pick or jsdos-bundle */
    let rom = raw;
    let ext = path.extname(new URL(seed.url).pathname).toLowerCase();
    if (seed.dosRun) {
      rom = buildJsdosBundle(raw, seed.dosRun);
      ext = ".jsdos";
    } else if (seed.pick) {
      const files = unzipSync(new Uint8Array(raw));
      const match = Object.keys(files).find((n) => seed.pick!.test(n));
      if (!match) throw new Error(`${seed.title}: nothing matches ${seed.pick} in zip`);
      rom = Buffer.from(files[match]!);
      ext = path.extname(match).toLowerCase();
    }

    if (!system.extensions.includes(ext))
      throw new Error(`${seed.title}: ${ext} not valid for ${system.id}`);

    const hash = sha256(rom);
    // idempotent re-runs: skip if this ROM (by content hash) OR this
    // system/slug already exists. The slug guard keeps re-seeding crash-free
    // even when an upstream source's bytes drift (its sha256 would differ but
    // games.(system_id, slug) is UNIQUE).
    const existing = await db
      .select({ id: schema.games.id, sha: schema.games.romSha256 })
      .from(schema.games)
      .where(
        sql`${schema.games.romSha256} = ${hash} or (${schema.games.systemId} = ${system.id} and ${schema.games.slug} = ${seed.slug})`,
      )
      .limit(1);
    if (existing.length > 0) {
      skipped++;
      if (existing[0]!.sha !== hash)
        log(`note: ${seed.title} source bytes changed since first seed — keeping existing row`);
      licenseLines.push(seedLicenseLine(seed));
      continue;
    }

    const romKey = `roms/${hash}${ext}`;
    storagePut(romKey, rom);

    let coverKey: string | null = null;
    if (seed.coverUrl) {
      try {
        const cover = await fetchRom(seed.coverUrl);
        coverKey = `covers/${hash}.png`;
        storagePut(coverKey, cover);
      } catch {
        log(`cover offline for ${seed.title} — placeholder will render`);
      }
    }

    const now = new Date();
    await db.insert(schema.games).values({
      id: crypto.randomUUID(),
      slug: seed.slug,
      title: seed.title,
      systemId: system.id,
      engine: system.engine,
      year: seed.year ?? null,
      publisher: seed.publisher ?? null,
      genre: seed.genre ?? null,
      players: seed.players ?? null,
      description: seed.description,
      coverPath: coverKey,
      romPath: romKey,
      romSha256: hash,
      sizeBytes: rom.length,
      licenseClass: seed.licenseClass,
      licenseNote: seed.license,
      status: "approved",
      staffPick: seed.staffPick ?? false,
      playCount: 0,
      createdAt: now,
      publishedAt: now,
    });
    inserted++;
    licenseLines.push(seedLicenseLine(seed));
    log(`mounted: ${seed.title} [${system.shortName}] ${(rom.length / 1024).toFixed(0)}KB`);
  }

  writeFileSync(
    path.join(ROOT, "SEED_LICENSES.md"),
    [
      "# RK8 Seed Library — Sources & Licenses",
      "",
      "Every game in the seed library is homebrew, public-domain, open-licensed,",
      "or freeware whose redistribution is explicitly permitted. Nothing in the",
      "seed is a commercial ROM. Sources:",
      "",
      ...licenseLines,
      "",
      "_Regenerated by `npm run seed`._",
      "",
    ].join("\n"),
  );

  log(`done — ${inserted} mounted, ${skipped} already present. SEED_LICENSES.md written.`);
  process.exit(0);
})().catch((e) => {
  console.error(`[rk8:seed] FAILED: ${e.message}`);
  process.exit(1);
});

function seedLicenseLine(seed: SeedEntry): string {
  return `- **${seed.title}** (${seed.systemId}) — ${seed.license}. Source: <${seed.url}>`;
}
