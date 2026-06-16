"use client";

import { useCallback, useEffect, useState } from "react";
import {
  systemsNeedingBios,
  type BiosFileDef,
  type SystemDef,
} from "@/config/systems.config";
import { sha256Hex } from "@/lib/client/hash";
import {
  deleteBios,
  getBios,
  putBios,
  type StoredBios,
} from "@/lib/client/idb";

const SYSTEMS = systemsNeedingBios();

type Status =
  | { state: "verified"; sha256: string; size: number }
  | { state: "unverified"; sha256: string; size: number } // stored, but no known-good hash to check against
  | { state: "mismatch"; sha256: string } // stored hash doesn't match known-good
  | { state: "missing" }
  | { state: "busy" }
  | { state: "error"; message: string };

/**
 * /bios — the BIOS Vault. RK8 never ships or fetches BIOS files; the user
 * supplies their own. Each file is hashed in-browser, checked against known-good
 * SHA-256s where we have them, and written to IndexedDB only — it is injected
 * into the engine at runtime and never sent anywhere.
 */
export function BiosManager() {
  const [statuses, setStatuses] = useState<Record<string, Status>>({});

  const refresh = useCallback(async (file: BiosFileDef) => {
    const stored = await getBios(file.fileName);
    setStatuses((prev) => ({
      ...prev,
      [file.fileName]: statusFor(file, stored),
    }));
  }, []);

  useEffect(() => {
    for (const sys of SYSTEMS)
      for (const f of sys.bios!.files) void refresh(f);
  }, [refresh]);

  const onUpload = useCallback(
    async (file: BiosFileDef, picked: File) => {
      setStatuses((prev) => ({ ...prev, [file.fileName]: { state: "busy" } }));
      try {
        const buf = await picked.arrayBuffer();
        const sha256 = await sha256Hex(buf);
        const known = file.sha256;
        const verified = known.length === 0 || known.includes(sha256);
        if (known.length > 0 && !verified) {
          // refuse to store a file that fails a known-good check
          setStatuses((prev) => ({
            ...prev,
            [file.fileName]: { state: "mismatch", sha256 },
          }));
          return;
        }
        const entry: StoredBios = {
          blob: new Blob([buf]),
          sha256,
          verified,
          storedAt: Date.now(),
        };
        await putBios(file.fileName, entry);
        await refresh(file);
      } catch (e) {
        setStatuses((prev) => ({
          ...prev,
          [file.fileName]: {
            state: "error",
            message: e instanceof Error ? e.message : "could not read file",
          },
        }));
      }
    },
    [refresh],
  );

  const onRemove = useCallback(
    async (file: BiosFileDef) => {
      await deleteBios(file.fileName);
      await refresh(file);
    },
    [refresh],
  );

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 md:px-6">
      <p className="hud-label mb-2">/// BIOS VAULT</p>
      <h1 className="mb-3 font-mono text-3xl font-bold text-text">
        bring your own bios
      </h1>
      <p className="mb-3 max-w-2xl font-mono text-sm leading-relaxed text-dim">
        Some systems need a console BIOS to boot. RK8 never bundles, downloads,
        hosts, or proxies BIOS files — they are copyrighted, so supplying them is
        on you, from hardware you own.
      </p>
      <p className="mb-10 max-w-2xl font-mono text-sm leading-relaxed text-cp-cyan">
        Files are verified in your browser and saved only in this browser&apos;s
        storage. They are injected into the emulator at runtime and never leave
        your device.
      </p>

      <div className="flex flex-col gap-px">
        {SYSTEMS.map((sys) => (
          <SystemBlock
            key={sys.id}
            sys={sys}
            statuses={statuses}
            onUpload={onUpload}
            onRemove={onRemove}
          />
        ))}
      </div>
    </div>
  );
}

function SystemBlock({
  sys,
  statuses,
  onUpload,
  onRemove,
}: {
  sys: SystemDef;
  statuses: Record<string, Status>;
  onUpload: (f: BiosFileDef, picked: File) => void;
  onRemove: (f: BiosFileDef) => void;
}) {
  return (
    <section className="border bg-surface p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-mono text-base text-text">{sys.name}</h2>
        <span className="hud-label">SYS // {sys.shortName}</span>
      </div>
      <p className="mb-4 font-mono text-xs leading-relaxed text-dim">
        {sys.bios!.note}
      </p>
      <div className="flex flex-col gap-px">
        {sys.bios!.files.map((f) => (
          <BiosRow
            key={f.fileName}
            file={f}
            status={statuses[f.fileName] ?? { state: "missing" }}
            onUpload={onUpload}
            onRemove={onRemove}
          />
        ))}
      </div>
    </section>
  );
}

function BiosRow({
  file,
  status,
  onUpload,
  onRemove,
}: {
  file: BiosFileDef;
  status: Status;
  onUpload: (f: BiosFileDef, picked: File) => void;
  onRemove: (f: BiosFileDef) => void;
}) {
  const present =
    status.state === "verified" ||
    status.state === "unverified";

  return (
    <div className="flex flex-col gap-3 border-t border-line/60 py-3 first:border-t-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="truncate font-mono text-sm text-text">
          {file.label}
          {file.optional && <span className="ml-2 hud-label">OPTIONAL</span>}
        </p>
        <p className="hud-label mt-0.5 truncate">
          FILE // {file.fileName}
          {file.sha256.length > 0 && (
            <span className="ml-2 text-cp-cyan">HASH-CHECKED</span>
          )}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-3">
        <StatusBadge status={status} />
        {present ? (
          <button
            type="button"
            className="rk8-btn-ghost rk8-btn-danger"
            onClick={() => onRemove(file)}
          >
            remove
          </button>
        ) : (
          <label className="rk8-btn-ghost cursor-pointer">
            {status.state === "busy" ? "verifying…" : "add file"}
            <input
              type="file"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onUpload(file, f);
                e.target.value = "";
              }}
            />
          </label>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: Status }) {
  switch (status.state) {
    case "verified":
      return <span className="hud-data text-cp-yellow">VERIFIED</span>;
    case "unverified":
      return <span className="hud-data">STORED</span>;
    case "mismatch":
      return (
        <span className="hud-label text-cp-red" title={status.sha256}>
          HASH MISMATCH
        </span>
      );
    case "error":
      return (
        <span className="hud-label text-cp-red" title={status.message}>
          ERROR
        </span>
      );
    case "busy":
      return <span className="hud-label text-cp-cyan">…</span>;
    default:
      return <span className="hud-label">NOT LOADED</span>;
  }
}

function statusFor(
  file: BiosFileDef,
  stored: StoredBios | undefined,
): Status {
  if (!stored) return { state: "missing" };
  const size = stored.blob.size;
  if (file.sha256.length === 0)
    return { state: "unverified", sha256: stored.sha256, size };
  if (file.sha256.includes(stored.sha256))
    return { state: "verified", sha256: stored.sha256, size };
  return { state: "mismatch", sha256: stored.sha256 };
}
