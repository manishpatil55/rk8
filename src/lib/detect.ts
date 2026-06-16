import { systemsForExtension } from "@/config/systems.config";

/**
 * Magic-byte / extension detection (§2). Isomorphic — the client uses it to
 * SUGGEST a system, the server uses it to VALIDATE an upload. Extension is the
 * hard allowlist; magic bytes are a sanity gate where a reliable signature
 * exists (many raw ROM formats have none → we accept on extension alone).
 */

type Sniffer = (b: Uint8Array) => boolean;

const ascii = (b: Uint8Array, off: number, s: string): boolean =>
  [...s].every((c, i) => b[off + i] === c.charCodeAt(0));

const isZip: Sniffer = (b) =>
  b[0] === 0x50 && b[1] === 0x4b && (b[2] === 0x03 || b[2] === 0x05 || b[2] === 0x07);

const isSwf: Sniffer = (b) =>
  ascii(b, 0, "FWS") || ascii(b, 0, "CWS") || ascii(b, 0, "ZWS");

/** per-system signatures (only where one is reliable) */
const SIG: Record<string, Sniffer> = {
  nes: (b) => ascii(b, 0, "NES") && b[3] === 0x1a,
  fds: (b) => (ascii(b, 0, "FDS") && b[3] === 0x1a) || b[0] === 0x01,
  gb: (b) => b[0x104] === 0xce && b[0x105] === 0xed && b[0x106] === 0x66,
  gbc: (b) => b[0x104] === 0xce && b[0x105] === 0xed && b[0x106] === 0x66,
  gba: (b) => b[4] === 0x24 && b[5] === 0xff && b[6] === 0xae && b[7] === 0x51,
  genesis: (b) => ascii(b, 0x100, "SEGA"),
  segacd: (b) => ascii(b, 0x100, "SEGA"),
  n64: (b) =>
    (b[0] === 0x80 && b[1] === 0x37) || // .z64 big-endian
    (b[0] === 0x37 && b[1] === 0x80) || // .v64 byteswapped
    (b[0] === 0x40 && b[1] === 0x12), // .n64 little-endian
  lynx: (b) => ascii(b, 0, "LYNX"),
  atarilynx: (b) => ascii(b, 0, "LYNX"),
};

const safe = (fn: Sniffer, b: Uint8Array): boolean => {
  try {
    return fn(b);
  } catch {
    return false;
  }
};

/** the expected signatures for a (system, extension) pair, if any are known */
function checks(systemId: string, ext: string): Sniffer[] {
  const out: Sniffer[] = [];
  if (SIG[systemId]) out.push(SIG[systemId]!);
  const e = ext.toLowerCase();
  if (e === ".zip") out.push(isZip);
  if (e === ".jsdos") out.push(isZip);
  if (e === ".swf") out.push(isSwf);
  return out;
}

/**
 * Validate file bytes against a chosen system. `known` is false when no
 * signature exists for the format (caller should accept on extension); when
 * `known` is true, `ok` is the verdict.
 */
export function checkMagic(
  systemId: string,
  ext: string,
  bytes: Uint8Array,
): { known: boolean; ok: boolean } {
  const c = checks(systemId, ext);
  if (c.length === 0) return { known: false, ok: true };
  return { known: true, ok: c.some((fn) => safe(fn, bytes)) };
}

/** best single system guess for a dropped/selected file (client suggestion) */
export function bestSystem(fileName: string, bytes: Uint8Array): string | null {
  const ext = fileName.slice(fileName.lastIndexOf(".")).toLowerCase();
  const candidates = systemsForExtension(ext);
  if (candidates.length === 0) return null;
  // prefer a magic-confirmed candidate, else the sole candidate
  const confirmed = candidates.find((s) => {
    const v = checkMagic(s.id, ext, bytes);
    return v.known && v.ok;
  });
  if (confirmed) return confirmed.id;
  return candidates.length === 1 ? candidates[0]!.id : null;
}
