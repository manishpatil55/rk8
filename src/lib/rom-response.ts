import "server-only";
import { storage } from "@/lib/storage";

/**
 * The single byte-serving path for stored ROMs, shared by the public
 * `/api/rom/[id]` (approved-only, cacheable) and the authed
 * `/api/admin/rom/[id]` (any status, no-store) routes so range handling and
 * header hygiene never drift between them.
 */

/** filename for Content-Disposition — slug + ext are user-derived, so sanitize */
export function romFilename(slug: string, romPath: string): string {
  const ext = (romPath.match(/\.[a-z0-9]+$/i)?.[0] ?? "").toLowerCase();
  return `${slug.replace(/[^a-z0-9._-]/gi, "_")}${ext}`;
}

export function streamStored(
  req: Request,
  key: string,
  opts: {
    filename: string;
    cacheControl: string;
    /** local disk always proxies; offload (signed URL) is opt-in per caller */
    allowOffload?: boolean;
  },
): Response {
  if (opts.allowOffload !== false) {
    const offloaded = storage.streamUrl(key);
    if (offloaded) return Response.redirect(offloaded, 302);
  }

  const total = storage.size(key);
  const baseHeaders: Record<string, string> = {
    "Content-Type": "application/octet-stream",
    "Content-Disposition": `inline; filename="${opts.filename}"`,
    "Accept-Ranges": "bytes",
    "Cache-Control": opts.cacheControl,
  };

  // single-range support: emulator cores seek, and big ROMs resume better
  const range = req.headers.get("range");
  const m = range?.match(/^bytes=(\d*)-(\d*)$/);
  if (m && total > 0) {
    const start = m[1] ? parseInt(m[1], 10) : 0;
    const end = m[2] ? Math.min(parseInt(m[2], 10), total - 1) : total - 1;
    if (start <= end && start < total) {
      return new Response(storage.stream(key, start, end), {
        status: 206,
        headers: {
          ...baseHeaders,
          "Content-Range": `bytes ${start}-${end}/${total}`,
          "Content-Length": String(end - start + 1),
        },
      });
    }
    return new Response(null, {
      status: 416,
      headers: { "Content-Range": `bytes */${total}` },
    });
  }

  return new Response(storage.stream(key), {
    headers: { ...baseHeaders, "Content-Length": String(total) },
  });
}
