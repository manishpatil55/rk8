import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth/guards";
import { PENDING_CAP, countPending } from "@/lib/contribute";
import { ContributeForm } from "@/components/contribute/ContributeForm";

export const metadata: Metadata = { title: "Contribute" };
export const dynamic = "force-dynamic";

export default async function ContributePage() {
  const user = await requireUser("/contribute");
  const pending = await countPending(user.id);
  const slotsLeft = Math.max(0, PENDING_CAP - pending);

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 md:px-6">
      <p className="hud-label">/// CONTRIBUTE</p>
      <h1 className="mb-3 mt-1 font-mono text-3xl font-bold text-text">
        share a cartridge
      </h1>
      <p className="mb-8 max-w-xl font-mono text-sm leading-relaxed text-dim">
        add homebrew, public-domain, or openly-licensed games to the community
        library. every submission enters a moderation queue and stays private
        until a moderator approves it. commercial ROMs are removed on sight and
        repeat infringers are banned — see the{" "}
        <Link href="/legal" className="text-cp-cyan hover:text-text">
          submission policy
        </Link>
        .
      </p>
      <ContributeForm slotsLeft={slotsLeft} />
    </div>
  );
}
