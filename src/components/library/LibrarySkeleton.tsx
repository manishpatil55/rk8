/**
 * /library loading scaffold — shown via Suspense while the URL-synced browser
 * hydrates (was a blank `fallback={null}` flash). Deliberately motionless: the
 * design system permits no looping animation, so this is a calm dim frame, not
 * a shimmer. Mirrors the real header + search bar so the swap doesn't jump.
 */
export function LibrarySkeleton() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:px-6" aria-hidden>
      <div className="mb-6">
        <p className="hud-label mb-1 text-dim">/// library</p>
        <h1 className="flex items-center gap-2 font-mono text-3xl font-bold text-text">
          <span className="text-cp-yellow">▌</span>
          the matrix
        </h1>
      </div>

      <div className="notch-tr mb-4 flex items-center gap-3 border bg-surface px-4 py-3">
        <span className="font-mono text-base text-cp-yellow">❯</span>
        <span className="font-mono text-sm text-dim">loading catalog…</span>
      </div>

      <div className="rk8-lib-grid grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="notch-tr border border-line bg-surface">
            <div className="aspect-[4/3] border-b bg-surface-2" />
            <div className="flex flex-col gap-2 p-3">
              <div className="h-3 w-3/4 bg-line" />
              <div className="h-2 w-1/3 bg-line/60" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
