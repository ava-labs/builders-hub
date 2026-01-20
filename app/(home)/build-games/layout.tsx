"use client";

import type { ReactNode } from "react";
import { useTheme } from "next-themes";
import { useEffect } from "react";

export default function BuildGamesLayout({
  children,
}: {
  children: ReactNode;
}): React.ReactElement {
  const { setTheme } = useTheme();

  useEffect(() => {
    setTheme("dark");
  }, [setTheme]);

  return <>{children}</>;
}
