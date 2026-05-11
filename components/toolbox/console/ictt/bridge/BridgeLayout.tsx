'use client';

import { useCallback, useMemo } from 'react';
import StepFlow from '@/components/console/step-flow';
import { BridgeRibbon } from './BridgeRibbon';
import { ActivityChip } from './activity/ActivityChip';
import { useIcttBridgeStore } from '@/components/toolbox/stores/iccttBridgeStore';
import { useBridgeContext } from './hooks/useBridgeContext';
import { ChainCardSkeleton } from './ChainCardSkeleton';
import { BRIDGE_BASE_PATH, bridgeSteps } from './bridge-steps';

interface BridgeLayoutProps {
  currentStep: string;
}

export function BridgeLayout({ currentStep }: BridgeLayoutProps) {
  const ctx = useBridgeContext({ step: currentStep });
  // Subscribe to the raw activity log (stable array reference per store update),
  // then filter in useMemo. Filtering inside the selector returns a fresh array
  // every render and triggers an infinite re-subscribe loop.
  const allActivity = useIcttBridgeStore((s) => s.activityLog);
  const clearActivityRaw = useIcttBridgeStore((s) => s.clearActivity);

  const activityEvents = useMemo(() => {
    return allActivity.filter((e) => {
      if (ctx.activeBridgeId && e.bridgeId !== ctx.activeBridgeId) return false;
      if (ctx.selectedRemoteId && e.remoteId && e.remoteId !== ctx.selectedRemoteId) return false;
      return true;
    });
  }, [allActivity, ctx.activeBridgeId, ctx.selectedRemoteId]);

  const clearScopedActivity = useCallback(() => {
    clearActivityRaw({
      bridgeId: ctx.activeBridgeId ?? undefined,
      remoteId: ctx.selectedRemoteId ?? undefined,
    });
  }, [clearActivityRaw, ctx.activeBridgeId, ctx.selectedRemoteId]);

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
        navTrailing={<ActivityChip events={activityEvents} onClear={clearScopedActivity} />}
      />
    </section>
  );
}
