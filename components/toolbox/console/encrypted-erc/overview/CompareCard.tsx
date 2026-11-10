'use client';

import React, { memo, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { ArrowLink, EYEBROW, FRAME } from '../shared/ui';

/**
 * A public ERC20 transfer event next to an encrypted ERC `PrivateTransfer`
 * event. The sender and recipient read the same in both; only the amount
 * becomes ciphertext. The auditorPCT bytes tick so the demo reads as live.
 */
interface CompareCardProps {
  className?: string;
}

export function CompareCard({ className }: CompareCardProps) {
  return (
    <section className={cn(FRAME, className)}>
      <div className="flex min-h-9 items-center justify-between gap-4 border-b border-zinc-200 px-4 py-2 dark:border-zinc-800">
        <p className={EYEBROW}>What a block explorer sees</p>
        <ArrowLink href="/academy/encrypted-erc" className="text-[10.5px]">
          Deep dive
        </ArrowLink>
      </div>

      <div className="grid grid-cols-1 gap-px border-b border-zinc-200 bg-zinc-200 md:grid-cols-2 dark:border-zinc-800 dark:bg-zinc-800">
        <PayloadPanel
          label="Public ERC20"
          payload={
            <>
              Transfer(0xALICE, 0xBOB, <span className="text-[#E6212F]">1500000000</span>)
            </>
          }
        />
        <PayloadPanel
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

      <p className="px-4 py-3 text-[13px] leading-relaxed text-zinc-500 dark:text-zinc-400">
        Both show who sent to whom. Encrypted ERC hides only how much. The amount is Poseidon-encrypted, and only the
        auditor&apos;s key can read it.
      </p>
    </section>
  );
}

function PayloadPanel({ label, payload }: { label: string; payload: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 bg-white p-4 dark:bg-zinc-950">
      <span className={EYEBROW}>{label}</span>
      <code className="block break-all font-mono text-[12px] leading-relaxed text-zinc-800 dark:text-zinc-200">
        {payload}
      </code>
    </div>
  );
}

/** Memoised so the 900ms interval driving its state doesn't ripple into the parent card. */
const RotatingBytes = memo(function RotatingBytes() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 900);
    return () => clearInterval(id);
  }, []);

  const segments = pickSegments(tick);

  return (
    <span className="text-zinc-400 dark:text-zinc-500">
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
