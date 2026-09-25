"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { BrandButton } from "@/components/landing-v2/BrandButton";
import SheetBackdrop from "@/components/landing-v2/SheetBackdrop";
import ExternalChainIcmDiagram from "@/components/landing-v2/ExternalChainIcmDiagram";

/* ------------------------------------------------------------------ */
/* External EVM chain ↔ Avalanche via ICM attestors — a pattern page.  */
/*                                                                     */
/* Reuses the PillarPage skeleton (breadcrumb eyebrow → statement →    */
/* hairline panels → spec rows) but is deliberately NOT a pillar: it   */
/* stays out of pillars.ts so it never reads as a peer of the four     */
/* shipped guarantees, and it closes without ConsoleBar, because       */
/* "Build yours in the Console" would imply this pattern is buildable  */
/* today. It is not.                                                   */
/*                                                                     */
/* The STATUS block in the hero is a content requirement from the      */
/* office that owns this copy, not a styling preference: the maturity  */
/* of the work must be readable above the fold at every breakpoint.    */
/* Do not move it down the page, and do not demote it into an          */
/* accordion, a tab, or a footnote.                                    */
/*                                                                     */
/* A per-component "what is built and what is not" table sat between   */
/* the configuration list and the download until Andrea cut it on      */
/* 2026-08-06. Two facts it carried are now stated nowhere on the      */
/* page: that registry synchronisation is not designed, and that no    */
/* Avalanche-to-Besu deployment has been demonstrated. If this page is */
/* ever extended, that gap is the first thing to reconsider.           */
/* ------------------------------------------------------------------ */

/** The report itself is not in the repo yet. This is the agreed drop path;
 *  the file goes at public/downloads/<basename> and the link goes live the
 *  moment it lands. Do not point this at an external host. */
const ANALYSIS_PDF = "/downloads/external-evm-icm-attestors-analysis.pdf";

const MECHANISM = [
  {
    title: "Each chain checks against its own list",
    body: "Each chain maintains its own list of the parties authorised to sign messages originating on the other side, together with the weight carried by each signature. On arrival, the receiving chain checks the signatures against its own list and confirms the combined weight clears the required threshold. No entity declares a message valid.",
  },
  {
    title: "A registry in place of the P-Chain",
    body: "On the Avalanche side, the external signers are registered as the validator set of a chain that exists only as a registry, executing nothing and producing no blocks. On the permissioned side, a contract reproduces the function the P-Chain performs for Avalanche networks: recording who may sign, and what each signature is worth.",
  },
  {
    title: "What the carrier cannot do",
    body: "The party carrying the message cannot alter it, because any change invalidates the signatures. It cannot fabricate one, because it holds no signing keys. It cannot substitute the signer set, because the list resides on the receiving chain rather than inside the message. Its only available failure is non-delivery.",
  },
];

const CONFIGURATION = [
  "Signing authority separate from node operation, so the parties authorising messages need not be the validators producing blocks",
  "Delivery restricted to named addresses, including only the institution's own infrastructure",
  "Transaction, deployment and issuance rights permissioned by role at protocol level",
  "Signer sets and weights readable on-chain, so an auditor verifies the trust model rather than being told about it",
  "Message format and encryption chosen by the sender, since the payload is opaque to the protocol",
];

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-10 flex items-center gap-4">
      <p className="shrink-0 font-mono text-[11px] tracking-[0.22em] text-zinc-900 dark:text-zinc-100">{children}</p>
      <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
    </div>
  );
}

