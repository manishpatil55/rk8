import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/guards";
import {
  listPendingGames,
  moderationStats,
  recentAuditLog,
} from "@/lib/moderation";
import { ModerationQueue, type QueueItem } from "@/components/admin/ModerationQueue";

export const metadata: Metadata = { title: "moderation // rk8" };
// always live — never cache the queue or audit tail
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await requireRole(["mod", "admin"], "/admin");
  const [pending, audit, stats] = await Promise.all([
    listPendingGames(),
    recentAuditLog(),
    moderationStats(),
  ]);

  const items: QueueItem[] = pending.map((r) => ({
    id: r.game.id,
    slug: r.game.slug,
    title: r.game.title,
    systemId: r.game.systemId,
    romSha256: r.game.romSha256,
    romFileName: r.game.romPath.slice(r.game.romPath.lastIndexOf("/") + 1),
    coverPath: r.game.coverPath,
    sizeBytes: r.game.sizeBytes,
    licenseClass: r.game.licenseClass,
    licenseNote: r.game.licenseNote,
    description: r.game.description,
    year: r.game.year,
    createdAt: r.game.createdAt.getTime(),
    submitter: r.submitterId
      ? { id: r.submitterId, label: r.submitterName || r.submitterEmail || r.submitterId }
      : null,
  }));

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:px-6">
      <div className="mb-6 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="hud-label mb-1 text-cp-cyan">/// MODERATION</p>
          <h1 className="font-mono text-2xl font-bold text-text md:text-3xl">
            review queue
          </h1>
        </div>
        <p className="hud-data">
          {stats.pending} PENDING <span className="text-dim">//</span>{" "}
          {stats.openReports} OPEN REPORTS <span className="text-dim">//</span>{" "}
          {user.role.toUpperCase()}
        </p>
      </div>

      <ModerationQueue items={items} canBan={user.role === "admin"} />

      <section className="mt-12 border-t pt-8">
        <h2 className="hud-label mb-4 text-text">/// AUDIT TRAIL — LAST {audit.length}</h2>
        <div className="flex flex-col gap-px border">
          {audit.length === 0 ? (
            <p className="p-4 font-mono text-sm text-dim">no actions logged yet.</p>
          ) : (
            audit.map((a) => {
              const meta = safeMeta(a.log.metaJson);
              return (
                <div
                  key={a.log.id}
                  className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-line/50 px-3 py-2 font-mono text-xs last:border-b-0"
                >
                  <span className="text-dim">
                    {new Date(a.log.createdAt).toISOString().replace("T", " ").slice(0, 19)}
                  </span>
                  <span className={actionColor(a.log.action)}>
                    {a.log.action.toUpperCase()}
                  </span>
                  <span className="text-text">{a.log.target}</span>
                  <span className="text-dim">
                    by {a.actorName || a.actorEmail || a.log.actorId || "system"}
                  </span>
                  {meta.reason && (
                    <span className="text-dim">— “{meta.reason}”</span>
                  )}
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}

function actionColor(action: string): string {
  if (action === "approve" || action === "restore") return "text-cp-yellow";
  if (action === "reject" || action === "takedown" || action === "ban")
    return "text-cp-red";
  return "text-cp-cyan";
}

function safeMeta(json: string): { reason?: string } {
  try {
    const o = JSON.parse(json);
    return typeof o === "object" && o ? o : {};
  } catch {
    return {};
  }
}
