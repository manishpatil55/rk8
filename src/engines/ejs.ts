"use client";

import type {
  EmulationEngine,
  EngineLoadOptions,
  EngineStatus,
} from "./types";

const EJS_DATA_PATH = "/engines/emulatorjs/data/";

// when a fallback core exists we stop waiting on the primary's wasm to compile
// after this long and switch cores; the overall start budget is the ceiling for
// a core that compiled but never reached gameplay (a rom/bios problem).
const CORE_READY_TIMEOUT_MS = 75_000;
const GAME_START_TIMEOUT_MS = 120_000;

/**
 * Thrown by a single boot attempt. `coreFailed` separates a core that never
 * initialized (the configured fallback is worth a shot) from a rom/bios failure
 * (a different core won't help) — so load() only retries when retrying can fix it.
 */
class CoreBootError extends Error {
  constructor(
    message: string,
    readonly coreFailed: boolean,
  ) {
    super(message);
    this.name = "CoreBootError";
  }
}

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

    const fallback =
      system.fallbackCore && system.fallbackCore !== system.core
        ? system.fallbackCore
        : null;

    try {
      await this.bootCore(system.core, opts, romUrl, biosUrl, biosName, Boolean(fallback));
    } catch (err) {
      // retry on the fallback ONLY when the primary core itself never came up;
      // a rom/bios failure (coreFailed=false) would fail identically on any core.
      if (fallback && err instanceof CoreBootError && err.coreFailed) {
        this.teardownIframe();
        this.status({
          phase: "mounting",
          message: `${system.core} failed — retrying on ${fallback}...`,
        });
        await this.bootCore(fallback, opts, romUrl, biosUrl, biosName, false);
        return;
      }
      throw err;
    }
  }

  /**
   * One boot attempt against a specific core. Resolves when the game starts,
   * rejects with a CoreBootError otherwise. With `canFallback` set, an un-readied
   * core is abandoned early (CORE_READY_TIMEOUT_MS) so load() can switch cores
   * rather than spend the whole start budget on a core that never compiled.
   */
  private bootCore(
    core: string,
    opts: EngineLoadOptions,
    romUrl: string,
    biosUrl: string | undefined,
    biosName: string | undefined,
    canFallback: boolean,
  ): Promise<void> {
    const { system } = opts;

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
    w.EJS_core = core;
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

    return new Promise<void>((resolve, reject) => {
      let settled = false;
      const timers: number[] = [];
      const finish = (fn: () => void) => {
        if (settled) return;
        settled = true;
        for (const t of timers) window.clearTimeout(t);
        fn();
      };
      // no error status here — a recoverable failure would flash BOOT FAILURE
      // before the retry; load()/PlayerFrame surface the message that sticks.
      const fail = (message: string, coreFailed: boolean) =>
        finish(() => reject(new CoreBootError(message, coreFailed)));

      let coreReady = false;
      w.EJS_ready = () => {
        // core fetched + wasm compiled; game starts via EJS_startOnLoaded
        coreReady = true;
      };
      w.EJS_onGameStart = () =>
        finish(() => {
          this.status({ phase: "running", core });
          resolve();
        });
      w.EJS_onGameStarted = w.EJS_onGameStart;

      // with a fallback in hand, don't spend the full budget on a core whose
      // wasm never even compiled — cut over early.
      if (canFallback) {
        timers.push(
          window.setTimeout(() => {
            if (!coreReady) fail(`core ${core} did not initialize`, true);
          }, CORE_READY_TIMEOUT_MS),
        );
      }
      // EmulatorJS reports fatal init errors only through its own UI; this is our
      // backstop. If the core never readied it's a core failure; otherwise rom/bios.
      timers.push(
        window.setTimeout(() => {
          fail(
            `core ${core} failed to start within 120s — ` +
              (system.bios ? "check BIOS in /bios, then retry" : "rom may be incompatible"),
            !coreReady,
          );
        }, GAME_START_TIMEOUT_MS),
      );

      const clear = () => {
        for (const t of timers) window.clearTimeout(t);
      };
      w.addEventListener?.("unload", clear);

      const script = doc.createElement("script");
      script.src = `${EJS_DATA_PATH}loader.js`;
      // a missing runtime breaks every core equally — no point trying the fallback.
      script.onerror = () =>
        fail("emulator runtime missing — run `npm run setup:engines`", false);
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

  setFastForward(on: boolean): void {
    const emu = this.emu;
    if (!emu?.gameManager) return; // not running yet
    try {
      // keep EJS's own flag in sync — its settings UI reads isFastForward
      emu.isFastForward = on;
      emu.gameManager.toggleFastForward(on ? 1 : 0);
    } catch {
      /* best-effort */
    }
  }

  async dispose(): Promise<void> {
    this.teardownIframe();
    for (const u of this.objectUrls) URL.revokeObjectURL(u);
    this.objectUrls = [];
    this.status({ phase: "disposed" });
  }

  /** drop the current attempt's iframe but KEEP the shared object URLs, so a
   *  fallback attempt can reuse the same rom/bios blobs. */
  private teardownIframe(): void {
    try {
      this.emu?.callEvent?.("exit");
    } catch {
      /* engine teardown is best-effort; iframe removal guarantees cleanup */
    }
    this.iframe?.remove();
    this.iframe = null;
  }

  private track(url: string): string {
    this.objectUrls.push(url);
    return url;
  }

  private status(s: EngineStatus) {
    this.onStatus?.(s);
  }
}
