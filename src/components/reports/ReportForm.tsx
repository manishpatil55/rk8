"use client";

import Link from "next/link";
import { useCallback, useState } from "react";

const ERR: Record<string, string> = {
  invalid: "check the highlighted fields and try again.",
  rate: "too many reports from your connection — try again later.",
  not_found: "that game no longer exists.",
  already_down: "this cartridge is already down.",
  server: "something went wrong on our end — try again.",
};

const TYPES = [
  { value: "dmca", label: "DMCA notice", hint: "formal copyright takedown" },
  { value: "broken", label: "broken / won't run", hint: "the game fails to play" },
  { value: "wrong_info", label: "wrong info", hint: "incorrect metadata" },
  { value: "other", label: "other", hint: "anything else" },
] as const;

type ReportType = (typeof TYPES)[number]["value"];

export function ReportForm({
  gameId,
  gameTitle,
}: {
  gameId: string;
  gameTitle: string;
}) {
  const [type, setType] = useState<ReportType>("broken");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [done, setDone] = useState<null | { verifying: boolean }>(null);

  const isDmca = type === "dmca";

  const onSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const fd = new FormData(e.currentTarget);
      const payload = {
        gameId,
        type,
        body: String(fd.get("body") ?? ""),
        reporterEmail: String(fd.get("reporterEmail") ?? "").trim() || undefined,
        signature: isDmca
          ? String(fd.get("signature") ?? "").trim() || undefined
          : undefined,
        sworn: isDmca ? fd.get("sworn") === "on" : undefined,
      };

      setBusy(true);
      setError(null);
      setFieldErrors({});
      try {
        const res = await fetch("/api/report", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          // surface per-field Zod errors next to the inputs, not a dead-end banner
          if (data.issues && typeof data.issues === "object")
            setFieldErrors(data.issues as Record<string, string[]>);
          throw new Error(data.message || ERR[data.error as string] || ERR.invalid);
        }
        setDone({ verifying: Boolean(data.verifying) });
      } catch (err) {
        setError(err instanceof Error ? err.message : ERR.server!);
      } finally {
        setBusy(false);
      }
    },
    [gameId, type, isDmca],
  );

  if (done) {
    return (
      <div className="rk8-card notch-tr flex flex-col gap-4 p-6">
        <p className="hud-label text-cp-yellow">/// REPORT RECEIVED</p>
        <p className="font-mono text-sm leading-relaxed text-text">
          {done.verifying
            ? "check your email — open the confirmation link to activate your DMCA notice. once confirmed, a moderator is alerted and, if not actioned sooner, the listing is removed automatically within 72 hours."
            : "thanks — a moderator will review this report."}
        </p>
        <Link href="/" className="rk8-btn-ghost self-start">
          back to library
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      {/* type selector */}
      <fieldset className="flex flex-col gap-1">
        <span className="hud-label">type</span>
        <div className="grid gap-px border sm:grid-cols-2">
          {TYPES.map((t) => (
            <label
              key={t.value}
              className={`flex cursor-pointer items-start gap-3 border border-line/50 p-3 transition-colors ${
                type === t.value ? "bg-surface" : "hover:bg-surface/50"
              }`}
            >
              <input
                type="radio"
                name="type"
                value={t.value}
                checked={type === t.value}
                onChange={() => setType(t.value)}
                className="mt-1 h-4 w-4 accent-cp-red"
              />
              <span className="flex flex-col">
                <span className="font-mono text-sm text-text">{t.label}</span>
                <span className="hud-label">{t.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {/* dmca-only formal fields */}
      {isDmca && (
        <div className="flex flex-col gap-4 border border-cp-red/40 bg-cp-red/5 p-4">
          <p className="prose-legal text-sm text-dim">
            A DMCA notice is a legal document. The fields below are required
            elements of a valid notice under 17 U.S.C. § 512(c)(3).
          </p>

          <label className="flex flex-col gap-1">
            <span className="hud-label">contact email (required)</span>
            <input
              type="email"
              name="reporterEmail"
              required
              maxLength={200}
              aria-invalid={!!fieldErrors.reporterEmail}
              className="rk8-input"
              placeholder="you@rightsholder.com"
            />
            <FieldError errors={fieldErrors.reporterEmail} />
          </label>

          <label className="flex flex-col gap-1">
            <span className="hud-label">signature — full legal name (required)</span>
            <input
              type="text"
              name="signature"
              required
              maxLength={120}
              aria-invalid={!!fieldErrors.signature}
              className="rk8-input"
              placeholder="Jane Q. Rightsholder"
            />
            <FieldError errors={fieldErrors.signature} />
          </label>
        </div>
      )}

      {/* body */}
      <label className="flex flex-col gap-1">
        <span className="hud-label">
          {isDmca ? "the notice (required)" : "what's wrong? (required)"}
        </span>
        <textarea
          name="body"
          required
          maxLength={4000}
          rows={isDmca ? 8 : 4}
          aria-invalid={!!fieldErrors.body}
          className="rk8-input resize-y"
          placeholder={
            isDmca
              ? "Identify the copyrighted work, the infringing material on this site, your good-faith statement, and confirm the information is accurate."
              : `what's the problem with "${gameTitle}"?`
          }
        />
        <FieldError errors={fieldErrors.body} />
      </label>

      {/* optional contact for non-dmca */}
      {!isDmca && (
        <label className="flex flex-col gap-1">
          <span className="hud-label">your email (optional)</span>
          <input
            type="email"
            name="reporterEmail"
            maxLength={200}
            className="rk8-input"
            placeholder="only if you want a reply"
          />
        </label>
      )}

      {/* sworn affirmation — gates the 72h auto-takedown clock */}
      {isDmca && (
        <label className="flex items-start gap-3 border border-line bg-surface p-4">
          <input
            type="checkbox"
            name="sworn"
            required
            className="mt-1 h-4 w-4 accent-cp-red"
          />
          <span className="font-mono text-[13px] leading-relaxed text-dim">
            I have a good-faith belief that the use is not authorized by the
            copyright owner, its agent, or the law; and I swear, under penalty of
            perjury, that this information is accurate and that I am the copyright
            owner or authorized to act on its behalf.
          </span>
        </label>
      )}
      {isDmca && <FieldError errors={fieldErrors.sworn} />}

      {error && (
        <p
          role="alert"
          className="border border-cp-red/50 bg-cp-red/10 p-3 font-mono text-sm text-cp-red"
        >
          {error}
        </p>
      )}

      <div className="flex items-center justify-between gap-3">
        <Link href="/dmca" className="cmd-link text-dim hover:text-text">
          &gt; full policy
        </Link>
        <button
          type="submit"
          disabled={busy}
          className="rk8-btn-primary disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? "transmitting…" : isDmca ? "submit notice" : "submit report"}
        </button>
      </div>
    </form>
  );
}

function FieldError({ errors }: { errors?: string[] }) {
  if (!errors?.length) return null;
  return (
    <span className="font-mono text-xs text-cp-red">{errors[0]}</span>
  );
}
