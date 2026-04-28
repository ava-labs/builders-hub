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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { CombinedL1 } from '../_lib/types';

interface QuickAction {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  href: string;
  external?: boolean;
}

export function QuickActionsCard({ l1 }: { l1: CombinedL1 }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Quick Actions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {buildQuickActions(l1).map((a) => (
            <QuickActionTile key={a.title} action={a} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
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
    faucetAction(l1),
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Quick Actions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {actions.map((a) => (
            <QuickActionTile key={a.title} action={a} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function buildQuickActions(l1: CombinedL1): QuickAction[] {
  return [
    {
      icon: Users,
      title: 'Add Validator',
      description: 'Register a new validator to your L1.',
      href: '/console/permissioned-l1s/add-validator',
    },
    {
      icon: ArrowUpDown,
      title: 'Setup Bridge',
      description: 'Enable token transfers to other chains.',
      href: '/console/ictt/setup',
    },
    {
      icon: MessagesSquare,
      title: 'Configure ICM',
      description: 'Set up cross-chain messaging.',
      href: '/console/icm/setup',
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
    faucetAction(l1),
  ];
}

// Pick the right faucet target based on what the L1's wallet metadata
// advertises: external URL takes precedence (well-known L1s like Echo /
// Dispatch / Dexalot point at Core's testnet faucet); otherwise the
// in-console faucet flow handles managed Builder Hub testnets.
function faucetAction(l1: CombinedL1): QuickAction {
  if (l1.externalFaucetUrl) {
    return {
      icon: Wallet,
      title: 'Get Test Tokens',
      description: `External faucet for ${l1.coinName ?? l1.chainName}.`,
      href: l1.externalFaucetUrl,
      external: true,
    };
  }
  return {
    icon: Wallet,
    title: 'Get Test Tokens',
    description: 'Request tokens from the in-console faucet.',
    href: '/console/primary-network/faucet',
  };
}

function QuickActionTile({ action }: { action: QuickAction }) {
  const Body = (
    <div className="p-4 rounded-lg border bg-card hover:bg-accent/40 hover:border-foreground/20 hover:-translate-y-0.5 hover:shadow-sm transition-all duration-200 h-full">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-muted group-hover:bg-foreground/[0.08] transition-colors">
          <action.icon className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
        </div>
        <div className="flex-1">
          <h4 className="font-medium text-foreground text-sm mb-1">{action.title}</h4>
          <p className="text-xs text-muted-foreground">{action.description}</p>
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all mt-1" />
      </div>
    </div>
  );

  if (action.external) {
    return (
      <a href={action.href} target="_blank" rel="noopener noreferrer" className="group block">
        {Body}
      </a>
    );
  }
  return (
    <Link href={action.href} className="group block">
      {Body}
    </Link>
  );
}
