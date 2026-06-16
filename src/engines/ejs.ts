"use client";

import type {
  EmulationEngine,
  EngineLoadOptions,
  EngineStatus,
} from "./types";

const EJS_DATA_PATH = "/engines/emulatorjs/data/";

/**
 * EmulatorJS adapter — the workhorse (~35 systems via libretro WASM cores).
 *
 * The emulator boots inside a same-origin iframe: EmulatorJS owns a pile of
 * window.EJS_* globals and rewrites its host DOM, so the iframe gives us clean
 * mount/dispose semantics and lets a new game boot without a page reload.
 * Blob URLs created here are same-origin and resolve fine inside it.
 */
export class EjsEngine implements EmulationEngine {
  readonly id = "ejs" as const;
  readonly capabilities = {
    saveStates: true,
    screenshots: true,
    fastForward: true,
  };

  private iframe: HTMLIFrameElement | null = null;
  private objectUrls: string[] = [];
  private onStatus: ((s: EngineStatus) => void) | undefined;

  private get emu(): any {
    const w = this.iframe?.contentWindow as any;
    return w?.EJS_emulator ?? null;
  }

  async load(opts: EngineLoadOptions): Promise<void> {
    this.onStatus = opts.onStatus;
    this.status({ phase: "mounting", message: "mounting rom..." });

    const { system, rom } = opts;
    if (!system.core) throw new Error(`system ${system.id} has no ejs core`);

    const romUrl =
      rom.kind === "url" ? rom.url : this.track(URL.createObjectURL(new Blob([rom.data])));

    // first available BIOS blob for the system, by config order
    let biosUrl: string | undefined;
    let biosName: string | undefined;
    if (system.bios && opts.bios) {
      for (const f of system.bios.files) {
        const blob = opts.bios[f.fileName];
        if (blob) {
          biosUrl = this.track(URL.createObjectURL(blob));
          biosName = f.fileName;
          break;
        }
      }
    }

    const iframe = document.createElement("iframe");
    iframe.title = `${opts.title} — emulator`;
    iframe.style.cssText =
      "width:100%;height:100%;border:0;display:block;background:#0a0a0c";
    iframe.allow = "gamepad; fullscreen; autoplay";
    opts.mount.appendChild(iframe);
    this.iframe = iframe;

    const doc = iframe.contentDocument!;
    doc.open();
    doc.write(
      `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;height:100%;background:#0a0a0c}#game{width:100%;height:100%}</style></head><body><div id="game"></div></body></html>`,
    );
    doc.close();

    const w = iframe.contentWindow as any;
    w.EJS_player = "#game";
    w.EJS_core = system.core;
    w.EJS_gameUrl = romUrl;
    w.EJS_gameName = opts.title;
    w.EJS_pathtodata = EJS_DATA_PATH;
    w.EJS_startOnLoaded = true;
    w.EJS_backgroundColor = "#0a0a0c";
    w.EJS_startButtonName = "▶ INSERT";
    // threads only help the heavy cores, and only when the page is cross-origin isolated
    w.EJS_threads = Boolean(system.heavy && window.crossOriginIsolated);
    if (biosUrl) {
      w.EJS_biosUrl = biosUrl;
      w.EJS_biosName = biosName;
    }

    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const fail = (message: string) => {
        if (settled) return;
        settled = true;
        this.status({ phase: "error", message });
        reject(new Error(message));
      };

      w.EJS_ready = () => {
        // core fetched + wasm compiled; game starts via EJS_startOnLoaded
      };
      w.EJS_onGameStart = () => {
        if (settled) return;
        settled = true;
        this.status({ phase: "running" });
        resolve();
      };
      // EmulatorJS reports fatal init errors through its own UI; watchdog covers us
      const watchdog = window.setTimeout(() => {
        fail(
          `core ${system.core} failed to start within 120s — ` +
            (system.bios ? "check BIOS in /bios, then retry" : "rom may be incompatible"),
        );
      }, 120_000);
      w.EJS_onGameStarted = w.EJS_onGameStart;
      const clear = () => window.clearTimeout(watchdog);
      w.addEventListener?.("unload", clear);

      const script = doc.createElement("script");
      script.src = `${EJS_DATA_PATH}loader.js`;
      script.onerror = () => fail("emulator runtime missing — run `npm run setup:engines`");
      doc.body.appendChild(script);
    });
  }

  async saveState(): Promise<Uint8Array> {
    const emu = this.emu;
    if (!emu?.gameManager) throw new Error("emulator not running");
    const state = await Promise.resolve(emu.gameManager.getState());
    if (!(state instanceof Uint8Array) || state.length === 0)
      throw new Error("core returned empty state");
    return state;
  }

  async loadState(data: Uint8Array): Promise<void> {
    const emu = this.emu;
    if (!emu?.gameManager) throw new Error("emulator not running");
    await Promise.resolve(emu.gameManager.loadState(data));
  }

  async screenshot(): Promise<Blob | null> {
    const emu = this.emu;
    try {
      // EmulatorJS ≥4.x exposes a screenshot on the game manager
      if (emu?.gameManager?.screenshot) {
        const shot = await Promise.resolve(emu.gameManager.screenshot());
        if (shot instanceof Blob) return shot;
        if (shot instanceof Uint8Array)
          return new Blob([shot.slice().buffer as ArrayBuffer], { type: "image/png" });
      }
    } catch {
      // fall through to canvas capture
    }
    const canvas = this.iframe?.contentDocument?.querySelector("canvas");
    if (!canvas) return null;
    return new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/png"));
  }

  setVolume(volume: number): void {
    const emu = this.emu;
    if (!emu) return;
    try {
      if (typeof emu.setVolume === "function") emu.setVolume(volume);
      else emu.volume = volume;
    } catch {
      /* a muted toggle failing is not worth surfacing */
    }
  }

  async dispose(): Promise<void> {
    try {
      this.emu?.callEvent?.("exit");
    } catch {
      /* engine teardown is best-effort; iframe removal guarantees cleanup */
    }
    this.iframe?.remove();
    this.iframe = null;
    for (const u of this.objectUrls) URL.revokeObjectURL(u);
    this.objectUrls = [];
    this.status({ phase: "disposed" });
  }

  private track(url: string): string {
    this.objectUrls.push(url);
    return url;
  }

  private status(s: EngineStatus) {
    this.onStatus?.(s);
  }
}
