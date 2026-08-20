"use client";

import SheetBackdrop from "@/components/landing-v2/SheetBackdrop";
import { ExplorerSubnav } from "@/components/explorer-v2/ExplorerSubnav";
import { ChainHeader } from "@/components/explorer-v2/ChainHeader";
import { Rise } from "@/components/explorer-v2/ui";
import { EvmSearchBox } from "@/components/explorer-v2/evm/EvmSearch";
import { useChainContext } from "@/app/(home)/explorer/[network]/[chain]/layout.client";

/* The EVM explorer page shell — the drafting-sheet analogue of ExplorerShell,
 * but for EVM chains. Chain identity comes from useChainContext() (populated by
 * the [network]/[chain] layout) rather than the P-chain EXPLORER_CHAINS
 * registry, and the header/search are EVM-flavored (ChainHeader + EvmSearchBox).
 * Prop shape matches ExplorerShell so the view components port cleanly. */
export function EvmShell({
  network,
  aside,
  search = true,
  children,
}: {
  network: string;
  /** Optional right-hand companion for the header (e.g. a live height figure). */
  aside?: React.ReactNode;
  /** Set false where there is nothing to search — an unindexed chain has no
   *  blocks, transactions or addresses to look up, so the box would only
   *  promise a lookup that cannot resolve. */
  search?: boolean;
  children: React.ReactNode;
}) {
  const c = useChainContext();
  const base = `/explorer/${network}/${c.chainSlug}`;
  // L1s wear their own brand color as the accent via --chain-accent; every
  // consumer falls back to the Avalanche red, which is what the C-Chain keeps.
  const accent = c.chainSlug !== "c-chain" ? c.themeColor : undefined;

  return (
    <main
      className="relative min-h-screen overflow-x-clip bg-white dark:bg-zinc-950"
      style={accent ? ({ "--chain-accent": accent } as React.CSSProperties) : undefined}
    >
      <SheetBackdrop snowOnly />
      <div className="relative mx-auto min-h-screen w-full max-w-[90rem] border-x border-transparent bg-white px-5 pb-24 pt-10 md:px-6 min-[90rem]:border-zinc-200/90 dark:bg-zinc-950 dark:min-[90rem]:border-zinc-800/90">
        <ExplorerSubnav
          network={network}
          chainSlug={c.chainSlug}
          chainName={c.chainName}
          chainLogoURI={c.chainLogoURI}
          className="mb-8"
        />
        <Rise delay={0.05}>
          <header className="flex flex-col gap-6 pb-10">
            <ChainHeader
              chainName={c.chainName}
              chainLogoURI={c.chainLogoURI}
              website={c.website}
              socials={c.socials}
              wallet={
                c.rpcUrl
                  ? { rpcUrl: c.rpcUrl, chainId: Number(c.chainId) || undefined, tokenSymbol: c.nativeToken }
                  : undefined
              }
              aside={aside}
            />
            {search && <EvmSearchBox base={base} chainName={c.chainName} />}
          </header>
        </Rise>
        <Rise delay={0.14}>{children}</Rise>
      </div>
    </main>
  );
}
