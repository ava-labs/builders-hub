"use client";

import { SearchBox } from "@/components/explorer-v2/ExplorerShell";
import { ExplorerSubnav } from "@/components/explorer-v2/ExplorerSubnav";
import { Rise } from "@/components/explorer-v2/ui";
import SheetBackdrop from "@/components/landing-v2/SheetBackdrop";

/* The network-scope shell — the widest lens in the explorer. Same chrome
   grammar as ExplorerShell (sheet column, subnav spine, rising header,
   universal search), but no chain in the switcher: every facet under it
   (chains, ICM, validators, apps, the token) describes the whole network.
   Mainnet only — the aggregate data sources don't cover Fuji. */
export function NetworkShell({
  title,
  eyebrow = "Avalanche Network",
  intro,
  aside,
  children,
}: {
  /** page display title, rendered with the trailing red period */
  title: string;
  eyebrow?: string;
  /** optional one-liner under the title row */
  intro?: string;
  /** optional right-hand companion for the title row (e.g. a live figure) */
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <main className="relative min-h-screen overflow-x-clip bg-white dark:bg-zinc-950">
      <SheetBackdrop snowOnly />
      <div className="relative mx-auto min-h-screen w-full max-w-[90rem] border-x border-transparent bg-white px-5 pb-24 pt-10 md:px-6 min-[90rem]:border-zinc-200/90 dark:bg-zinc-950 dark:min-[90rem]:border-zinc-800/90">
        {/* no chainSlug = the subnav's network scope: All Networks switcher
            row, ecosystem facet tabs, static Mainnet label */}
        <ExplorerSubnav network="mainnet" className="mb-8" />
        <Rise delay={0.05}>
          <header className="flex flex-col gap-6 pb-10">
            {/* pl-0!/pr-0!: overrides the global `header > div` navbar
                padding hack (global.css) that would indent this by 3rem */}
            <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4 pl-0! pr-0!">
              <div className="flex flex-col gap-2.5">
                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">
                  {eyebrow}
                </p>
                <h1 className="v2-display -ml-[0.055em] text-[clamp(1.85rem,4.5vw,3.25rem)] leading-[0.95] text-zinc-900 dark:text-zinc-50">
                  {title}
                  <span className="text-[#E6212F]">.</span>
                </h1>
                {intro && (
                  <p className="max-w-2xl text-[13px] leading-relaxed text-zinc-500 dark:text-zinc-400">
                    {intro}
                  </p>
                )}
              </div>
              {aside}
            </div>
            {/* the universal search — chain="p-chain" routes every shape of
                identifier to whichever chain it belongs to */}
            <SearchBox chain="p-chain" network="mainnet" />
          </header>
        </Rise>
        <Rise delay={0.14}>{children}</Rise>
      </div>
    </main>
  );
}
