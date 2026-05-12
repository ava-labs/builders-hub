'use client';

import StepFlow from '@/components/console/step-flow';
import { BridgeRibbon } from './BridgeRibbon';
import { ManageBridgesButton } from './activity/ManageBridgesButton';
import { useBridgeContext } from './hooks/useBridgeContext';
import { ChainCardSkeleton } from './ChainCardSkeleton';
import { BRIDGE_BASE_PATH, bridgeSteps } from './bridge-steps';

interface BridgeLayoutProps {
  currentStep: string;
}

export function BridgeLayout({ currentStep }: BridgeLayoutProps) {
  const ctx = useBridgeContext({ step: currentStep });

  if (!ctx.migrationReady) {
    return (
      <section className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <ChainCardSkeleton role="home" />
          <ChainCardSkeleton role="remote" />
        </div>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <StepFlow
        steps={bridgeSteps}
        basePath={BRIDGE_BASE_PATH}
        currentStepKey={currentStep}
        compact
        showCompletionModal={false}
        aboveBody={<BridgeRibbon />}
        navTrailing={<ManageBridgesButton />}
      />
    </section>
  );
}
