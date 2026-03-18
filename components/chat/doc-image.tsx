"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";

export default function DocImage({ src, alt }: { src: string; alt?: string }) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  if (!src || error) return null;

  return (
    <figure className="my-4">
      <div
        className={cn(
          "overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-700",
          "bg-zinc-50 dark:bg-zinc-900",
          !loaded && "animate-pulse min-h-[120px]",
        )}
      >
        <img
          src={src}
          alt={alt || ""}
          loading="lazy"
          onLoad={() => setLoaded(true)}
          onError={() => setError(true)}
          className={cn(
            "max-w-full h-auto transition-opacity duration-200",
            loaded ? "opacity-100" : "opacity-0",
          )}
        />
      </div>
      {alt && (
        <figcaption className="mt-1.5 text-xs text-muted-foreground">
          {alt}
        </figcaption>
      )}
    </figure>
  );
}
