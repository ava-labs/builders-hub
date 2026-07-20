"use client";

import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { ChainIdChips } from "@/components/ui/copyable-id-chip";
import { AddToWalletButton } from "@/components/ui/add-to-wallet-button";

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
  className?: string;
}

function ExitLink({ label, href }: ChainExit) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
    >
      {label}
      <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
    </a>
  );
}

export function ChainHeader({
  chainName,
  chainLogoURI,
  website,
  socials,
  exits = [],
  subnetId,
  blockchainId,
  wallet,
  className,
}: ChainHeaderProps) {
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
    <div className={cn("flex flex-col gap-6", className)}>
      {/* title row: logo, display name, the chain's exits at right */}
      <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-4">
        <div className="flex min-w-0 items-center gap-4">
          {chainLogoURI && (
            <img
              src={chainLogoURI}
              alt=""
              className="h-10 w-10 rounded-full border border-zinc-200 bg-white object-contain md:h-11 md:w-11 dark:border-zinc-800 dark:bg-zinc-900"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          )}
          <h1 className="v2-display min-w-0 truncate text-[clamp(1.6rem,4vw,3rem)] leading-[0.95] text-zinc-900 dark:text-zinc-50">
            {chainName}
            <span className="text-[#E6212F]">.</span>
          </h1>
        </div>
        {exitRows.length > 0 && (
          <div className="flex flex-col items-start gap-y-2.5 sm:items-end">
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

      {/* identifiers and the wallet hook */}
      {(subnetId || blockchainId || wallet) && (
        <div className="-mx-5 px-5 md:mx-0 md:px-0">
          <div className="scrollbar-hide flex flex-row items-center gap-2 overflow-x-auto pb-1">
            <div className="flex flex-shrink-0 items-center gap-2">
              <ChainIdChips subnetId={subnetId} blockchainId={blockchainId} />
            </div>
            {wallet && (
              <div className="flex-shrink-0">
                <AddToWalletButton
                  rpcUrl={wallet.rpcUrl}
                  chainName={chainName}
                  chainId={wallet.chainId}
                  tokenSymbol={wallet.tokenSymbol}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
