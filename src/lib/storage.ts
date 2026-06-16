import "server-only";
import { createReadStream, existsSync, mkdirSync, statSync } from "node:fs";
import { unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";

/**
 * StorageAdapter — ROMs, covers and synced save-states live behind this
 * interface, never at guessable public paths.
 *
 * v1 ships LocalDiskStorage (zero ops). At scale, implement this same
 * interface over S3/R2 and have `streamUrl` return a short-lived signed URL —
 * the /api/rom route then 302s and app servers stop touching ROM bytes.
 */
export interface StorageAdapter {
  put(key: string, data: Buffer): Promise<void>;
  delete(key: string): Promise<void>;
  exists(key: string): boolean;
  size(key: string): number;
  /** web ReadableStream for proxying through a route handler; optional byte range */
  stream(key: string, start?: number, end?: number): ReadableStream;
  /** signed/offloaded URL when the backend supports it; null = proxy locally */
  streamUrl(key: string): string | null;
}

const DATA_DIR = process.env.RK8_DATA_DIR ?? path.join(process.cwd(), "data");
const STORE_DIR = path.join(DATA_DIR, "storage");

/** storage keys are constrained to safe path segments — never user-controlled paths */
function resolveKey(key: string): string {
  if (!/^[a-z0-9][a-z0-9/_.-]*$/i.test(key) || key.includes(".."))
    throw new Error(`invalid storage key: ${key}`);
  return path.join(STORE_DIR, key);
}

class LocalDiskStorage implements StorageAdapter {
  async put(key: string, data: Buffer): Promise<void> {
    const file = resolveKey(key);
    mkdirSync(path.dirname(file), { recursive: true });
    await writeFile(file, data);
  }

  async delete(key: string): Promise<void> {
    const file = resolveKey(key);
    if (existsSync(file)) await unlink(file);
  }

  exists(key: string): boolean {
    return existsSync(resolveKey(key));
  }

  size(key: string): number {
    return statSync(resolveKey(key)).size;
  }

  stream(key: string, start?: number, end?: number): ReadableStream {
    const opts =
      start !== undefined && end !== undefined ? { start, end } : undefined;
    return Readable.toWeb(
      createReadStream(resolveKey(key), opts),
    ) as ReadableStream;
  }

  streamUrl(): string | null {
    return null; // local disk always proxies
  }
}

export const storage: StorageAdapter = new LocalDiskStorage();
