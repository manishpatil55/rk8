import Link from "next/link";
import { getSystem } from "@/config/systems.config";
import { CoverImage } from "@/components/games/CoverImage";

interface GameCardData {
  id: string;
  slug: string;
  title: string;
  systemId: string;
  coverPath: string | null;
  year: number | null;
  playCount: number;
}

/**
 * Library cartridge card. Hover = the §5 "power on" micro-glitch (CSS-driven
 * via .rk8-card). Covers are optional — absent ones get the styled placeholder.
 */
export function GameCard({ game }: { game: GameCardData }) {
  const system = getSystem(game.systemId);
  return (
    <Link
      href={`/play/${game.systemId}/${game.slug}`}
      className="rk8-card notch-tr group block focus-visible:outline-none"
    >
      <div className="rk8-card-img relative aspect-[4/3] overflow-hidden border-b bg-surface-2">
        {game.coverPath ? (
          <CoverImage src={`/api/cover/${game.id}`} />
        ) : (
          <CoverPlaceholder title={game.title} sys={system?.shortName ?? "?"} />
        )}
        {/* system tag — always-on HUD readout */}
        <span className="hud-label absolute left-2 top-2 bg-bg/75 px-1.5 py-0.5 text-cp-cyan backdrop-blur-sm">
          {system?.shortName ?? game.systemId}
        </span>
        {/* play affordance — powers on with the card */}
        <div className="absolute inset-0 flex items-center justify-center bg-bg/55 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100">
          <span className="inline-flex items-center gap-2 border border-cp-yellow px-3 py-1.5 font-mono text-xs uppercase tracking-widest text-cp-yellow">
            <span aria-hidden>▶</span> play
          </span>
        </div>
      </div>
      <div className="flex flex-col gap-1.5 p-3">
        <span className="truncate font-mono text-sm text-text group-hover:text-cp-yellow">
          {game.title}
        </span>
        {/* data line — year on the rail, play-count as the social readout.
            system already lives in the cover tag, so it isn't repeated here. */}
        <span className="flex items-center justify-between gap-2">
          <span className="hud-label">{game.year ?? "—"}</span>
          {game.playCount > 0 && (
            <span className="hud-data" title={`${game.playCount} plays`}>
              <span aria-hidden>▸</span> {formatPlays(game.playCount)} plays
            </span>
          )}
        </span>
      </div>
    </Link>
  );
}

/** compact play-count: 1240 -> "1.2k", 18400 -> "18k". */
function formatPlays(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1)}k`;
  return String(n);
}

function CoverPlaceholder({ title, sys }: { title: string; sys: string }) {
  return (
    <div className="flex h-full w-full flex-col items-start justify-between p-3">
      <span className="hud-label">NO COVER DATA</span>
      <span className="line-clamp-3 font-mono text-base leading-snug text-dim">
        {title}
      </span>
      <span className="hud-data">{sys}</span>
    </div>
  );
}
