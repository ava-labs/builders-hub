'use client';

import type { ComponentType, ReactNode } from 'react';
import { useParams } from 'next/navigation';

/**
 * con-step-travel: the layout of a step flow's base route, for app/console/<flow>/layout.tsx. The flow renders here,
 * above its [step] route, so it stays mounted while the step changes: the step bar holds still, the red mark travels,
 * and only the step's title and body cross-fade. Next mounts a new [step] page for every step, and that page renders
 * only a marker above the flow, which Next scrolls into view on a step change as it scrolled the whole flow. The other
 * pages under the base (its index, a sibling route such as create-l1/basic) have no `step` param and render as they
 * are. A flow's base also goes in MOUNTED_FLOWS (app/console/layout.client.tsx), so the pane fades once per flow.
 */
export function stepFlowLayout(Flow: ComponentType<{ currentStepKey: string }>) {
  return function StepFlowLayout({ children }: { children: ReactNode }) {
    const { step } = useParams<{ step?: string }>();
    if (typeof step !== 'string') return children;
    return (
      <>
        {children}
        <Flow currentStepKey={step} />
      </>
    );
  };
}
