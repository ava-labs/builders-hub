'use client';

import StepFlow from '@/components/console/step-flow';
import { CheckRequirements } from '@/components/toolbox/components/CheckRequirements';
import { WalletRequirementsConfigKey } from '@/components/toolbox/hooks/useWalletRequirements';
import { steps } from '../steps';

export default function DepositClientPage({ currentStepKey }: { currentStepKey: string }) {
  return (
    <CheckRequirements toolRequirements={[WalletRequirementsConfigKey.EVMChainBalance]}>
      <StepFlow steps={steps} basePath="/console/encrypted-erc/deposit" currentStepKey={currentStepKey} />
    </CheckRequirements>
  );
}
