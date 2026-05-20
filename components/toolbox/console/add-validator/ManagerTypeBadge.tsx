'use client';

import React from 'react';
import { Badge } from '@/components/ui/badge';
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
    return {
      label: 'PoS · Native',
      tone: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    };
  }
  if (ownerType === 'StakingManager' && stakingType === 'erc20') {
    return { label: 'PoS · ERC20', tone: 'border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-400' };
  }
  if (ownerType === 'PoAManager') {
    return {
      label: 'PoA · Multisig',
      tone: 'border-violet-500/30 bg-violet-500/10 text-violet-600 dark:text-violet-400',
    };
  }
  if (ownerType === 'EOA') {
    return { label: 'PoA · EOA', tone: 'border-zinc-400/30 bg-zinc-400/10 text-zinc-600 dark:text-zinc-400' };
  }
  return null;
}

/**
 * Subtle inline tag in step headers that confirms which validator-manager type
 * was auto-detected for the selected subnet. Stays out of the way while
 * detection is loading.
 */
export function ManagerTypeBadge({ ownerType, stakingType, isDetecting, className }: ManagerTypeBadgeProps) {
  if (isDetecting) {
    return (
      <Badge
        variant="outline"
        className={`text-[10px] font-normal text-zinc-400 dark:text-zinc-500 ${className ?? ''}`}
      >
        Detecting…
      </Badge>
    );
  }

  const descriptor = describe(ownerType, stakingType);
  if (!descriptor) return null;

  return (
    <Badge
      variant="outline"
      className={`text-[10px] font-medium tracking-wide uppercase ${descriptor.tone} ${className ?? ''}`}
    >
      {descriptor.label}
    </Badge>
  );
}
