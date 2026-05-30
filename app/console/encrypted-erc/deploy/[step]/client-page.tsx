'use client';

import StepFlow from '@/components/console/step-flow';
import { CheckRequirements } from '@/components/toolbox/components/CheckRequirements';
import { WalletRequirementsConfigKey } from '@/components/toolbox/hooks/useWalletRequirements';
import { steps } from '../steps';
import { useEERCDeployStore } from '@/components/toolbox/stores/eercDeployStore';

/**
 * The StepFlow primitive only wraps its children in ChainGate + error boundary;
 * it does NOT supply the ConnectedWalletProvider that `useContractDeployer`
 * (and therefore every deploy step) depends on. We wrap the whole wizard in
 * CheckRequirements so the provider is available to every step and the user
 * is nudged to connect + top up before reaching the first deploy tx.
 */
export default function DeployClientPage({ currentStepKey }: { currentStepKey: string }) {
  const { lastTxHash } = useEERCDeployStore();
  return (
    <CheckRequirements toolRequirements={[WalletRequirementsConfigKey.EVMChainBalance]}>
      <StepFlow
        steps={steps}
        basePath="/console/encrypted-erc/deploy"
        currentStepKey={currentStepKey}
        transactionHash={lastTxHash || undefined}
      />
    </CheckRequirements>
  );
}
