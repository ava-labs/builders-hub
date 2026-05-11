'use client';

import { useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import StepFlow from '@/components/console/step-flow';
import { BridgeRibbon } from './BridgeRibbon';
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
  // before any bridge exists it would be a no-op offering.
  const hasExistingBridges = useMemo(() => Object.values(bridgesRecord).some((b) => !b.archivedAt), [bridgesRecord]);

  // TODO(my-bridges): pair this with a "My bridges" sheet so users can hop back
  // to a previous bridge via `useIcttBridgeStore.selectBridge(id)` instead of
  // only being able to start fresh.
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
