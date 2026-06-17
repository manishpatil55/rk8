"use client";

import { useState } from "react";

/**
 * Cover art that fades in once decoded instead of popping when the proxied
 * /api/cover byte stream lands. The aspect box + surface-2 backing live on the
 * parent, so nothing shifts — only opacity moves, and only when motion is OK.
 */
export function CoverImage({ src }: { src: string }) {
  const [loaded, setLoaded] = useState(false);
  return (
    // covers are operator/community files of unknown dimensions; plain img is correct here
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      onLoad={() => setLoaded(true)}
      className={`h-full w-full object-cover transition-opacity duration-300 motion-reduce:transition-none motion-reduce:opacity-100 ${
        loaded ? "opacity-100" : "opacity-0"
      }`}
    />
  );
}
