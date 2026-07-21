"use client";

import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* The chain identity block, shared by every chain-scoped surface       */
/* (explorer and stats alike): logo in a hairline circle, display name  */
/* with the red period, the chain's exits as mono links at right, and   */
/* the identifier chips + wallet hook underneath. One component so the  */
/* explorer and the stats pages can never drift apart.                  */
/* ------------------------------------------------------------------ */

export interface ChainExit {
  label: string;
  href: string;
}

interface ChainHeaderProps {
  chainName: string;
  chainLogoURI?: string;
  website?: string;
  socials?: {
    twitter?: string;
    linkedin?: string;
  };
  /** extra external exits, e.g. third-party block explorers */
  exits?: ChainExit[];
  subnetId?: string;
  blockchainId?: string;
  wallet?: { rpcUrl: string; chainId?: number; tokenSymbol?: string };
  /** right-hand companion above the exits (e.g. the live tip-height hero) */
  aside?: React.ReactNode;
  className?: string;
}

/* The Primary Network's chains present like the P-Chain does: an eyebrow
   naming the network over the proper chain name — no "Avalanche" prefix,
   no logo bubble. Catalog data (and wallet metadata) keep the full name. */
const PRIMARY_NETWORK_DISPLAY: Record<string, { title: string; eyebrow: string }> = {
  "Avalanche C-Chain": { title: "Contract Chain", eyebrow: "Avalanche Primary Network" },
};

export function ChainHeader({
  chainName,
  chainLogoURI,
  website,
  socials,
  exits = [],
  subnetId,
  blockchainId,
  wallet,
  aside,
  className,
}: ChainHeaderProps) {
  const primary = PRIMARY_NETWORK_DISPLAY[chainName];
  // identifiers, the wallet hook, socials, and external explorers all live
  // on the chain's Details tab now — the header holds only the identity and
  // its aside, so switching between the P-Chain and any L1 never shifts

  return (
    // pl-0!/pr-0! neutralize the global `header > div` navbar padding hack
    // (global.css) wherever this lands as a direct child of a <header> —
    // otherwise the title sits 3rem right of the P-Chain's and shifts on
    // every chain switch
    <div className={cn("flex flex-col gap-6 pl-0! pr-0!", className)}>
      {/* title row: logo, display name, the chain's exits at right */}
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <div className={cn("flex min-w-0 gap-4", primary ? "flex-col gap-2.5" : "items-center")}>
          {primary ? (
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">
              {primary.eyebrow}
            </p>
          ) : (
            chainLogoURI && (
              <img
                src={chainLogoURI}
                alt=""
                className="h-10 w-10 rounded-full border border-zinc-200 bg-white object-contain md:h-11 md:w-11 dark:border-zinc-800 dark:bg-zinc-900"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            )
          )}
          <h1
            className={cn(
              "v2-display min-w-0 truncate text-[clamp(1.85rem,4.5vw,3.25rem)] leading-[0.95] text-zinc-900 dark:text-zinc-50",
              primary && "-ml-[0.055em]",
            )}
          >
            {primary?.title ?? chainName}
            <span className="text-[#E6212F]">.</span>
          </h1>
        </div>
        {aside}
      </div>
    </div>
  );
}
