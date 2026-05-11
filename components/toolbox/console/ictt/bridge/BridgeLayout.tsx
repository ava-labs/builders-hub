'use client';

import { useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import StepFlow from '@/components/console/step-flow';
import { BridgeRibbon } from './BridgeRibbon';
import { ActivityChip } from './activity/ActivityChip';
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
  // Subscribe to the raw activity log (stable array reference per store update),
  // then filter in useMemo. Filtering inside the selector returns a fresh array
  // every render and triggers an infinite re-subscribe loop.
  const allActivity = useIcttBridgeStore((s) => s.activityLog);
  const clearActivityRaw = useIcttBridgeStore((s) => s.clearActivity);
  const bridgesRecord = useIcttBridgeStore((s) => s.bridges);

  const activityEvents = useMemo(() => {
    return allActivity.filter((e) => {
      if (ctx.activeBridgeId && e.bridgeId !== ctx.activeBridgeId) return false;
      if (ctx.selectedRemoteId && e.remoteId && e.remoteId !== ctx.selectedRemoteId) return false;
      return true;
    });
  }, [allActivity, ctx.activeBridgeId, ctx.selectedRemoteId]);

  // Show the "New bridge" CTA only once the user has something to reset from —
  // before any bridge exists it would be a no-op offering.
  const hasExistingBridges = useMemo(() => Object.values(bridgesRecord).some((b) => !b.archivedAt), [bridgesRecord]);

  const clearScopedActivity = useCallback(() => {
    clearActivityRaw({
      bridgeId: ctx.activeBridgeId ?? undefined,
      remoteId: ctx.selectedRemoteId ?? undefined,
    });
  }, [clearActivityRaw, ctx.activeBridgeId, ctx.selectedRemoteId]);

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
        navTrailing={
          // Pull the action group slightly away from the step pills with a
          // hairline divider so it reads as a distinct "global controls" cluster
          // rather than the tail of the stepper.
          <div className="flex items-center gap-2 border-l border-zinc-200/70 pl-3 dark:border-zinc-800/70">
            {hasExistingBridges && <NewBridgeButton onClick={handleStartNewBridge} />}
            <ActivityChip events={activityEvents} onClear={clearScopedActivity} />
          </div>
        }
      />
    </section>
  );
}
