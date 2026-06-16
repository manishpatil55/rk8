"use client";

import { useCallback, useState } from "react";
import { PlayerFrame } from "@/components/player/PlayerFrame";
import { getSystem } from "@/config/systems.config";

export interface QueueItem {
  id: string;
  slug: string;
  title: string;
  systemId: string;
  romSha256: string;
  romFileName: string;
  coverPath: string | null;
  sizeBytes: number;
  licenseClass: string;
  licenseNote: string | null;
  description: string;
  year: number | null;
  createdAt: number;
  submitter: { id: string; label: string } | null;
}

type Toast = { text: string; tone: "info" | "error" } | null;
type GameAction = "approve" | "reject" | "takedown";

/**
 * The moderation queue — one card per pending submission with in-browser
 * preview-play (authed /api/admin/rom) and one-click approve / reject /
 * takedown. Reject and takedown require a reason; the row leaves the list
 * optimistically on success. Ban (admin-only) acts on the uploader.
 */
export function ModerationQueue({
  items,
  canBan,
}: {
  items: QueueItem[];
  canBan: boolean;
}) {
  const [queue, setQueue] = useState(items);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast>(null);

  const say = useCallback((text: string, tone: "info" | "error" = "info") => {
    setToast({ text, tone });
    window.setTimeout(() => setToast(null), 3200);
  }, []);

  const moderate = useCallback(
    async (item: QueueItem, action: GameAction) => {
      const reason = (reasons[item.id] ?? "").trim();
      if ((action === "reject" || action === "takedown") && !reason) {
        say(`${action} needs a reason`, "error");
        return;
      }
      if (action === "takedown" && !confirm(`Takedown "${item.title}"? This is permanent and deletes the file.`))
        return;

      setBusy(item.id);
      try {
        const res = await fetch("/api/admin/moderate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ gameId: item.id, action, reason: reason || undefined }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || data.error || "failed");
        setQueue((q) => q.filter((g) => g.id !== item.id));
        if (preview === item.id) setPreview(null);
        say(`${item.title} — ${action}d`);
      } catch (e) {
        say(e instanceof Error ? e.message : "action failed", "error");
      } finally {
        setBusy(null);
      }
    },
    [preview, reasons, say],
  );

  const ban = useCallback(
    async (item: QueueItem) => {
      if (!item.submitter) return;
      const reason = prompt(`Ban ${item.submitter.label}? Reason:`);
      if (reason === null) return;
      if (!reason.trim()) return say("ban needs a reason", "error");

      setBusy(item.id);
      try {
        const res = await fetch(`/api/admin/users/${item.submitter.id}/ban`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "ban", reason: reason.trim() }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || data.error || "failed");
        say(`${item.submitter.label} banned // sessions revoked`);
      } catch (e) {
        say(e instanceof Error ? e.message : "ban failed", "error");
      } finally {
        setBusy(null);
      }
    },
    [say],
  );

  if (queue.length === 0) {
    return (
      <div className="border border-line/50 p-8 text-center">
        <p className="hud-label mb-1 text-cp-yellow">/// QUEUE CLEAR</p>
        <p className="font-mono text-sm text-dim">no pending submissions.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {queue.map((item) => {
        const system = getSystem(item.systemId);
        const isBusy = busy === item.id;
        const reason = reasons[item.id] ?? "";
        return (
          <article key={item.id} className="notch-tr border bg-surface p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <p className="hud-label mb-1">
                  /// {system?.name.toUpperCase() ?? item.systemId.toUpperCase()}
                  <span className="ml-3 text-dim">{item.licenseClass.replace("_", " ")}</span>
                </p>
                <h3 className="font-mono text-lg text-text">{item.title}</h3>
              </div>
              <p className="hud-data">
                {(item.sizeBytes / 1024 / 1024).toFixed(2)} MB
                {item.year ? ` // ${item.year}` : ""} //{" "}
                {item.submitter ? item.submitter.label : "seed"}
              </p>
            </div>

            <p className="mt-1 break-all font-mono text-xs text-dim">
              {item.romFileName} · sha {item.romSha256.slice(0, 16)}…
            </p>

            {item.description && (
              <p className="prose-legal mt-3 max-w-2xl text-sm text-dim">
                {item.description}
              </p>
            )}
            {item.licenseNote && (
              <p className="mt-2 font-mono text-xs text-cp-cyan">
                attestation: {item.licenseNote}
              </p>
            )}

            {/* in-browser preview-play (authed rom route) */}
            {preview === item.id && system && (
              <div className="mt-4">
                <PlayerFrame
                  systemId={item.systemId}
                  title={item.title}
                  slug={item.slug}
                  romSha256={item.romSha256}
                  rom={{
                    kind: "url",
                    url: `/api/admin/rom/${item.id}`,
                    fileName: item.romFileName,
                  }}
                />
              </div>
            )}

            {/* reason field — required for reject / takedown */}
            <input
              type="text"
              value={reason}
              onChange={(e) =>
                setReasons((r) => ({ ...r, [item.id]: e.target.value }))
              }
              placeholder="reason (required for reject / takedown)"
              maxLength={500}
              className="rk8-input mt-4 w-full"
            />

            {/* actions */}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="rk8-btn-ghost"
                disabled={isBusy}
                onClick={() => setPreview((p) => (p === item.id ? null : item.id))}
              >
                {preview === item.id ? "close preview" : "preview"}
              </button>
              <button
                type="button"
                className="rk8-btn-primary"
                disabled={isBusy}
                onClick={() => moderate(item, "approve")}
              >
                approve
              </button>
              <button
                type="button"
                className="rk8-btn-ghost"
                disabled={isBusy}
                onClick={() => moderate(item, "reject")}
              >
                reject
              </button>
              <button
                type="button"
                className="rk8-btn-ghost rk8-btn-danger"
                disabled={isBusy}
                onClick={() => moderate(item, "takedown")}
              >
                takedown
              </button>
              {canBan && item.submitter && (
                <button
                  type="button"
                  className="rk8-btn-ghost rk8-btn-danger ml-auto"
                  disabled={isBusy}
                  onClick={() => ban(item)}
                >
                  ban uploader
                </button>
              )}
            </div>
          </article>
        );
      })}

      {toast && (
        <p
          role={toast.tone === "error" ? "alert" : "status"}
          aria-live={toast.tone === "error" ? "assertive" : "polite"}
          className={`fixed bottom-4 left-1/2 z-50 max-w-[calc(100vw-2rem)] -translate-x-1/2 border bg-bg px-4 py-2 text-center font-mono text-xs ${
            toast.tone === "error"
              ? "border-cp-red text-cp-red"
              : "border-cp-yellow text-cp-yellow"
          }`}
        >
          {toast.text}
        </p>
      )}
    </div>
  );
}
