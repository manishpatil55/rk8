"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GameCard } from "@/components/games/GameCard";
import {
  getSystem,
  MANUFACTURERS,
  type ManufacturerId,
} from "@/config/systems.config";

export interface LibraryGame {
  id: string;
  slug: string;
  title: string;
  altTitles: string | null;
  systemId: string;
  year: number | null;
  players: number | null;
  region: string | null;
  genre: string | null;
  coverPath: string | null;
  playCount: number;
}

/** url-synced filter keys — single source of truth for what lives in the query */
const FILTER_KEYS = [
  "q",
  "manufacturer",
  "system",
  "genre",
  "year",
  "players",
  "region",
] as const;
type FilterKey = (typeof FILTER_KEYS)[number];
type Filters = Record<FilterKey, string>;

const EMPTY: Filters = {
  q: "",
  manufacturer: "",
  system: "",
  genre: "",
  year: "",
  players: "",
  region: "",
};

/**
 * Subsequence fuzzy match — dependency-free and instant over a few hundred
 * titles. A direct substring always wins; otherwise characters need only
 * appear in order. Searches title + alt-titles.
 */
function fuzzy(needle: string, haystack: string): boolean {
  if (!needle) return true;
  const n = needle.toLowerCase();
  const h = haystack.toLowerCase();
  if (h.includes(n)) return true;
  let i = 0;
  for (let j = 0; j < h.length && i < n.length; j++) {
    if (h[j] === n[i]) i++;
  }
  return i === n.length;
}

function uniqueSorted<T>(values: (T | null | undefined)[]): T[] {
  return [...new Set(values.filter((v): v is T => v != null))].sort((a, b) =>
    String(a).localeCompare(String(b), undefined, { numeric: true }),
  );
}

/** human label for an active-filter pill (e.g. system:snes -> "SNES"). */
function pillLabel(key: FilterKey, value: string): string {
  switch (key) {
    case "q":
      return `“${value}”`;
    case "system":
      return getSystem(value)?.shortName ?? value;
    case "manufacturer":
      return MANUFACTURERS.find((m) => m.id === value)?.label ?? value;
    case "players":
      return `${value}P`;
    default:
      return value;
  }
}

/**
 * /library — the matrix browser. Instant client-side fuzzy search + faceted
 * filters (manufacturer · system · genre · year · players · region), all
 * mirrored into the URL so views are shareable and the mega-menu can deep-link
 * (e.g. /library?system=snes). Responsive down to 360px.
 */
