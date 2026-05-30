"use client";

import * as React from "react";
import { createPortal } from "react-dom";

interface SpotlightProps {
  targetRect: DOMRect | null;
  padding?: number;
}

export function TourSpotlight({ targetRect, padding = 8 }: SpotlightProps) {
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
    <div className="fixed inset-0 z-[9998]">
      {/* Dark overlay with cutout */}
      <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <mask id="spotlight-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            <rect
              x={spotlightX}
              y={spotlightY}
              width={spotlightWidth}
              height={spotlightHeight}
              rx={borderRadius}
              ry={borderRadius}
              fill="black"
            />
          </mask>
        </defs>

        {/* Overlay */}
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(0, 0, 0, 0.6)"
          mask="url(#spotlight-mask)"
        />

        {/* Simple border around spotlight */}
        <rect
          x={spotlightX}
          y={spotlightY}
          width={spotlightWidth}
          height={spotlightHeight}
          rx={borderRadius}
          ry={borderRadius}
          fill="none"
          stroke="rgb(59, 130, 246)"
          strokeWidth="2"
        />
      </svg>

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
