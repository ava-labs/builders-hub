'use client';

import { IcmLayout } from '@/components/toolbox/console/icm/network/IcmLayout';
import { CheckRequirements } from '@/components/toolbox/components/CheckRequirements';
import { WalletRequirementsConfigKey } from '@/components/toolbox/hooks/useWalletRequirements';

interface Props {
  currentPhase: string;
}

export default function IcmPhaseClientPage({ currentPhase }: Props) {
  return (
    <CheckRequirements toolRequirements={[WalletRequirementsConfigKey.EVMChainBalance]}>
      <IcmLayout currentStep={currentPhase} />
    </CheckRequirements>
  );
}
