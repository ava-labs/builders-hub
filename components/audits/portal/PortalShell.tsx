"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Moon, Sun } from "lucide-react";
import { signOut } from "next-auth/react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <span className="h-9 w-9" aria-hidden />;
  const dark = resolvedTheme === "dark";
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      onClick={() => setTheme(dark ? "light" : "dark")}
      className="h-9 w-9"
    >
      {dark ? <Sun aria-hidden className="h-4 w-4" /> : <Moon aria-hidden className="h-4 w-4" />}
    </Button>
  );
}

/** Portal header (design 1b): wordmark left, firm identity + controls right. */
export function PortalShell({
  firmName,
  signedIn,
}: {
  firmName: string | null;
  signedIn: boolean;
}) {
  return (
    <header className="border-b border-zinc-200 dark:border-white/10">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-3 px-4">
        <Link href="/audits/portal" className="flex items-baseline gap-2">
          <span className="text-sm font-semibold">Audit Marketplace</span>
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
            Auditor portal
          </span>
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href="/"
            className="hidden text-sm text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 sm:inline"
          >
            Builder Hub
          </Link>
          {firmName ? (
            <span className="flex items-center gap-2 text-sm">
              <span
                aria-hidden
                className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-100 font-mono text-[10px] font-semibold text-zinc-600 dark:bg-white/10 dark:text-zinc-300"
              >
                {initialsOf(firmName)}
              </span>
              <span className="hidden font-medium sm:inline">{firmName}</span>
            </span>
          ) : null}
          <ThemeToggle />
          {signedIn ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void signOut({ callbackUrl: "/audits/portal/sign-in" })}
            >
              Sign out
            </Button>
          ) : null}
        </div>
      </div>
    </header>
  );
}
