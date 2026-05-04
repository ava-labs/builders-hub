'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  ArrowUpDown,
  BarChart3,
  Check,
  ChevronRight,
  FileCode,
  MessagesSquare,
  Settings,
  Users,
  Wallet,
} from 'lucide-react';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils';
import type { CombinedL1 } from '../_lib/types';
import { getAddValidatorPath, type ValidatorManagerKind } from '../_lib/validator-manager-routing';

interface QuickAction {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  /** When set, the tile renders as an anchor/link. Mutually exclusive with onClick. */
  href?: string;
  /** When set, the tile renders as a button. Mutually exclusive with href. */
  onClick?: () => void | Promise<void>;
  external?: boolean;
  /** Renders the tile dimmed and non-interactive (no click). Used for the
   *  "genesis not available" state of the Copy Genesis tile so the user
   *  still sees the affordance with an explanatory description. */
  disabled?: boolean;
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

export function QuickActionsCard({
  l1,
  validatorManagerKind,
}: {
  l1: CombinedL1;
  validatorManagerKind?: ValidatorManagerKind | null;
}) {
  return <QuickActionsSection actions={buildQuickActions(l1, validatorManagerKind ?? null)} />;
}

// Reduced detail view for wallet-only L1s — no managed-node fleet to show, so
// surface the most useful next-step actions instead. Reuses the same
// QuickActionTile as managed L1s for consistency; faucet target picks
// external URL (Echo / Dispatch / Dexalot, etc.) when set.
export function WalletOnlyActions({
  l1,
  validatorManagerKind,
}: {
  l1: CombinedL1;
  validatorManagerKind?: ValidatorManagerKind | null;
}) {
  const actions: QuickAction[] = [
    {
      icon: Users,
      title: 'Add Validator',
      description: 'Register a new validator.',
      href: getAddValidatorPath(validatorManagerKind ?? null, l1),
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
  const genesis = copyGenesisAction(l1);
  if (genesis) actions.push(genesis);

  return <QuickActionsSection actions={actions} />;
}

export function PrimaryNetworkActions({ l1 }: { l1: CombinedL1 }) {
  const actions: QuickAction[] = [
    {
      icon: Wallet,
      title: l1.isTestnet ? 'Get Test AVAX' : 'C/P-Chain Bridge',
      description: l1.isTestnet ? 'Request Fuji AVAX for development.' : 'Transfer AVAX between C-Chain and P-Chain.',
      href: l1.isTestnet ? '/console/primary-network/faucet' : '/console/primary-network/c-p-bridge',
    },
    {
      icon: BarChart3,
      title: 'Validator Lookup',
      description: 'Search Primary Network validators.',
      href: '/console/primary-network/validator-lookup',
    },
    {
      icon: Settings,
      title: 'Node Setup',
      description: 'Run an AvalancheGo node.',
      href: '/console/primary-network/node-setup',
    },
  ];
  const faucet = faucetAction(l1);
  if (l1.isTestnet && faucet?.external) actions.push(faucet);
  return <QuickActionsSection actions={actions} />;
}

function buildQuickActions(l1: CombinedL1, validatorManagerKind: ValidatorManagerKind | null): QuickAction[] {
  const actions: QuickAction[] = [
    {
      icon: Users,
      title: 'Add Validator',
      description: 'Register a new validator to your L1.',
      href: getAddValidatorPath(validatorManagerKind, l1),
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
  const genesis = copyGenesisAction(l1);
  if (genesis) actions.push(genesis);
  return actions;
}

// Tile factory for the "Copy Genesis" action. Returns the action only
// when we have genesis JSON on file for this L1 — wallet entries created
// before this field existed and any chain imported without a paste have
// no genesis stored, so showing a permanently-disabled tile would
// mislead the user. The button-on-the-hero variant used to render with a
// "not available" tooltip; in the Tools section the cleaner choice is to
// hide the tile entirely.
function copyGenesisAction(l1: CombinedL1): QuickAction | null {
  const genesis = typeof l1.genesisData === 'string' ? l1.genesisData.trim() : '';
  if (!genesis) return null;
  return {
    icon: FileCode,
    title: 'Copy Genesis',
    description: 'Copy this L1’s genesis JSON to clipboard.',
    onClick: async () => {
      try {
        await navigator.clipboard.writeText(genesis);
        toast.success('Genesis JSON copied', undefined, { id: 'copy-genesis' });
      } catch (err) {
        toast.error(
          'Could not copy',
          err instanceof Error ? err.message : 'Clipboard unavailable',
          { id: 'copy-genesis' },
        );
      }
    },
  };
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
  // Tiles with onClick (e.g. Copy Genesis) flash a check icon for ~1.4s
  // after a successful click so the user gets a glance-level confirmation
  // even when the toast is dismissed quickly. Stays on the action's own
  // tile — global state would be wrong if multiple action tiles ever
  // shared an icon.
  const [didRun, setDidRun] = useState(false);
  const isClickAction = !action.href && !!action.onClick;

  const Icon = didRun && isClickAction ? Check : action.icon;
  const iconClass = didRun && isClickAction
    ? 'w-4 h-4 text-emerald-500'
    : 'w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors';

  const handleClick = async () => {
    if (action.disabled || !action.onClick) return;
    try {
      await action.onClick();
      setDidRun(true);
      window.setTimeout(() => setDidRun(false), 1400);
    } catch {
      // Tile keeps its idle state on failure — the action's own onClick
      // is responsible for surfacing the error (toast). No re-throw so
      // we don't trip the React error boundary on a copy-failed.
    }
  };

  const Body = (
    // Tiny -1px lift on hover unifies the interactive-card affordance
    // across the dashboard (Setup checklist rows, NetworkDetailsCard
    // items, and Tools tiles all read the same way).
    <div
      className={cn(
        'rounded-lg border bg-card px-3 py-2.5 transition-all duration-150 h-full',
        action.disabled
          ? 'opacity-60 cursor-not-allowed'
          : 'hover:bg-accent/40 hover:border-foreground/20 hover:shadow-sm hover:-translate-y-px',
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'p-1.5 rounded-md bg-muted transition-colors',
            !action.disabled && 'group-hover:bg-foreground/[0.08]',
          )}
        >
          <Icon className={iconClass} />
        </div>
        <div className="flex-1">
          <h4 className="font-medium text-foreground text-sm">{action.title}</h4>
          <p className="text-xs text-muted-foreground">{action.description}</p>
        </div>
        <ChevronRight
          className={cn(
            'w-4 h-4 text-muted-foreground transition-all mt-1',
            action.disabled
              ? 'opacity-0'
              : 'opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5',
          )}
        />
      </div>
    </div>
  );

  if (isClickAction) {
    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={action.disabled}
        className="group block w-full text-left disabled:cursor-not-allowed"
        aria-label={action.title}
      >
        {Body}
      </button>
    );
  }

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
    <Link href={action.href ?? '#'} className="group block" aria-label={action.title}>
      {Body}
    </Link>
  );
}
