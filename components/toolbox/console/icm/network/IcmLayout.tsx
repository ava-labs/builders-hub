'use client';

import StepFlow from '@/components/console/step-flow';
import { Bone } from '@/components/toolbox/console/icm/ui';
import { useIcmContext } from './hooks/useIcmContext';
import { ICM_BASE_PATH, icmSteps } from './icm-steps';

interface IcmLayoutProps {
  currentStep: string;
}

/** The step nav and a two-pane body in the shapes StepFlow will draw, so nothing jumps when it lands. */
function IcmLayoutSkeleton() {
  return (
    <section role="status" aria-label="Loading ICM setup" className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Bone className="h-3 w-40" />
        <div className="flex gap-1">
          {icmSteps.map((s) => (
            <Bone key={s.key} className="h-1 flex-1" />
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
        <div className="border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex flex-col gap-2 border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
            <Bone className="h-2.5 w-24" />
            <Bone className="h-4 w-56" />
          </div>
          <div className="flex flex-col gap-4 px-5 py-5">
            <Bone className="h-3 w-full" />
            <Bone className="h-3 w-4/5" />
            <Bone className="h-10 w-full" />
          </div>
        </div>
        <Bone className="h-[320px] border border-zinc-200 dark:border-zinc-800" />
      </div>
    </section>
  );
}

export function IcmLayout({ currentStep }: IcmLayoutProps) {
  const ctx = useIcmContext({ step: currentStep });

  if (!ctx.migrationReady) {
    return <IcmLayoutSkeleton />;
  }

  return (
    <section className="flex flex-col gap-4">
      <StepFlow
        steps={icmSteps}
        basePath={ICM_BASE_PATH}
        currentStepKey={currentStep}
        compact
        showCompletionModal={false}
      />
    </section>
  );
}
