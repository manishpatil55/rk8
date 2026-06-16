/**
 * Safe internal-redirect validation for `?next=` params. Rejects absolute URLs,
 * protocol-relative (`//host`), backslash tricks (`/\host`), and anything that
 * resolves off-origin — closing open-redirect vectors. Returns a path only.
 */
export function safeNextPath(value: unknown): string {
  const s = typeof value === "string" ? value : "";
  if (!s.startsWith("/") || s.startsWith("//") || s.includes("\\")) return "/";
  try {
    const probe = new URL(s, "http://rk8.invalid");
    if (probe.origin !== "http://rk8.invalid") return "/";
    return probe.pathname + probe.search;
  } catch {
    return "/";
  }
}
