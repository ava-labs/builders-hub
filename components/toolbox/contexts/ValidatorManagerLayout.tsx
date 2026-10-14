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
}

/**
 * Shows no step error itself. Each step's tool shows its error in its own alert, with the remediation links, next
 * to the button that failed. A second copy here made a screen reader read the error twice.
 */
export default function ValidatorManagerLayout({ subnetIdL1, children, showPoSWarning }: ValidatorManagerLayoutProps) {
  return (
    <ValidatorManagerProvider subnetId={subnetIdL1}>
      {showPoSWarning && <MainnetPoSWarning />}
      <StepErrorBoundary fallbackMessage="An error occurred in this flow. Your progress is kept. Reload the page.">
        {children}
      </StepErrorBoundary>
    </ValidatorManagerProvider>
  );
}
