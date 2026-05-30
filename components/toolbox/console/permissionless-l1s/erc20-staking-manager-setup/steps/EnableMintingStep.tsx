'use client';

import { EnableStakingManagerMintingInner } from '@/components/toolbox/console/permissionless-l1s/staking-manager-setup/EnableStakingManagerMinting';

export default function EnableMintingStep() {
  return <EnableStakingManagerMintingInner initialTokenType="erc20" />;
}
