import "server-only";
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { storage } from "@/lib/storage";

/**
 * Server save-state sync (§4.2 / Phase 3f). Logged-in users sync states to the
 * server so they resume on any device; anonymous play still works fully offline
 * via IndexedDB (the client merges both). Bytes live behind StorageAdapter at
 * non-guessable keys, never public paths — same posture as ROMs/covers.
 *
 * Slots are 0–9, so the "10 per user per game" cap (§6) is structural: the
 * unique index on (user_id, game_id, slot) means a PUT to an occupied slot
 * replaces it, and you can never hold more than ten.
 */

const { saveStates, games } = schema;

export const MAX_SLOTS = 10;
/** a single save blob is small (SRAM + machine state); cap to catch abuse */
export const MAX_SAVE_BYTES = 16 * 1024 * 1024;
export const MAX_SHOT_BYTES = 2 * 1024 * 1024;

export class SaveError extends Error {
  constructor(
    public code: string,
    message?: string,
  ) {
    super(message ?? code);
  }
}

export function validSlot(slot: number): boolean {
  return Number.isInteger(slot) && slot >= 0 && slot < MAX_SLOTS;
}

const blobKey = (userId: string, gameId: string, slot: number) =>
  `saves/${userId}/${gameId}/${slot}.bin`;
const shotKey = (userId: string, gameId: string, slot: number) =>
  `saves/${userId}/${gameId}/${slot}.png`;

export interface SaveSlotMeta {
  slot: number;
  createdAt: number;
  screenshot: boolean;
}

/** occupied slots for this user+game (metadata only — not the blobs) */
export async function listSaves(
  userId: string,
  gameId: string,
): Promise<SaveSlotMeta[]> {
  const rows = await db
    .select()
    .from(saveStates)
    .where(and(eq(saveStates.userId, userId), eq(saveStates.gameId, gameId)));
  return rows
    .map((r) => ({
      slot: r.slot,
      createdAt: r.createdAt.getTime(),
      screenshot: !!r.screenshotPath,
    }))
    .sort((a, b) => a.slot - b.slot);
}

/** the stored row for one slot (null if empty) */
export async function getSaveRow(userId: string, gameId: string, slot: number) {
  const [row] = await db
    .select()
    .from(saveStates)
    .where(
      and(
        eq(saveStates.userId, userId),
        eq(saveStates.gameId, gameId),
        eq(saveStates.slot, slot),
      ),
    )
    .limit(1);
  return row ?? null;
}

/**
 * Upsert a save into a slot. Replaces any existing blob/screenshot for that
 * slot. Requires the game to exist (you can only sync a real library game).
 */
export async function putSave(opts: {
  userId: string;
  gameId: string;
  slot: number;
  state: Buffer;
  screenshot?: Buffer | null;
}): Promise<void> {
  if (!validSlot(opts.slot)) throw new SaveError("bad_slot");
  if (opts.state.byteLength === 0) throw new SaveError("empty");
  if (opts.state.byteLength > MAX_SAVE_BYTES) throw new SaveError("too_large");
  if (opts.screenshot && opts.screenshot.byteLength > MAX_SHOT_BYTES)
    throw new SaveError("shot_too_large");

  const [game] = await db
    .select({ id: games.id })
    .from(games)
    .where(eq(games.id, opts.gameId))
    .limit(1);
  if (!game) throw new SaveError("game_not_found");

  const bKey = blobKey(opts.userId, opts.gameId, opts.slot);
  const sKey = shotKey(opts.userId, opts.gameId, opts.slot);
  await storage.put(bKey, opts.state);
  if (opts.screenshot) await storage.put(sKey, opts.screenshot);

  const existing = await getSaveRow(opts.userId, opts.gameId, opts.slot);
  const now = new Date();
  if (existing) {
    // dropped a screenshot this time but had one before? leave the stale file
    // only if we didn't overwrite — here we always rewrite blob, refresh row.
    if (!opts.screenshot && existing.screenshotPath)
      await storage.delete(existing.screenshotPath);
    await db
      .update(saveStates)
      .set({
        blobPath: bKey,
        screenshotPath: opts.screenshot ? sKey : null,
        createdAt: now,
      })
      .where(eq(saveStates.id, existing.id));
  } else {
    await db.insert(saveStates).values({
      id: randomUUID(),
      userId: opts.userId,
      gameId: opts.gameId,
      slot: opts.slot,
      blobPath: bKey,
      screenshotPath: opts.screenshot ? sKey : null,
      createdAt: now,
    });
  }
}

export async function deleteSave(
  userId: string,
  gameId: string,
  slot: number,
): Promise<void> {
  const row = await getSaveRow(userId, gameId, slot);
  if (!row) return;
  await storage.delete(row.blobPath);
  if (row.screenshotPath) await storage.delete(row.screenshotPath);
  await db.delete(saveStates).where(eq(saveStates.id, row.id));
}