export function LibraryBrowser({ games }: { games: LibraryGame[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // initialise from the URL once (deep links from the mega-menu land here)
  const [filters, setFilters] = useState<Filters>(() => {
    const f = { ...EMPTY };
    for (const k of FILTER_KEYS) f[k] = searchParams.get(k) ?? "";
    return f;
  });

  // keep the URL in sync without spamming history entries
  const firstSync = useRef(true);
  useEffect(() => {
    const params = new URLSearchParams();
    for (const k of FILTER_KEYS) if (filters[k]) params.set(k, filters[k]);
    const qs = params.toString();
    if (firstSync.current) {
      firstSync.current = false;
      return;
    }
    router.replace(qs ? `/library?${qs}` : "/library", { scroll: false });
  }, [filters, router]);

  const set = useCallback(
    (key: FilterKey, value: string) =>
      setFilters((prev) => {
        const next = { ...prev, [key]: value };
        // picking a manufacturer clears a now-inconsistent system selection
        if (key === "manufacturer" && prev.system) {
          const sys = getSystem(prev.system);
          if (sys && sys.manufacturer !== value) next.system = "";
        }
        // picking a system implies (and locks in) its manufacturer
        if (key === "system" && value) {
          const sys = getSystem(value);
          if (sys) next.manufacturer = sys.manufacturer;
        }
        return next;
      }),
    [],
  );

  const clearAll = useCallback(() => setFilters({ ...EMPTY }), []);

  /* facet option lists, derived from the data that's actually present */
  const manufacturersPresent = useMemo(() => {
    const ids = new Set(
      games.map((g) => getSystem(g.systemId)?.manufacturer).filter(Boolean),
    );
    return MANUFACTURERS.filter((m) => ids.has(m.id));
  }, [games]);

  const systemsPresent = useMemo(() => {
    const ids = uniqueSorted(games.map((g) => g.systemId));
    return ids
      .map((id) => getSystem(id))
      .filter((s): s is NonNullable<typeof s> => Boolean(s))
      .filter((s) => !filters.manufacturer || s.manufacturer === filters.manufacturer)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [games, filters.manufacturer]);

  const genres = useMemo(() => uniqueSorted(games.map((g) => g.genre)), [games]);
  const years = useMemo(
    () => uniqueSorted(games.map((g) => g.year)).reverse(),
    [games],
  );
  const players = useMemo(
    () => uniqueSorted(games.map((g) => g.players)),
    [games],
  );
  const regions = useMemo(
    () => uniqueSorted(games.map((g) => g.region)),
    [games],
  );

  /* the filtered result set */
  const results = useMemo(() => {
    return games.filter((g) => {
      const sys = getSystem(g.systemId);
      if (filters.manufacturer && sys?.manufacturer !== filters.manufacturer)
        return false;
      if (filters.system && g.systemId !== filters.system) return false;
      if (filters.genre && g.genre !== filters.genre) return false;
      if (filters.year && String(g.year) !== filters.year) return false;
      if (filters.players && String(g.players) !== filters.players) return false;
      if (filters.region && g.region !== filters.region) return false;
      if (filters.q && !fuzzy(filters.q, `${g.title}\n${g.altTitles ?? ""}`))
        return false;
      return true;
    });
  }, [games, filters]);

  const activeFilters = FILTER_KEYS.filter((k) => filters[k]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:px-6">
      <div className="mb-6">
        <p className="hud-label mb-1">/// library</p>
        <h1 className="flex items-center gap-2 font-mono text-3xl font-bold text-text">
          <span aria-hidden className="text-cp-yellow">
            ▌
          </span>
          the matrix
        </h1>
      </div>

      {/* search — a live command prompt; the match readout ticks as you type */}
      <label className="notch-tr mb-4 flex items-center gap-3 border bg-surface px-4 py-3 transition-colors focus-within:border-cp-yellow">
        <span className="shrink-0 font-mono text-base text-cp-yellow" aria-hidden>
          ❯
        </span>
        <input
          type="search"
          value={filters.q}
          onChange={(e) => set("q", e.target.value)}
          placeholder="search title or alias…"
          aria-label="search library"
          className="w-full bg-transparent font-mono text-sm text-text placeholder:text-dim focus:outline-none"
        />
        <span
          className="hud-data shrink-0 whitespace-nowrap"
          aria-live="polite"
          aria-label={`${results.length} of ${games.length} games match`}
        >
          {results.length} / {games.length}
        </span>
      </label>

      {/* manufacturer chips — horizontal scroll on small screens */}
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        <Chip
          active={!filters.manufacturer}
          onClick={() => set("manufacturer", "")}
          label="ALL"
        />
        {manufacturersPresent.map((m) => (
          <Chip
            key={m.id}
            active={filters.manufacturer === m.id}
            onClick={() =>
              set(
                "manufacturer",
                filters.manufacturer === m.id ? "" : (m.id as ManufacturerId),
              )
            }
            label={m.label}
          />
        ))}
      </div>

      {/* facet selects — wrap on mobile, single row on desktop */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Facet
          label="SYSTEM"
          value={filters.system}
          onChange={(v) => set("system", v)}
          options={systemsPresent.map((s) => [s.id, s.name])}
        />
        <Facet
          label="GENRE"
          value={filters.genre}
          onChange={(v) => set("genre", v)}
          options={genres.map((g) => [g, g])}
        />
        <Facet
          label="YEAR"
          value={filters.year}
          onChange={(v) => set("year", v)}
          options={years.map((y) => [String(y), String(y)])}
        />
        <Facet
          label="PLAYERS"
          value={filters.players}
          onChange={(v) => set("players", v)}
          options={players.map((p) => [String(p), `${p}P`])}
        />
        <Facet
          label="REGION"
          value={filters.region}
          onChange={(v) => set("region", v)}
          options={regions.map((r) => [r, r])}
        />
      </div>

      {activeFilters.length > 0 && (
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <span className="hud-label mr-1">active //</span>
          {activeFilters.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => set(k, "")}
              aria-label={`remove ${k} filter`}
              className="hud-label group/pill inline-flex items-center gap-1.5 border border-line px-2 py-1 text-dim transition-colors hover:border-cp-yellow hover:text-text"
            >
              {pillLabel(k, filters[k])}
              <span
                aria-hidden
                className="text-cp-yellow opacity-60 transition-opacity group-hover/pill:opacity-100"
              >
                ×
              </span>
            </button>
          ))}
          <button type="button" className="rk8-btn-ghost ml-1" onClick={clearAll}>
            clear all
          </button>
        </div>
      )}

      {results.length === 0 ? (
        <div className="notch-bl border border-dashed border-line px-6 py-12 text-center">
          <p className="hud-label mb-2 text-dim">no cartridges match</p>
          <p className="mb-5 font-mono text-sm text-dim">
            the query returned an empty set — widen it or reset.
          </p>
          <button type="button" className="rk8-btn-ghost" onClick={clearAll}>
            reset filters
          </button>
        </div>
      ) : (
        <div className="rk8-lib-grid grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {results.map((g) => (
            <GameCard key={g.id} game={g} />
          ))}
        </div>
      )}
    </div>
  );
}

function Chip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`hud-label shrink-0 whitespace-nowrap border px-3 py-2 transition-colors ${
        active
          ? "border-cp-yellow text-cp-yellow"
          : "border-line text-dim hover:border-dim hover:text-text"
      }`}
    >
      {label}
    </button>
  );
}

function Facet({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="hud-label">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label.toLowerCase()}
        className="border border-line bg-surface px-2 py-2 font-mono text-sm text-text focus:border-cp-yellow focus:outline-none disabled:opacity-40"
        disabled={options.length === 0}
      >
        <option value="">any</option>
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}
