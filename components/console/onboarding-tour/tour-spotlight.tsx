"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

interface SpotlightProps {
  targetRect: DOMRect | null;
  padding?: number;
  /** The tour moved to its next stop: the cutout travels there. A scroll or a resize places it at once. */
  glide?: boolean;
  /** The tour is closing: the overlay fades out. */
  leaving?: boolean;
}

/**
 * con-tour-glide: the dark overlay is the cutout's own wide shadow, so the cutout can travel from stop to stop
 * (transform, width and height, 350ms on the in-out curve) and the eye follows it. The 2px ring straddles the edge,
 * as the SVG stroke did. The overlay fades in over 200ms and out in 150ms. Reduce Motion: the site policy drops the
 * travel, so the cutout jumps as before; the fades stay.
 */
const CUTOUT_SHADOW =
  "0 0 0 1px rgb(59, 130, 246), inset 0 0 0 1px rgb(59, 130, 246), 0 0 0 9999px rgba(0, 0, 0, 0.6)";

export function TourSpotlight({ targetRect, padding = 8, glide = false, leaving = false }: SpotlightProps) {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !targetRect) return null;

  const spotlightX = targetRect.left - padding;
  const spotlightY = targetRect.top - padding;
  const spotlightWidth = targetRect.width + padding * 2;
  const spotlightHeight = targetRect.height + padding * 2;
  const borderRadius = 8;

  return createPortal(
    <div
      className={cn(
        "fixed inset-0 z-[9998] transition-opacity",
        leaving
          ? "pointer-events-none opacity-0 duration-150 ease-out"
          : "opacity-100 duration-200 ease-out starting:opacity-0"
      )}
    >
      {/* The cutout: everything outside it is darkened by its shadow */}
      <div
        className={cn(
          "absolute left-0 top-0",
          glide && "transition-[transform,width,height] duration-350 ease-in-out"
        )}
        style={{
          transform: `translate(${spotlightX}px, ${spotlightY}px)`,
          width: spotlightWidth,
          height: spotlightHeight,
          borderRadius,
          boxShadow: CUTOUT_SHADOW,
        }}
      />

      {/* Click blocker outside spotlight */}
      <div
        className="absolute inset-0"
        style={{
          clipPath: `polygon(
            0% 0%,
            0% 100%,
            ${spotlightX}px 100%,
            ${spotlightX}px ${spotlightY}px,
            ${spotlightX + spotlightWidth}px ${spotlightY}px,
            ${spotlightX + spotlightWidth}px ${spotlightY + spotlightHeight}px,
            ${spotlightX}px ${spotlightY + spotlightHeight}px,
            ${spotlightX}px 100%,
            100% 100%,
            100% 0%
          )`,
        }}
      />
    </div>,
    document.body
  );
}
