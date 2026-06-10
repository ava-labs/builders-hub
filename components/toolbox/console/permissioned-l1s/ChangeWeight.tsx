'use client';

import { useState, useCallback } from 'react';
import StepFlow from '@/components/console/step-flow';
import { steps } from '@/app/console/permissioned-l1s/change-validator-weight/steps';
import { useChangeWeightStore } from '@/components/toolbox/stores/changeWeightStore';
import ValidatorManagerLayout from '@/components/toolbox/contexts/ValidatorManagerLayout';
import { WalletRequirementsConfigKey } from '@/components/toolbox/hooks/useWalletRequirements';
import { ConsoleToolMetadata, withConsoleToolMetadata } from '@/components/toolbox/components/WithConsoleToolMetadata';
import { generateConsoleToolGitHubUrl } from '@/components/toolbox/utils/githubUrl';

const metadata: ConsoleToolMetadata = {
  title: 'Change Validator Weight',
  description: "Change the consensus weight of a validator through the L1's Validator Manager",
  toolRequirements: [WalletRequirementsConfigKey.EVMChainBalance],
  githubUrl: generateConsoleToolGitHubUrl(import.meta.url),
};

function ChangeWeight() {
  const { subnetIdL1, globalError } = useChangeWeightStore();
  const firstKey = steps[0].type === 'single' ? steps[0].key : steps[0].options[0].key;
  const [currentStepKey, setCurrentStepKey] = useState(firstKey);

  const handleNavigate = useCallback((stepKey: string) => {
    setCurrentStepKey(stepKey);
  }, []);

  return (
    <ValidatorManagerLayout subnetIdL1={subnetIdL1} globalError={globalError}>
      <StepFlow
        steps={steps}
        basePath=""
        currentStepKey={currentStepKey}
        onNavigate={handleNavigate}
        showCompletionModal={false}
        compact
      />
    </ValidatorManagerLayout>
  );
}

export default withConsoleToolMetadata(ChangeWeight, metadata);
