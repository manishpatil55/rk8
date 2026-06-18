"use client";

import { useEffect } from "react";
import Link from "next/link";

/**
 * Route-segment error boundary. Catches a throw in any page/component below the
 * root layout (the layout + chrome stay mounted). `reset()` re-renders the
 * segment. A real logger swaps in where we console.error today.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-2xl flex-col items-start gap-4 px-4 py-24 md:px-6">
      <p className="hud-label text-cp-red">/// SYSTEM FAULT — 500</p>
      <h1 className="font-mono text-3xl font-bold text-text">
        the machine hit a fault
      </h1>
      <p className="font-mono text-sm text-dim">
        something crashed mid-process. retry the operation, or head back to the
        library.
      </p>
      {error.digest && (
        <p className="hud-label text-dim">trace // {error.digest}</p>
      )}
      <div className="mt-2 flex flex-wrap gap-3">
        <button type="button" onClick={reset} className="rk8-btn-primary">
          retry
        </button>
        <Link href="/" className="rk8-btn-ghost">
          back to library
        </Link>
      </div>
    </div>
  );
}
