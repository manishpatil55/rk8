/**
 * RK8 engine provisioning — self-hosts all three emulation engines into public/engines/.
 *
 *   EmulatorJS  → mirrored from the version-pinned EmulatorJS CDN path (runtime +
 *                 every libretro core the system matrix uses, threaded + plain WASM)
 *   Ruffle      → copied from the version-pinned npm package @ruffle-rs/ruffle
 *   js-dos      → copied from the version-pinned npm package js-dos
 *
 * Downloads happen ONCE at provision time; at runtime everything is served from
 * /engines/* on our origin. No CDN hotlinks, ever.
 *
 * The core list is parsed from src/config/systems.config.ts — the single source
 * of truth. Adding a system there and re-running this script fetches its core.
 *
 * Upgrade path: bump EMULATORJS_VERSION / the npm versions in package.json,
 * delete public/engines/, re-run `npm run setup:engines`, regression-test the
 * seed library, then commit the version bump.
 */
import {
  cpSync,
  existsSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "public", "engines");
const IF_MISSING = process.argv.includes("--if-missing");

// ---- pinned versions ------------------------------------------------------
const EMULATORJS_VERSION = "4.2.3";
const EJS_BASE = `https://cdn.emulatorjs.org/${EMULATORJS_VERSION}/data`;
// Ruffle + js-dos versions are pinned by package.json / package-lock.json.

const log = (m) => console.log(`[rk8:engines] ${m}`);
const warn = (m) => console.warn(`[rk8:engines] WARN ${m}`);

let failures = 0;

// ---- Ruffle (npm → public/engines/ruffle) ---------------------------------
function provisionRuffle() {
  const dest = path.join(OUT, "ruffle");
  if (IF_MISSING && existsSync(path.join(dest, "ruffle.js")))
    return log("ruffle: present, skipping");
  const src = path.join(ROOT, "node_modules", "@ruffle-rs", "ruffle");
  if (!existsSync(src)) {
    warn("ruffle: @ruffle-rs/ruffle not installed yet");
    failures++;
    return;
  }
  mkdirSync(dest, { recursive: true });
  cpSync(src, dest, {
    recursive: true,
    // exclude a NESTED node_modules (relative to the package root) and the
    // package manifest — not the source's own node_modules/ prefix, which
    // would match every path and copy nothing.
    filter: (s) => {
      const rel = path.relative(src, s);
      return (
        !rel.split(path.sep).includes("node_modules") &&
        !path.basename(s).startsWith("package")
      );
    },
  });
  log("ruffle: provisioned from npm package");
}

// ---- js-dos (npm → public/engines/jsdos) ----------------------------------
function provisionJsDos() {
  const dest = path.join(OUT, "jsdos");
  if (IF_MISSING && existsSync(path.join(dest, "js-dos.js")))
    return log("js-dos: present, skipping");
  const pkg = path.join(ROOT, "node_modules", "js-dos");
  if (!existsSync(pkg)) {
    warn("js-dos: package not installed yet");
    failures++;
    return;
  }
  const src = existsSync(path.join(pkg, "dist")) ? path.join(pkg, "dist") : pkg;
  mkdirSync(dest, { recursive: true });
  cpSync(src, dest, { recursive: true });
  log("js-dos: provisioned from npm package");
}

// ---- EmulatorJS (pinned CDN mirror → public/engines/emulatorjs/data) ------

/** cores used by the matrix, parsed straight from systems.config.ts */
function coresFromConfig() {
  const cfg = readFileSync(
    path.join(ROOT, "src", "config", "systems.config.ts"),
    "utf8",
  );
  const cores = new Set();
  for (const m of cfg.matchAll(/(?:core|fallbackCore):\s*"([a-z0-9_]+)"/g)) {
    cores.add(m[1]);
  }
  return [...cores].sort();
}

async function download(rel, destFile, { optional = false } = {}) {
  if (existsSync(destFile)) return "cached";
  const url = `${EJS_BASE}/${rel}`;
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) {
    if (optional && res.status === 404) return "absent";
    throw new Error(`HTTP ${res.status} for ${url}`);
  }
  mkdirSync(path.dirname(destFile), { recursive: true });
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(destFile, buf);
  return "fetched";
}

async function provisionEmulatorJS() {
  const dest = path.join(OUT, "emulatorjs", "data");
  const marker = path.join(OUT, "emulatorjs", ".rk8-version");
  if (
    IF_MISSING &&
    existsSync(marker) &&
    readFileSync(marker, "utf8").trim() === EMULATORJS_VERSION
  )
    return log("emulatorjs: present, skipping");

  const runtime = [
    "loader.js",
    "emulator.min.js",
    "emulator.min.css",
    "version.json",
    "compression/extract7z.js",
    "compression/extractzip.js",
    "compression/libunrar.js",
    "compression/libunrar.wasm",
  ];

  log(`emulatorjs: mirroring v${EMULATORJS_VERSION} runtime ...`);
  for (const rel of runtime) {
    await download(rel, path.join(dest, rel));
  }

  const cores = coresFromConfig();
  log(`emulatorjs: fetching ${cores.length} cores from the system matrix ...`);

  // each core: report json + plain wasm + threaded wasm (where published)
  const jobs = [];
  for (const core of cores) {
    jobs.push({ rel: `cores/reports/${core}.json`, optional: true });
    jobs.push({ rel: `cores/${core}-wasm.data`, optional: true });
    jobs.push({ rel: `cores/${core}-thread-wasm.data`, optional: true });
  }

  let fetched = 0;
  const missingCores = new Set(cores);
  const CONCURRENCY = 6;
  for (let i = 0; i < jobs.length; i += CONCURRENCY) {
    const batch = jobs.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      batch.map(async (j) => {
        const r = await download(j.rel, path.join(dest, j.rel), {
          optional: j.optional,
        });
        return { ...j, result: r };
      }),
    );
    for (const r of results) {
      if (r.result !== "absent" && r.rel.endsWith("-wasm.data")) {
        fetched++;
        const core = r.rel.replace(/^cores\//, "").replace(/(-thread)?-wasm\.data$/, "");
        missingCores.delete(core);
      }
    }
    if (i % 24 === 0 && i > 0) log(`emulatorjs: ${i}/${jobs.length} files ...`);
  }

  if (missingCores.size > 0) {
    warn(
      `emulatorjs: no wasm published for cores: ${[...missingCores].join(", ")} — their systems will not boot until resolved`,
    );
  }

  writeFileSync(marker, `${EMULATORJS_VERSION}\n`);
  log(
    `emulatorjs: provisioned v${EMULATORJS_VERSION} (${fetched} core builds mirrored, lazy-loaded per system at runtime)`,
  );
}

// ---------------------------------------------------------------------------
mkdirSync(OUT, { recursive: true });
provisionRuffle();
provisionJsDos();
try {
  await provisionEmulatorJS();
} catch (e) {
  failures++;
  warn(`emulatorjs: ${e.message}`);
  warn("emulatorjs: re-run `npm run setup:engines` when online to finish the mirror (resumes where it left off)");
}

if (failures > 0 && !IF_MISSING) process.exitCode = 1;
if (failures > 0 && IF_MISSING)
  log("finished with warnings — engines can be provisioned later, install continues");
else log("all engines provisioned");
