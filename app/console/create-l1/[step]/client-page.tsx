'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import StepFlow from '@/components/console/step-flow';
import { useCreateL1FlowStore } from '@/components/toolbox/stores/createL1FlowStore';
import { generateCreateL1Steps } from '@/components/toolbox/console/create-l1/generateSteps';

export default function CreateL1StepClientPage({ currentStepKey }: { currentStepKey: string }) {
  const router = useRouter();
  const answers = useCreateL1FlowStore((s) => s.answers);

  const steps = useMemo(() => {
    if (!answers) return [];
    return generateCreateL1Steps(answers);
  }, [answers]);

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
