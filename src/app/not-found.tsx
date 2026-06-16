import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-start gap-4 px-4 py-24 md:px-6">
      <p className="hud-label text-cp-red">/// NO SIGNAL — 404</p>
      <h1 className="font-mono text-3xl font-bold text-text">
        no cartridge at this address
      </h1>
      <p className="font-mono text-sm text-dim">
        the page you were looking for isn&rsquo;t here. it may have moved, never
        existed, or been ejected.
      </p>
      <div className="mt-2 flex flex-wrap gap-3">
        <Link href="/" className="rk8-btn-primary">
          back to library
        </Link>
        <Link href="/library" className="rk8-btn-ghost">
          browse systems
        </Link>
      </div>
    </div>
  );
}
