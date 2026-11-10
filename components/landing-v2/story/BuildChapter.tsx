"use client";

import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { BrandButton } from "@/components/landing-v2/BrandButton";
import { HoverPrefetchLink } from "@/components/landing-v2/HoverPrefetchLink";
import { track } from "@/components/landing-v2/track";
import { BODY, Chapter, FOCUS, Reveal, SUBHEAD } from "./kit";

/* The close. The hero's display voice returns as a bookend, then the
   two ways in, then the help a builder gets on either path. */

interface Path {
  title: ReactNode;
  line: string;
  cta: { label: string; href: string };
  primary: boolean;
}

// the CTA labels match the hero buttons on purpose, as a bookend
const PATHS: Path[] = [
  {
    title: "Your own L1",
    line: "Deploy an L1 on the Fuji testnet in one click, with a managed validator node.",
    cta: { label: "Build an L1", href: "/console/create-l1" },
    primary: true,
  },
  {
    // the name stays on one line: a narrow cell broke it at its hyphen
    title: (
      <>
        Your app on the <span className="whitespace-nowrap">C-Chain</span>
      </>
    ),
    line: "Deploy Solidity contracts and verify them from Foundry or Hardhat. Each transaction is final in about a second.",
    cta: { label: "Build on C-Chain", href: "/docs/primary-network#c-chain-contract-chain" },
    primary: false,
  },
];

function Resource({ href, label, line }: { href: string; label: string; line: string }) {
  return (
    <HoverPrefetchLink
      href={href}
      onClick={() => track("home_cta_clicked", { section: "build", label, href })}
      // the ring sits inside the cell: the next cell in the hairline grid paints over anything outside it
      className={`group relative flex flex-col gap-1.5 bg-white p-6 transition-colors hover:bg-zinc-50 focus-visible:bg-zinc-50 md:p-8 dark:bg-zinc-950 dark:hover:bg-zinc-900 dark:focus-visible:bg-zinc-900 ${FOCUS} focus-visible:-outline-offset-2!`}
    >
      {/* the lead's 18 px step: a label, quieter than the path titles above */}
      <span className="v2-heading pr-6 text-lg text-zinc-900 dark:text-zinc-50">{label}</span>
      <span className={`text-pretty ${BODY}`}>{line}</span>
      <ArrowRight className="absolute top-6.5 right-6 h-4 w-4 text-zinc-300 transition-all group-hover:translate-x-0.5 group-hover:text-[#E6212F] group-focus-visible:translate-x-0.5 group-focus-visible:text-[#E6212F] md:top-8.5 md:right-8 dark:text-zinc-600" />
    </HoverPrefetchLink>
  );
}

export default function BuildChapter({ academyLine }: { academyLine: string | null }) {
  return (
    <Chapter id="build">
      <Reveal>
        {/* the period holds still: a loop with no pause control fails WCAG 2.2.2 */}
        <h2 className="v2-display text-[3rem] text-zinc-900 md:text-[4rem] xl:text-[5rem] dark:text-zinc-50">
          Build yours<span className="text-[#E6212F]">.</span>
        </h2>
      </Reveal>

      <Reveal delay={0.1} className="mt-16 md:mt-20">
        {/* one hairline grid: the two paths, then the four resources under them */}
        <div className="grid gap-px border border-zinc-200 bg-zinc-200 md:grid-cols-2 lg:grid-cols-4 dark:border-zinc-800 dark:bg-zinc-800">
          {PATHS.map((p) => (
            <div key={p.cta.href} className="flex flex-col gap-10 bg-white p-6 md:p-8 lg:col-span-2 dark:bg-zinc-950">
              <div className="flex flex-col gap-4">
                <h3 className={SUBHEAD}>{p.title}</h3>
                <p className={`max-w-md ${BODY}`}>{p.line}</p>
              </div>
              <BrandButton
                href={p.cta.href}
                variant={p.primary ? "primary" : "secondary"}
                prefetchOnIntent
                onClick={() => track("home_cta_clicked", { section: "build", label: p.cta.label, href: p.cta.href })}
                className="mt-auto w-full sm:w-auto sm:self-start"
              >
                {p.cta.label}
              </BrandButton>
            </div>
          ))}
          {/* commas, not the Academy's dots: a line may break after a comma, never strand a dot */}
          <Resource
            href="/academy"
            label="Academy"
            line={academyLine?.replaceAll(" · ", ", ") ?? "Courses with certificates"}
          />
          <Resource href="/console/primary-network/faucet" label="Testnet faucet" line="Free test tokens for Fuji" />
          <Resource href="/grants" label="Funding" line="Grants and the Blizzard Fund" />
          <Resource href="/audits" label="Audits" line="Free quotes from vetted firms" />
        </div>
      </Reveal>
    </Chapter>
  );
}
