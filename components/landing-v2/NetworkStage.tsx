"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import MiniNetworkDiagram, { MiniChainData, MiniICMFlow } from "@/components/stats/MiniNetworkDiagram";
import l1ChainsData from "@/constants/l1-chains.json";
import { GlobeData } from "@/components/landing/globe";

/**
 * Responsive wrapper for MiniNetworkDiagram. The diagram takes a fixed
 * containerSize prop, so we measure the column we're given and hand it the
 * largest square that fits — keeping the hub (and its background nebula)
 * optically centered at any viewport instead of floating in a 760px crate.
 *
 * Prototype note: the data transform below is copied from
 * components/landing/globe.tsx (Sponsors). If /v2 graduates, export the
 * transform from there instead of duplicating it.
 */

const BOTTOM_CONTROLS_HEIGHT = 60; // keep in sync with MiniNetworkDiagram

function getCategoryColor(category?: string): string {
  switch (category) {
    case "Primary":
      return "#e84142";
    case "Gaming":
      return "#22c55e";
    case "DeFi":
      return "#3b82f6";
    case "Enterprise":
    case "Institutions":
      return "#a855f7";
    case "Infrastructure":
      return "#f97316";
    case "Creative":
      return "#ec4899";
    case "RWAs":
      return "#f59e0b";
    case "Payments":
      return "#06b6d4";
    default:
      return "#8b5cf6";
  }
}

function stringToColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash % 360);
  return `hsl(${hue}, 70%, 55%)`;
}

export default function NetworkStage({ globeData }: { globeData: GlobeData }) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(0);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const measure = () => {
      // offsetWidth/Height are layout sizes, immune to the scroll-driven
      // scale transform the parent applies during the chapter handoff
      // (getBoundingClientRect would shrink and trigger relayout mid-collapse).
      const next = Math.floor(Math.min(el.offsetWidth, el.offsetHeight - BOTTOM_CONTROLS_HEIGHT));
      setSize(next > 0 ? next : 0);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const metrics = globeData?.metrics || null;
  const icmFlows = globeData?.icmFlows || [];

  const chainData: MiniChainData[] = useMemo(() => {
    if (!metrics?.chains) return [];

    const AVALANCHE_CCHAIN_ID = "43114";
    const SHRAPNEL_CHAIN_ID = "2044";
    // Wordmark logos that render cropped inside circular nodes — hide until
    // they have square brand assets.
    const CROPPED_LOGO_CHAINS = ["dcomm", "watr"];

    const avalancheChain = metrics.chains.find((c) => c.chainId === AVALANCHE_CCHAIN_ID);

    const l1Chains = metrics.chains
      .filter((chain) => chain.chainId !== AVALANCHE_CCHAIN_ID && chain.chainId !== SHRAPNEL_CHAIN_ID)
      .map((chain) => {
        const tpsScore = (chain.tps || 0) * 10;
        const txScore = Math.sqrt(chain.txCount || 0) * 0.1;
        const addressScore = Math.sqrt(chain.activeAddresses || 0) * 0.5;
        const validatorScore = typeof chain.validatorCount === "number" ? chain.validatorCount : 0;
        const icmScore = Math.sqrt(chain.icmMessages || 0) * 0.3;
        return { ...chain, activityScore: tpsScore + txScore + addressScore + validatorScore + icmScore };
      })
      .sort((a, b) => b.activityScore - a.activityScore);

    const totalTps = metrics.chains.reduce((sum, c) => sum + (c.tps || 0), 0);

    const result: MiniChainData[] = [
      {
        id: AVALANCHE_CCHAIN_ID,
        chainId: AVALANCHE_CCHAIN_ID,
        name: "Avalanche",
        logo:
          avalancheChain?.chainLogoURI ||
          "https://images.ctfassets.net/gcj8jwzm6086/5VHupNKwnDYJvqMENeV7iJ/3e4b8ff10b69bfa31e70080a4b142cd0/avalanche-avax-logo.svg",
        color: "#e84142",
        category: "Primary Network",
        link: "/stats/overview",
        isPrimary: true,
        tps: totalTps,
        validatorCount:
          typeof avalancheChain?.validatorCount === "number" ? avalancheChain.validatorCount : undefined,
      },
    ];

    l1Chains.forEach((chain) => {
      if (CROPPED_LOGO_CHAINS.some((name) => chain.chainName.toLowerCase().includes(name))) return;
      const l1Chain = l1ChainsData.find(
        (c: any) =>
          c.chainId === chain.chainId || c.chainName.toLowerCase() === chain.chainName.toLowerCase(),
      );
      const category = l1Chain?.category || "General";
      const slug = l1Chain?.slug;
      // Glacier serves a generic AvaCloud placeholder for chains without
      // brand assets — fall back to a curated logo, else drop the chain
      // from this marketing surface entirely.
      const GENERIC_LOGO = "AvaCloud-512x512";
      const glacierLogo =
        chain.chainLogoURI && !chain.chainLogoURI.includes(GENERIC_LOGO)
          ? chain.chainLogoURI
          : undefined;
      const curatedLogo =
        l1Chain?.chainLogoURI && !l1Chain.chainLogoURI.includes(GENERIC_LOGO)
          ? l1Chain.chainLogoURI
          : undefined;
      const logo = glacierLogo || curatedLogo;
      if (!logo) return;

      result.push({
        id: chain.chainId,
        chainId: chain.chainId,
        name: chain.chainName,
        logo,
        color: l1Chain?.color || getCategoryColor(category) || stringToColor(chain.chainName),
        category,
        link: slug ? `/stats/l1/${slug}` : undefined,
        isPrimary: false,
        validatorCount: typeof chain.validatorCount === "number" ? chain.validatorCount : undefined,
        tps: chain.tps || 0,
      });
    });

    return result;
  }, [metrics]);

  const icmFlowsData: MiniICMFlow[] = useMemo(
    () =>
      icmFlows.map((flow) => ({
        sourceChainId: flow.sourceChainId,
        targetChainId: flow.targetChainId,
        messageCount: flow.messageCount,
      })),
    [icmFlows],
  );

  return (
    <div ref={wrapperRef} className="absolute inset-0 flex items-center justify-center">
      {size > 0 && chainData.length > 0 && (
        <MiniNetworkDiagram
          chains={chainData}
          icmFlows={icmFlowsData}
          containerSize={size}
          autoRotate={true}
          autoRotateSpeed={0.1}
          minimal
        />
      )}
    </div>
  );
}
