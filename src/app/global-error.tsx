"use client";

import { useEffect } from "react";
import { JetBrains_Mono, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";

/**
 * Last-resort boundary. `error.tsx` catches throws *below* the root layout;
 * this catches a throw in the root layout itself, where Next replaces the whole
 * document. So we render our own <html>/<body> — and must re-supply the font
 * vars + globals.css, since the layout that normally provides them is gone
 * (an undefined --font-jetbrains would invalidate the entire font-family and
 * drop us to the browser default serif). A real logger swaps in for console.
 */
const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
});

const plex = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex",
  display: "swap",
});

export default function GlobalError({
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
    <html lang="en" className={`${jetbrains.variable} ${plex.variable}`}>
      <body className="flex min-h-dvh flex-col">
        <div className="rk8-ambient" aria-hidden />
        <div className="rk8-noise" aria-hidden />
        <main className="relative flex flex-1 items-center">
          <div className="mx-auto flex max-w-2xl flex-col items-start gap-4 px-4 md:px-6">
            <p className="hud-label text-cp-red">/// KERNEL PANIC — FATAL</p>
            <h1 className="font-mono text-3xl font-bold text-text">
              the whole terminal went dark
            </h1>
            <p className="font-mono text-sm text-dim">
              a fault took down the entire shell — not just this screen. cold-boot
              to bring the system back up.
            </p>
            {error.digest && (
              <p className="hud-label text-dim">trace // {error.digest}</p>
            )}
            <div className="mt-2 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={reset}
                className="rk8-btn-primary"
              >
                cold boot
              </button>
              {/* hard navigation, not <Link> — re-initialize everything after a
                  root-level crash rather than trusting client routing. */}
              <a href="/" className="rk8-btn-ghost">
                reload home
              </a>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}
