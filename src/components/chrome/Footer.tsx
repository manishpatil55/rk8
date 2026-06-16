import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 md:px-6">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <Link href="/dmca" className="cmd-link text-dim hover:text-text">
            &gt; dmca
          </Link>
          <Link href="/legal" className="cmd-link text-dim hover:text-text">
            &gt; legal
          </Link>
          <Link href="/contact" className="cmd-link text-dim hover:text-text">
            &gt; contact
          </Link>
          <Link href="/bios" className="cmd-link text-dim hover:text-text">
            &gt; bios policy
          </Link>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="hud-label">
            RK8 // NON-COMMERCIAL FAN PROJECT // FROM ONE GAMER TO ANOTHER
          </p>
          <p className="hud-label">
            TRADEMARKS BELONG TO THEIR OWNERS
          </p>
        </div>
      </div>
    </footer>
  );
}
