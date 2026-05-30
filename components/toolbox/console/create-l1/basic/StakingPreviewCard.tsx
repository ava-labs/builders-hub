'use client';

import { motion } from 'framer-motion';
import { Coins, Cpu, Layers, Sparkles } from 'lucide-react';

/**
 * "Here's what you'll get" callout shown when the user picks Proof of
 * Stake in Quick L1 Basic Setup.
 *
 * Quick L1's ERC20-PoS path always has the orchestrator deploy a fresh
 * ExampleERC20 + reward calculator + ERC20TokenStakingManager on Fuji
 * C-Chain — users don't pick or supply a staking token. This card just
 * makes that promise visible at the moment of decision so the user
 * knows what addresses to expect on the recap screen.
 *
 * Previously this card hosted a wallet token list; we cut that because
 * the user's question at this point is "what will the deploy do?" not
 * "what do I already have?". Simpler card, single-screen content, no
 * Glacier round-trip on mount.
 */

// Component still accepts walletAddress for API compatibility with the
// form's call site even though we no longer fetch anything. Prefixed
// underscore tells eslint we know it's unused.
export interface StakingPreviewCardProps {
  walletAddress?: string;
}

export default function StakingPreviewCard(_props: StakingPreviewCardProps) {
  // Three artifacts the orchestrator deploys, in deploy order
  // (ExampleERC20 → reward calculator → staking manager init). Listed
  // in the same order they appear in the progress timeline so users
  // can map this preview to the live deploy steps below.
  const items: Array<{ icon: React.ReactNode; title: string; sub: string }> = [
    {
      icon: <Coins className="h-3.5 w-3.5" />,
      title: 'Example ERC20 staking token',
      sub: 'Fresh deploy on Fuji C-Chain. Open mint — top up validators with test stake any time.',
    },
    {
      icon: <Cpu className="h-3.5 w-3.5" />,
      title: 'Example reward calculator',
      sub: 'Pays out validator rewards using the icm-contracts reference formula.',
    },
    {
      icon: <Layers className="h-3.5 w-3.5" />,
      title: 'ERC20TokenStakingManager',
      sub: 'Owns the core Validator Manager. Anyone holding the staking token can validate.',
    },
  ];

  return (
    // Explicit initial/animate (not inherited variants) so the card
    // animates correctly when it mounts post-toggle, after the form's
    // initial stagger cascade has already fired.
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 240, damping: 24 }}
      className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/40 overflow-hidden h-fit"
    >
      <div className="px-5 py-3 border-b border-zinc-100 dark:border-zinc-900 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">We&apos;ll deploy your staking setup</h3>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5 leading-snug">
            All three contracts ship to Fuji C-Chain. Addresses appear on the recap when the deploy finishes.
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-[10px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-500 shrink-0">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
          Fuji C-Chain
        </span>
      </div>

      <div className="px-3.5 pt-3 pb-3.5">
        <div className="flex items-center gap-1.5 mb-2 text-[10px] font-semibold uppercase tracking-wider text-primary">
          <Sparkles className="h-3 w-3" />
          Included with PoS
        </div>
        <ul className="space-y-1.5">
          {items.map((item) => (
            <li key={item.title} className="flex items-start gap-2.5">
              <span className="shrink-0 mt-0.5 flex h-5 w-5 items-center justify-center rounded-md bg-primary/10 text-primary">
                {item.icon}
              </span>
              <div className="min-w-0">
                <div className="text-[12.5px] font-medium text-zinc-900 dark:text-zinc-100 leading-tight">
                  {item.title}
                </div>
                <div className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-snug mt-0.5">{item.sub}</div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </motion.div>
  );
}
