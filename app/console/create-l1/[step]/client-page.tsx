'use client';

import { useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import StepFlow from '@/components/console/step-flow';
import { useCreateL1FlowStore } from '@/components/toolbox/stores/createL1FlowStore';
import { generateCreateL1Steps } from '@/components/toolbox/console/create-l1/generateSteps';

export default function CreateL1StepClientPage({ currentStepKey }: { currentStepKey: string }) {
  const router = useRouter();
  const answers = useCreateL1FlowStore((s) => s.answers);
  const setCurrentStepIndex = useCreateL1FlowStore((s) => s.setCurrentStepIndex);

  const steps = useMemo(() => {
    if (!answers) return [];
    return generateCreateL1Steps(answers);
  }, [answers]);

  // Keep the flow store's currentStepIndex in sync with the URL. The URL is
  // the source of truth for "where the user is now" — every Next/Back/deep-
  // link goes through this component on mount. Writing the index here makes
  // the sidebar's Resume entry deep-link to the user's actual last position.
  useEffect(() => {
    if (steps.length === 0) return;
    const idx = steps.findIndex((s) =>
      s.type === 'single'
        ? s.key === currentStepKey
        : s.options.some((o) => o.key === currentStepKey),
    );
    if (idx >= 0) setCurrentStepIndex(idx);
  }, [currentStepKey, steps, setCurrentStepIndex]);

  // If no answers stored (user navigated directly), redirect to questionnaire
  if (!answers || steps.length === 0) {
    router.replace('/console/create-l1');
    return null;
  }

  return (
    <StepFlow
      steps={steps}
      basePath="/console/create-l1"
      currentStepKey={currentStepKey}
    />
  );
}
