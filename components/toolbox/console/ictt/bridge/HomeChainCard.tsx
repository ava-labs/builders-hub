'use client';

import { ChainCard, ChainCardRow, ChainCardRowList } from './ChainCard';
import type { L1ListItem } from '@/components/toolbox/stores/l1ListStore';
import type { Bridge, BridgePhase } from './types';

interface HomeChainCardProps {
  homeL1: L1ListItem | null;
  bridge: Bridge | null;
  activePhase: BridgePhase;
  isWalletOnHome: boolean;
  onSwitchChain?: () => void;
}

export function HomeChainCard({ homeL1, bridge, activePhase, isWalletOnHome, onSwitchChain }: HomeChainCardProps) {
  return (
    <ChainCard role="home" l1={homeL1} isWalletOnChain={isWalletOnHome} onSwitchChain={onSwitchChain}>
      <ChainCardRowList>
        <ChainCardRow
          label="Source token"
          sublabel={
            bridge?.kind === 'native-home'
              ? 'Native (wrapped)'
              : bridge?.symbol
                ? `ERC-20 · ${bridge.symbol}`
                : 'ERC-20'
          }
          address={bridge?.underlyingTokenAddress ?? null}
          status={bridge?.kind === 'native-home' || bridge?.underlyingTokenAddress ? 'deployed' : 'missing'}
          isActive={activePhase === 'token'}
          l1={homeL1}
        />
        <ChainCardRow
          label="TokenHome"
          sublabel={bridge?.kind === 'native-home' ? 'Native home' : 'ERC-20 home'}
          address={bridge?.homeAddress ?? null}
          status={bridge?.homeAddress ? 'deployed' : 'missing'}
          isActive={activePhase === 'home'}
          l1={homeL1}
        />
        <ChainCardRow
          label="Collateral"
          sublabel={bridge ? 'Collateral status' : undefined}
          address={null}
          status={
            bridge?.remotes.some((r) => r.collateralizedAt)
              ? 'deployed'
              : bridge?.remotes.length
                ? 'pending'
                : 'missing'
          }
          statusText={
            bridge?.remotes.some((r) => r.collateralizedAt)
              ? 'Collateralized'
              : bridge?.remotes.length
                ? 'Awaiting collateral'
                : '—'
          }
          isActive={activePhase === 'collateral'}
          l1={homeL1}
        />
      </ChainCardRowList>
    </ChainCard>
  );
}
