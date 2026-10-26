'use client';

import React from 'react';
import { ValidatorManagerProvider } from './ValidatorManagerContext';
import { MainnetPoSWarning } from '@/components/toolbox/components/MainnetPoSWarning';
import { StepErrorBoundary } from '@/components/toolbox/components/StepErrorBoundary';

interface ValidatorManagerLayoutProps {
  subnetIdL1: string;
  children: React.ReactNode;
  /** Show mainnet PoS warning banner (for permissionless staking flows) */
  showPoSWarning?: boolean;
  /**
   * The step flow inside gives each step its own provider (StepFlow's wrapStep with validatorManagerPerStep), so the
   * layout adds none: the flow stays mounted from step to step, and each step still loads the manager's address,
   * weight, churn and owner fresh, as it did when every step mounted the flow.
   */
  providerPerStep?: boolean;
}

/**
 * For StepFlow's wrapStep: each step gets a ValidatorManagerProvider of its own, which mounts with the step, so a step
 * after a transaction that changed the weight, or a run started again with Back, reads the manager afresh.
 */
export function validatorManagerPerStep(subnetId: string) {
  return function wrapStep(step: React.ReactNode) {
    return <ValidatorManagerProvider subnetId={subnetId}>{step}</ValidatorManagerProvider>;
  };
}

/**
 * Shows no step error itself. Each step's tool shows its error in its own alert, with the remediation links, next
 * to the button that failed. A second copy here made a screen reader read the error twice.
 */
export default function ValidatorManagerLayout({
  subnetIdL1,
  children,
  showPoSWarning,
  providerPerStep = false,
}: ValidatorManagerLayoutProps) {
  const content = (
    <>
      {showPoSWarning && <MainnetPoSWarning />}
      <StepErrorBoundary fallbackMessage="An error occurred in this flow. Your progress is kept. Reload the page.">
        {children}
      </StepErrorBoundary>
    </>
  );
  if (providerPerStep) return content;
  return <ValidatorManagerProvider subnetId={subnetIdL1}>{content}</ValidatorManagerProvider>;
}
