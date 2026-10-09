'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import type { StakingType } from '@/components/toolbox/contexts/ValidatorManagerContext';

type OwnerType = 'PoAManager' | 'StakingManager' | 'EOA' | null;

interface ManagerTypeBadgeProps {
  ownerType: OwnerType;
  stakingType: StakingType;
  isDetecting: boolean;
  className?: string;
}

interface BadgeDescriptor {
  label: string;
  tone: string;
}

function describe(ownerType: OwnerType, stakingType: StakingType): BadgeDescriptor | null {
  if (ownerType === 'StakingManager' && stakingType === 'native') {
    return { label: 'PoS · Native', tone: 'bg-emerald-500 dark:bg-emerald-400' };
  }
  if (ownerType === 'StakingManager' && stakingType === 'erc20') {
    return { label: 'PoS · ERC20', tone: 'bg-sky-500 dark:bg-sky-400' };
  }
  if (ownerType === 'PoAManager') {
    return { label: 'PoA · Multisig', tone: 'bg-violet-500 dark:bg-violet-400' };
  }
  if (ownerType === 'EOA') {
    return { label: 'PoA · EOA', tone: 'bg-zinc-500 dark:bg-zinc-400' };
  }
  return null;
}

const LABEL =
  'inline-flex shrink-0 items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-700 dark:text-zinc-300';

/**
 * Subtle inline tag in step headers that confirms which validator-manager type
 * was auto-detected for the selected subnet. Stays out of the way while
 * detection is loading.
 */
export function ManagerTypeBadge({ ownerType, stakingType, isDetecting, className }: ManagerTypeBadgeProps) {
  if (isDetecting) {
    return (
      <span className={cn(LABEL, 'text-zinc-400 dark:text-zinc-500', className)}>
        <span aria-hidden className="h-1.5 w-1.5 animate-pulse rounded-full bg-zinc-300 dark:bg-zinc-600" />
        Detecting…
      </span>
    );
  }

  const descriptor = describe(ownerType, stakingType);
  if (!descriptor) return null;

  return (
    <span className={cn(LABEL, className)}>
      <span aria-hidden className={cn('h-1.5 w-1.5 rounded-full', descriptor.tone)} />
      {descriptor.label}
    </span>
  );
}
