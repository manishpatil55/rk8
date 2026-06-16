"use client";

import type {
  EmulationEngine,
  EngineLoadOptions,
  EngineStatus,
} from "./types";

const RUFFLE_BASE = "/engines/ruffle/";

declare global {
  interface Window {
    RufflePlayer?: any;
  }
}

let ruffleScript: Promise<void> | null = null;

function loadRuffleRuntime(): Promise<void> {
  if (!ruffleScript) {
    ruffleScript = new Promise((resolve, reject) => {
      window.RufflePlayer = window.RufflePlayer || {};
      window.RufflePlayer.config = {
        publicPath: RUFFLE_BASE, // wasm fetched from our origin, never a CDN
        polyfills: false,
        autoplay: "on",
        letterbox: "on",
        contextMenu: "rightClickOnly",
        splashScreen: false,
        preferredRenderer: "wgpu-webgl",
      };
      const s = document.createElement("script");
      s.src = `${RUFFLE_BASE}ruffle.js`;
      s.onload = () => resolve();
      s.onerror = () =>
        reject(new Error("ruffle runtime missing — run `npm run setup:engines`"));
      document.head.appendChild(s);
    });
  }
  return ruffleScript;
}

/**
 * Ruffle adapter — Flash games as first-class cartridges.
 * Flash has no machine-state serialization, so save-state slots report
 * unsupported and the player chrome renders them dark with an honest note.
 */
export class RuffleEngine implements EmulationEngine {
  readonly id = "ruffle" as const;
  readonly capabilities = {
    saveStates: false,
    screenshots: false,
    fastForward: false,
  };

  private player: any = null;
  private objectUrl: string | null = null;
  private onStatus: ((s: EngineStatus) => void) | undefined;

  async load(opts: EngineLoadOptions): Promise<void> {
    this.onStatus = opts.onStatus;
    this.onStatus?.({ phase: "mounting", message: "mounting swf..." });

    await loadRuffleRuntime();

    const ruffle = window.RufflePlayer.newest();
    const player = ruffle.createPlayer();
    player.style.width = "100%";
    player.style.height = "100%";
    opts.mount.appendChild(player);
    this.player = player;

    const url =
      opts.rom.kind === "url"
        ? opts.rom.url
        : (this.objectUrl = URL.createObjectURL(
            new Blob([opts.rom.data], { type: "application/x-shockwave-flash" }),
          ));

    await player.ruffle().load({ url });
    this.onStatus?.({ phase: "running" });
  }

  async saveState(): Promise<Uint8Array> {
    throw new Error("flash has no save states");
  }

  async loadState(): Promise<void> {
    throw new Error("flash has no save states");
  }

  async screenshot(): Promise<Blob | null> {
    return null; // ruffle renders into closed shadow DOM
  }

  setVolume(volume: number): void {
    try {
      this.player?.ruffle?.()?.set_volume?.(volume);
      if (this.player) this.player.volume = volume;
    } catch {
      /* best-effort */
    }
  }

  async dispose(): Promise<void> {
    try {
      this.player?.remove();
    } finally {
      this.player = null;
      if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
      this.onStatus?.({ phase: "disposed" });
    }
  }
}
