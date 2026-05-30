'use client';

import { InitializeStakingManagerInner } from '@/components/toolbox/console/permissionless-l1s/staking-manager-setup/InitializeStakingManager';

export default function InitializeStep() {
  return <InitializeStakingManagerInner initialStakingType="native" />;
}
