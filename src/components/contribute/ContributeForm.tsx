"use client";

import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import { MANUFACTURERS, getSystem, systemsFor } from "@/config/systems.config";
import { bestSystem } from "@/lib/detect";

const ERR: Record<string, string> = {
  attestation: "you must confirm you have the right to share this file.",
  invalid: "check the highlighted fields and try again.",
  system: "pick a valid system.",
  no_rom: "choose a rom file first.",
  too_large: "rom exceeds the 256 MB limit.",
  ext: "that file type isn't valid for the selected system.",
  magic: "the file contents don't match the selected system.",
  duplicate: "this exact rom is already in the library.",
  pending_cap: "you already have 3 submissions awaiting review.",
  cover_large: "cover image must be under 5 MB.",
  cover_type: "cover must be a png, jpg, or webp.",
  rate: "you're submitting too fast — wait a moment.",
  auth: "your session expired — sign in again.",
  banned: "this account can't contribute.",
  email: "verify your email with your provider first.",
  server: "something went wrong on our end — try again.",
  form: "upload failed — try again.",
};

const MB = 1024 * 1024;

interface Done {
  slug: string;
  systemId: string;
}

export function ContributeForm({ slotsLeft }: { slotsLeft: number }) {
  const [file, setFile] = useState<File | null>(null);
  const [systemId, setSystemId] = useState("");
  const [detected, setDetected] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Done | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  const onFile = useCallback(async (f: File) => {
    setError(null);
    setFile(f);
    if (titleRef.current && !titleRef.current.value)
      titleRef.current.value = f.name.replace(/\.[^.]+$/, "");
    // sniff the head for a magic-byte suggestion
    const head = new Uint8Array(await f.slice(0, MB).arrayBuffer());
    const guess = bestSystem(f.name, head);
    setDetected(guess);
    if (guess) setSystemId(guess);
  }, []);

  const onSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!file) return setError(ERR.no_rom!);
      if (!systemId) return setError(ERR.system!);
      const fd = new FormData(e.currentTarget);
      fd.set("rom", file);
      fd.set("systemId", systemId);

      setBusy(true);
      setProgress(0);
      setError(null);
      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/contribute");
      xhr.upload.onprogress = (ev) => {
        if (ev.lengthComputable) setProgress(Math.round((ev.loaded / ev.total) * 100));
      };
      xhr.onload = () => {
        setBusy(false);
        let body: { ok?: boolean; error?: string; message?: string; slug?: string; systemId?: string } = {};
        try {
          body = JSON.parse(xhr.responseText);
        } catch {
          /* ignore */
        }
        if (xhr.status === 200 && body.ok) {
          setDone({ slug: body.slug!, systemId: body.systemId! });
        } else {
          setError(body.message || ERR[body.error ?? "server"] || ERR.server!);
        }
      };
      xhr.onerror = () => {
        setBusy(false);
        setError(ERR.server!);
      };
      xhr.send(fd);
    },
    [file, systemId],
  );

  if (done) {
    return (
      <div className="rk8-card notch-tr flex flex-col gap-4 p-6">
        <p className="hud-label text-cp-yellow">/// SUBMISSION RECEIVED</p>
        <p className="font-mono text-sm leading-relaxed text-text">
          your cartridge entered the moderation queue. it stays private until a
          moderator approves it — you can track its status on your profile.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/profile" className="rk8-btn-primary">
            view my submissions
          </Link>
          <button
            type="button"
            className="rk8-btn-ghost"
            onClick={() => {
              setDone(null);
              setFile(null);
              setSystemId("");
              setDetected(null);
              setProgress(0);
            }}
          >
            submit another
          </button>
        </div>
      </div>
    );
  }

  const system = systemId ? getSystem(systemId) : undefined;

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      {/* rom drop zone */}
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const f = e.dataTransfer.files[0];
          if (f) onFile(f);
        }}
        className={`notch-tr flex min-h-40 cursor-pointer flex-col items-center justify-center gap-2 border border-dashed p-6 text-center transition-colors ${
          dragOver ? "border-cp-yellow bg-surface" : "border-line"
        }`}
      >
        <span className="font-mono text-sm text-text">
          {file ? file.name : "drop the rom here, or click to browse"}
        </span>
        <span className="hud-label">
          {file
            ? `${(file.size / MB).toFixed(1)} MB`
            : "MAX 256 MB · MOST CONSOLE / ARCADE / DOS / FLASH FORMATS"}
        </span>
        <input
          type="file"
          name="rom"
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
          }}
        />
      </label>

      {detected && (
        <p className="hud-label text-cp-cyan">
          DETECTED // {getSystem(detected)?.shortName ?? detected} — override below
          if wrong
        </p>
      )}

      {/* metadata grid */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="title" full>
          <input
            ref={titleRef}
            name="title"
            required
            maxLength={120}
            className="rk8-input"
            placeholder="e.g. Lan Master"
          />
        </Field>

        <Field label="system">
          <select
            value={systemId}
            onChange={(e) => setSystemId(e.target.value)}
            required
            className="rk8-input"
          >
            <option value="">— select —</option>
            {MANUFACTURERS.map((m) => (
              <optgroup key={m.id} label={m.label}>
                {systemsFor(m.id).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </Field>

        <Field label="license you're attesting">
          <select name="licenseClass" required className="rk8-input">
            <option value="homebrew">homebrew</option>
            <option value="public_domain">public domain</option>
            <option value="open">open / freely licensed</option>
          </select>
        </Field>

        <Field label="year (optional)">
          <input
            name="year"
            type="number"
            min={1970}
            max={2100}
            className="rk8-input"
            placeholder="2011"
          />
        </Field>

        <Field label="players (optional)">
          <input
            name="players"
            type="number"
            min={1}
            max={8}
            className="rk8-input"
            placeholder="1"
          />
        </Field>

        <Field label="description (optional)" full>
          <textarea
            name="description"
            maxLength={2000}
            rows={3}
            className="rk8-input resize-y"
            placeholder="what is it, why it's worth playing…"
          />
        </Field>

        <Field label="cover image (optional)" full>
          <input
            name="cover"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="rk8-input file:mr-3 file:border-0 file:bg-surface-2 file:px-3 file:py-1 file:font-mono file:text-dim"
          />
        </Field>
      </div>

      {system?.bios && (
        <p className="hud-label text-cp-cyan">
          NOTE // {system.shortName} needs a BIOS to run — players supply their
          own via the BIOS vault. never include BIOS files in your upload.
        </p>
      )}

      {/* attestation */}
      <label className="flex items-start gap-3 border border-line bg-surface p-4">
        <input
          type="checkbox"
          name="attestation"
          required
          className="mt-1 h-4 w-4 accent-cp-yellow"
        />
        <span className="font-mono text-[13px] leading-relaxed text-dim">
          I have the right to share this file — it is homebrew, public domain, or
          openly licensed — and I accept the Submission Policy. Commercial ROMs
          are removed and repeat infringers are banned.
        </span>
      </label>

      {error && (
        <p
          role="alert"
          className="border border-cp-red/50 bg-cp-red/10 p-3 font-mono text-sm text-cp-red"
        >
          {error}
        </p>
      )}

      {busy && (
        <div className="flex flex-col gap-1">
          <div className="h-1 w-full bg-surface-2">
            <div
              className="h-full bg-cp-yellow transition-[width]"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="hud-data">UPLOADING // {progress}%</span>
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <span className="hud-label">
          {slotsLeft > 0
            ? `${slotsLeft} of 3 submission slots free`
            : "no free slots — wait for a pending review"}
        </span>
        <button
          type="submit"
          disabled={busy || slotsLeft <= 0}
          className="rk8-btn-primary disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? "transmitting…" : "submit for review"}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  full,
  children,
}: {
  label: string;
  full?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className={`flex flex-col gap-1 ${full ? "sm:col-span-2" : ""}`}>
      <span className="hud-label">{label}</span>
      {children}
    </label>
  );
}
