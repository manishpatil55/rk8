"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  MANUFACTURERS,
  SYSTEM_COUNT,
  systemsFor,
  type ManufacturerId,
} from "@/config/systems.config";

/**
 * Site chrome: HUD status strip, command nav, and the manufacturer mega-menu.
 * Fully keyboard navigable: Tab/Enter opens a manufacturer, Escape closes,
 * arrow keys move between manufacturers.
 */
export function Header() {
  const [open, setOpen] = useState<ManufacturerId | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  // undefined = still loading; null = signed out
  const [me, setMe] = useState<{ name: string; role: string } | null | undefined>(
    undefined,
  );
  const navRef = useRef<HTMLElement>(null);
  const pathname = usePathname();

  // route change closes everything
  useEffect(() => {
    setOpen(null);
    setMobileOpen(false);
  }, [pathname]);

  // refresh auth state on navigation (catches login/logout redirects)
  useEffect(() => {
    let active = true;
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        if (active) setMe(d.user ? { name: d.user.name, role: d.user.role } : null);
      })
      .catch(() => active && setMe(null));
    return () => {
      active = false;
    };
  }, [pathname]);

  // click outside / Escape closes the panel
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) setOpen(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const onMfrKeyDown = useCallback(
    (e: React.KeyboardEvent, id: ManufacturerId) => {
      const idx = MANUFACTURERS.findIndex((m) => m.id === id);
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        e.preventDefault();
        const next =
          MANUFACTURERS[
            (idx + (e.key === "ArrowRight" ? 1 : MANUFACTURERS.length - 1)) %
              MANUFACTURERS.length
          ];
        if (next) {
          const el = navRef.current?.querySelector<HTMLButtonElement>(
            `[data-mfr="${next.id}"]`,
          );
          el?.focus();
          if (open) setOpen(next.id);
        }
      }
    },
    [open],
  );

  return (
    <header className="sticky top-0 z-50 border-b bg-bg/95 backdrop-blur-sm">
      {/* status strip */}
      <div className="flex items-center justify-between border-b px-4 py-1.5 md:px-6">
        <span className="hud-label">RK8 // ROMKERNEL-8</span>
        <span className="hud-label hidden sm:inline">
          NON-COMMERCIAL // NO ADS // NO TRACKING
        </span>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event("rk8:open-cmdk"))}
            className="hud-label transition-colors hover:text-cp-yellow"
            aria-label="open command palette"
          >
            <span className="text-cp-yellow">⌘K</span> SEARCH
          </button>
          <span className="hud-data">
            {SYSTEM_COUNT} SYSTEMS <span className="text-dim">//</span>{" "}
            <span aria-hidden>●</span> ONLINE
          </span>
        </div>
      </div>

      {/* main bar */}
      <div className="flex items-center justify-between px-4 py-3 md:px-6">
        <Link
          href="/"
          className="font-mono text-lg font-bold tracking-tight text-text"
        >
          rk8<span className="text-cp-yellow">://</span>
        </Link>

        <nav className="hidden items-center gap-6 md:flex" aria-label="primary">
          <CmdLink href="/library" active={pathname.startsWith("/library")}>
            library
          </CmdLink>
          <CmdLink href="/local" active={pathname.startsWith("/local")}>
            local play
          </CmdLink>
          <CmdLink href="/contribute" active={pathname.startsWith("/contribute")}>
            contribute
          </CmdLink>
          <CmdLink href="/bios" active={pathname.startsWith("/bios")}>
            bios
          </CmdLink>
          {(me?.role === "mod" || me?.role === "admin") && (
            <CmdLink href="/admin" active={pathname.startsWith("/admin")}>
              <span className="text-cp-cyan">admin</span>
            </CmdLink>
          )}
          {me === undefined ? null : me ? (
            <CmdLink href="/profile" active={pathname.startsWith("/profile")}>
              {me.name}
              {me.role !== "user" && (
                <span className="text-cp-cyan"> //{me.role}</span>
              )}
            </CmdLink>
          ) : (
            <CmdLink href="/login" active={pathname.startsWith("/login")}>
              sign in
            </CmdLink>
          )}
        </nav>

        <button
          type="button"
          className="rk8-btn-ghost md:hidden"
          aria-expanded={mobileOpen}
          aria-controls="rk8-mobile-nav"
          onClick={() => setMobileOpen((v) => !v)}
        >
          {mobileOpen ? "close" : "menu"}
        </button>
      </div>

      {/* manufacturer rail + mega-menu (desktop) */}
      <nav
        ref={navRef}
        aria-label="systems"
        className="relative hidden border-t md:block"
      >
        <div className="flex items-stretch overflow-x-auto px-2 md:px-4">
          {MANUFACTURERS.map((m) => (
            <button
              key={m.id}
              type="button"
              data-mfr={m.id}
              className={`hud-label whitespace-nowrap px-3 py-2.5 transition-colors hover:text-text ${
                open === m.id
                  ? "border-b border-cp-yellow text-cp-yellow hover:text-cp-yellow"
                  : ""
              }`}
              aria-expanded={open === m.id}
              onClick={() => setOpen((v) => (v === m.id ? null : m.id))}
              onMouseEnter={() => open && setOpen(m.id)}
              onKeyDown={(e) => onMfrKeyDown(e, m.id)}
            >
              {m.label}
            </button>
          ))}
        </div>

        {open && (
          <div className="notch-bl absolute inset-x-0 top-full border-b bg-surface">
            <div className="mx-auto grid max-w-6xl grid-cols-2 gap-px p-4 sm:grid-cols-3 lg:grid-cols-4">
              {systemsFor(open).map((s) => (
                <Link
                  key={s.id}
                  href={`/library?system=${s.id}`}
                  className="group flex flex-col gap-1 border border-transparent p-3 transition-colors hover:border-line hover:bg-surface-2"
                >
                  <span className="font-mono text-sm text-text group-hover:text-cp-yellow">
                    {s.name}
                  </span>
                  <span className="hud-label flex flex-wrap gap-2">
                    <span>SYS // {s.shortName}</span>
                    {s.bios && <span className="text-cp-cyan">BIOS REQ</span>}
                    {s.experimental && (
                      <span className="text-cp-red">EXPERIMENTAL</span>
                    )}
                    {s.heavy && <span>HEAVY</span>}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </nav>

      {/* mobile nav */}
      {mobileOpen && (
        <nav
          id="rk8-mobile-nav"
          aria-label="primary mobile"
          className="border-t md:hidden"
        >
          <div className="flex flex-col">
            {[
              ["/library", "> library"],
              ["/local", "> local play"],
              ["/contribute", "> contribute"],
              ["/bios", "> bios"],
            ].map(([href, label]) => (
              <Link
                key={href}
                href={href!}
                className="cmd-link border-b px-4 py-3 text-dim hover:text-text"
              >
                {label}
              </Link>
            ))}
            <Link
              href={me ? "/profile" : "/login"}
              className="cmd-link border-b px-4 py-3 text-cp-yellow hover:text-text"
            >
              {me ? `> ${me.name}` : "> sign in"}
            </Link>
            {(me?.role === "mod" || me?.role === "admin") && (
              <Link
                href="/admin"
                className="cmd-link border-b px-4 py-3 text-cp-cyan hover:text-text"
              >
                &gt; admin
              </Link>
            )}
            {MANUFACTURERS.map((m) => (
              <details key={m.id} className="border-b">
                <summary className="hud-label cursor-pointer list-none px-4 py-3">
                  {m.label}
                </summary>
                <div className="flex flex-col pb-2">
                  {systemsFor(m.id).map((s) => (
                    <Link
                      key={s.id}
                      href={`/library?system=${s.id}`}
                      className="px-6 py-2 font-mono text-sm text-dim hover:text-text"
                    >
                      {s.name}
                    </Link>
                  ))}
                </div>
              </details>
            ))}
          </div>
        </nav>
      )}
    </header>
  );
}

function CmdLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`cmd-link transition-colors ${
        active ? "text-cp-yellow" : "text-dim hover:text-text"
      }`}
    >
      <span aria-hidden>&gt; </span>
      {children}
    </Link>
  );
}
