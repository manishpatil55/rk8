import Link from "next/link";
import { GameCard } from "@/components/games/GameCard";
import { SYSTEM_COUNT } from "@/config/systems.config";
import {
  getApprovedCount,
  getGamesByManufacturer,
  getMostPlayed,
  getRecentlyInserted,
  getStaffPicks,
  type Game,
} from "@/lib/games";

/** library content only changes on moderation events — ISR keeps this page CDN-cacheable */
export const revalidate = 300;

export default async function HomePage() {
  const [picks, recent, popular, gameCount, manufacturerRails] =
    await Promise.all([
      getStaffPicks(),
      getRecentlyInserted(),
      getMostPlayed(),
      getApprovedCount(),
      getGamesByManufacturer(),
    ]);

  return (
    <div className="mx-auto max-w-6xl px-4 md:px-6">
      {/* hero — the one-time 600ms glitch, then permanent stillness */}
      <section className="flex flex-col items-start gap-6 border-b py-16 md:py-24">
        <p className="hud-label">/// ROMKERNEL-8 — BROWSER-NATIVE RETRO ARCADE</p>
        <h1 className="rk8-hero-glitch font-mono text-5xl font-bold tracking-tight text-text sm:text-7xl md:text-8xl">
          RK8<span className="text-cp-yellow">://</span>
          <span className="rk8-cursor" aria-hidden />
        </h1>
        <p className="max-w-xl font-mono text-base text-dim">
          every cartridge ever mounted. {SYSTEM_COUNT} systems, zero installs,
          zero ads. insert coin — no coin required.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/library" className="rk8-btn-primary">
            <span aria-hidden>▶</span> ENTER LIBRARY
          </Link>
          <Link href="/local" className="rk8-btn-ghost">
            mount local rom
          </Link>
        </div>
        <p className="hud-data">
          {gameCount} GAMES INDEXED <span className="text-dim">//</span>{" "}
          {SYSTEM_COUNT} SYSTEMS ONLINE
        </p>
      </section>

      {/* three ways to play */}
      <section aria-label="ways to play" className="grid gap-px border-b py-10 sm:grid-cols-3 sm:gap-4">
        <WayCard
          href="/library"
          k="01"
          title="library play"
          body="browse the matrix. click. playing in three seconds. homebrew, public-domain and open-licensed games, documented per title."
        />
        <WayCard
          href="/local"
          k="02"
          title="local play"
          body="drag any rom from your device. it loads entirely in your browser — your file never leaves your device. nothing uploaded, nothing logged."
        />
        <WayCard
          href="/contribute"
          k="03"
          title="contribute"
          body="share homebrew and open-licensed games with the community. everything passes moderation before going public."
        />
      </section>

      <Rail label="STAFF PICKS" games={picks} empty="no picks transmitted yet" />
      <Rail
        label="RECENTLY INSERTED"
        games={recent}
        empty="library is warming up — run `npm run seed` to mount the starter cartridges"
      />
      <Rail label="MOST PLAYED" games={popular} empty="no play data yet" />

      {/* per-manufacturer rails — only manufacturers with mounted cartridges show */}
      {manufacturerRails.map((rail) => (
        <Rail
          key={rail.id}
          label={rail.label}
          games={rail.games}
          href={`/library?manufacturer=${rail.id}`}
        />
      ))}
    </div>
  );
}

function WayCard({
  href,
  k,
  title,
  body,
}: {
  href: string;
  k: string;
  title: string;
  body: string;
}) {
  return (
    <Link
      href={href}
      className="rk8-card notch-tr flex flex-col gap-3 p-5 focus-visible:outline-none"
    >
      <span className="hud-data">{k}</span>
      <span className="cmd-link text-text">&gt; {title}</span>
      <span className="font-mono text-[13px] leading-relaxed text-dim">{body}</span>
    </Link>
  );
}

function Rail({
  label,
  games,
  empty,
  href = "/library",
}: {
  label: string;
  games: Game[];
  empty?: string;
  href?: string;
}) {
  return (
    <section aria-label={label.toLowerCase()} className="border-b py-10">
      <div className="mb-5 flex items-baseline justify-between">
        <h2 className="hud-label text-text">/// {label}</h2>
        <Link href={href} className="cmd-link text-dim hover:text-text">
          &gt; all
        </Link>
      </div>
      {games.length === 0 ? (
        <p className="border border-dashed border-line p-6 font-mono text-sm text-dim">
          {empty}
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {games.map((g) => (
            <GameCard key={g.id} game={g} />
          ))}
        </div>
      )}
    </section>
  );
}
