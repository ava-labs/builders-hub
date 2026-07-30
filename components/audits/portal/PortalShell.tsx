"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

/**
 * Slim portal identity bar under the Builder Hub navbar: wordmark, firm
 * identity, portal sign-out. Theme and global nav come from the Hub shell.
 */
export function PortalShell({
  firmName,
  signedIn,
}: {
  firmName: string | null;
  signedIn: boolean;
}) {
  return (
    <div className="border-b border-zinc-200 dark:border-white/10">
      <div className="mx-auto flex h-12 w-full max-w-5xl items-center justify-between gap-3 px-4">
        <Link href="/audits/portal" className="flex items-baseline gap-2">
          <span className="text-sm font-semibold">Audit Marketplace</span>
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
            Auditor portal
          </span>
        </Link>
        <div className="flex items-center gap-2">
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
    </div>
  );
}
