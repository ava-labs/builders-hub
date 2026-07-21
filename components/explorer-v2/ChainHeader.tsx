"use client";

import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
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

function ExitLink({ label, href, internal = false }: ChainExit & { internal?: boolean }) {
  const cls =
    "group inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100";
  if (internal) {
    return (
      <Link href={href} className={cls}>
        {label}
        <ArrowRight className="h-3.5 w-3.5 transition-all group-hover:translate-x-0.5 group-hover:text-[#E6212F]" />
      </Link>
    );
  }
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>
      {label}
      <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
    </a>
  );
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
  // identifiers and the wallet hook live on the chain's Details tab now
  const socialExits: ChainExit[] = [
    ...(website ? [{ label: "Website", href: website }] : []),
    ...(socials?.twitter ? [{ label: "X", href: `https://x.com/${socials.twitter}` }] : []),
    ...(socials?.linkedin
      ? [{ label: "LinkedIn", href: `https://linkedin.com/company/${socials.linkedin}` }]
      : []),
  ];
  // two short right-aligned rows (socials, then explorers) read as a deliberate
  // cluster; one long row wraps into debris under the display title
  const exitRows = [socialExits, exits].filter((row) => row.length > 0);

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
        {(aside || exitRows.length > 0) && (
          <div className="flex flex-col items-start gap-y-2.5 sm:items-end">
            {aside}
            {exitRows.map((row, i) => (
              <div key={i} className="flex flex-wrap items-center gap-x-6 gap-y-2">
                {row.map((exit) => (
                  <ExitLink key={exit.href} {...exit} />
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
