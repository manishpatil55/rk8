"use client";

/**
 * Client wrapper for the server save-sync API. Mirrors the IndexedDB helpers so
 * PlayerFrame can write to both: IndexedDB is the always-available local vault
 * (works offline + anonymous), the server is the cross-device sync layer for
 * logged-in users. The player merges slot occupancy from both.
 */

export interface ServerSlot {
  slot: number;
  createdAt: number;
  screenshot: boolean;
}

export async function fetchServerSlots(gameId: string): Promise<ServerSlot[]> {
  const res = await fetch(`/api/saves/${gameId}`, { cache: "no-store" });
  if (!res.ok) return [];
  const data = await res.json().catch(() => ({ slots: [] }));
  return Array.isArray(data.slots) ? data.slots : [];
}

export async function putServerSave(
  gameId: string,
  slot: number,
  state: Uint8Array,
  screenshot?: Blob | null,
): Promise<void> {
  const fd = new FormData();
  // copy into a fresh, standalone ArrayBuffer (state may be a view over a larger
  // or shared buffer; this also satisfies BlobPart's ArrayBuffer-backed typing)
  fd.set(
    "state",
    new Blob([new Uint8Array(state)], { type: "application/octet-stream" }),
  );
  if (screenshot) fd.set("screenshot", screenshot);
  const res = await fetch(`/api/saves/${gameId}/${slot}`, {
    method: "PUT",
    body: fd,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "sync failed");
  }
}

export async function getServerSave(
  gameId: string,
  slot: number,
): Promise<Uint8Array | null> {
  const res = await fetch(`/api/saves/${gameId}/${slot}`, { cache: "no-store" });
  if (!res.ok) return null;
  return new Uint8Array(await res.arrayBuffer());
}

export async function deleteServerSave(
  gameId: string,
  slot: number,
): Promise<void> {
  await fetch(`/api/saves/${gameId}/${slot}`, { method: "DELETE" });
}
