import { describe, it, expect } from "vitest";
import { checkMagic, bestSystem } from "@/lib/detect";

/** build a buffer of `size`, writing numbers or ascii strings at offsets */
function bytes(size: number, patch: Record<number, number | string>): Uint8Array {
  const b = new Uint8Array(size);
  for (const [off, val] of Object.entries(patch)) {
    const o = Number(off);
    if (typeof val === "string") {
      for (let i = 0; i < val.length; i++) b[o + i] = val.charCodeAt(i);
    } else {
      b[o] = val;
    }
  }
  return b;
}

describe("checkMagic", () => {
  it("accepts a valid NES header (NES\\x1a)", () => {
    expect(checkMagic("nes", ".nes", bytes(16, { 0: "NES", 3: 0x1a }))).toEqual({
      known: true,
      ok: true,
    });
  });

  it("rejects bytes that don't match the NES signature", () => {
    expect(checkMagic("nes", ".nes", bytes(16, { 0: "ELF", 3: 0x00 }))).toEqual({
      known: true,
      ok: false,
    });
  });

  it("treats a format with no signature as unknown → accept on extension", () => {
    // snes has no signature and .sfc is neither zip nor swf
    expect(checkMagic("snes", ".sfc", bytes(16, { 0: 0x00 }))).toEqual({
      known: false,
      ok: true,
    });
  });

  it("validates a .jsdos/.zip container by PK magic", () => {
    expect(checkMagic("dos", ".jsdos", bytes(8, { 0: 0x50, 1: 0x4b, 2: 0x03, 3: 0x04 })).ok).toBe(
      true,
    );
    expect(checkMagic("dos", ".jsdos", bytes(8, { 0: 0x00 })).ok).toBe(false);
  });

  it("validates an .swf by FWS / CWS / ZWS magic", () => {
    expect(checkMagic("flash", ".swf", bytes(8, { 0: "FWS" })).ok).toBe(true);
    expect(checkMagic("flash", ".swf", bytes(8, { 0: "CWS" })).ok).toBe(true);
    expect(checkMagic("flash", ".swf", bytes(8, { 0: "ZWS" })).ok).toBe(true);
    expect(checkMagic("flash", ".swf", bytes(8, { 0: "PDF" })).ok).toBe(false);
  });

  it("detects all three N64 byte orders (z64 / v64 / n64)", () => {
    expect(checkMagic("n64", ".z64", bytes(8, { 0: 0x80, 1: 0x37 })).ok).toBe(true);
    expect(checkMagic("n64", ".v64", bytes(8, { 0: 0x37, 1: 0x80 })).ok).toBe(true);
    expect(checkMagic("n64", ".n64", bytes(8, { 0: 0x40, 1: 0x12 })).ok).toBe(true);
    expect(checkMagic("n64", ".z64", bytes(8, { 0: 0x12, 1: 0x34 })).ok).toBe(false);
  });

  it("reads the Game Boy logo signature at offset 0x104", () => {
    expect(
      checkMagic("gb", ".gb", bytes(0x110, { 0x104: 0xce, 0x105: 0xed, 0x106: 0x66 })).ok,
    ).toBe(true);
  });

  it("does not throw on a short buffer (out-of-range reads) and reports a miss", () => {
    const short = new Uint8Array(2);
    expect(() => checkMagic("gb", ".gb", short)).not.toThrow();
    expect(checkMagic("gb", ".gb", short).ok).toBe(false);
  });
});

describe("bestSystem", () => {
  it("returns null for an extension no system claims", () => {
    expect(bestSystem("mystery.xyz", new Uint8Array(8))).toBeNull();
  });

  it("identifies a NES rom from its sole-candidate extension + magic", () => {
    expect(bestSystem("zelda.nes", bytes(16, { 0: "NES", 3: 0x1a }))).toBe("nes");
  });

  it("accepts the sole candidate when the format has no signature", () => {
    // .smc maps only to snes, which has no magic — the lone candidate wins
    expect(bestSystem("game.smc", bytes(16, { 0: 0x00 }))).toBe("snes");
  });

  it("disambiguates a shared extension by magic", () => {
    // .bin is shared (genesis/segacd/saturn/32x); SEGA at 0x100 confirms a Sega system
    const guess = bestSystem("sonic.bin", bytes(0x110, { 0x100: "SEGA" }));
    expect(["genesis", "segacd"]).toContain(guess);
  });

  it("returns null for a shared extension when nothing confirms", () => {
    expect(bestSystem("ambiguous.bin", new Uint8Array(0x110))).toBeNull();
  });
});
