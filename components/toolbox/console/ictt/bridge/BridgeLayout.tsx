'use client';

import { useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import StepFlow from '@/components/console/step-flow';
import { BridgeRibbon } from './BridgeRibbon';
import { BridgesPicker } from './BridgesPicker';
import { NewBridgeButton } from './activity/NewBridgeButton';
import { useIcttBridgeStore } from '@/components/toolbox/stores/iccttBridgeStore';
import { useBridgeContext } from './hooks/useBridgeContext';
import { ChainCardSkeleton } from './ChainCardSkeleton';
import { BRIDGE_BASE_PATH, bridgeSteps } from './bridge-steps';

interface BridgeLayoutProps {
  currentStep: string;
}

export function BridgeLayout({ currentStep }: BridgeLayoutProps) {
  const ctx = useBridgeContext({ step: currentStep });
  const router = useRouter();
  const bridgesRecord = useIcttBridgeStore((s) => s.bridges);

  // Show the "New bridge" CTA only once the user has something to reset from —
  // before any bridge exists it would be a no-op offering. The `BridgesPicker`
  // bar self-hides on the same condition (its own internal check), so both
  // affordances either appear together or stay hidden together for new users.
  const hasExistingBridges = useMemo(() => Object.values(bridgesRecord).some((b) => !b.archivedAt), [bridgesRecord]);

  const handleStartNewBridge = useCallback(() => {
    ctx.startNewBridge();
    router.push(`${BRIDGE_BASE_PATH}/token`);
  }, [ctx, router]);

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
      <BridgesPicker />
      <StepFlow
        steps={bridgeSteps}
        basePath={BRIDGE_BASE_PATH}
        currentStepKey={currentStep}
        compact
        showCompletionModal={false}
        aboveBody={<BridgeRibbon />}
        navTrailing={hasExistingBridges ? <NewBridgeButton onClick={handleStartNewBridge} /> : null}
      />
    </section>
  );
}
