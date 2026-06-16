"use client";

/**
 * Tiny promise wrapper over IndexedDB — RK8's client-side vault.
 *
 *   saves : save states keyed `${romSha256}:${slot}` — survive reloads, work
 *           identically for Local Play files and library games
 *   bios  : user-supplied BIOS blobs keyed by expected file name.
 *           BIOS NEVER leaves the browser — that's the legal architecture.
 */

const DB_NAME = "rk8";
const DB_VERSION = 1;

export interface SavedState {
  data: Uint8Array;
  createdAt: number;
  title: string;
}

export interface StoredBios {
  blob: Blob;
  sha256: string;
  verified: boolean;
  storedAt: number;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains("saves")) db.createObjectStore("saves");
        if (!db.objectStoreNames.contains("bios")) db.createObjectStore("bios");
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

async function tx<T>(
  store: string,
  mode: IDBTransactionMode,
  fn: (s: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await open();
  return new Promise<T>((resolve, reject) => {
    const t = db.transaction(store, mode);
    const req = fn(t.objectStore(store));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/* ── save states ────────────────────────────────────────────────────────── */

export const saveKey = (romSha256: string, slot: number) =>
  `${romSha256}:${slot}`;

export async function putSaveState(
  romSha256: string,
  slot: number,
  state: SavedState,
): Promise<void> {
  await tx("saves", "readwrite", (s) => s.put(state, saveKey(romSha256, slot)));
}

export async function getSaveState(
  romSha256: string,
  slot: number,
): Promise<SavedState | undefined> {
  return tx("saves", "readonly", (s) => s.get(saveKey(romSha256, slot)));
}

export async function deleteSaveState(
  romSha256: string,
  slot: number,
): Promise<void> {
  await tx("saves", "readwrite", (s) => s.delete(saveKey(romSha256, slot)));
}

/** which of the 10 slots are occupied for a game */
export async function listSaveSlots(romSha256: string): Promise<Map<number, SavedState>> {
  const out = new Map<number, SavedState>();
  await Promise.all(
    Array.from({ length: 10 }, async (_, slot) => {
      const v = await getSaveState(romSha256, slot);
      if (v) out.set(slot, v);
    }),
  );
  return out;
}

/* ── bios vault ─────────────────────────────────────────────────────────── */

export async function putBios(fileName: string, entry: StoredBios): Promise<void> {
  await tx("bios", "readwrite", (s) => s.put(entry, fileName));
}

export async function getBios(fileName: string): Promise<StoredBios | undefined> {
  return tx("bios", "readonly", (s) => s.get(fileName));
}

export async function deleteBios(fileName: string): Promise<void> {
  await tx("bios", "readwrite", (s) => s.delete(fileName));
}

export async function listBiosKeys(): Promise<string[]> {
  return tx("bios", "readonly", (s) => s.getAllKeys()) as Promise<string[]>;
}
