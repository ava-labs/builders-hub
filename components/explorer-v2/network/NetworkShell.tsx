"use client";

import { SearchBox } from "@/components/explorer-v2/ExplorerShell";
import { ExplorerSubnav } from "@/components/explorer-v2/ExplorerSubnav";
import { Rise } from "@/components/explorer-v2/ui";
import SheetBackdrop from "@/components/landing-v2/SheetBackdrop";

/* The network-scope shell: the widest lens in the explorer. Same chrome
   grammar as ExplorerShell (sheet column, subnav spine, rising header,
   universal search), but no chain in the switcher: every facet under it
   (chains, ICM, validators, apps, the token) describes the whole network.
   Mainnet only: the aggregate data sources don't cover Fuji. */
export function NetworkShell({
  network = "mainnet",
  children,
}: {
  /** Defaults to mainnet */
  network?: string;
  children: React.ReactNode;
}) {
  return (
    <main className="relative min-h-screen overflow-x-clip bg-white dark:bg-zinc-950">
      <SheetBackdrop snowOnly />
      <div className="relative mx-auto min-h-screen w-full max-w-[90rem] border-x border-transparent bg-white px-5 pb-24 pt-10 md:px-6 min-[90rem]:border-zinc-200/90 dark:bg-zinc-950 dark:min-[90rem]:border-zinc-800/90">
        {/* no chainSlug = the subnav's network scope: All Networks switcher
            row, ecosystem facet tabs, static network label. The facet tabs stay
            pinned to mainnet on purpose: those aggregates exist there only. */}
        <ExplorerSubnav network={network} className="mb-6" />
        {/* the C-Chain's grammar: no display title, no explainer. The
            subnav names the page; the search leads, the figures follow */}
        <div className="pb-8">
          <SearchBox chain="p-chain" network={network} />
        </div>
        <Rise delay={0.14}>{children}</Rise>
      </div>
    </main>
  );
}
