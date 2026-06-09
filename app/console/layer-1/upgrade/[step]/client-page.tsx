'use client';

import StepFlow from '@/components/console/step-flow';
import { steps } from '../steps';

export default function L1UpgradeClientPage({ currentStepKey }: { currentStepKey: string }) {
  return (
    <StepFlow
      steps={steps}
      basePath="/console/layer-1/upgrade"
      currentStepKey={currentStepKey}
      finishLabel="Done"
    />
  );
}
