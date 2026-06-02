'use client';

import { BridgeLayout } from '@/components/toolbox/console/ictt/bridge/BridgeLayout';
import { CheckRequirements } from '@/components/toolbox/components/CheckRequirements';
import { WalletRequirementsConfigKey } from '@/components/toolbox/hooks/useWalletRequirements';

interface Props {
  currentStep: string;
}

export default function IcttBridgeStepClientPage({ currentStep }: Props) {
  return (
    <CheckRequirements toolRequirements={[WalletRequirementsConfigKey.EVMChainBalance]}>
      <BridgeLayout currentStep={currentStep} />
    </CheckRequirements>
  );
}