export default function ExternalChainIcmPattern() {
  const reducedMotion = useReducedMotion();

  const rise = (delay: number) =>
    reducedMotion
      ? {}
      : {
          initial: { opacity: 0, y: 16 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] as const },
        };

  return (
    <main className="relative overflow-x-clip bg-white dark:bg-zinc-950">
      <SheetBackdrop snowOnly />
      <div className="relative">
        <div className="mx-auto w-full max-w-7xl px-5 pt-14 md:px-6">
          <motion.div className="flex items-center gap-4" {...rise(0)}>
            <p className="shrink-0 font-mono text-[11px] tracking-[0.22em] text-zinc-500 dark:text-zinc-400">
              <Link href="/solutions" className="transition-colors hover:text-zinc-900 dark:hover:text-zinc-100">
                SOLUTIONS
              </Link>{" "}
              · <span className="text-zinc-900 dark:text-zinc-100">ARCHITECTURE PATTERN</span>
            </p>
            <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
          </motion.div>

          {/* statement — the solutions hero layout (title left, dek in the
              right column, bottom-aligned so it meets the closing line), but
              deliberately not the solutions hero voice; see the h1 below */}
          <motion.div className="pt-14 lg:pt-20" {...rise(0.08)}>
            <div className="lg:grid lg:grid-cols-[minmax(0,8fr)_minmax(0,4fr)] lg:gap-14">
              {/* .v2-heading, not .v2-display: Aeonik 500 and sentence case
                  rather than heavy uppercase caps, and no red punch line.
                  The house display grammar is a selling voice, and the whole
                  argument of this page is that it is not selling anything.
                  Consequence worth keeping: red now appears exactly once on
                  the page, on the message in flight in the diagram — which
                  is what the token is supposed to mean. */}
              <h1 className="v2-heading text-2xl text-zinc-900 md:text-4xl xl:text-[2.75rem] dark:text-zinc-50">
                Connecting an external EVM chain to Avalanche with ICM attestors
              </h1>
              <div className="lg:flex lg:flex-col lg:justify-end lg:border-l lg:border-zinc-200 lg:pl-10 dark:lg:border-zinc-800">
                <p className="mt-8 max-w-2xl pb-1 text-base leading-relaxed text-zinc-600 lg:mt-0 lg:max-w-none lg:text-lg lg:leading-relaxed dark:text-zinc-300">
                  A design pattern for linking a permissioned network, such as Hyperledger Besu, to the Avalanche
                  C-Chain without an intermediary operator in the message path.
                </p>
              </div>
            </div>
          </motion.div>

          {/* maturity, stated before anything else is claimed. This sits in
              the hero at every breakpoint by requirement — it is not a
              disclaimer and must not migrate to the foot of the page. */}
          <motion.div className="mt-12 lg:mt-14" {...rise(0.16)}>
            <div className="border-y border-zinc-200 bg-white/80 px-5 py-6 backdrop-blur-sm md:px-8 md:py-7 dark:border-zinc-800 dark:bg-zinc-950/80">
              <p className="font-mono text-[10px] tracking-[0.18em] text-zinc-400 dark:text-zinc-500">STATUS</p>
              <p className="mt-3 max-w-4xl text-base leading-relaxed text-zinc-600 dark:text-zinc-300">
                The Avalanche primitives this builds on run in production today.{" "}
                <span className="font-medium text-zinc-900 dark:text-zinc-50">
                  The extension to a non-Avalanche chain is designed and not yet implemented.
                </span>
              </p>
            </div>
          </motion.div>

          {/* the drawing carries the argument; dense enough that it pans
              rather than reflows on small screens */}
          <motion.div className="pt-20 lg:pt-28" {...rise(0.22)}>
            <SectionLabel>ARCHITECTURE</SectionLabel>
            <div className="border-y border-zinc-200 bg-white/80 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-950/80">
              <div className="overflow-x-auto px-5 py-8 md:px-8 md:py-10">
                <div className="mx-auto min-w-[680px] max-w-4xl">
                  <ExternalChainIcmDiagram />
                </div>
              </div>
            </div>
            <p className="mt-4 max-w-3xl text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
              Neither registry is populated from the other: each is held and maintained on the chain that reads it.
              Weights are drawn as relative bars because no weighting scheme for this pattern has been fixed.
            </p>
          </motion.div>

          <motion.div className="pt-20 lg:pt-28" {...rise(0.26)}>
            <SectionLabel>THE PROBLEM</SectionLabel>
            <div className="grid grid-cols-1 divide-y divide-zinc-200 border-y border-zinc-200 bg-white/80 backdrop-blur-sm md:grid-cols-2 md:divide-x md:divide-y-0 dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-950/80">
              <div className="px-5 py-8 md:px-8 md:py-10">
                <p className="text-base leading-relaxed text-zinc-600 dark:text-zinc-300">
                  Avalanche and a permissioned EVM network share no validators, no state, and no built-in means of
                  confirming what occurred on the other side. Left alone, a message crossing between them is an
                  unbacked assertion.
                </p>
              </div>
              <div className="px-5 py-8 md:px-8 md:py-10">
                <p className="text-base leading-relaxed text-zinc-600 dark:text-zinc-300">
                  Most answers introduce a third party: a custodial bridge, a group of key holders, or an oracle
                  network with its own operators and its own economics.{" "}
                  <span className="font-medium text-zinc-900 dark:text-zinc-50">This pattern introduces none.</span>
                </p>
              </div>
            </div>
          </motion.div>

          <motion.div className="pt-20 lg:pt-28" {...rise(0.3)}>
            <SectionLabel>HOW IT WORKS</SectionLabel>
            <div className="grid grid-cols-1 divide-y divide-zinc-200 border-y border-zinc-200 bg-white/80 backdrop-blur-sm md:grid-cols-3 md:divide-x md:divide-y-0 dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-950/80">
              {MECHANISM.map((item, i) => (
                <div key={item.title} className="px-5 py-8 md:px-8 md:py-10">
                  <span className="font-mono text-[11px] tracking-[0.18em] text-zinc-400 dark:text-zinc-500">
                    {`0${i + 1}`}
                  </span>
                  <h2 className="v2-display mt-4 text-xl text-zinc-900 md:text-2xl dark:text-zinc-50">{item.title}</h2>
                  <p className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">{item.body}</p>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div className="pt-20 lg:pt-28" {...rise(0.34)}>
            <SectionLabel>WHAT THE OPERATING INSTITUTION CONFIGURES</SectionLabel>
            <ul className="divide-y divide-zinc-200 border-y border-zinc-200 bg-white/80 backdrop-blur-sm dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-950/80">
              {CONFIGURATION.map((item, i) => (
                <li key={item} className="flex gap-5 px-5 py-5 md:gap-8 md:px-8">
                  <span className="shrink-0 pt-0.5 font-mono text-[11px] tracking-[0.18em] text-zinc-400 dark:text-zinc-500">
                    {`0${i + 1}`}
                  </span>
                  <span className="text-[15px] leading-relaxed text-zinc-600 dark:text-zinc-300">{item}</span>
                </li>
              ))}
            </ul>
          </motion.div>

          <motion.div className="pt-20 pb-20 lg:pt-28 lg:pb-28" {...rise(0.38)}>
            <SectionLabel>DOWNLOAD THE FULL ANALYSIS</SectionLabel>
            <div className="border-y border-zinc-200 bg-white/80 px-5 py-8 backdrop-blur-sm md:px-8 md:py-10 dark:border-zinc-800 dark:bg-zinc-950/80">
              <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:gap-14">
                <p className="max-w-2xl text-base leading-relaxed text-zinc-600 dark:text-zinc-300">
                  A written analysis covering benefits, viability, architecture, comparison with oracle and bridge
                  designs, failure paths, and a verification record for every claim.
                </p>
                <BrandButton href={ANALYSIS_PDF} variant="secondary" className="w-full lg:w-auto">
                  Download the full analysis
                </BrandButton>
              </div>
              <div className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-3 border-t border-zinc-200 pt-6 dark:border-zinc-800">
                <span className="font-mono text-[10px] tracking-[0.18em] text-zinc-400 dark:text-zinc-500">
                  THE PRIMITIVES, DOCUMENTED
                </span>
                <Link
                  href="/docs/cross-chain"
                  className="font-mono text-[11px] tracking-[0.18em] text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                >
                  INTERCHAIN MESSAGING →
                </Link>
                <Link
                  href="/docs/cross-chain/icm-contracts/overview"
                  className="font-mono text-[11px] tracking-[0.18em] text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                >
                  ICM CONTRACTS →
                </Link>
                <Link
                  href="/docs/avalanche-l1s/precompiles/transaction-allowlist"
                  className="font-mono text-[11px] tracking-[0.18em] text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                >
                  PERMISSIONING PRECOMPILES →
                </Link>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </main>
  );
}
