'use client';

import StepFlow from '@/components/console/step-flow';
import { Skeleton } from '@/components/ui/skeleton';
import { useIcmContext } from './hooks/useIcmContext';
import { IcmNetworkButton } from './IcmNetworkButton';
import { IcmLogButton } from './activity/IcmLogButton';
import { ICM_BASE_PATH, icmSteps } from './icm-steps';

interface IcmLayoutProps {
  currentStep: string;
}

export function IcmLayout({ currentStep }: IcmLayoutProps) {
  const ctx = useIcmContext({ step: currentStep });

  if (!ctx.migrationReady) {
    return (
      <section className="flex flex-col gap-4">
        <Skeleton className="h-24 rounded-2xl" />
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
        navTrailing={
          <div className="flex items-center gap-2">
            <IcmLogButton />
            <IcmNetworkButton />
          </div>
        }
      />
    </section>
  );
}
