'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  ArrowRight,
  ArrowUpDown,
  BarChart3,
  Check,
  Copy,
  ExternalLink,
  FileCode,
  MessagesSquare,
  Settings,
  Users,
  Wallet,
} from 'lucide-react';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils';
import type { CombinedL1 } from '@/lib/console/my-l1/types';
import { getAddValidatorPath, type ValidatorManagerKind } from '@/lib/console/my-l1/validator-manager-routing';
import { CELL, GRID } from './chrome';

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

// Hairline door grid: the cells share their borders, like the console home's
// Start grid, so six to eight tools read as one instrument rather than a
// pile of cards.
function QuickActionsSection({ actions }: { actions: QuickAction[] }) {
  return (
    <div className={cn(GRID, 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3')}>
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
      icon: FileCode,
      title: 'Upgrade JSON',
      description: 'Enable precompiles or schedule state upgrades.',
      href: upgradeJsonPath(l1),
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
    {
      icon: FileCode,
      title: 'Upgrade JSON',
      description: 'Enable precompiles or schedule state upgrades.',
      href: upgradeJsonPath(l1),
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
        toast.error('Could not copy', err instanceof Error ? err.message : 'Clipboard unavailable', {
          id: 'copy-genesis',
        });
      }
    },
  };
}

function upgradeJsonPath(l1: CombinedL1): string {
  const params = new URLSearchParams();
  if (l1.subnetId) params.set('subnetId', l1.subnetId);
  if (l1.blockchainId) params.set('blockchainId', l1.blockchainId);
  if (l1.rpcUrl) params.set('rpcUrl', l1.rpcUrl);
  if (l1.chainName) params.set('chainName', l1.chainName);
  params.set('isManaged', l1.source === 'managed' ? 'true' : 'false');
  const query = params.toString();
  return `/console/layer-1/upgrade/select-l1${query ? `?${query}` : ''}`;
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
  const iconClass =
    didRun && isClickAction
      ? 'h-4 w-4 text-emerald-500'
      : 'h-4 w-4 text-zinc-400 transition-colors group-hover/door:text-zinc-900 dark:group-hover/door:text-zinc-100';
  // The top-right mark says what the door does when it isn't a plain in-app link.
  const Mark = action.external ? ExternalLink : isClickAction ? Copy : null;

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
    <div
      className={cn(
        CELL,
        'flex h-full min-h-32 flex-col gap-3 p-5',
        action.disabled && 'cursor-not-allowed opacity-50',
      )}
    >
      <span className="flex items-center justify-between">
        <Icon className={iconClass} />
        {Mark && <Mark className="h-3 w-3 text-zinc-300 dark:text-zinc-600" aria-hidden="true" />}
      </span>
      <span className="mt-auto flex items-center gap-2 text-[15px] font-semibold text-zinc-900 dark:text-zinc-50">
        <span className={cn(!action.disabled && 'underline-offset-4 group-hover/door:underline')}>{action.title}</span>
        {!action.disabled && (
          <ArrowRight className="h-3.5 w-3.5 -translate-x-1 text-[#E6212F] opacity-0 transition-all group-hover/door:translate-x-0 group-hover/door:opacity-100" />
        )}
      </span>
      <span className="text-[13px] leading-relaxed text-zinc-500 dark:text-zinc-400">{action.description}</span>
    </div>
  );

  if (isClickAction) {
    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={action.disabled}
        className="group/door block w-full text-left disabled:cursor-not-allowed"
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
        className="group/door block"
        aria-label={`${action.title} (opens in a new tab)`}
      >
        {Body}
      </a>
    );
  }
  return (
    <Link href={action.href ?? '#'} className="group/door block" aria-label={action.title}>
      {Body}
    </Link>
  );
}
