"use client";

import type {
  EmulationEngine,
  EngineLoadOptions,
  EngineStatus,
} from "./types";

const JSDOS_BASE = "/engines/jsdos/";

declare global {
  interface Window {
    Dos?: any;
  }
}

let jsdosAssets: Promise<void> | null = null;

function loadJsDosRuntime(): Promise<void> {
  if (!jsdosAssets) {
    jsdosAssets = new Promise((resolve, reject) => {
      if (!document.querySelector('link[data-rk8="jsdos"]')) {
        const css = document.createElement("link");
        css.rel = "stylesheet";
        css.href = `${JSDOS_BASE}js-dos.css`;
        css.dataset.rk8 = "jsdos";
        document.head.appendChild(css);
      }
      const s = document.createElement("script");
      s.src = `${JSDOS_BASE}js-dos.js`;
      s.onload = () => resolve();
      s.onerror = () =>
        reject(new Error("js-dos runtime missing — run `npm run setup:engines`"));
      document.head.appendChild(s);
    });
  }
  return jsdosAssets;
}

/**
 * js-dos v8 adapter — DOS games from .jsdos bundles (a zip with a dosbox.conf
 * inside). v8 ships its own touch keyboard + virtual controls for mobile.
 * Machine save-states aren't exposed by v8's API, so slots report unsupported;
 * in-game disk saves persist via the emulator's own FS layer.
 */
export class JsDosEngine implements EmulationEngine {
  readonly id = "jsdos" as const;
  readonly capabilities = {
    saveStates: false,
    screenshots: true,
    fastForward: false,
  };

  private props: any = null;
  private host: HTMLElement | null = null;
  private objectUrl: string | null = null;
  private onStatus: ((s: EngineStatus) => void) | undefined;

  async load(opts: EngineLoadOptions): Promise<void> {
    this.onStatus = opts.onStatus;
    this.onStatus?.({ phase: "mounting", message: "mounting bundle..." });

    await loadJsDosRuntime();

    const url =
      opts.rom.kind === "url"
        ? opts.rom.url
        : (this.objectUrl = URL.createObjectURL(new Blob([opts.rom.data])));

    const host = document.createElement("div");
    host.style.cssText = "width:100%;height:100%";
    opts.mount.appendChild(host);
    this.host = host;

    this.props = window.Dos(host, {
      url,
      pathPrefix: `${JSDOS_BASE}emulators/`,
      theme: "dark",
      noNetworking: true,
      autoStart: true,
      kiosk: true,
      onEvent: (event: string) => {
        if (event === "emu-ready" || event === "ci-ready") {
          this.onStatus?.({ phase: "running" });
        }
      },
    });

    // js-dos boots asynchronously; if no ready event lands, surface running
    // state after the canvas appears so the chrome doesn't hang on "mounting"
    const started = Date.now();
    const poll = () => {
      if (!this.host) return;
      if (this.host.querySelector("canvas")) {
        this.onStatus?.({ phase: "running" });
        return;
      }
      if (Date.now() - started < 60_000) setTimeout(poll, 500);
      else this.onStatus?.({ phase: "error", message: "dos bundle failed to boot" });
    };
    setTimeout(poll, 500);
  }

  async saveState(): Promise<Uint8Array> {
    throw new Error("js-dos v8 does not expose machine states");
  }

  async loadState(): Promise<void> {
    throw new Error("js-dos v8 does not expose machine states");
  }

  async screenshot(): Promise<Blob | null> {
    const canvas = this.host?.querySelector("canvas");
    if (!canvas) return null;
    return new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/png"));
  }

  setVolume(volume: number): void {
    try {
      this.props?.setVolume?.(volume);
    } catch {
      /* best-effort */
    }
  }

  async dispose(): Promise<void> {
    try {
      await this.props?.stop?.();
    } catch {
      /* host removal guarantees cleanup */
    }
    this.props = null;
    this.host?.remove();
    this.host = null;
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
    this.objectUrl = null;
    this.onStatus?.({ phase: "disposed" });
  }
}
