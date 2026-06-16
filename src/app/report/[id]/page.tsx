import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getGameById } from "@/lib/games";
import { getSystem } from "@/config/systems.config";
import { ReportForm } from "@/components/reports/ReportForm";

export const metadata: Metadata = { title: "report // rk8" };
export const dynamic = "force-dynamic";

export default async function ReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const game = await getGameById(id);
  if (!game) notFound();

  // already gone — no ticket to file
  if (game.status === "takedown") {
    return (
      <div className="mx-auto flex max-w-2xl flex-col items-start gap-4 px-4 py-24 md:px-6">
        <p className="hud-label text-cp-red">/// ALREADY EJECTED</p>
        <h1 className="font-mono text-2xl text-text">this cartridge is already down</h1>
        <p className="font-mono text-sm text-dim">
          it was removed at a rights-holder&rsquo;s request.{" "}
          <Link href="/dmca" className="text-cp-cyan hover:text-text">
            takedown policy
          </Link>
        </p>
      </div>
    );
  }

  const system = getSystem(game.systemId);

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 md:px-6">
      <p className="hud-label text-cp-red">/// REPORT</p>
      <h1 className="mb-1 mt-1 font-mono text-3xl font-bold text-text">
        report a problem
      </h1>
      <p className="mb-8 font-mono text-sm text-dim">
        re:{" "}
        <span className="text-text">{game.title}</span>{" "}
        <span className="text-dim">
          // {system?.shortName ?? game.systemId}
        </span>
      </p>

      <p className="prose-legal mb-8 max-w-xl text-dim">
        Use this form to flag a problem or to file a formal copyright takedown
        notice. Copyright owners and their agents: select{" "}
        <span className="text-text">DMCA notice</span> below — you do not need an
        account. For the full policy and the designated agent&rsquo;s details,
        see the{" "}
        <Link href="/dmca" className="text-cp-cyan hover:text-text">
          DMCA page
        </Link>
        .
      </p>

      <ReportForm gameId={game.id} gameTitle={game.title} />
    </div>
  );
}
