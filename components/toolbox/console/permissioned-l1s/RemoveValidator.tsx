'use client';

import { useState, useCallback } from 'react';
import StepFlow from '@/components/console/step-flow';
import { steps } from '@/app/console/permissioned-l1s/remove-validator/steps';
import { useRemoveValidatorStore } from '@/components/toolbox/stores/removeValidatorStore';
import PermissionedFlowLayout from './shared/PermissionedFlowLayout';

export default function RemoveValidator() {
  const { subnetIdL1, globalError } = useRemoveValidatorStore();
  const firstKey = steps[0].type === 'single' ? steps[0].key : steps[0].options[0].key;
  const [currentStepKey, setCurrentStepKey] = useState(firstKey);

  const handleNavigate = useCallback((stepKey: string) => {
    setCurrentStepKey(stepKey);
  }, []);

  return (
    <PermissionedFlowLayout subnetIdL1={subnetIdL1} globalError={globalError}>
      <StepFlow
        steps={steps}
        basePath=""
        currentStepKey={currentStepKey}
        onNavigate={handleNavigate}
        showCompletionModal={false}
        compact
      />
    </PermissionedFlowLayout>
  );
}
