import { Suspense } from "react";
import { LibraryBrowser } from "@/components/library/LibraryBrowser";
import { LibrarySkeleton } from "@/components/library/LibrarySkeleton";
import { listApprovedGames } from "@/lib/games";

/** library changes only on moderation events — ISR keeps it CDN-cacheable */
export const revalidate = 300;

export const metadata = {
  title: "Library // RK8://",
  description:
    "Browse the full RK8 system matrix — homebrew, public-domain and open-licensed games across every classic console, handheld, arcade board, computer, DOS and Flash.",
};

export default async function LibraryPage() {
  const games = await listApprovedGames();
  const items = games.map((g) => ({
    id: g.id,
    slug: g.slug,
    title: g.title,
    altTitles: g.altTitles,
    systemId: g.systemId,
    year: g.year,
    players: g.players,
    region: g.region,
    genre: g.genre,
    coverPath: g.coverPath,
    playCount: g.playCount,
  }));

  return (
    <Suspense fallback={<LibrarySkeleton />}>
      <LibraryBrowser games={items} />
    </Suspense>
  );
}
