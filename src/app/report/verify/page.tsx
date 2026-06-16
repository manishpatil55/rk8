import type { Metadata } from "next";
import Link from "next/link";
import { verifyReport } from "@/lib/reports";

export const metadata: Metadata = { title: "confirm notice // rk8" };
export const dynamic = "force-dynamic";

/**
 * DMCA email-verification landing. The reporter clicks the link from their
 * inbox; only here is the 72h auto-takedown clock armed. This round-trip is the
 * gate that stops an anonymous, unverified notice from arming the clock.
 */
export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; token?: string }>;
}) {
  const { id, token } = await searchParams;

  let state: "ok" | "already" | "error" = "error";
  if (id && token) {
    try {
      const res = await verifyReport(id, token);
      state = res.alreadyVerified ? "already" : "ok";
    } catch {
      state = "error";
    }
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col items-start gap-4 px-4 py-24 md:px-6">
      {state === "error" ? (
        <>
          <p className="hud-label text-cp-red">/// INVALID LINK</p>
          <h1 className="font-mono text-2xl text-text">
            this confirmation link is invalid or expired
          </h1>
          <p className="prose-legal max-w-xl text-dim">
            The link may have been mistyped or already used. If you still wish to
            file a takedown notice, please submit it again from the game page, or
            contact our designated agent on the{" "}
            <Link href="/dmca" className="text-cp-cyan hover:text-text">
              DMCA page
            </Link>
            .
          </p>
        </>
      ) : (
        <>
          <p className="hud-label text-cp-yellow">/// NOTICE CONFIRMED</p>
          <h1 className="font-mono text-2xl text-text">
            {state === "already"
              ? "this notice was already confirmed"
              : "your takedown notice is confirmed"}
          </h1>
          <p className="prose-legal max-w-xl text-dim">
            Thank you. A moderator has been alerted and will review the notice. If
            it is not actioned sooner, the listing is removed automatically within
            72 hours of confirmation. See our full{" "}
            <Link href="/dmca" className="text-cp-cyan hover:text-text">
              takedown policy
            </Link>
            .
          </p>
        </>
      )}
    </div>
  );
}
