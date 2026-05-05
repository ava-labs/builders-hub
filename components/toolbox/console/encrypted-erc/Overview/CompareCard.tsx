'use client';

import React, { memo, useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, EyeOff } from 'lucide-react';
import { boardItem } from '@/components/console/motion';
import { TileShell } from './TileShell';

/**
 * Side-by-side comparison of a public ERC20 transfer event vs. an
 * encrypted ERC `PrivateTransfer` event.
 *
 * Now full-width on the Overview, the two payloads sit as a paired
 * column at `md+` so the matching `0xALICE → 0xBOB` reads at a glance
 * and the only contrast on the row is the amount/auditorPCT swap.
 *
 * The encrypted payload's auditorPCT placeholder is replaced with a
 * tiny rolling-hex component (`<RotatingBytes />`) so the demo feels
 * live — the bytes flip every 900ms, matching the cipher language of
 * the hero. The component is `memo`-isolated so its setInterval-driven
 * re-renders don't cascade into this card's parents.
 */
interface CompareCardProps {
  className?: string;
}

export function CompareCard({ className }: CompareCardProps) {
  return (
    <motion.div className={className} variants={boardItem}>
      <TileShell className="h-full">
        <div className="mb-4 flex items-center gap-2">
          <EyeOff className="h-4 w-4 text-zinc-500 dark:text-zinc-400" strokeWidth={2} />
          <h3 className="text-sm font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
            What a block explorer sees
          </h3>
          <Link
            href="/academy/encrypted-erc"
            className="ml-auto inline-flex items-center gap-1 text-[11px] font-medium text-zinc-500 transition-colors hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50"
          >
            Deep dive
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <PayloadPanel
            kind="public"
            label="Public ERC20"
            payload={
              <>
                Transfer(0xALICE, 0xBOB, <span className="text-rose-500 dark:text-rose-400">1500000000</span>)
              </>
            }
          />
          <PayloadPanel
            kind="encrypted"
            label="Encrypted ERC"
            payload={
              <>
                PrivateTransfer(0xALICE, 0xBOB,
                <br />
                auditorPCT=
                <RotatingBytes />)
              </>
            }
          />
        </div>

        <p className="mt-4 text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
          Same sender and recipient are visible both times — eERC doesn't obfuscate <em>who</em>, only <em>how much</em>
          . The 7-element auditorPCT is Poseidon-encrypted; only the auditor's key can reveal the amount.
        </p>
      </TileShell>
    </motion.div>
  );
}

interface PayloadPanelProps {
  kind: 'public' | 'encrypted';
  label: string;
  payload: React.ReactNode;
}

function PayloadPanel({ kind, label, payload }: PayloadPanelProps) {
  const isEncrypted = kind === 'encrypted';
  return (
    <div
      className={
        isEncrypted
          ? 'rounded-xl border border-emerald-200/80 bg-emerald-50/60 p-3 ring-1 ring-emerald-500/[0.04] dark:border-emerald-900/50 dark:bg-emerald-900/10 dark:ring-emerald-400/[0.06]'
          : 'rounded-xl border border-zinc-200/80 bg-zinc-50/60 p-3 ring-1 ring-zinc-900/[0.02] dark:border-zinc-800 dark:bg-zinc-900/40 dark:ring-white/[0.02]'
      }
    >
      <div
        className={
          isEncrypted
            ? 'mb-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-400'
            : 'mb-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-500'
        }
      >
        {label}
      </div>
      <code className="block break-all font-mono text-[11px] leading-relaxed text-zinc-700 dark:text-zinc-300">
        {payload}
      </code>
    </div>
  );
}

/**
 * Tiny "auditorPCT bytes are live" indicator. Memoised + isolated so the
 * 900ms interval driving its state doesn't ripple into the parent card.
 * Three short hex segments separated by commas — flips one segment per
 * tick so it doesn't feel like a slot machine.
 */
const RotatingBytes = memo(function RotatingBytes() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 900);
    return () => clearInterval(id);
  }, []);

  // Deterministic LCG seeded by `tick` so the value scrolls predictably
  // and is stable across re-renders within a tick.
  const segments = pickSegments(tick);

  return (
    <span className="text-emerald-600 dark:text-emerald-400">
      [{segments[0]},{segments[1]},{segments[2]}]
    </span>
  );
});

function pickSegments(tick: number): string[] {
  let seed = (0x9e3779b1 ^ (tick * 0x85ebca6b)) >>> 0;
  const next = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed;
  };
  const hex = () => next().toString(16).padStart(6, '0').slice(0, 6);
  return [hex(), hex(), hex()];
}
