'use client';

import StepFlow from '@/components/console/step-flow';
import { BridgeRibbon } from './BridgeRibbon';
import { ManageBridgesButton } from './activity/ManageBridgesButton';
import { useBridgeContext } from './hooks/useBridgeContext';
import { BridgeSkeleton } from './ChainCardSkeleton';
import { BRIDGE_BASE_PATH, bridgeSteps } from './bridge-steps';

interface BridgeLayoutProps {
  currentStep: string;
}

export function BridgeLayout({ currentStep }: BridgeLayoutProps) {
  const ctx = useBridgeContext({ step: currentStep });

  if (!ctx.migrationReady) {
    return (
      <section className="not-prose flex flex-col">
        <BridgeSkeleton />
      </section>
    );
  }

  return (
    <section className="not-prose flex flex-col">
      <StepFlow
        steps={bridgeSteps}
        basePath={BRIDGE_BASE_PATH}
        currentStepKey={currentStep}
        showCompletionModal={false}
        aboveBody={<BridgeRibbon />}
        navTrailing={<ManageBridgesButton />}
      />
    </section>
  );
}
