import { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { L1Chain } from "@/types/stats";
import { Board, BoardHeader } from "@/components/explorer-v2/ui";
import { EvmShell } from "@/components/explorer-v2/EvmShell";
import { findAliasClaimants, resolveCatalogChain, wantsTestnet } from "@/lib/explorer-catalog";
import { ChainExplorerLayoutClient } from "./layout.client";

/* The whole page body for a chain we don't index. */
function ChainNotIndexed({ network, chainName }: { network: string; chainName: string }) {
  const pchain = `/explorer/${wantsTestnet(network) ? "fuji" : "mainnet"}/p-chain`;
  return (
    <EvmShell network={network} search={false}>
      <Board divide={false}>
        <BoardHeader label="Not indexed" display />
        <div className="space-y-3 px-5 py-8 md:px-6 md:py-10">
          <p className="max-w-prose text-[13px] leading-relaxed text-zinc-600 dark:text-zinc-400">
            The explorer has no data for{" "}
            <span className="text-zinc-900 dark:text-zinc-100">{chainName}</span>. Blocks,
            transactions, accounts and gas history are all unavailable — this
            chain publishes no public RPC endpoint and is not in our indexing
            set.
          </p>
          <p className="max-w-prose text-[13px] leading-relaxed text-zinc-500 dark:text-zinc-500">
            Its on-chain registration is still visible from the P-Chain, which is
            where subnet and validator records live.
          </p>
          <Link
            href={pchain}
            className="group inline-flex items-center gap-2 pt-1 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            Open the P-Chain explorer
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </Board>
    </EvmShell>
  );
}

/* A request for a bare alias that no chain holds. */
function UnclaimedAlias({
  slug,
  network,
  claimants,
}: {
  slug: string;
  network: string;
  claimants: L1Chain[];
}) {
  return (
    <div className="mx-auto max-w-3xl px-5 py-16 md:px-6">
      <Board divide={false}>
        <BoardHeader label="Unverified alias" display />
        <div className="space-y-4 px-5 py-8 md:px-6 md:py-10">
          <p className="max-w-prose text-[13px] leading-relaxed text-zinc-600 dark:text-zinc-400">
            No chain holds{" "}
            <span className="font-mono text-zinc-900 dark:text-zinc-100">{slug}</span> as an alias here.
            Chain names are self-declared and unverified, so the plain name in a
            URL is reserved for chains we acknowledge — every other chain
            answers on a slug that carries its own blockchain ID.
          </p>
          <p className="max-w-prose text-[13px] leading-relaxed text-zinc-500 dark:text-zinc-500">
            {claimants.length === 1
              ? `One chain on ${network} calls itself this:`
              : `${claimants.length} separate chains on ${network} call themselves this:`}
          </p>
          <div className="divide-y divide-zinc-200 border-y border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {claimants.map((c) => (
              <Link
                key={c.slug}
                href={`/explorer/${network}/${c.slug}`}
                className="group flex items-center justify-between gap-4 py-3 transition-colors"
              >
                <span className="min-w-0 truncate font-mono text-[11px] text-[#0061E2] dark:text-[#5f9dff]">
                  {c.slug}
                </span>
                <span className="flex shrink-0 items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
                  {c.chainName}
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </Board>
    </div>
  );
}

interface ChainExplorerLayoutProps {
  children: ReactNode;
  params: Promise<{ network: string; chain: string }>;
}

export default async function ChainExplorerLayout({
  children,
  params
}: ChainExplorerLayoutProps) {
  const resolvedParams = await params;
  const { network, chain: chainSlug } = resolvedParams;

  const chain = resolveCatalogChain(network, chainSlug);
  const unindexed = chain?.isIndexed === false;

  // If chain found in static data, render with server-known props
  if (chain) {
    return (
      <ChainExplorerLayoutClient
        chainId={chain.chainId}
        chainName={chain.chainName}
        chainSlug={chain.slug}
        themeColor={chain.color || "#E57373"}
        chainLogoURI={chain.chainLogoURI}
        nativeToken={chain.networkToken?.symbol}
        description={chain.description}
        website={chain.website}
        socials={chain.socials}
        rpcUrl={chain.rpcUrl}
        blockchainId={chain.blockchainId}
        sourcifySupport={(chain as L1Chain & { sourcifySupport?: boolean }).sourcifySupport}
      >
        {unindexed ? (
          <ChainNotIndexed network={network} chainName={chain.chainName} />
        ) : (
          children
        )}
      </ChainExplorerLayoutClient>
    );
  }

  // Nothing answers on this slug
  const claimants = findAliasClaimants(network, chainSlug);
  if (claimants.length > 0) {
    return <UnclaimedAlias slug={chainSlug} network={network} claimants={claimants} />;
  }

  // For custom chains (not in static data), render client-side loader
  // The client component will look up the chain from localStorage
  return (
    <ChainExplorerLayoutClient chainSlug={chainSlug} isCustomChain>
      {children}
    </ChainExplorerLayoutClient>
  );
}
