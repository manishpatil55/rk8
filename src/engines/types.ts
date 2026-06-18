import type { EngineId, SystemDef } from "@/config/systems.config";

/**
 * The engine abstraction — the play page, save-state system, and player chrome
 * are written ONCE against this interface. Three adapters implement it:
 * EmulatorJS (ejs), Ruffle (ruffle), js-dos (jsdos). Nothing outside
 * src/engines/ may touch engine internals.
 */

export type RomSource =
  | { kind: "url"; url: string; fileName: string }
  | { kind: "buffer"; data: ArrayBuffer; fileName: string };

export type EngineStatusPhase =
  | "mounting"
  | "running"
  | "error"
  | "disposed";

export interface EngineStatus {
  phase: EngineStatusPhase;
  message?: string;
  /** the core actually in use once running — reflects a fallback swap, so the
   *  HUD reports the real core rather than the configured primary. */
  core?: string;
}

export interface EngineLoadOptions {
  system: SystemDef;
  rom: RomSource;
  /** host element the engine renders into (the inside of the HUD bezel) */
  mount: HTMLElement;
  /** stable identity for the game — rom SHA-256; keys save states */
  gameKey: string;
  /** display title, used for engine-internal naming */
  title: string;
  /** user-supplied BIOS blobs from IndexedDB, by expected file name */
  bios?: Record<string, Blob>;
  onStatus?: (status: EngineStatus) => void;
}

export interface EngineCapabilities {
  saveStates: boolean;
  screenshots: boolean;
  fastForward: boolean;
}

export interface EmulationEngine {
  readonly id: EngineId;
  readonly capabilities: EngineCapabilities;
  load(opts: EngineLoadOptions): Promise<void>;
  /** serialized machine state; throws if capabilities.saveStates is false */
  saveState(): Promise<Uint8Array>;
  loadState(data: Uint8Array): Promise<void>;
  screenshot(): Promise<Blob | null>;
  /** 0..1 */
  setVolume(volume: number): void;
  dispose(): Promise<void>;
}
