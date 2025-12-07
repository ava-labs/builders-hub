"use client";

import { useEffect } from "react";

/**
 * Overrides fumadocs' media query to use 1024px breakpoint instead of 768px
 * This ensures mobile sidebar renders at our custom breakpoint
 */
export function ForceMobileSidebar() {
  useEffect(() => {
    // Override window.matchMedia for fumadocs' media query
    const originalMatchMedia = window.matchMedia;

    window.matchMedia = function (query: string) {
      // If fumadocs is checking for mobile (width < 768px)
      // Change it to our breakpoint (width < 1024px)
      if (query === "(width < 768px)" || query === "(max-width: 767px)") {
        query = "(max-width: 1023px)";
      }

      return originalMatchMedia.call(this, query);
    };

    // Cleanup
    return () => {
      window.matchMedia = originalMatchMedia;
    };
  }, []);

  return null;
}
