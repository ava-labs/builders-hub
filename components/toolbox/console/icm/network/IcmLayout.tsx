'use client';

import StepFlow from '@/components/console/step-flow';
import { Skeleton } from '@/components/ui/skeleton';
import { useIcmContext } from './hooks/useIcmContext';
import { IcmRibbon } from './IcmRibbon';
import { IcmNetworkButton } from './IcmNetworkButton';
import { ICM_BASE_PATH, icmSteps } from './icm-steps';

interface IcmLayoutProps {
  currentStep: string;
}

export function IcmLayout({ currentStep }: IcmLayoutProps) {
  const ctx = useIcmContext({ step: currentStep });

  if (!ctx.migrationReady) {
    return (
      <section className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
        </div>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <StepFlow
        steps={icmSteps}
        basePath={ICM_BASE_PATH}
        currentStepKey={currentStep}
        compact
        showCompletionModal={false}
        aboveBody={<IcmRibbon />}
        navTrailing={<IcmNetworkButton />}
      />
    </section>
  );
}
