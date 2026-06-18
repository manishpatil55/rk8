import { Buffer } from "node:buffer";
import { beforeEach, describe, expect, it } from "vitest";
import { db, schema } from "@/db";
import { storage } from "@/lib/storage";
import {
  MAX_SAVE_BYTES,
  MAX_SHOT_BYTES,
  MAX_SLOTS,
  deleteSave,
  getSaveRow,
  listSaves,
  putSave,
  validSlot,
} from "@/lib/saves";

// minimal valid PNG: the 8-byte signature is all the sniffer checks
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 1, 2, 3]);

async function seedUser(id = "user-1") {
  await db.insert(schema.users).values({ id, email: `${id}@rk8.local`, createdAt: new Date() });
  return id;
}

async function seedGame(id = "game-1") {
  await db.insert(schema.games).values({
    id,
    slug: `slug-${id}`,
    title: "Test Cartridge",
    systemId: "nes",
    engine: "ejs",
    romPath: `roms/${id}.nes`,
    romSha256: `sha-${id}`,
    sizeBytes: 1024,
    status: "approved",
    createdAt: new Date(),
  });
  return id;
}

beforeEach(async () => {
  await db.delete(schema.saveStates);
  await db.delete(schema.reports);
  await db.delete(schema.auditLog);
  await db.delete(schema.games);
  await db.delete(schema.users);
});

describe("validSlot (the structural 10-slot cap)", () => {
  it("accepts 0..9 and nothing else", () => {
    for (let i = 0; i < MAX_SLOTS; i++) expect(validSlot(i)).toBe(true);
    expect(validSlot(-1)).toBe(false);
    expect(validSlot(MAX_SLOTS)).toBe(false); // slot 10 is out — the cap is structural
    expect(validSlot(1.5)).toBe(false);
    expect(validSlot(NaN)).toBe(false);
  });
});

describe("putSave guards", () => {
  it("rejects an out-of-range slot before touching storage", async () => {
    await expect(
      putSave({ userId: "u", gameId: "g", slot: 10, state: Buffer.from([1]) }),
    ).rejects.toMatchObject({ code: "bad_slot" });
  });

  it("rejects an empty state", async () => {
    await expect(
      putSave({ userId: "u", gameId: "g", slot: 0, state: Buffer.alloc(0) }),
    ).rejects.toMatchObject({ code: "empty" });
  });

  it("rejects an oversized state", async () => {
    await expect(
      putSave({ userId: "u", gameId: "g", slot: 0, state: Buffer.alloc(MAX_SAVE_BYTES + 1) }),
    ).rejects.toMatchObject({ code: "too_large" });
  });

  it("rejects an oversized screenshot", async () => {
    await expect(
      putSave({
        userId: "u",
        gameId: "g",
        slot: 0,
        state: Buffer.from([1]),
        screenshot: Buffer.alloc(MAX_SHOT_BYTES + 1),
      }),
    ).rejects.toMatchObject({ code: "shot_too_large" });
  });

  it("rejects a screenshot that isn't a real PNG (magic-byte sniff)", async () => {
    await expect(
      putSave({
        userId: "u",
        gameId: "g",
        slot: 0,
        state: Buffer.from([1]),
        screenshot: Buffer.from("GIF89a-not-a-png"),
      }),
    ).rejects.toMatchObject({ code: "bad_shot" });
  });

  it("rejects a save for a game that doesn't exist", async () => {
    const userId = await seedUser();
    await expect(
      putSave({ userId, gameId: "missing", slot: 0, state: Buffer.from([1]) }),
    ).rejects.toMatchObject({ code: "game_not_found" });
  });
});

describe("putSave / listSaves / deleteSave round-trip", () => {
  it("persists, lists, upserts, and deletes a slot", async () => {
    const userId = await seedUser();
    const gameId = await seedGame();

    await putSave({ userId, gameId, slot: 3, state: Buffer.from("STATE-A"), screenshot: PNG });
    const row = await getSaveRow(userId, gameId, 3);
    expect(row).not.toBeNull();
    expect(storage.exists(row!.blobPath)).toBe(true);
    expect(row!.screenshotPath).not.toBeNull();
    expect(storage.exists(row!.screenshotPath!)).toBe(true);

    let slots = await listSaves(userId, gameId);
    expect(slots.map((s) => s.slot)).toEqual([3]);
    expect(slots[0]!.screenshot).toBe(true);

    // re-PUT the same slot without a screenshot → still ONE row, screenshot cleared
    await putSave({ userId, gameId, slot: 3, state: Buffer.from("STATE-B") });
    slots = await listSaves(userId, gameId);
    expect(slots).toHaveLength(1);
    expect(slots[0]!.screenshot).toBe(false);

    // delete frees the slot and removes the blob from storage
    const blobPath = (await getSaveRow(userId, gameId, 3))!.blobPath;
    await deleteSave(userId, gameId, 3);
    expect(await getSaveRow(userId, gameId, 3)).toBeNull();
    expect(storage.exists(blobPath)).toBe(false);
  });

  it("scopes slots to the owning user", async () => {
    const a = await seedUser("user-a");
    const b = await seedUser("user-b");
    const gameId = await seedGame();
    await putSave({ userId: a, gameId, slot: 0, state: Buffer.from("A") });
    expect(await listSaves(a, gameId)).toHaveLength(1);
    expect(await listSaves(b, gameId)).toHaveLength(0); // b never sees a's saves
  });
});
