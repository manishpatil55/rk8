"use client";

import { useCallback, useState } from "react";
import { getSystem } from "@/config/systems.config";

export interface RestorableItem {
  id: string;
  title: string;
  systemId: string;
  takedownReason: string | null;
  takedownAt: number | null;
}

/**
 * Reversible auto-suspensions: games taken down (mostly by the 72h DMCA sweep)
 * whose bytes were retained. A moderator can restore one if the notice turns
 * out to be wrong — the counterweight to anonymous, automated takedowns.
 */
export function RestorableGames({ items }: { items: RestorableItem[] }) {
  const [queue, setQueue] = useState(items);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<{ text: string; tone: "info" | "error" } | null>(null);

  const say = useCallback((text: string, tone: "info" | "error" = "info") => {
    setToast({ text, tone });
    window.setTimeout(() => setToast(null), 3200);
  }, []);

  const restore = useCallback(
    async (item: RestorableItem) => {
      if (!confirm(`Restore "${item.title}"? It becomes publicly playable again.`))
        return;
      setBusy(item.id);
      try {
        const res = await fetch("/api/admin/moderate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ gameId: item.id, action: "restore" }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || data.error || "failed");
        setQueue((q) => q.filter((g) => g.id !== item.id));
        say(`${item.title} restored`);
      } catch (e) {
        say(e instanceof Error ? e.message : "restore failed", "error");
      } finally {
        setBusy(null);
      }
    },
    [say],
  );

  if (queue.length === 0) {
    return (
      <p className="border border-line/50 p-4 font-mono text-sm text-dim">
        no restorable takedowns.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-px border">
      {queue.map((item) => {
        const system = getSystem(item.systemId);
        return (
          <div
            key={item.id}
            className="flex flex-wrap items-center justify-between gap-2 border-b border-line/50 px-3 py-2 last:border-b-0"
          >
            <div className="min-w-0">
              <p className="hud-label">
                {system?.name.toUpperCase() ?? item.systemId.toUpperCase()}
                {item.takedownAt && (
                  <span className="ml-3 text-dim">
                    {new Date(item.takedownAt).toISOString().slice(0, 10)}
                  </span>
                )}
              </p>
              <p className="truncate font-mono text-sm text-text">{item.title}</p>
              {item.takedownReason && (
                <p className="truncate font-mono text-xs text-dim">
                  {item.takedownReason}
                </p>
              )}
            </div>
            <button
              type="button"
              className="rk8-btn-ghost"
              disabled={busy === item.id}
              onClick={() => restore(item)}
            >
              restore
            </button>
          </div>
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
