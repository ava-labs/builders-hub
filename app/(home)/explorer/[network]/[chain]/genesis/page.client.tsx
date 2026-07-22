"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ExplorerLayout } from "@/components/explorer/ExplorerLayout";
import { Board, SectionHeader } from "@/components/explorer-v2/ui";
import { CopyButton } from "@/components/explorer/DetailRow";
import { useChainContext } from "../layout.client";
import mainnetGenesis from "@/constants/cchain-genesis/mainnet.json";
import fujiGenesis from "@/constants/cchain-genesis/fuji.json";

/* The chain's founding document, readable in place: the exact genesis JSON
   avalanchego embeds, one board per concern so the whole thing scans
   without scrolling a 100-line blob. */

const GENESIS: Record<string, object> = {
  mainnet: mainnetGenesis,
  fuji: fujiGenesis,
};

const SOURCE_URL = (network: string) =>
  `https://github.com/ava-labs/avalanchego/blob/master/genesis/genesis_${network}.json`;

function JsonBlock({ value }: { value: unknown }) {
  return (
    <pre className="overflow-x-auto px-5 py-4 font-mono text-[12px] leading-relaxed text-zinc-700 md:px-6 dark:text-zinc-300">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

export function ChainGenesisPageClient({ network }: { network: string }) {
  const chain = useChainContext();
  const genesis = GENESIS[network] as Record<string, unknown>;
  const { config, alloc, ...header } = genesis;
  const raw = JSON.stringify(genesis, null, 2);

  return (
    <ExplorerLayout
      chainId={chain.chainId}
      chainName={chain.chainName}
      chainSlug={chain.chainSlug}
      themeColor={chain.themeColor}
      chainLogoURI={chain.chainLogoURI}
      website={chain.website}
      socials={chain.socials}
      rpcUrl={chain.rpcUrl}
    >
      <div className="mx-auto flex w-full max-w-[90rem] flex-col gap-10 px-5 pb-16 pt-2 md:px-6">
        <section className="flex flex-col gap-4">
          <SectionHeader
            label={`Genesis · ${network}`}
            action={
              <span className="flex shrink-0 items-center gap-5">
                <span className="flex items-center gap-1.5">
                  <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
                    Copy JSON
                  </span>
                  <CopyButton text={raw} />
                </span>
                <Link
                  href={SOURCE_URL(network)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                >
                  Source · avalanchego
                  <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </span>
            }
          />
          <p className="max-w-3xl text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
            The block the chain began from, vendored verbatim from avalanchego&apos;s embedded{" "}
            <span className="font-mono text-[12px]">cChainGenesis</span>. Genesis is immutable:
            this document is the same today as at network launch.
          </p>
        </section>

        <div className="grid items-start gap-x-8 gap-y-10 lg:grid-cols-2">
          <section className="flex flex-col gap-4">
            <SectionHeader label="Chain Config" />
            <Board divide={false}>
              <JsonBlock value={config} />
            </Board>
          </section>
          <section className="flex flex-col gap-4">
            <SectionHeader label="Allocation" />
            <Board divide={false}>
              <JsonBlock value={alloc} />
            </Board>
          </section>
        </div>

        <section className="flex flex-col gap-4">
          <SectionHeader label="Block Header" />
          <Board divide={false}>
            <JsonBlock value={header} />
          </Board>
        </section>
      </div>
    </ExplorerLayout>
  );
}
