'use client';

import { ChainCard, ChainCardRow, ChainCardRowList } from './ChainCard';
import type { L1ListItem } from '@/components/toolbox/stores/l1ListStore';
import type { BridgePhase, Remote } from './types';

interface RemoteChainCardProps {
  remoteL1: L1ListItem | null;
  remote: Remote | null;
  activePhase: BridgePhase;
  isWalletOnRemote: boolean;
  onSwitchChain?: () => void;
}

export function RemoteChainCard({
  remoteL1,
  remote,
  activePhase,
  isWalletOnRemote,
  onSwitchChain,
}: RemoteChainCardProps) {
  return (
    <ChainCard role="remote" l1={remoteL1} isWalletOnChain={isWalletOnRemote} onSwitchChain={onSwitchChain}>
      <ChainCardRowList>
        <ChainCardRow
          label="TokenRemote"
          sublabel={remote?.kind === 'native-remote' ? 'Native remote' : 'ERC-20 remote'}
          address={remote?.address ?? null}
          status={remote?.address ? 'deployed' : 'missing'}
          isActive={activePhase === 'remote'}
          l1={remoteL1}
        />
        <ChainCardRow
          label="Registered with Home"
          sublabel="Cross-chain pairing"
          address={null}
          status={remote?.registeredAt ? 'deployed' : remote?.address ? 'pending' : 'missing'}
          statusText={remote?.registeredAt ? 'Registered' : remote?.address ? 'Awaiting registration' : '—'}
          isActive={activePhase === 'register'}
          l1={remoteL1}
        />
      </ChainCardRowList>
    </ChainCard>
  );
}
