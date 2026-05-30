"use client";
import { useEffect, useState, useCallback } from "react";
import { useTheme } from "next-themes";

// Resolves a chain logo URL against the current theme. Logos in l1-chains.json
// follow a `*Light*` / `*Dark*` naming convention; this hook swaps the segment
// to match the active theme. Defers to `isMounted` so we don't flash the wrong
// variant during SSR hydration.
export function useThemedLogo() {
  const { resolvedTheme } = useTheme();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const getThemedLogoUrl = useCallback(
    (logoUrl: string): string => {
      if (!isMounted || !logoUrl) return logoUrl;
      if (resolvedTheme === "dark") {
        return logoUrl.replace(/Light/g, "Dark");
      }
      return logoUrl.replace(/Dark/g, "Light");
    },
    [isMounted, resolvedTheme]
  );

  return { getThemedLogoUrl, isMounted };
}
