import type { NextConfig } from "next";

/**
 * Cross-origin isolation is ON for the whole site: threaded libretro cores
 * (N64, DS, PSP) need SharedArrayBuffer. Consequence: every subresource must be
 * same-origin or CORP-tagged — which is fine, because RK8 self-hosts everything
 * (engines, fonts, covers, ROM streams). Never add un-proxied third-party embeds.
 */
const nextConfig: NextConfig = {
  outputFileTracingRoot: __dirname,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
          { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
      {
        // Engine runtimes + WASM cores are immutable per pinned version;
        // cache hard so repeat visits boot instantly.
        source: "/engines/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
    ];
  },
};

export default nextConfig;
