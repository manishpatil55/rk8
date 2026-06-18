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

  const boot: { text: string; status: string; tone: string }[] = [
    { text: "initializing romkernel-8", status: "OK", tone: "text-cp-cyan" },
    { text: `mounting ${SYSTEM_COUNT} systems`, status: "OK", tone: "text-cp-cyan" },
    {
      text: "emulation cores // ejs · ruffle · js-dos",
      status: "READY",
      tone: "text-cp-yellow",
    },
    { text: `indexed cartridges // ${gameCount}`, status: "OK", tone: "text-cp-cyan" },
    { text: "anonymous session // no-track", status: "LIVE", tone: "text-cp-yellow" },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 md:px-6">
      {/* hero — a terminal that boots: status log reveals line-by-line, then
          the glitch wordmark. One-time motion, reduced-motion-safe. */}
      <section className="py-8 md:py-14">
        <div className="notch-tr relative overflow-hidden border border-line bg-surface/50 backdrop-blur-sm">
          {/* title bar */}
          <div className="flex items-center justify-between border-b border-line bg-surface/80 px-4 py-2">
            <span className="hud-label text-dim">rk8://romkernel-8 — boot.seq</span>
            <span className="hud-data flex items-center gap-2">
              <span className="text-cp-cyan" aria-hidden>
                ●
              </span>
              ONLINE
            </span>
          </div>

          {/* boot log */}
          <div className="space-y-2 px-4 pt-6 font-mono text-[13px] sm:px-8">
            {boot.map((l, i) => (
              <p
                key={l.text}
                className="rk8-boot-line flex items-center gap-2 sm:gap-3"
                style={{ animationDelay: `${100 + i * 130}ms` }}
              >
                <span className="text-cp-yellow" aria-hidden>
                  &gt;
                </span>
                <span className="flex-1 truncate text-dim">{l.text}</span>
                <span className={`shrink-0 ${l.tone}`}>[ {l.status} ]</span>
              </p>
            ))}
          </div>

          {/* wordmark + CTA */}
          <div className="px-4 pb-9 pt-7 sm:px-8">
            <p className="hud-label mb-3">/// browser-native retro arcade</p>
            <h1 className="rk8-hero-glitch font-mono text-5xl font-bold tracking-tight text-text sm:text-7xl md:text-8xl">
              RK8<span className="text-cp-yellow">://</span>
              <span className="rk8-cursor" aria-hidden />
            </h1>
            <p className="mt-5 max-w-xl font-mono text-base text-dim">
              every cartridge ever mounted. {SYSTEM_COUNT} systems, zero installs,
              zero ads. insert coin — no coin required.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/library" className="rk8-btn-primary">
                <span aria-hidden>▶</span> ENTER LIBRARY
              </Link>
              <Link href="/local" className="rk8-btn-ghost">
                mount local rom
              </Link>
            </div>
          </div>
        </div>
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
      <Rail label="MOST PLAYED" games={popular} empty="no play data yet" href="/charts" />

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
      <div className="mb-5 flex items-center justify-between gap-4">
        <h2 className="hud-label flex items-center gap-2 text-text">
          <span aria-hidden className="text-cp-yellow">
            ▌
          </span>
          {label}
        </h2>
        <span className="h-px flex-1 bg-line" aria-hidden />
        <Link href={href} className="cmd-link shrink-0 text-dim hover:text-text">
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
