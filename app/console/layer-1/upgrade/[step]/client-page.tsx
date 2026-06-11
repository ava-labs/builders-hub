'use client';

import { useCallback } from 'react';
import StepFlow from '@/components/console/step-flow';
import { useL1UpgradeStore } from '@/components/toolbox/stores/l1UpgradeStore';
import { steps } from '../steps';

export default function L1UpgradeClientPage({ currentStepKey }: { currentStepKey: string }) {
  const store = useL1UpgradeStore();

  // Clear the persisted selection when the user reaches "Finish" so the next
  // run starts clean, mirroring the Create L1 flow.
  const handleFinish = useCallback(() => {
    store.getState().reset();
  }, [store]);

  return (
    <StepFlow
      steps={steps}
      basePath="/console/layer-1/upgrade"
      currentStepKey={currentStepKey}
      onFinish={handleFinish}
    />
  );
}
