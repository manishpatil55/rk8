"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { SYSTEMS } from "@/config/systems.config";

/**
 * ⌘K / Ctrl-K command palette — the terminal-grade jump bar. Fuzzy-searches
 * every action and all 38 systems, keyboard-first. Opens on the shortcut or a
 * `rk8:open-cmdk` window event (dispatched by the header affordance).
 */
interface Cmd {
  label: string;
  hint: string;
  href: string;
}

const ACTIONS: Cmd[] = [
  { label: "home", hint: "DASHBOARD", href: "/" },
  { label: "library", hint: "BROWSE THE MATRIX", href: "/library" },
  { label: "local play", hint: "ZERO-UPLOAD", href: "/local" },
  { label: "contribute", hint: "SUBMIT A GAME", href: "/contribute" },
  { label: "bios vault", hint: "BYO BIOS", href: "/bios" },
  { label: "profile", hint: "ACCOUNT", href: "/profile" },
];

const SYSTEM_CMDS: Cmd[] = SYSTEMS.map((s) => ({
  label: s.name,
  hint: `SYS // ${s.shortName}`,
  href: `/library?system=${s.id}`,
}));

const ALL = [...ACTIONS, ...SYSTEM_CMDS];

/** subsequence match (terminal-style fuzzy) */
function matches(q: string, c: Cmd): boolean {
  if (!q) return true;
  const hay = `${c.label} ${c.hint}`.toLowerCase();
  const needle = q.toLowerCase();
  if (hay.includes(needle)) return true;
  let i = 0;
  for (const ch of hay) if (ch === needle[i]) i++;
  return i === needle.length;
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const results = useMemo(() => ALL.filter((c) => matches(q, c)).slice(0, 40), [q]);

  // global open: shortcut + custom event
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("rk8:open-cmdk", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("rk8:open-cmdk", onOpen);
    };
  }, []);

  // reset + focus on open
  useEffect(() => {
    if (open) {
      setQ("");
      setActive(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => setActive(0), [q]);

  if (!open) return null;

  const go = (c: Cmd | undefined) => {
    if (!c) return;
    setOpen(false);
    router.push(c.href);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") return setOpen(false);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(results[active]);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center bg-bg/70 p-4 pt-[12vh] backdrop-blur-sm"
      onMouseDown={() => setOpen(false)}
      role="dialog"
      aria-modal="true"
      aria-label="command palette"
    >
      <div
        className="notch-tr w-full max-w-xl border border-cp-yellow/40 bg-surface"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        <div className="flex items-center gap-2 border-b px-4 py-3">
          <span className="hud-data">RK8 ::</span>
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="jump to a system or action…"
            className="w-full bg-transparent font-mono text-sm text-text outline-none placeholder:text-dim"
          />
          <span className="hud-label hidden sm:inline">ESC</span>
        </div>
        <div ref={listRef} className="max-h-[50vh] overflow-y-auto p-1">
          {results.length === 0 ? (
            <p className="px-3 py-6 text-center font-mono text-sm text-dim">
              no match — try a system name
            </p>
          ) : (
            results.map((c, i) => (
              <button
                key={c.href}
                type="button"
                data-active={i === active}
                onMouseEnter={() => setActive(i)}
                onClick={() => go(c)}
                className="rk8-cmdk-item flex w-full items-center justify-between border border-transparent px-3 py-2 text-left transition-colors"
              >
                <span className="font-mono text-sm text-text">
                  <span className="text-cp-yellow">&gt; </span>
                  {c.label}
                </span>
                <span className="hud-label">{c.hint}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
