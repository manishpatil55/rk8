"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { getSystem } from "@/config/systems.config";

export interface ReportItem {
  id: string;
  type: "dmca" | "broken" | "wrong_info" | "other";
  body: string;
  reporterEmail: string | null;
  createdAt: number;
  dmcaDeadlineAt: number | null;
  game: {
    id: string;
    title: string;
    slug: string;
    systemId: string;
    status: string;
  } | null;
}

type Toast = { text: string; tone: "info" | "error" } | null;

const TYPE_LABEL: Record<ReportItem["type"], string> = {
  dmca: "DMCA",
  broken: "BROKEN",
  wrong_info: "WRONG INFO",
  other: "OTHER",
};

/** time remaining on a dmca auto-takedown deadline, or "EXPIRED" / null */
function deadlineLabel(deadline: number | null, nowMs: number): string | null {
  if (!deadline) return null;
  const ms = deadline - nowMs;
  if (ms <= 0) return "EXPIRED — DUE FOR AUTO-TAKEDOWN";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return `AUTO-TAKEDOWN IN ${h}h ${m}m`;
}

/**
 * Open report tickets. DMCA tickets carry a 72h countdown; `action` takes the
 * game down (and resolves sibling tickets), `dismiss` closes the ticket alone.
 * Resolved tickets leave the list optimistically.
 */
export function ReportsQueue({
  items,
  nowMs,
}: {
  items: ReportItem[];
  nowMs: number;
}) {
  const [queue, setQueue] = useState(items);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast>(null);

  const say = useCallback((text: string, tone: "info" | "error" = "info") => {
    setToast({ text, tone });
    window.setTimeout(() => setToast(null), 3200);
  }, []);

  const resolve = useCallback(
    async (item: ReportItem, action: "action" | "dismiss") => {
      if (
        action === "action" &&
        !confirm(
          `Take down "${item.game?.title ?? "this game"}"? This deletes the file and is permanent.`,
        )
      )
        return;

      setBusy(item.id);
      try {
        const res = await fetch("/api/admin/reports", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reportId: item.id, action }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || data.error || "failed");
        setQueue((q) => q.filter((r) => r.id !== item.id));
        say(action === "action" ? "game taken down" : "report dismissed");
      } catch (e) {
        say(e instanceof Error ? e.message : "action failed", "error");
      } finally {
        setBusy(null);
      }
    },
    [say],
  );

  if (queue.length === 0) {
    return (
      <div className="border border-line/50 p-8 text-center">
        <p className="hud-label mb-1 text-cp-yellow">/// NO OPEN REPORTS</p>
        <p className="font-mono text-sm text-dim">the inbox is clear.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {queue.map((item) => {
        const isBusy = busy === item.id;
        const isDmca = item.type === "dmca";
        const system = item.game ? getSystem(item.game.systemId) : undefined;
        const dl = isDmca ? deadlineLabel(item.dmcaDeadlineAt, nowMs) : null;
        const expired = !!item.dmcaDeadlineAt && item.dmcaDeadlineAt <= nowMs;
        return (
          <article
            key={item.id}
            className={`notch-tr border bg-surface p-4 ${
              isDmca ? "border-cp-red/50" : ""
            }`}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <p className="hud-label mb-1">
                  <span className={isDmca ? "text-cp-red" : "text-cp-cyan"}>
                    {TYPE_LABEL[item.type]}
                  </span>
                  {system && (
                    <span className="ml-3 text-dim">
                      {system.name.toUpperCase()}
                    </span>
                  )}
                </p>
                <h3 className="font-mono text-lg text-text">
                  {item.game ? (
                    <Link
                      href={`/play/${item.game.systemId}/${item.game.slug}`}
                      className="hover:text-cp-cyan"
                    >
                      {item.game.title}
                    </Link>
                  ) : (
                    <span className="text-dim">[game deleted]</span>
                  )}
                </h3>
              </div>
              <p className="hud-data">
                {new Date(item.createdAt).toISOString().slice(0, 10)}
                {item.game && item.game.status !== "approved"
                  ? ` // ${item.game.status.toUpperCase()}`
                  : ""}
              </p>
            </div>

            {dl && (
              <p
                className={`mt-2 hud-label ${
                  expired ? "text-cp-red" : "text-cp-yellow"
                }`}
              >
                /// {dl}
              </p>
            )}

            <p className="prose-legal mt-3 max-w-2xl whitespace-pre-wrap text-sm text-dim">
              {item.body}
            </p>

            {item.reporterEmail && (
              <p className="mt-2 font-mono text-xs text-cp-cyan">
                contact: {item.reporterEmail}
              </p>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="rk8-btn-ghost rk8-btn-danger"
                disabled={isBusy || !item.game}
                onClick={() => resolve(item, "action")}
              >
                takedown game
              </button>
              <button
                type="button"
                className="rk8-btn-ghost"
                disabled={isBusy}
                onClick={() => resolve(item, "dismiss")}
              >
                dismiss
              </button>
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
