'use client';

import TransferOwnershipToStakingManager from '@/components/toolbox/console/permissionless-l1s/staking-manager-setup/TransferOwnershipToStakingManager';

export default function TransferOwnershipStep() {
  // The default export adds CheckRequirements, which provides the connected wallet that the tool reads
  return <TransferOwnershipToStakingManager preferNative />;
}
