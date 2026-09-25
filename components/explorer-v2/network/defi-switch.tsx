"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

/* The DeFi tab's two views, protocols and stablecoins, as the Query
   panels' pill switch. Each view keeps its own URL, so links and search
   results land on the right one. */

const VIEWS = [
  { key: "apps", label: "Protocols", href: "/explorer/mainnet/apps" },
  { key: "stablecoins", label: "Stablecoins", href: "/explorer/mainnet/stablecoins" },
] as const;

export function DefiSwitch({ on }: { on: "apps" | "stablecoins" }) {
  return (
    <nav aria-label="DeFi view" className="flex w-fit items-center gap-px rounded-full bg-zinc-100 p-0.5 ring-1 ring-inset ring-zinc-200/70 dark:bg-zinc-900 dark:ring-zinc-800">
      {VIEWS.map((v) => {
        const active = v.key === on;
        return (
          <Link
            key={v.key}
            href={v.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex h-7 items-center rounded-full px-3 font-mono text-[10.5px] font-medium transition-colors duration-200",
              active
                ? "bg-white text-zinc-900 shadow-[0_1px_3px_rgba(0,0,0,0.12)] dark:bg-zinc-700 dark:text-zinc-50"
                : "text-zinc-500 hover:bg-white/60 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-100",
            )}
          >
            {v.label}
          </Link>
        );
      })}
    </nav>
  );
}
