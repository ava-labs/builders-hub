'use client';

import Link from 'next/link';
import {
  ArrowUpDown,
  BarChart3,
  ChevronRight,
  MessagesSquare,
  Settings,
  Users,
  Wallet,
} from 'lucide-react';
import type { CombinedL1 } from '../_lib/types';

interface QuickAction {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  href: string;
  external?: boolean;
}

// Section heading + tile grid rendered without a Card shell. Wrapping six
// rectangular tiles inside another rectangular Card just stacks borders
// inside borders; the heading + bare grid reads cleaner and lets the tiles
// breathe.
function QuickActionsSection({
  actions,
}: {
  actions: QuickAction[];
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5">
      {actions.map((a) => (
        <QuickActionTile key={a.title} action={a} />
      ))}
    </div>
  );
}

export function QuickActionsCard({ l1 }: { l1: CombinedL1 }) {
  return <QuickActionsSection actions={buildQuickActions(l1)} />;
}

// Reduced detail view for wallet-only L1s — no managed-node fleet to show, so
// surface the most useful next-step actions instead. Reuses the same
// QuickActionTile as managed L1s for consistency; faucet target picks
// external URL (Echo / Dispatch / Dexalot, etc.) when set.
export function WalletOnlyActions({ l1 }: { l1: CombinedL1 }) {
  const actions: QuickAction[] = [
    {
      icon: Users,
      title: 'Add Validator',
      description: 'Register a new validator.',
      href: '/console/permissioned-l1s/add-validator',
    },
    {
      icon: BarChart3,
      title: 'Validator Set',
      description: 'View the current validator set.',
      href: '/console/layer-1/validator-set',
    },
    {
      icon: Settings,
      title: 'Fee Parameters',
      description: 'Configure gas, fees.',
      href: '/console/l1-tokenomics/fee-manager',
    },
    {
      icon: MessagesSquare,
      title: 'Configure ICM',
      description: 'Set up cross-chain messaging.',
      href: '/console/icm/setup',
    },
    {
      icon: ArrowUpDown,
      title: 'Setup Bridge',
      description: 'Enable token transfers.',
      href: '/console/ictt/setup',
    },
  ];
  const faucet = faucetAction(l1);
  if (faucet) actions.push(faucet);

  return <QuickActionsSection actions={actions} />;
}

function buildQuickActions(l1: CombinedL1): QuickAction[] {
  const actions: QuickAction[] = [
    {
      icon: Users,
      title: 'Add Validator',
      description: 'Register a new validator to your L1.',
      href: '/console/permissioned-l1s/add-validator',
    },
    {
      icon: BarChart3,
      title: 'Validator Set',
      description: 'View the current validator set.',
      href: '/console/layer-1/validator-set',
    },
    {
      icon: Settings,
      title: 'Fee Parameters',
      description: 'Configure gas, fees, and permissions.',
      href: '/console/l1-tokenomics/fee-manager',
    },
  ];
  if (l1.teleporterRegistryAddress) {
    actions.push({
      icon: MessagesSquare,
      title: 'ICM',
      description: 'Manage cross-chain messaging.',
      href: '/console/icm/setup',
    });
  }
  if (l1.wrappedTokenAddress) {
    actions.push({
      icon: ArrowUpDown,
      title: 'Token Bridge',
      description: 'Manage token transfers.',
      href: '/console/ictt/setup',
    });
  }
  const faucet = faucetAction(l1);
  if (faucet) actions.push(faucet);
  return actions;
}

// Pick the right faucet target based on what the L1's wallet metadata
// advertises: external URL takes precedence (well-known L1s like Echo /
// Dispatch / Dexalot point at Core's testnet faucet); otherwise a managed
// Builder Hub testnet flag tells us to use the in-console faucet.
//
// For a custom user-deployed L1 with neither flag set, the in-console
// faucet drops AVAX to the user's address on the C-Chain — that doesn't
// help the user get the L1's native token on the L1 itself, so we omit
// the action entirely instead of pointing at the wrong faucet.
function faucetAction(l1: CombinedL1): QuickAction | null {
  if (l1.externalFaucetUrl) {
    return {
      icon: Wallet,
      title: 'Get Test Tokens',
      description: `External faucet for ${l1.coinName ?? l1.chainName}.`,
      href: l1.externalFaucetUrl,
      external: true,
    };
  }
  if (l1.hasBuilderHubFaucet) {
    return {
      icon: Wallet,
      title: 'Get Test Tokens',
      description: 'Request tokens from the in-console faucet.',
      href: '/console/primary-network/faucet',
    };
  }
  return null;
}

function QuickActionTile({ action }: { action: QuickAction }) {
  const Body = (
    <div className="rounded-lg border bg-card px-3 py-2.5 hover:bg-accent/40 hover:border-foreground/20 hover:shadow-sm transition-all duration-200 h-full">
      <div className="flex items-start gap-3">
        <div className="p-1.5 rounded-md bg-muted group-hover:bg-foreground/[0.08] transition-colors">
          <action.icon className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
        </div>
        <div className="flex-1">
          <h4 className="font-medium text-foreground text-sm">{action.title}</h4>
          <p className="text-xs text-muted-foreground">{action.description}</p>
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all mt-1" />
      </div>
    </div>
  );

  if (action.external) {
    return (
      <a
        href={action.href}
        target="_blank"
        rel="noopener noreferrer"
        className="group block"
        aria-label={`${action.title} (opens in a new tab)`}
      >
        {Body}
      </a>
    );
  }
  return (
    <Link href={action.href} className="group block" aria-label={action.title}>
      {Body}
    </Link>
  );
}
