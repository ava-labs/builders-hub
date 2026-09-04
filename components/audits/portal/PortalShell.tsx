"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { MONO_LABEL_META } from "@/components/audits/shared/classes";

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

/**
 * Slim portal identity bar under the Builder Hub navbar: the marketplace's
 * own triangle mark + wordmark, firm identity as the board's bordered pill,
 * exit. Sign-out lives in the navbar's account menu (one shared session);
 * the bar only ever leaves the portal.
 */
export function PortalShell({ firmName }: { firmName: string | null }) {
  return (
    <div className="border-b border-zinc-200 dark:border-white/10">
      <div className="mx-auto flex h-12 w-full max-w-[1040px] items-center justify-between gap-3 px-4">
        <Link href="/audits/portal" className="flex items-center gap-2.5">
          <span
            aria-hidden
            className="inline-block h-[12px] w-[13px] bg-brand [clip-path:polygon(50%_0,100%_100%,0_100%)]"
          />
          <span className="text-sm font-semibold">Audit Marketplace</span>
          <span className={MONO_LABEL_META}>Auditor portal</span>
        </Link>
        <div className="flex items-center gap-2">
          {firmName ? (
            <span className="flex items-center gap-2 rounded-full border border-zinc-300 py-1 pl-1 pr-3 text-sm dark:border-white/[0.16]">
              <span
                aria-hidden
                className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-zinc-100 font-mono text-[9.5px] font-semibold text-zinc-600 dark:bg-white/10 dark:text-zinc-300"
              >
                {initialsOf(firmName)}
              </span>
              <span className="hidden font-medium sm:inline">{firmName}</span>
            </span>
          ) : null}
          <Button asChild variant="ghost" className="h-11 md:h-9">
            <Link href="/audits" title="Back to Security Audits, session intact">
              Exit portal
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
