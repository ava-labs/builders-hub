"use client";

import { useEffect, useState } from "react";
import { LayoutGroup, motion } from "framer-motion";
import { faLinkSlash } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

const steps = [
  {
    eyebrow: "Last accepted L1 block",
    title: "L1 is pinned to P-Chain height X",
    body: "The last accepted L1 block references height X. ProposerVM will use that parent context to choose who may build next.",
    markerIndex: 0,
  },
  {
    eyebrow: "P-Chain advances",
    title: "The P-Chain moves to X+1",
    body: "The Primary Network keeps accepting P-Chain blocks even while the L1 is halted. The L1 parent still points at X.",
    markerIndex: 1,
  },
  {
    eyebrow: "P-Chain advances",
    title: "The P-Chain moves to X+2",
    body: "More P-Chain height passes, but no L1 block has been accepted to update the L1's referenced height.",
    markerIndex: 2,
  },
  {
    eyebrow: "Balance top-up",
    title: "The balance top-up lands at X+N",
    body: "Registered validators are reactivated at the current P-Chain height, not retroactively at X.",
    markerIndex: 3,
  },
  {
    eyebrow: "Next block attempt",
    title: "ProposerVM still checks height X",
    body: "The next L1 block must be built from the last accepted parent, so proposer selection still uses X.",
    markerIndex: 3,
  },
  {
    eyebrow: "Result",
    title: "ProposerVM still sees all registered validators inactive at block height X",
    body: "At X, every registered validator is still inactive. The top-up exists at X+N, but the L1 cannot reference X+N until a new block is accepted.",
    markerIndex: 3,
  },
];

const pchainHeights = ["X", "X+1", "X+2", "X+N"];
const STEP_DURATION_MS = 5200;

function ArrowSegment({ active }: { active: boolean }) {
  return (
    <svg className="h-6 w-full" viewBox="0 0 80 24" fill="none" aria-hidden="true">
      <motion.path
        d="M4 12H70"
        strokeLinecap="round"
        initial={false}
        animate={{
          stroke: active ? "rgb(16 185 129)" : "rgb(161 161 170)",
          opacity: active ? 0.9 : 0.45,
        }}
        strokeWidth="2"
      />
      <motion.path
        d="M62 5L72 12L62 19"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={false}
        animate={{
          stroke: active ? "rgb(16 185 129)" : "rgb(161 161 170)",
          opacity: active ? 0.9 : 0.45,
        }}
        strokeWidth="2"
      />
    </svg>
  );
}

