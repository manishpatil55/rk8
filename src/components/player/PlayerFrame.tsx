"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { getSystem } from "@/config/systems.config";
import { createEngine } from "@/engines";
import type { EmulationEngine, EngineStatus, RomSource } from "@/engines/types";
import {
  deleteSaveState,
  getBios,
  getSaveState,
  listSaveSlots,
  putSaveState,
} from "@/lib/client/idb";
import {
  deleteServerSave,
  fetchServerSlots,
  getServerSave,
  putServerSave,
} from "@/lib/client/server-saves";

export interface PlayerFrameProps {
  systemId: string;
  title: string;
  slug: string;
  rom: RomSource;
  /** rom SHA-256 — keys save states identically for local + library play */
  romSha256: string;
  /** library game id; fires the debounced play-count beacon when present */
  gameId?: string;
  /** signed-in on a library game → also sync save states to the server */
  canSync?: boolean;
}

type Toast = { text: string; tone: "info" | "error" } | null;

/**
 * THE player frame — RK8's signature element and the unifying identity across
 * all three engines: hairline HUD bezel, yellow corner brackets, cyan status
 * readout, save slots as a row of cartridges that fill yellow when occupied.
 */
export function PlayerFrame(props: PlayerFrameProps) {
  const system = getSystem(props.systemId);
  const mountRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<EmulationEngine | null>(null);

  const [status, setStatus] = useState<EngineStatus>({
    phase: "mounting",
    message: "mounting rom...",
  });
  const [slots, setSlots] = useState<Map<number, { createdAt: number }>>(new Map());
  const [activeSlot, setActiveSlot] = useState(0);
  const [muted, setMuted] = useState(false);
  const [toast, setToast] = useState<Toast>(null);
  const [biosMissing, setBiosMissing] = useState<string[] | null>(null);
  const [fastForwarding, setFastForwarding] = useState(false);
  const [legendOpen, setLegendOpen] = useState(false);

  // fast-forward is the only non-universal capability; EJS is the only engine
  // that implements it (ruffle/jsdos throw, so the control is gated off).
  const supportsFastForward = system?.engine === "ejs";

  // sync only makes sense for a signed-in user playing a real library game
  const canSync = !!props.canSync && !!props.gameId;

  const say = useCallback((text: string, tone: "info" | "error" = "info") => {
    setToast({ text, tone });
    window.setTimeout(() => setToast(null), 2600);
  }, []);

  /* boot */
  useEffect(() => {
    if (!system || !mountRef.current) return;
    let cancelled = false;
    setFastForwarding(false); // a fresh boot is always at normal speed
    const engine = createEngine(system.engine);
    engineRef.current = engine;

    (async () => {
      // gather user-supplied BIOS from the browser vault
      let bios: Record<string, Blob> | undefined;
      if (system.bios) {
        bios = {};
        const missing: string[] = [];
        for (const f of system.bios.files) {
          const entry = await getBios(f.fileName);
          if (entry) bios[f.fileName] = entry.blob;
          else if (!f.optional) missing.push(f.fileName);
        }
        const anyPresent = Object.keys(bios).length > 0;
        const allOptional = system.bios.files.every((f) => f.optional);
        if ((allOptional && !anyPresent) || (!allOptional && missing.length > 0)) {
          if (!cancelled) setBiosMissing(system.bios.files.map((f) => f.fileName));
          return;
        }
      }

      try {
        await engine.load({
          system,
          rom: props.rom,
          mount: mountRef.current!,
          gameKey: props.romSha256,
          title: props.title,
          bios,
          onStatus: (s) => !cancelled && setStatus(s),
        });
        if (cancelled) return;
        // debounced play-count beacon — one per boot, fire-and-forget
        if (props.gameId) {
          navigator.sendBeacon?.(`/api/play/${props.gameId}`) ||
            fetch(`/api/play/${props.gameId}`, { method: "POST", keepalive: true });
        }
      } catch (e) {
        if (!cancelled)
          setStatus({
            phase: "error",
            message: e instanceof Error ? e.message : "boot failed",
          });
      }
    })();

    return () => {
      cancelled = true;
      engine.dispose();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.systemId, props.romSha256]);

  /* occupied slots — union of the local IndexedDB vault and (if signed in) the
     server, so cross-device saves show up on a fresh browser */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const merged = new Map<number, { createdAt: number }>();
      const local = await listSaveSlots(props.romSha256);
      for (const [k, v] of local) merged.set(k, { createdAt: v.createdAt });
      if (canSync && props.gameId) {
        try {
          for (const s of await fetchServerSlots(props.gameId)) {
            const cur = merged.get(s.slot);
            // keep the freshest timestamp across local/server
            if (!cur || s.createdAt > cur.createdAt)
              merged.set(s.slot, { createdAt: s.createdAt });
          }
        } catch {
          /* offline / server hiccup — local slots still show */
        }
      }
      if (!cancelled) setSlots(merged);
    })();
    return () => {
      cancelled = true;
    };
  }, [props.romSha256, props.gameId, canSync]);

  /* controller toast */
  useEffect(() => {
    const on = () => say("controller linked");
    const off = () => say("controller disconnected");
    window.addEventListener("gamepadconnected", on);
    window.addEventListener("gamepaddisconnected", off);
    return () => {
      window.removeEventListener("gamepadconnected", on);
      window.removeEventListener("gamepaddisconnected", off);
    };
  }, [say]);

  const supportsStates = system
    ? createEngineCapability(system.engine)
    : false;

  const doSave = useCallback(async () => {
    const engine = engineRef.current;
    if (!engine || status.phase !== "running") return;
    try {
      const data = await engine.saveState();
      const now = Date.now();
      // local vault always (offline + anonymous)
      await putSaveState(props.romSha256, activeSlot, {
        data,
        createdAt: now,
        title: props.title,
      });
      setSlots((m) => new Map(m).set(activeSlot, { createdAt: now }));
      // server sync (best-effort) with a thumbnail for the slot
      if (canSync && props.gameId) {
        try {
          const shot = await engine.screenshot().catch(() => null);
          await putServerSave(props.gameId, activeSlot, data, shot);
          say(`state saved // slot ${activeSlot} // synced`);
          return;
        } catch {
          say(`state saved // slot ${activeSlot} // local only (sync failed)`);
          return;
        }
      }
      say(`state saved // slot ${activeSlot}`);
    } catch (e) {
      say(e instanceof Error ? e.message : "save failed", "error");
    }
  }, [activeSlot, canSync, props.gameId, props.romSha256, props.title, say, status.phase]);

  const doLoad = useCallback(async () => {
    const engine = engineRef.current;
    if (!engine || status.phase !== "running") return;
    try {
      // prefer the local copy; fall back to the server (fresh device / cleared cache)
      const local = await getSaveState(props.romSha256, activeSlot);
      let data = local?.data ?? null;
      let fromServer = false;
      if (!data && canSync && props.gameId) {
        data = await getServerSave(props.gameId, activeSlot);
        fromServer = !!data;
      }
      if (!data) return say(`slot ${activeSlot} is empty`, "error");
      await engine.loadState(data);
      // warm the local vault so a server-sourced state is offline-available next time
      if (fromServer)
        await putSaveState(props.romSha256, activeSlot, {
          data,
          createdAt: Date.now(),
          title: props.title,
        });
      say(`state loaded // slot ${activeSlot}${fromServer ? " // from cloud" : ""}`);
    } catch (e) {
      say(e instanceof Error ? e.message : "load failed", "error");
    }
  }, [activeSlot, canSync, props.gameId, props.romSha256, props.title, say, status.phase]);

  const doDelete = useCallback(async () => {
    await deleteSaveState(props.romSha256, activeSlot);
    if (canSync && props.gameId)
      await deleteServerSave(props.gameId, activeSlot).catch(() => {});
    setSlots((m) => {
      const n = new Map(m);
      n.delete(activeSlot);
      return n;
    });
    say(`slot ${activeSlot} ejected`);
  }, [activeSlot, canSync, props.gameId, props.romSha256, say]);

  const doScreenshot = useCallback(async () => {
    const blob = await engineRef.current?.screenshot();
    if (!blob) return say("screenshot unavailable for this engine", "error");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${props.slug}-${Date.now()}.png`;
    a.click();
    URL.revokeObjectURL(a.href);
    say("frame captured");
  }, [props.slug, say]);

  const doFullscreen = useCallback(() => {
    frameRef.current?.requestFullscreen?.();
  }, []);

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      engineRef.current?.setVolume(m ? 1 : 0);
      return !m;
    });
  }, []);

  const toggleFastForward = useCallback(() => {
    setFastForwarding((on) => {
      const next = !on;
      try {
        engineRef.current?.setFastForward(next);
      } catch {
        /* gated by supportsFastForward, so this shouldn't fire */
      }
      return next;
    });
  }, []);

  /* `?` toggles the control legend (ignored while typing, e.g. the admin
     preview's reason field). The button below works regardless of focus —
     the emulator iframe swallows keydowns once the game has focus. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      if (e.key === "?") {
        e.preventDefault();
        setLegendOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!system) {
    return (
      <p className="border border-cp-red p-6 font-mono text-sm text-cp-red">
        UNKNOWN SYSTEM — this cartridge has no machine to run on
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* the bezel */}
      <div
        ref={frameRef}
        className="relative border bg-black"
        style={{ aspectRatio: "4 / 3", maxHeight: "70vh" }}
      >
        <CornerBrackets />
        {biosMissing ? (
          <BiosGate files={biosMissing} note={system.bios?.note} />
        ) : status.phase === "error" ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-6">
            <p className="hud-label text-cp-red">BOOT FAILURE</p>
            <p className="max-w-md text-center font-mono text-sm text-dim">
              {status.message}
            </p>
          </div>
        ) : (
          <>
            {status.phase === "mounting" && (
              <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
                <p className="font-mono text-sm text-cp-cyan">
                  {status.message ?? "mounting rom..."}
                </p>
              </div>
            )}
            <div
              ref={mountRef}
              className={`h-full w-full ${status.phase === "running" ? "rk8-crt-on" : ""}`}
            />
          </>
        )}
        {toast && (
          <p
            role="status"
            className={`absolute bottom-3 left-3 z-20 border bg-bg px-3 py-1.5 font-mono text-xs ${
              toast.tone === "error"
                ? "border-cp-red text-cp-red"
                : "border-cp-yellow text-cp-yellow"
            }`}
          >
            {toast.text}
          </p>
        )}
      </div>

      {/* live status row */}
      <p className="hud-data flex flex-wrap gap-x-3 gap-y-1">
        <span>SYS // {system.shortName}</span>
        <span className="text-dim">·</span>
        <span>CORE // {(status.core ?? system.core ?? system.engine).toUpperCase()}</span>
        <span className="text-dim">·</span>
        <span>
          STATE //{" "}
          {supportsStates ? `SLOT ${activeSlot}` : "UNSUPPORTED"}
        </span>
        <span className="text-dim">·</span>
        <span
          className={
            status.phase === "error" ? "text-cp-red" : undefined
          }
        >
          STATUS // {status.phase.toUpperCase()}
        </span>
      </p>

      {/* cartridge slots + transport controls */}
      <div className="flex flex-wrap items-center gap-4 border p-3">
        {supportsStates ? (
          <>
            <div className="flex items-center gap-1.5" role="group" aria-label="save slots">
              {Array.from({ length: 10 }, (_, i) => (
                <button
                  key={i}
                  type="button"
                  aria-label={`slot ${i}${slots.has(i) ? " (occupied)" : " (empty)"}`}
                  aria-pressed={activeSlot === i}
                  onClick={() => setActiveSlot(i)}
                  className={`h-10 w-6 border transition-colors ${
                    slots.has(i)
                      ? "border-cp-yellow bg-cp-yellow"
                      : "border-line bg-surface"
                  } ${activeSlot === i ? "outline outline-1 outline-offset-2 outline-cp-yellow" : ""}`}
                  style={{
                    clipPath:
                      "polygon(0 18%, 22% 18%, 22% 0, 78% 0, 78% 18%, 100% 18%, 100% 100%, 0 100%)",
                  }}
                />
              ))}
            </div>
            <div className="flex gap-2">
              <button type="button" className="rk8-btn-ghost" onClick={doSave}>
                save
              </button>
              <button type="button" className="rk8-btn-ghost" onClick={doLoad}>
                load
              </button>
              {slots.has(activeSlot) && (
                <button type="button" className="rk8-btn-ghost rk8-btn-danger" onClick={doDelete}>
                  del
                </button>
              )}
            </div>
          </>
        ) : (
          <p className="hud-label">
            SAVE STATES // NOT SUPPORTED BY THIS ENGINE
          </p>
        )}

        <div className="ml-auto flex gap-2">
          {supportsFastForward && (
            <button
              type="button"
              className={`rk8-btn-ghost ${
                fastForwarding ? "!border-cp-yellow !text-cp-yellow" : ""
              }`}
              onClick={toggleFastForward}
              aria-pressed={fastForwarding}
            >
              {fastForwarding ? "fast ▶▶" : "fast"}
            </button>
          )}
          <button type="button" className="rk8-btn-ghost" onClick={doScreenshot}>
            capture
          </button>
          <button type="button" className="rk8-btn-ghost" onClick={toggleMute} aria-pressed={muted}>
            {muted ? "unmute" : "mute"}
          </button>
          <button type="button" className="rk8-btn-ghost" onClick={doFullscreen}>
            fullscreen
          </button>
          <button
            type="button"
            className="rk8-btn-ghost"
            onClick={() => setLegendOpen(true)}
            aria-haspopup="dialog"
            aria-label="control legend"
          >
            ?
          </button>
        </div>
      </div>

      <KeyLegend
        open={legendOpen}
        onClose={() => setLegendOpen(false)}
        supportsFastForward={supportsFastForward}
      />
    </div>
  );
}

/** engines whose adapter implements machine states (kept in one place) */
function createEngineCapability(engine: string): boolean {
  return engine === "ejs";
}

function CornerBrackets() {
  const base = "pointer-events-none absolute z-10 h-4 w-4 border-cp-yellow";
  return (
    <>
      <span aria-hidden className={`${base} left-0 top-0 border-l border-t`} />
      <span aria-hidden className={`${base} right-0 top-0 border-r border-t`} />
      <span aria-hidden className={`${base} bottom-0 left-0 border-b border-l`} />
      <span aria-hidden className={`${base} bottom-0 right-0 border-b border-r`} />
    </>
  );
}

function BiosGate({ files, note }: { files: string[]; note?: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-6">
      <p className="hud-label text-cp-cyan">BIOS REQUIRED</p>
      <p className="max-w-md text-center font-mono text-sm text-dim">
        {note ?? "this system needs a bios file you supply yourself."} needed:{" "}
        {files.join(" · ")}
      </p>
      <Link href="/bios" className="rk8-btn-primary">
        open bios vault
      </Link>
    </div>
  );
}

/** the `?` control legend — native <dialog> for a free focus trap + Escape. */
function KeyLegend({
  open,
  onClose,
  supportsFastForward,
}: {
  open: boolean;
  onClose: () => void;
  supportsFastForward: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    else if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby="rk8-legend-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className="notch-tr m-auto w-[calc(100vw-2rem)] max-w-md border bg-surface p-5 text-text backdrop:bg-black/70 backdrop:backdrop-blur-sm"
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-baseline justify-between gap-3">
          <p id="rk8-legend-title" className="hud-label text-cp-yellow">
            /// controls
          </p>
          <button type="button" className="rk8-btn-ghost" onClick={onClose}>
            close
          </button>
        </div>
        <dl className="flex flex-col gap-2 font-mono text-sm">
          <LegendRow k="slots 0–9" v="pick a cartridge slot, then save / load" />
          <LegendRow k="save / load" v="write or restore the active slot" />
          {supportsFastForward && (
            <LegendRow k="fast ▶▶" v="run the machine above real-time" />
          )}
          <LegendRow k="capture" v="download a png of the frame" />
          <LegendRow k="mute" v="toggle audio" />
          <LegendRow k="fullscreen" v="expand the bezel" />
          <LegendRow k="?" v="toggle this panel · esc closes" />
        </dl>
        <p className="font-mono text-xs text-dim">
          in-game buttons + gamepad are mapped inside the emulator — open its gear
          menu to remap. controllers are auto-detected.
        </p>
      </div>
    </dialog>
  );
}

function LegendRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="shrink-0 text-cp-cyan">{k}</dt>
      <dd className="text-right text-dim">{v}</dd>
    </div>
  );
}
