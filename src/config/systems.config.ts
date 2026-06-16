/**
 * RK8 SYSTEM MATRIX — single source of truth.
 *
 * This file drives: mega-menu nav, library filters, upload validation,
 * system badges, file-type detection, BIOS manager, and engine routing.
 * Adding a future system = one entry here. Nothing else knows core names.
 *
 * Engines:  ejs    = EmulatorJS (libretro WASM) — the workhorse
 *           ruffle = Ruffle (WASM Flash Player)
 *           jsdos  = js-dos (DOSBox WASM)
 */

export type EngineId = "ejs" | "ruffle" | "jsdos";

export type ManufacturerId =
  | "nintendo"
  | "sega"
  | "nec"
  | "atari"
  | "playstation"
  | "arcade"
  | "handheld"
  | "computers"
  | "dos"
  | "flash";

export interface ManufacturerDef {
  id: ManufacturerId;
  /** mega-menu label, uppercase by convention */
  label: string;
  /** css color token suffix for the (tiny, desaturated) chip */
  chip: string;
  order: number;
}

export interface BiosFileDef {
  /** filename the core expects, e.g. "scph5501.bin" */
  fileName: string;
  label: string;
  /** known-good SHA-256 hashes (lowercase hex); empty = accept-with-warning */
  sha256: string[];
  optional?: boolean;
}

export interface SystemDef {
  /** stable id + url segment: /play/[system]/[slug] */
  id: string;
  name: string;
  /** HUD badge text: SYS // SNES */
  shortName: string;
  manufacturer: ManufacturerId;
  engine: EngineId;
  /** libretro core (ejs only) */
  core?: string;
  /** tried automatically if the primary core fails to boot */
  fallbackCore?: string;
  /** accepted file extensions, lowercase, with dot */
  extensions: string[];
  /** user-supplied via /bios manager, IndexedDB only — never server-side */
  bios?: { files: BiosFileDef[]; note: string };
  /** honest per-system flags, surfaced in UI */
  experimental?: boolean;
  /** "heavy — desktop recommended" */
  heavy?: boolean;
  /** arcade zips are romset-version sensitive; changes detection + upload copy */
  romsetSensitive?: boolean;
  yearIntro: number;
  /** ordering inside the manufacturer dropdown */
  order: number;
}

/* ── manufacturers — mega-menu top level, in nav order ──────────────────── */

export const MANUFACTURERS: readonly ManufacturerDef[] = [
  { id: "nintendo", label: "NINTENDO", chip: "mfr-nintendo", order: 1 },
  { id: "sega", label: "SEGA", chip: "mfr-sega", order: 2 },
  { id: "nec", label: "NEC", chip: "mfr-nec", order: 3 },
  { id: "atari", label: "ATARI", chip: "mfr-atari", order: 4 },
  { id: "playstation", label: "PLAYSTATION", chip: "mfr-playstation", order: 5 },
  { id: "arcade", label: "ARCADE", chip: "mfr-arcade", order: 6 },
  { id: "computers", label: "COMPUTERS", chip: "mfr-computers", order: 7 },
  { id: "handheld", label: "HANDHELD", chip: "mfr-snk", order: 8 },
  { id: "dos", label: "DOS", chip: "mfr-dos", order: 9 },
  { id: "flash", label: "FLASH", chip: "mfr-flash", order: 10 },
] as const;

/* ── the matrix ─────────────────────────────────────────────────────────── */

