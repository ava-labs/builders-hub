import {
  ArrowUpDown,
  Layers,
  MessagesSquare,
  Server,
  Settings,
} from 'lucide-react';
import type { CombinedL1 } from './types';

// Setup steps + completion summary — single source of truth shared between
// SetupProgressCard (the full checklist) and NextActionBar (the inline CTA
// above the stats grid). Both views need to agree on what "the next step" is.
export type SetupStep = {
  key: string;
  label: string;
  shortLabel: string;
  ctaLabel: string;
  completed: boolean;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
};

export function getSetupSteps(l1: CombinedL1): SetupStep[] {
  const hasNode = (l1.nodes ?? []).some((n) => n.status === 'active');
  const hasValidatorManager = !!l1.validatorManagerAddress;
  const hasIcm = !!l1.teleporterRegistryAddress;
  const hasBridge = !!l1.wrappedTokenAddress;

  const steps: SetupStep[] = [
    {
      key: 'created',
      label: 'L1 created',
      shortLabel: 'L1 created',
      ctaLabel: 'Create L1',
      completed: true,
      href: '/console/create-l1',
      icon: Layers,
    },
  ];

  // The "provision a managed node" step is only meaningful for L1s that
  // Builder Hub manages. Wallet-added L1s run on whatever infra the owner
  // chose, so dropping the step keeps their checklist accurate (4 items
  // they can actually act on, not 5 with one that doesn't apply).
  if (l1.source === 'managed') {
    steps.push({
      key: 'node',
      label: 'Managed node provisioned',
      shortLabel: 'Provision a managed node',
      ctaLabel: 'Provision a node',
      completed: hasNode,
      href: '/console/testnet-infra/nodes',
      icon: Server,
    });
  }

  steps.push(
    {
      key: 'vm',
      label: 'Validator Manager configured',
      shortLabel: 'Configure Validator Manager',
      ctaLabel: 'Configure',
      completed: hasValidatorManager,
      href: '/console/permissioned-l1s/validator-manager-setup',
      icon: Settings,
    },
    {
      key: 'icm',
      label: 'Interchain Messaging (ICM)',
      shortLabel: 'Set up Interchain Messaging',
      ctaLabel: 'Set up ICM',
      completed: hasIcm,
      href: '/console/icm/setup',
      icon: MessagesSquare,
    },
    {
      key: 'bridge',
      label: 'Token Bridge',
      shortLabel: 'Set up the token bridge',
      ctaLabel: 'Set up bridge',
      completed: hasBridge,
      href: '/console/ictt/setup',
      icon: ArrowUpDown,
    },
  );

  return steps;
}

export function setupSummary(l1: CombinedL1): {
  steps: SetupStep[];
  done: number;
  pct: number;
  nextStep: SetupStep | null;
} {
  const steps = getSetupSteps(l1);
  const done = steps.filter((s) => s.completed).length;
  const pct = Math.round((done / steps.length) * 100);
  const nextStep = steps.find((s) => !s.completed) ?? null;
  return { steps, done, pct, nextStep };
}