function StatusPill({
  label,
  active,
  tone,
}: {
  label: string;
  active: boolean;
  tone: "red" | "amber" | "emerald" | "sky";
}) {
  const tones = {
    red: "border-red-500/50 bg-red-500/10 text-red-600 dark:text-red-300",
    amber: "border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    emerald: "border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    sky: "border-sky-500/50 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  };

  return (
    <motion.div
      animate={{ opacity: active ? 1 : 0.45, scale: active ? 1 : 0.98 }}
      className={`rounded-md border px-2 py-1 text-[11px] font-medium ${tones[tone]}`}
    >
      {label}
    </motion.div>
  );
}

function HaltBadge({ active }: { active: boolean }) {
  return (
    <motion.div
      animate={{ opacity: active ? 1 : 0.45, scale: active ? 1 : 0.98 }}
      className="flex min-h-20 min-w-28 items-center justify-center rounded-md border border-red-300 bg-red-50 px-4 py-3 text-red-700 dark:border-red-500/35 dark:bg-red-500/10 dark:text-red-300"
      aria-label="L1 block production halted"
    >
      <FontAwesomeIcon icon={faLinkSlash} className="h-10 w-10" />
    </motion.div>
  );
}

export function HaltedBlockProductionDiagram() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setStep((current) => (current + 1) % steps.length);
    }, STEP_DURATION_MS);

    return () => window.clearInterval(timer);
  }, []);

  const markerIndex = steps[step].markerIndex;
  const pChainAdvanced = step >= 1;
  const topUpVisible = step >= 3;
  const proposerCheckVisible = step >= 4;
  const haltVisible = step >= 5;

  return (
    <div className="my-8 overflow-hidden rounded-md border border-zinc-200 bg-white text-zinc-950 shadow-sm dark:border-white/10 dark:bg-zinc-950 dark:text-white">
      <div className="border-b border-zinc-200 px-4 py-3 dark:border-white/10">
        <div className="text-xs font-mono uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
          Balance top-up vs proposer selection
        </div>
        <div className="mt-1 text-lg font-semibold">
          The top-up lands at X+N, but the L1 is still trying to build from X
        </div>
      </div>

      <div className="grid gap-5 p-4 lg:grid-cols-[1fr_280px]">
        <div className="min-w-0 space-y-6">
          <div>
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className="text-xs font-mono uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                P-Chain time
              </span>
              <StatusPill
                label={topUpVisible ? "Top-up accepted at current height" : "P-Chain height is advancing"}
                active={pChainAdvanced || topUpVisible}
                tone={topUpVisible ? "emerald" : "sky"}
              />
            </div>

            <div className="relative rounded-md border border-zinc-200 bg-zinc-50 px-4 py-5 dark:border-white/10 dark:bg-white/[0.03]">
              <LayoutGroup>
                <div className="grid grid-cols-[56px_minmax(28px,1fr)_56px_minmax(28px,1fr)_56px_minmax(28px,1fr)_56px] items-start gap-2">
                  {pchainHeights.map((height, index) => {
                    const isPinned = index === 0;
                    const isTopUp = index === pchainHeights.length - 1;
                    const markerHere = markerIndex === index;
                    const active = isPinned || (pChainAdvanced && index > 0 && markerIndex >= index);

                    return (
                      <div key={height} className="contents">
                        <div className="flex flex-col items-center gap-2">
                          <motion.div
                            animate={{
                              borderColor: active
                                ? isPinned
                                  ? "rgb(244 63 94)"
                                  : "rgb(16 185 129)"
                                : "rgba(113,113,122,0.35)",
                              backgroundColor: active
                                ? isPinned
                                  ? "rgba(244,63,94,0.12)"
                                  : "rgba(16,185,129,0.12)"
                                : "rgba(113,113,122,0.08)",
                            }}
                            className="relative flex h-12 w-12 items-center justify-center rounded-md border text-sm font-bold"
                          >
                            {height}
                            {markerHere && (
                              <motion.div
                                layoutId="l1-top-up-marker"
                                className="absolute -bottom-1.5 -right-1.5 h-3 w-3 rounded-full bg-emerald-500 shadow-[0_0_18px_rgba(16,185,129,0.8)]"
                                transition={{ duration: 1.8, ease: "easeInOut" }}
                              />
                            )}
                          </motion.div>
                          <span className="max-w-[72px] text-center text-[10px] leading-tight text-zinc-500 dark:text-zinc-400">
                            {isPinned ? "last block produced" : isTopUp ? "balance top-up" : "passes"}
                          </span>
                        </div>
                        {index < pchainHeights.length - 1 && (
                          <div className="pt-3">
                            <ArrowSegment active={pChainAdvanced && markerIndex > index} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </LayoutGroup>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-[1fr_80px_1fr]">
            <div className="rounded-md border border-red-200 bg-red-50 p-4 dark:border-red-500/30 dark:bg-red-500/10">
              <div className="text-xs font-mono uppercase tracking-[0.16em] text-red-700 dark:text-red-300">
                L1 parent
              </div>
              <div className="mt-2 text-sm font-semibold">Last accepted block</div>
              <div className="mt-3 rounded-md border border-red-300 bg-white p-3 font-mono text-xs dark:border-red-500/40 dark:bg-zinc-950">
                pChainHeight: X
              </div>
            </div>

            <div className="flex items-center justify-center">
              <motion.div
                animate={{
                  opacity: proposerCheckVisible ? 1 : 0.35,
                  x: proposerCheckVisible ? [0, 8, 0] : 0,
                }}
                transition={{ duration: 1.2, repeat: proposerCheckVisible ? Infinity : 0 }}
                className="hidden h-px w-full bg-red-400 md:block"
              />
              <div className="h-8 w-px bg-red-400 md:hidden" />
            </div>

            <div className="rounded-md border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/30 dark:bg-amber-500/10">
              <div className="text-xs font-mono uppercase tracking-[0.16em] text-amber-700 dark:text-amber-300">
                ProposerVM check
              </div>
              <div className="mt-2 text-sm font-semibold">Select proposer from height X</div>
              <div className="mt-3 flex flex-wrap gap-2">
                <StatusPill label="all registered inactive at X" active={proposerCheckVisible} tone="red" />
                <StatusPill label="top-up only at X+N" active={topUpVisible} tone="emerald" />
              </div>
            </div>
          </div>

          <motion.div
            animate={{
              opacity: haltVisible ? 1 : 0.45,
              borderColor: haltVisible ? "rgba(244,63,94,0.55)" : "rgba(113,113,122,0.25)",
            }}
            className="rounded-md border bg-zinc-50 p-4 dark:bg-white/[0.03]"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-xs font-mono uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                  Result
                </div>
                <div className="mt-1 text-sm font-semibold">
                  ProposerVM still sees all registered validators inactive at block height X - L1 can't produce a new block
                </div>
              </div>
              <HaltBadge active={haltVisible} />
            </div>
          </motion.div>
        </div>

        <div className="rounded-md border border-zinc-200 bg-zinc-50 p-4 dark:border-white/10 dark:bg-white/[0.03]">
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
          >
            <div className="text-xs font-mono uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
              {steps[step].eyebrow}
            </div>
            <div className="mt-2 text-base font-semibold">{steps[step].title}</div>
            <p className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
              {steps[step].body}
            </p>
          </motion.div>

          <div className="mt-5 grid grid-cols-6 gap-2">
            {steps.map((item, index) => (
              <button
                key={item.eyebrow}
                type="button"
                aria-label={`Show step ${index + 1}`}
                onClick={() => setStep(index)}
                className="h-1.5 rounded-full bg-zinc-200 dark:bg-white/15"
              >
                <motion.div
                  animate={{ width: index === step ? "100%" : "0%" }}
                  transition={{ duration: index === step ? STEP_DURATION_MS / 1000 - 0.1 : 0.15, ease: "linear" }}
                  className="h-full rounded-full bg-sky-500"
                />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
