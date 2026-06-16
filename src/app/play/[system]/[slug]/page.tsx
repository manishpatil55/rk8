import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GameCard } from "@/components/games/GameCard";
import { PlayerFrame } from "@/components/player/PlayerFrame";
import { getSystem } from "@/config/systems.config";
import { getGameBySlug, getRelatedGames } from "@/lib/games";

export const revalidate = 300;

interface Params {
  system: string;
  slug: string;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { system, slug } = await params;
  const game = await getGameBySlug(system, slug);
  if (!game) return { title: "cartridge not found" };
  return { title: game.title };
}

export default async function PlayPage({ params }: { params: Promise<Params> }) {
  const { system: systemId, slug } = await params;
  const system = getSystem(systemId);
  const game = await getGameBySlug(systemId, slug);
  if (!system || !game) notFound();

  /* takedown tombstone — §5 voice, permanent */
  if (game.status === "takedown") {
    return (
      <div className="mx-auto flex max-w-2xl flex-col items-start gap-4 px-4 py-24 md:px-6">
        <p className="hud-label text-cp-red">/// EJECTED</p>
        <h1 className="font-mono text-2xl text-text">
          THIS CARTRIDGE WAS EJECTED
        </h1>
        <p className="font-mono text-sm text-dim">
          removed at rights-holder request.{" "}
          <Link href="/dmca" className="text-cp-cyan hover:text-text">
            takedown policy
          </Link>
        </p>
      </div>
    );
  }

  if (game.status !== "approved") notFound();

  const related = await getRelatedGames(game);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:px-6">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="hud-label mb-1">
            /// {system.name.toUpperCase()}
            {system.experimental && (
              <span className="ml-3 text-cp-red">EXPERIMENTAL</span>
            )}
            {system.heavy && (
              <span className="ml-3">HEAVY — DESKTOP RECOMMENDED</span>
            )}
          </p>
          <h1 className="font-mono text-2xl font-bold text-text md:text-3xl">
            {game.title}
          </h1>
        </div>
        <p className="hud-data">
          {game.playCount} PLAYS <span className="text-dim">//</span>{" "}
          {game.licenseClass.replace("_", " ").toUpperCase()}
        </p>
      </div>

      <PlayerFrame
        systemId={system.id}
        title={game.title}
        slug={game.slug}
        rom={{
          kind: "url",
          url: `/api/rom/${game.id}`,
          fileName: game.romPath.slice(game.romPath.lastIndexOf("/") + 1),
        }}
        romSha256={game.romSha256}
        gameId={game.id}
      />

      {/* metadata strip */}
      <section className="mt-8 grid gap-px border sm:grid-cols-2 lg:grid-cols-4">
        <Meta k="YEAR" v={game.year?.toString()} />
        <Meta k="PUBLISHER" v={game.publisher} />
        <Meta k="GENRE" v={game.genre} />
        <Meta k="PLAYERS" v={game.players?.toString()} />
        <Meta k="REGION" v={game.region} />
        <Meta k="SIZE" v={`${(game.sizeBytes / 1024 / 1024).toFixed(2)} MB`} />
        <Meta k="SHA-256" v={game.romSha256.slice(0, 16) + "…"} />
        <Meta k="SOURCE" v={game.licenseNote ?? undefined} />
      </section>

      {game.description && (
        <p className="prose-legal mt-6 max-w-2xl text-dim">{game.description}</p>
      )}

      <div className="mt-6">
        <Link
          href={`/report/${game.id}`}
          className="cmd-link text-dim hover:text-cp-red"
        >
          &gt; report / takedown
        </Link>
      </div>

      {related.length > 0 && (
        <section className="mt-12 border-t pt-8">
          <h2 className="hud-label mb-5 text-text">/// MORE ON THIS SYSTEM</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {related.map((g) => (
              <GameCard key={g.id} game={g} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Meta({ k, v }: { k: string; v: string | undefined | null }) {
  if (!v) return null;
  return (
    <div className="flex flex-col gap-1 border border-line/50 p-3">
      <span className="hud-label">{k}</span>
      <span className="break-all font-mono text-sm text-text">{v}</span>
    </div>
  );
}
