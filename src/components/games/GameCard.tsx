import Link from "next/link";
import { getSystem } from "@/config/systems.config";

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
          // covers are operator/community files of unknown dimensions; plain img is correct here
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/cover/${game.id}`}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <CoverPlaceholder title={game.title} sys={system?.shortName ?? "?"} />
        )}
      </div>
      <div className="flex flex-col gap-1.5 p-3">
        <span className="truncate font-mono text-sm text-text group-hover:text-cp-yellow">
          {game.title}
        </span>
        <span className="hud-label flex items-center justify-between">
          <span>
            SYS <span aria-hidden>//</span> {system?.shortName ?? game.systemId}
          </span>
          {game.year && <span>{game.year}</span>}
        </span>
      </div>
    </Link>
  );
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