export const SYSTEMS: readonly SystemDef[] = [
  /* ── NINTENDO ── */
  {
    id: "nes",
    name: "NES / Famicom",
    shortName: "NES",
    manufacturer: "nintendo",
    engine: "ejs",
    core: "fceumm",
    extensions: [".nes"],
    yearIntro: 1983,
    order: 1,
  },
  {
    id: "fds",
    name: "Famicom Disk System",
    shortName: "FDS",
    manufacturer: "nintendo",
    engine: "ejs",
    core: "fceumm",
    extensions: [".fds"],
    bios: {
      files: [{ fileName: "disksys.rom", label: "FDS BIOS (disksys.rom)", sha256: [] }],
      note: "Famicom Disk System games need the FDS BIOS to boot.",
    },
    yearIntro: 1986,
    order: 2,
  },
  {
    id: "snes",
    name: "SNES / Super Famicom",
    shortName: "SNES",
    manufacturer: "nintendo",
    engine: "ejs",
    core: "snes9x",
    extensions: [".sfc", ".smc"],
    yearIntro: 1990,
    order: 3,
  },
  {
    id: "gb",
    name: "Game Boy",
    shortName: "GB",
    manufacturer: "nintendo",
    engine: "ejs",
    core: "gambatte",
    extensions: [".gb"],
    yearIntro: 1989,
    order: 4,
  },
  {
    id: "gbc",
    name: "Game Boy Color",
    shortName: "GBC",
    manufacturer: "nintendo",
    engine: "ejs",
    core: "gambatte",
    extensions: [".gbc"],
    yearIntro: 1998,
    order: 5,
  },
  {
    id: "gba",
    name: "Game Boy Advance",
    shortName: "GBA",
    manufacturer: "nintendo",
    engine: "ejs",
    core: "mgba",
    extensions: [".gba"],
    yearIntro: 2001,
    order: 6,
  },
  {
    id: "vb",
    name: "Virtual Boy",
    shortName: "VB",
    manufacturer: "nintendo",
    engine: "ejs",
    core: "beetle_vb",
    extensions: [".vb"],
    yearIntro: 1995,
    order: 7,
  },
  {
    id: "n64",
    name: "Nintendo 64",
    shortName: "N64",
    manufacturer: "nintendo",
    engine: "ejs",
    core: "mupen64plus_next",
    fallbackCore: "parallel_n64",
    extensions: [".z64", ".n64", ".v64"],
    heavy: true,
    yearIntro: 1996,
    order: 8,
  },
  {
    id: "nds",
    name: "Nintendo DS",
    shortName: "NDS",
    manufacturer: "nintendo",
    engine: "ejs",
    core: "melonds",
    fallbackCore: "desmume2015",
    extensions: [".nds"],
    heavy: true,
    yearIntro: 2004,
    order: 9,
  },

  /* ── SEGA ── */
  {
    id: "sg1000",
    name: "SG-1000",
    shortName: "SG-1000",
    manufacturer: "sega",
    engine: "ejs",
    core: "genesis_plus_gx",
    extensions: [".sg"],
    yearIntro: 1983,
    order: 1,
  },
  {
    id: "sms",
    name: "Master System",
    shortName: "SMS",
    manufacturer: "sega",
    engine: "ejs",
    core: "genesis_plus_gx",
    extensions: [".sms"],
    yearIntro: 1985,
    order: 2,
  },
  {
    id: "gamegear",
    name: "Game Gear",
    shortName: "GG",
    manufacturer: "sega",
    engine: "ejs",
    core: "genesis_plus_gx",
    extensions: [".gg"],
    yearIntro: 1990,
    order: 3,
  },
  {
    id: "genesis",
    name: "Genesis / Mega Drive",
    shortName: "GEN",
    manufacturer: "sega",
    engine: "ejs",
    core: "genesis_plus_gx",
    extensions: [".md", ".gen", ".bin"],
    yearIntro: 1988,
    order: 4,
  },
  {
    id: "sega32x",
    name: "Sega 32X",
    shortName: "32X",
    manufacturer: "sega",
    engine: "ejs",
    core: "picodrive",
    extensions: [".32x"],
    yearIntro: 1994,
    order: 5,
  },
  {
    id: "segacd",
    name: "Sega CD / Mega CD",
    shortName: "SEGA-CD",
    manufacturer: "sega",
    engine: "ejs",
    core: "genesis_plus_gx",
    extensions: [".cue", ".bin", ".chd"],
    bios: {
      files: [
        { fileName: "bios_CD_U.bin", label: "Sega CD BIOS (US)", sha256: [], optional: true },
        { fileName: "bios_CD_E.bin", label: "Mega CD BIOS (EU)", sha256: [], optional: true },
        { fileName: "bios_CD_J.bin", label: "Mega CD BIOS (JP)", sha256: [], optional: true },
      ],
      note: "Sega CD needs the boot BIOS for your game's region (at least one).",
    },
    yearIntro: 1991,
    order: 6,
  },
  {
    id: "saturn",
    name: "Saturn",
    shortName: "SATURN",
    manufacturer: "sega",
    engine: "ejs",
    core: "yabause",
    extensions: [".cue", ".bin", ".chd"],
    experimental: true,
    heavy: true,
    yearIntro: 1994,
    order: 7,
  },

  /* ── NEC ── */
  {
    id: "pce",
    name: "TurboGrafx-16 / PC Engine",
    shortName: "PCE",
    manufacturer: "nec",
    engine: "ejs",
    core: "mednafen_pce",
    extensions: [".pce"],
    yearIntro: 1987,
    order: 1,
  },
  {
    id: "pcecd",
    name: "TurboGrafx-CD / PC Engine CD",
    shortName: "PCE-CD",
    manufacturer: "nec",
    engine: "ejs",
    core: "mednafen_pce",
    extensions: [".cue", ".chd"],
    bios: {
      files: [{ fileName: "syscard3.pce", label: "Super System Card 3.0", sha256: [] }],
      note: "CD games need the System Card BIOS.",
    },
    yearIntro: 1988,
    order: 2,
  },
  {
    id: "pcfx",
    name: "PC-FX",
    shortName: "PC-FX",
    manufacturer: "nec",
    engine: "ejs",
    core: "mednafen_pcfx",
    extensions: [".cue", ".chd"],
    bios: {
      files: [{ fileName: "pcfx.rom", label: "PC-FX BIOS (pcfx.rom)", sha256: [] }],
      note: "PC-FX requires its BIOS ROM.",
    },
    yearIntro: 1994,
    order: 3,
  },

  /* ── ATARI ── */
  {
    id: "atari2600",
    name: "Atari 2600",
    shortName: "2600",
    manufacturer: "atari",
    engine: "ejs",
    core: "stella2014",
    extensions: [".a26", ".bin"],
    yearIntro: 1977,
    order: 1,
  },
  {
    id: "atari5200",
    name: "Atari 5200",
    shortName: "5200",
    manufacturer: "atari",
    engine: "ejs",
    core: "a5200",
    extensions: [".a52"],
    yearIntro: 1982,
    order: 2,
  },
  {
    id: "atari7800",
    name: "Atari 7800",
    shortName: "7800",
    manufacturer: "atari",
    engine: "ejs",
    core: "prosystem",
    extensions: [".a78"],
    yearIntro: 1986,
    order: 3,
  },
  {
    id: "lynx",
    name: "Atari Lynx",
    shortName: "LYNX",
    manufacturer: "atari",
    engine: "ejs",
    core: "handy",
    extensions: [".lnx"],
    yearIntro: 1989,
    order: 4,
  },
  {
    id: "jaguar",
    name: "Atari Jaguar",
    shortName: "JAGUAR",
    manufacturer: "atari",
    engine: "ejs",
    core: "virtualjaguar",
    extensions: [".j64", ".jag"],
    experimental: true,
    heavy: true,
    yearIntro: 1993,
    order: 5,
  },

  /* ── PLAYSTATION ── */
  {
    id: "psx",
    name: "PlayStation 1",
    shortName: "PS1",
    manufacturer: "playstation",
    engine: "ejs",
    core: "pcsx_rearmed",
    extensions: [".cue", ".bin", ".chd", ".pbp"],
    bios: {
      files: [
        { fileName: "scph5500.bin", label: "PS1 BIOS (JP, SCPH-5500)", sha256: [], optional: true },
        { fileName: "scph5501.bin", label: "PS1 BIOS (US, SCPH-5501)", sha256: [], optional: true },
        { fileName: "scph5502.bin", label: "PS1 BIOS (EU, SCPH-5502)", sha256: [], optional: true },
      ],
      note: "PS1 needs a console BIOS for your game's region (at least one).",
    },
    yearIntro: 1994,
    order: 1,
  },
  {
    id: "psp",
    name: "PSP",
    shortName: "PSP",
    manufacturer: "playstation",
    engine: "ejs",
    core: "ppsspp",
    extensions: [".iso", ".cso"],
    heavy: true,
    yearIntro: 2004,
    order: 2,
  },

  /* ── ARCADE ── */
  {
    id: "arcade-fbneo",
    name: "Arcade (FBNeo)",
    shortName: "FBNEO",
    manufacturer: "arcade",
    engine: "ejs",
    core: "fbneo",
    extensions: [".zip"],
    romsetSensitive: true,
    yearIntro: 1978,
    order: 1,
  },
  {
    id: "arcade-mame",
    name: "Arcade (MAME 2003+)",
    shortName: "MAME",
    manufacturer: "arcade",
    engine: "ejs",
    core: "mame2003_plus",
    extensions: [".zip"],
    romsetSensitive: true,
    yearIntro: 1978,
    order: 2,
  },
  {
    id: "neogeo",
    name: "Neo Geo AES / MVS",
    shortName: "NEOGEO",
    manufacturer: "arcade",
    engine: "ejs",
    core: "fbneo",
    extensions: [".zip"],
    romsetSensitive: true,
    bios: {
      files: [{ fileName: "neogeo.zip", label: "Neo Geo BIOS romset (neogeo.zip)", sha256: [] }],
      note: "Neo Geo games need the system BIOS romset.",
    },
    yearIntro: 1990,
    order: 3,
  },
  {
    id: "cps1",
    name: "CPS-1",
    shortName: "CPS-1",
    manufacturer: "arcade",
    engine: "ejs",
    core: "fbalpha2012_cps1",
    extensions: [".zip"],
    romsetSensitive: true,
    yearIntro: 1988,
    order: 4,
  },
  {
    id: "cps2",
    name: "CPS-2",
    shortName: "CPS-2",
    manufacturer: "arcade",
    engine: "ejs",
    core: "fbalpha2012_cps2",
    extensions: [".zip"],
    romsetSensitive: true,
    yearIntro: 1993,
    order: 5,
  },

  /* ── HANDHELD / OTHER ── */
  {
    id: "ngp",
    name: "Neo Geo Pocket / Color",
    shortName: "NGP",
    manufacturer: "handheld",
    engine: "ejs",
    core: "mednafen_ngp",
    extensions: [".ngp", ".ngc"],
    yearIntro: 1998,
    order: 1,
  },
  {
    id: "wonderswan",
    name: "WonderSwan / Color",
    shortName: "WS",
    manufacturer: "handheld",
    engine: "ejs",
    core: "mednafen_wswan",
    extensions: [".ws", ".wsc"],
    yearIntro: 1999,
    order: 2,
  },
  {
    id: "colecovision",
    name: "ColecoVision",
    shortName: "COLECO",
    manufacturer: "handheld",
    engine: "ejs",
    core: "gearcoleco",
    extensions: [".col"],
    bios: {
      files: [{ fileName: "colecovision.rom", label: "ColecoVision BIOS", sha256: [] }],
      note: "ColecoVision requires its system BIOS.",
    },
    yearIntro: 1982,
    order: 3,
  },

  /* ── COMPUTERS ── */
  {
    id: "c64",
    name: "Commodore 64",
    shortName: "C64",
    manufacturer: "computers",
    engine: "ejs",
    core: "vice_x64",
    extensions: [".d64", ".t64", ".prg"],
    yearIntro: 1982,
    order: 1,
  },
  {
    id: "amiga",
    name: "Amiga",
    shortName: "AMIGA",
    manufacturer: "computers",
    engine: "ejs",
    core: "puae",
    extensions: [".adf"],
    bios: {
      files: [{ fileName: "kick34005.A500", label: "Kickstart 1.3 ROM (A500)", sha256: [] }],
      note: "Amiga needs a Kickstart ROM from a machine you own.",
    },
    yearIntro: 1985,
    order: 2,
  },
  {
    id: "3do",
    name: "3DO",
    shortName: "3DO",
    manufacturer: "computers",
    engine: "ejs",
    core: "opera",
    extensions: [".iso", ".chd"],
    bios: {
      files: [{ fileName: "panafz10.bin", label: "3DO BIOS (Panasonic FZ-10)", sha256: [] }],
      note: "3DO requires a console BIOS.",
    },
    heavy: true,
    yearIntro: 1993,
    order: 3,
  },
  {
    id: "doom",
    name: "DOOM Engine",
    shortName: "DOOM",
    manufacturer: "computers",
    engine: "ejs",
    core: "prboom",
    extensions: [".wad"],
    yearIntro: 1993,
    order: 4,
  },

  /* ── DOS — Engine C: js-dos ── */
  {
    id: "dos",
    name: "MS-DOS",
    shortName: "DOS",
    manufacturer: "dos",
    engine: "jsdos",
    extensions: [".jsdos", ".zip"],
    yearIntro: 1981,
    order: 1,
  },

  /* ── FLASH — Engine B: Ruffle ── */
  {
    id: "flash",
    name: "Flash",
    shortName: "FLASH",
    manufacturer: "flash",
    engine: "ruffle",
    extensions: [".swf"],
    yearIntro: 1996,
    order: 1,
  },
] as const;

/* ── lookups — everything downstream goes through these ─────────────────── */

const byId = new Map(SYSTEMS.map((s) => [s.id, s]));

export function getSystem(id: string): SystemDef | undefined {
  return byId.get(id);
}

export function systemsFor(manufacturer: ManufacturerId): SystemDef[] {
  return SYSTEMS.filter((s) => s.manufacturer === manufacturer).sort(
    (a, b) => a.order - b.order,
  );
}

export function getManufacturer(id: ManufacturerId): ManufacturerDef {
  const m = MANUFACTURERS.find((m) => m.id === id);
  if (!m) throw new Error(`unknown manufacturer: ${id}`);
  return m;
}

/** all extensions → candidate systems, for upload/local-play detection */
export function systemsForExtension(ext: string): SystemDef[] {
  const e = ext.toLowerCase();
  return SYSTEMS.filter((s) => s.extensions.includes(e));
}

export function systemsNeedingBios(): SystemDef[] {
  return SYSTEMS.filter((s) => s.bios !== undefined);
}

export const SYSTEM_COUNT = SYSTEMS.length;
