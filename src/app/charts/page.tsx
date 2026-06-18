import type { Metadata } from "next";
import Link from "next/link";
import { getSystem } from "@/config/systems.config";
import { getMostPlayed } from "@/lib/games";

// play counts drift continuously; a minute of staleness keeps this CDN-cacheable
export const revalidate = 60;

export const metadata: Metadata = {
  title: "charts",
  description: "The most-played cartridges on RK8 — the community leaderboard.",
};

/** compact play-count: 1240 -> "1.2k", 18400 -> "18k" (matches GameCard) */
function formatPlays(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1)}k`;
  return String(n);
}

export default async function ChartsPage() {
  const games = await getMostPlayed(50);
  const anyPlays = games.some((g) => g.playCount > 0);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 md:px-6">
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <p className="hud-label text-cp-yellow">/// LEADERBOARD</p>
        <Link href="/library" className="cmd-link shrink-0 text-dim hover:text-text">
          &gt; browse all
        </Link>
      </div>
      <h1 className="font-mono text-2xl font-bold text-text md:text-3xl">most played</h1>
      <p className="mt-2 max-w-xl font-mono text-sm text-dim">
        the cartridges the community reaches for most — anonymous play counts, ranked.
      </p>

      {games.length === 0 ? (
        <p className="mt-8 border border-dashed border-line p-6 font-mono text-sm text-dim">
          no cartridges mounted yet — run `npm run seed` to load the starter library.
        </p>
      ) : (
        <ol className="mt-8 flex flex-col border">
          {games.map((g, i) => {
            const system = getSystem(g.systemId);
            const rank = i + 1;
            return (
              <li
                key={g.id}
                className="flex items-center gap-3 border-b border-line/50 px-3 py-3 last:border-b-0 sm:gap-4 sm:px-4"
              >
                <span
                  className={`w-7 shrink-0 text-right font-mono text-sm tabular-nums ${
                    rank <= 3 ? "text-cp-yellow" : "text-dim"
                  }`}
                >
                  {rank}
                </span>
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/play/${g.systemId}/${g.slug}`}
                    className="block truncate font-mono text-sm text-text hover:text-cp-yellow"
                  >
                    {g.title}
                  </Link>
                  <span className="hud-label">
                    {system?.shortName ?? g.systemId}
                    {g.year ? ` // ${g.year}` : ""}
                  </span>
                </div>
                <span className="hud-data shrink-0" title={`${g.playCount} plays`}>
                  {g.playCount > 0 ? (
                    <span className="text-cp-cyan">
                      <span aria-hidden>▸</span> {formatPlays(g.playCount)}
                    </span>
                  ) : (
                    <span className="text-dim">—</span>
                  )}
                </span>
              </li>
            );
          })}
        </ol>
      )}

      {games.length > 0 && !anyPlays && (
        <p className="mt-4 hud-label text-dim">
          no plays recorded yet — be the first to insert a coin.
        </p>
      )}
    </div>
  );
}
