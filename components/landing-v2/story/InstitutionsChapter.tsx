"use client";

import { ArrowRight } from "lucide-react";
import { HoverPrefetchLink } from "@/components/landing-v2/HoverPrefetchLink";
import { track } from "@/components/landing-v2/track";
import { BODY, Chapter, FOCUS, Lead, Reveal, SUBHEAD, TextLink, Title } from "./kit";

/* Who already made the choice. Each entry says what is live, in the
   words of its source in the repo, and links to that source. Each cell
   carries the partner's mark on a round chip, the same fit rule as the
   hero tape (see builtOnChains.ts): the brand's own color is its mark. */

interface Case {
  name: string;
  line: string;
  href: string;
  /** a square mark; `chip` is the round tile behind it, `inset` pads a mark that runs to its edges */
  mark: { src: string; chip: string; inset?: boolean };
}

const CASES: Case[] = [
  {
    name: "BlackRock BUIDL",
    line: "A tokenized fund on the C-Chain, issued through Securitize.",
    href: "/integrations/blackrock",
    mark: { src: "/logos/partners/tape/blackrock.svg", chip: "#000000" },
  },
  {
    name: "Galaxy CLO 2025-1",
    line: "Tokenized private credit, issued natively on Avalanche. $75M at the initial closing.",
    href: "/integrations/galaxy",
    mark: { src: "/images/galaxy.svg", chip: "#ffffff", inset: true },
  },
  {
    name: "Wyoming FRNT",
    line: "A state-issued, dollar-pegged stablecoin. Holders spend it with Rain-issued Visa cards.",
    href: "/integrations/rain",
    mark: { src: "/logos/partners/tape/wyoming-frnt.png", chip: "#ffffff" },
  },
  {
    name: "Dinari Financial Network",
    line: "An Avalanche L1 for tokenized U.S. public securities.",
    href: "/explorer/mainnet/dinari-financial-network",
    mark: { src: "/logos/partners/tape/dinari.png", chip: "#07846d" },
  },
  {
    name: "Intain Market",
    line: "Permissioned structured finance on an L1. Its gateway serves 2,000+ regional banks.",
    href: "/explorer/mainnet/intainmkt",
    mark: { src: "/logos/partners/tape/intain.png", chip: "#ffffff" },
  },
  {
    name: "Circle USDC",
    line: "Native USDC on the C-Chain. CCTP moves it to other supported chains with no wrapped token.",
    href: "/integrations/circlepay",
    mark: { src: "/logos/tokens/usdc.png", chip: "transparent" },
  },
];

function CaseCell({ c }: { c: Case }) {
  return (
    <HoverPrefetchLink
      href={c.href}
      onClick={() => track("home_cta_clicked", { section: "institutions", label: c.name, href: c.href })}
      // the ring sits inside the cell: the next cell in the hairline grid paints over anything outside it
      className={`group relative flex flex-col gap-3 bg-white p-6 transition-colors hover:bg-zinc-50 focus-visible:bg-zinc-50 sm:gap-2 md:p-8 dark:bg-zinc-950 dark:hover:bg-zinc-900 dark:focus-visible:bg-zinc-900 ${FOCUS} focus-visible:-outline-offset-2!`}
    >
      {/* below sm the name joins the chip on one row; from sm the chip stands above the name */}
      <span className="flex items-center gap-3 pr-8 sm:flex-col sm:items-start sm:gap-6 sm:pr-0 md:gap-8">
        {/* a hairline ring holds a white chip's edge on the light page and a dark chip's on the dark one */}
        <span
          className="h-8 w-8 shrink-0 overflow-hidden rounded-full ring-1 ring-inset ring-zinc-950/10 sm:h-10 sm:w-10 dark:ring-white/15"
          style={{ background: c.mark.chip }}
        >
          <img
            src={c.mark.src}
            alt=""
            loading="lazy"
            decoding="async"
            className={`h-full w-full object-contain ${c.mark.inset ? "p-2 sm:p-2.5" : ""}`}
          />
        </span>
        <span className={`${SUBHEAD} max-sm:text-xl`}>{c.name}</span>
      </span>
      <span className={`text-pretty ${BODY}`}>{c.line}</span>
      {/* the arrow sits level with the chip's center at every width */}
      <ArrowRight className="absolute right-6 top-8 h-4 w-4 text-zinc-300 transition-all group-hover:translate-x-0.5 group-hover:text-[#E6212F] group-focus-visible:translate-x-0.5 group-focus-visible:text-[#E6212F] sm:top-9 md:right-8 md:top-11 dark:text-zinc-600" />
    </HoverPrefetchLink>
  );
}

export default function InstitutionsChapter() {
  return (
    <Chapter id="institutions">
      <Reveal>
        <Title lead="Already in production" />
        <Lead className="mt-8">
          Institutions run funds, credit, securities and stablecoins on the{" "}
          <span className="whitespace-nowrap">C-Chain</span> and on L1s.
        </Lead>
      </Reveal>
      <Reveal delay={0.1} className="mt-16 md:mt-20">
        {/* hairline grid: the 1 px gaps show the border color through */}
        <div className="grid gap-px border border-zinc-200 bg-zinc-200 sm:grid-cols-2 lg:grid-cols-3 dark:border-zinc-800 dark:bg-zinc-800">
          {CASES.map((c) => (
            <CaseCell key={c.name} c={c} />
          ))}
        </div>
        <div className="mt-12">
          <TextLink href="/solutions" section="institutions">
            Solutions for institutions
          </TextLink>
        </div>
      </Reveal>
    </Chapter>
  );
}
