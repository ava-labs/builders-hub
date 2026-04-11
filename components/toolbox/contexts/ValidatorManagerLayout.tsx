'use client';

import React from 'react';
import { ValidatorManagerProvider } from './ValidatorManagerContext';
import { Alert } from '@/components/toolbox/components/Alert';
import { MainnetPoSWarning } from '@/components/toolbox/components/MainnetPoSWarning';

interface ValidatorManagerLayoutProps {
  subnetIdL1: string;
  globalError: string | null;
  children: React.ReactNode;
  /** Show mainnet PoS warning banner (for permissionless staking flows) */
  showPoSWarning?: boolean;
}

export default function ValidatorManagerLayout({
  subnetIdL1,
  globalError,
  children,
  showPoSWarning,
}: ValidatorManagerLayoutProps) {
  return (
    <ValidatorManagerProvider subnetId={subnetIdL1}>
      {showPoSWarning && <MainnetPoSWarning />}
      {globalError && (
        <Alert variant="error" className="mb-4">
          Error: {globalError}
        </Alert>
      )}
      {children}
    </ValidatorManagerProvider>
  );
}
