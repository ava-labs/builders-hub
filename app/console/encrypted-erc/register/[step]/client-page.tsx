'use client';

import { useRouter } from 'next/navigation';
import StepFlow from '@/components/console/step-flow';
import { CheckRequirements } from '@/components/toolbox/components/CheckRequirements';
import { WalletRequirementsConfigKey } from '@/components/toolbox/hooks/useWalletRequirements';
import { steps } from '../steps';

export default function RegisterClientPage({ currentStepKey }: { currentStepKey: string }) {
  const router = useRouter();

  return (
    <CheckRequirements toolRequirements={[WalletRequirementsConfigKey.EVMChainBalance]}>
      <StepFlow
        steps={steps}
        basePath="/console/encrypted-erc/register"
        currentStepKey={currentStepKey}
        showCompletionModal={false}
        finishLabel="Next"
        onFinish={() => router.push('/console/encrypted-erc/deposit/wrap-avax')}
      />
    </CheckRequirements>
  );
}
