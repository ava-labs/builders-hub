'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { EyeOff } from 'lucide-react';
import { boardItem } from '@/components/console/motion';
import { TileShell } from './TileShell';

/**
 * Side-by-side comparison of a public ERC20 transfer event vs. an
 * encrypted ERC `PrivateTransfer` event.
 *
 * Kept as the main "teaching aid" card on the Overview because it shows
 * the actual on-chain payload difference — sender/recipient still public,
 * amount replaced with the 7-element auditor PCT. Replaces the
 * (deleted) `ConceptCard`, which described the cryptographic primitives
 * abstractly; that copy is better served by the Academy course already
 * linked from the hero.
 */
interface CompareCardProps {
  className?: string;
}

export function CompareCard({ className }: CompareCardProps) {
  return (
    <motion.div className={className} variants={boardItem}>
      <TileShell className="h-full">
        <div className="flex items-center gap-2 mb-3">
          <EyeOff className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">What a block explorer sees</h3>
        </div>
        <div className="space-y-2.5">
          <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 p-3">
            <div className="text-[10px] uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-1">
              Public ERC20
            </div>
            <code className="block font-mono text-[11px] text-zinc-700 dark:text-zinc-300 break-all">
              Transfer(0xALICE, 0xBOB, <span className="text-red-500">1500000000</span>)
            </code>
          </div>
          <div className="rounded-lg border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/50 dark:bg-emerald-900/10 p-3">
            <div className="text-[10px] uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mb-1">
              Encrypted ERC
            </div>
            <code className="block font-mono text-[11px] text-zinc-700 dark:text-zinc-300 break-all">
              PrivateTransfer(0xALICE, 0xBOB, auditorPCT=
              <span className="text-emerald-600 dark:text-emerald-400">[???,???,???]</span>)
            </code>
          </div>
        </div>
        <p className="mt-3 text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
          Same sender and recipient are visible both times — eERC doesn't obfuscate <em>who</em>, only <em>how much</em>
          . The 7-element auditorPCT is Poseidon-encrypted; only the auditor's key can reveal the amount.
        </p>
      </TileShell>
    </motion.div>
  );
}
