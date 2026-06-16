"use client";

import { useCallback, useMemo, useState } from "react";
import { PlayerFrame } from "@/components/player/PlayerFrame";
import {
  SYSTEMS,
  systemsForExtension,
  type SystemDef,
} from "@/config/systems.config";
import { sha256Hex } from "@/lib/client/hash";

interface MountedRom {
  data: ArrayBuffer;
  fileName: string;
  sha256: string;
  candidates: SystemDef[];
}

/**
 * LOCAL PLAY — the zero-upload path. The file is read into an ArrayBuffer in
 * this tab and handed straight to the engine. There is no upload code on this
 * page at all; nothing is stored or logged server-side.
 */
export default function LocalPlayPage() {
  const [rom, setRom] = useState<MountedRom | null>(null);
  const [systemId, setSystemId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mount = useCallback(async (file: File) => {
    setError(null);
    const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
    const candidates = systemsForExtension(ext);
    if (candidates.length === 0) {
      setError(
        `no system accepts "${ext}" — supported: ${[...new Set(SYSTEMS.flatMap((s) => s.extensions))].join(" ")}`,
      );
      return;
    }
    const data = await file.arrayBuffer();
    const sha256 = await sha256Hex(data);
    setRom({ data, fileName: file.name, sha256, candidates });
    setSystemId(candidates.length === 1 ? candidates[0]!.id : null);
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) mount(file);
    },
    [mount],
  );

  const title = useMemo(
    () => rom?.fileName.replace(/\.[^.]+$/, "") ?? "",
    [rom],
  );

  /* playing */
  if (rom && systemId) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8 md:px-6">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <p className="hud-label mb-1">/// LOCAL PLAY — ZERO UPLOAD</p>
            <h1 className="font-mono text-2xl font-bold text-text">{title}</h1>
          </div>
          <button
            type="button"
            className="rk8-btn-ghost"
            onClick={() => {
              setRom(null);
              setSystemId(null);
            }}
          >
            eject
          </button>
        </div>
        <PlayerFrame
          systemId={systemId}
          title={title}
          slug={title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}
          rom={{ kind: "buffer", data: rom.data, fileName: rom.fileName }}
          romSha256={rom.sha256}
        />
        <p className="hud-label mt-4">
          THIS FILE NEVER LEFT YOUR DEVICE // SAVE STATES PERSIST IN YOUR
          BROWSER, KEYED TO THIS ROM&apos;S SHA-256
        </p>
      </div>
    );
  }

  /* system picker for ambiguous extensions (.bin, .cue, .iso, .zip ...) */
  if (rom && !systemId) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 md:px-6">
        <p className="hud-label mb-2">/// SELECT SYSTEM</p>
        <h1 className="mb-6 font-mono text-xl text-text">
          {rom.fileName} fits more than one machine — pick the right one
        </h1>
        <div className="flex flex-col gap-px border">
          {rom.candidates.map((s) => (
            <button
              key={s.id}
              type="button"
              className="flex items-center justify-between border-b border-line/50 p-4 text-left transition-colors last:border-b-0 hover:bg-surface"
              onClick={() => setSystemId(s.id)}
            >
              <span className="font-mono text-sm text-text">{s.name}</span>
              <span className="hud-label">
                SYS // {s.shortName}
                {s.bios && <span className="ml-2 text-cp-cyan">BIOS REQ</span>}
              </span>
            </button>
          ))}
        </div>
        <button
          type="button"
          className="rk8-btn-ghost mt-4"
          onClick={() => setRom(null)}
        >
          eject
        </button>
      </div>
    );
  }

  /* drop zone */
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 md:px-6">
      <p className="hud-label mb-2">/// LOCAL PLAY</p>
      <h1 className="mb-3 font-mono text-3xl font-bold text-text">
        your file never leaves your device
      </h1>
      <p className="mb-8 max-w-xl font-mono text-sm leading-relaxed text-dim">
        drag a rom from your own collection. it loads entirely inside your
        browser — no upload, no storage, no logging. save states live in your
        browser keyed by the file&apos;s fingerprint, so they survive reloads.
      </p>

      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`notch-tr flex min-h-56 cursor-pointer flex-col items-center justify-center gap-3 border border-dashed p-8 transition-colors ${
          dragOver ? "border-cp-yellow bg-surface" : "border-line"
        }`}
      >
        <span className="font-mono text-base text-text">
          {dragOver ? "release to mount" : "drop cartridge here"}
        </span>
        <span className="hud-label">OR CLICK TO BROWSE</span>
        <input
          type="file"
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) mount(f);
          }}
        />
      </label>

      {error && (
        <p className="mt-4 border border-cp-red p-3 font-mono text-xs text-cp-red">
          {error}
        </p>
      )}

      <p className="hud-label mt-8">
        SUPPORTED // {SYSTEMS.length} SYSTEMS ·{" "}
        {[...new Set(SYSTEMS.flatMap((s) => s.extensions))].length} FILE TYPES ·
        BIOS-GATED SYSTEMS NEED THE{" "}
        <a href="/bios" className="text-cp-cyan hover:text-text">
          BIOS VAULT
        </a>
      </p>
    </div>
  );
}
