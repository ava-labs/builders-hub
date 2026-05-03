'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { BookOpen, Check, ChevronRight } from 'lucide-react';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import { boardItem } from '@/components/console/motion';

/**
 * Top-row hero of the EERC Overview.
 *
 * Earlier this card competed for attention with the Journey card and the
 * "Register / Deposit" tile in Row 3 — three CTAs above the fold for the
 * same flow. The new copy keeps a single primary action that flexes with
 * progress (Connect → Register → Deposit), drops the decorative
 * `CiphertextStream` (it was hidden below `md` and the green hero badge
 * already conveys "live"), and replaces the dead `<span>Connect wallet</span>`
 * with a real `useConnectModal()` button so the hero CTA actually works
 * in the disconnected state.
 *
 * The "Live on Fuji" pill that used to sit in this card has been removed
 * because `CanonicalDeploymentCard` already shows the chain badge — they
 * were stacked one below the other above the fold.
 */
interface HeroCardProps {
  address: string | undefined;
  isRegistered: boolean | null;
  hasIdentity: boolean;
  className?: string;
}

export function HeroCard({ address, isRegistered, hasIdentity, className }: HeroCardProps) {
  const { openConnectModal } = useConnectModal();
  const ctaHref = !address
    ? undefined
    : !isRegistered
      ? '/console/encrypted-erc/register'
      : '/console/encrypted-erc/deposit';
  const ctaLabel = !address ? 'Connect wallet' : !isRegistered ? 'Register to start' : 'Deposit & encrypt';

  return (
    <motion.div className={className ?? 'md:col-span-6 p-px'} variants={boardItem}>
      <div
        className="group relative h-full rounded-2xl border border-zinc-700 bg-zinc-900 px-5 py-4 overflow-hidden transition-all duration-200 hover:border-zinc-600"
        style={{
          boxShadow: 'inset 0 1px 0 0 rgba(255,255,255,0.06), 0 2px 8px rgba(0,0,0,0.15), 0 8px 24px rgba(0,0,0,0.1)',
        }}
      >
        <div className="relative flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-white/[0.08] flex items-center justify-center shrink-0 transition-colors group-hover:bg-white/[0.14]">
            <svg
              className="lock-shackle w-5 h-5 text-emerald-400"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
            </svg>
          </div>

          <div className="flex-1 min-w-0">
            {hasIdentity && (
              <div className="flex items-center gap-2 mb-1.5">
                <span className="inline-flex items-center gap-1 text-[10px] text-zinc-500 font-mono">
                  <Check className="w-3 h-3 text-emerald-400" />
                  BJJ cached
                </span>
              </div>
            )}
            <h1 className="text-lg md:text-xl font-semibold text-white mb-1 leading-tight">
              Private balances, <span className="text-emerald-400">public accountability.</span>
            </h1>
            <p className="text-xs text-zinc-400 max-w-xl leading-relaxed mb-3">
              Encrypted balances and transfers, with one designated auditor key for compliance. Built on BabyJubJub
              ElGamal + Groth16 zk-SNARKs.
            </p>

            <div className="flex items-center gap-2 flex-wrap">
              {ctaHref ? (
                <Link
                  href={ctaHref}
                  className="inline-flex items-center gap-1.5 bg-emerald-400 text-zinc-900 hover:bg-emerald-300 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                >
                  {ctaLabel}
                  <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => openConnectModal?.()}
                  disabled={!openConnectModal}
                  className="inline-flex items-center gap-1.5 bg-emerald-400 text-zinc-900 hover:bg-emerald-300 disabled:opacity-60 disabled:cursor-not-allowed px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                >
                  {ctaLabel}
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              )}
              <Link
                href="/academy/encrypted-erc"
                className="inline-flex items-center gap-1.5 border border-zinc-700 hover:border-zinc-600 text-zinc-300 hover:text-white px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors"
              >
                <BookOpen className="w-3 h-3" />
                Learn the protocol
              </Link>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
