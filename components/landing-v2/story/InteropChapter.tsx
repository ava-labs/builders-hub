"use client";

import { useMemo, useRef } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useInView } from "framer-motion";
import { BrandButton } from "@/components/landing-v2/BrandButton";
import { track } from "@/components/landing-v2/track";
import { formatCompact } from "@/components/landing-v2/compactFigure";
import { catalogOf } from "@/lib/explorer-catalog";
import l1ChainsData from "@/constants/l1-chains.json";
import { CAPTION, Chapter, Figure, Lead, Reveal, TextLink, Title } from "./kit";
import { SceneFrame } from "./three/SceneFrame";
import type { NetworkChain, NetworkRoute } from "./three/NetworkScene";

const NetworkScene = dynamic(() => import("./three/NetworkScene"), { ssr: false });

/* A chain of your own is not an island. The drawing is the network
   from the server's snapshot: every chain the explorer lists, and the
   routes its ICM messages took in the last 30 days. */

const C_CHAIN_ID = "43114";
const STILL = { light: "/home/story/network-light.webp", dark: "/home/story/network-dark.webp" };
const STILL_NARROW = { light: "/home/story/network-narrow-light.webp", dark: "/home/story/network-narrow-dark.webp" };

/* a chain's explorer page: the feed's ID is the catalog's chain ID, else its name is the catalog's */
function explorerHref(chainId: string, chainName: string): string | null {
  const name = chainName.toLowerCase();
  const cat =
    catalogOf("mainnet").get(chainId) ??
    (l1ChainsData as { chainName: string; slug: string; isTestnet?: boolean }[]).find(
      (c) => c.isTestnet !== true && c.chainName.toLowerCase() === name,
    );
  return cat?.slug ? `/explorer/mainnet/${cat.slug}` : null;
}

export interface InteropData {
  chains: { chainId: string; chainName: string; txCount?: number | null; logo?: string | null }[];
  flows: { sourceChainId: string; targetChainId: string; messageCount: number }[];
}

export default function InteropChapter({ data }: { data: InteropData }) {
  const chains = useMemo<NetworkChain[]>(
    () =>
      data.chains.map((c) => ({
        id: String(c.chainId),
        name: c.chainName.replace(/^Avalanche /, ""),
        // 0 is a count (a flat block); only a missing count draws an outline
        txCount: typeof c.txCount === "number" ? c.txCount : null,
        logo: c.logo ?? null,
        href: explorerHref(String(c.chainId), c.chainName),
      })),
    [data.chains],
  );
  const routes = useMemo<NetworkRoute[]>(
    () =>
      data.flows
        .filter((f) => f.messageCount > 0)
        .map((f) => ({ from: String(f.sourceChainId), to: String(f.targetChainId), count: f.messageCount })),
    [data.flows],
  );
  // names on the C-Chain and the two busiest other ends of a route
  const labelled = useMemo(() => {
    const sent = new Map<string, number>();
    for (const r of routes) {
      for (const id of [r.from, r.to]) if (id !== C_CHAIN_ID) sent.set(id, (sent.get(id) ?? 0) + r.count);
    }
    const top = [...sent.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([id]) => id);
    return [C_CHAIN_ID, ...top];
  }, [routes]);
  // the red marks' number: every message on these routes in the window
  const messages = useMemo(() => routes.reduce((sum, r) => sum + r.count, 0), [routes]);
  // the rise starts when most of the box is on screen, so the reader sees it from the start
  const boxRef = useRef<HTMLDivElement>(null);
  const shown = useInView(boxRef, { once: true, amount: 0.6 });
  const router = useRouter();
  const onSelect = (chain: NetworkChain) => {
    if (!chain.href) return;
    track("home_chain_clicked", { chain: chain.name, section: "interop", href: chain.href });
    router.push(chain.href);
  };

  return (
    <Chapter id="interop">
      <Reveal>
        <Title lead="Any L1 can connect." rest="No bridge operator" />
        <Lead className="mt-8">
          With Interchain Messaging (ICM), the sending chain&apos;s validators sign each message. The receiving chain checks
          the signatures against the sender&apos;s validator set on the <span className="whitespace-nowrap">P-Chain</span>.
        </Lead>
      </Reveal>

      <Reveal delay={0.1} className="-mx-5 mt-12 md:mx-0 md:mt-16">
        <div ref={boxRef}>
          <SceneFrame
            Scene={NetworkScene}
            sceneProps={{ chains, routes, labelled, play: shown, onSelect }}
            still={STILL}
            stillNarrow={STILL_NARROW}
            alt="The chains the explorer lists, drawn as blocks on the P-Chain with their logos, each as tall as its transactions over 30 days, on a log scale. Chains with no indexed count stand at the base height. Red marks are interchain messages on the routes they took."
            aspect={2.15}
            aspectNarrow={1.625}
          />
        </div>
        <p className={`mt-6 max-w-xl px-5 md:px-0 ${CAPTION}`}>
          Height: transactions in 30 days, on a log scale. Base height: no indexed count. Red: ICM messages in the same 30
          days.
        </p>
      </Reveal>

      <Reveal delay={0.15} className="mt-12 md:mt-16">
        <div className="grid gap-12 border-t border-zinc-200 pt-10 md:grid-cols-3 md:gap-8 md:pt-12 dark:border-zinc-800">
          {messages > 0 && (
            <Figure value={formatCompact(messages)} caption="ICM messages between these chains in the last 30 days." />
          )}
          <Figure value="67%" caption="of the sender's stake must sign each message, by default." />
        </div>
        <div className="mt-14 flex flex-col gap-6 sm:flex-row sm:items-center sm:gap-8">
          <BrandButton
            href="/console/icm/setup"
            variant="secondary"
            prefetchOnIntent
            onClick={() => track("home_cta_clicked", { section: "interop", label: "Set up ICM", href: "/console/icm/setup" })}
            className="w-full sm:w-auto"
          >
            Set up ICM
          </BrandButton>
          <TextLink href="/docs/cross-chain/avalanche-warp-messaging/overview" section="interop">
            How messages are verified
          </TextLink>
        </div>
      </Reveal>
    </Chapter>
  );
}
