"use client";

import { SearchBox } from "@/components/explorer-v2/ExplorerShell";
import { ExplorerSubnav } from "@/components/explorer-v2/ExplorerSubnav";
import { Rise } from "@/components/explorer-v2/ui";
import { AskingFrame } from "@/components/explorer-v2/evm/query-asking";
import { QueryWorking } from "@/components/explorer-v2/evm/QueryWorking";
import SheetBackdrop from "@/components/landing-v2/SheetBackdrop";

/* The network-scope shell: the widest lens in the explorer. Same chrome
   grammar as ExplorerShell (sheet column, subnav spine, rising header,
   universal search), but no chain in the switcher: every facet under it
   (chains, ICM, validators, apps, the token) describes the whole network.
   Mainnet only: the aggregate data sources don't cover Fuji. */
export function NetworkShell({
  network = "mainnet",
  search = true,
  heading = true,
  rise = true,
  children,
}: {
  /** Defaults to mainnet */
  network?: string;
  /** Set false where the page has its own input, such as Query's prompt box */
  search?: boolean;
  /** Set false where the page shows its own h1, such as a Query answer */
  heading?: boolean;
  /** Set false where the body must paint with the first frame, such as Query's */
  rise?: boolean;
  children: React.ReactNode;
}) {
  // a div: the site layout's <main> holds the page
  return (
    <div className="relative min-h-screen overflow-x-clip bg-white dark:bg-zinc-950">
      <SheetBackdrop snowOnly />
      <div className="relative mx-auto min-h-screen w-full max-w-[90rem] border-x border-transparent bg-white px-5 pb-24 pt-10 md:px-6 min-[90rem]:border-zinc-200/90 dark:bg-zinc-950 dark:min-[90rem]:border-zinc-800/90">
        {/* no display title by design; the h1 names the page for screen readers */}
        {heading && <h1 className="sr-only">Avalanche Explorer</h1>}
        {/* a question asked in the box shows the Query page's first frame under the subnav at once */}
        <AskingFrame
          // no chainSlug = the subnav's network scope: All Networks switcher
          // row, ecosystem facet tabs, static network label. The facet tabs stay
          // pinned to mainnet on purpose: those aggregates exist there only.
          above={<ExplorerSubnav network={network} className="mb-6" />}
          working={(q) => <QueryWorking question={q} kind="evm" chainName="the C-Chain" scope="network" />}
        >
          {/* the C-Chain's grammar: no display title, no explainer. The
              subnav names the page; the search leads, the figures follow */}
          {search && (
            <div className="pb-8">
              <SearchBox chain="p-chain" network={network} askAt={`/explorer/${network}/query`} />
            </div>
          )}
          {rise ? <Rise delay={0.14}>{children}</Rise> : <div>{children}</div>}
        </AskingFrame>
      </div>
    </div>
  );
}
