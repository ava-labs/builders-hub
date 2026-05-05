'use client';

import React from 'react';
import { Alert } from '@/components/toolbox/components/Alert';
import { useUptimeProofStore } from '@/components/toolbox/stores/uptimeProofStore';
import { useValidatorManagerContext } from '@/components/toolbox/contexts/ValidatorManagerContext';
import ValidatorUptimeDashboard from '@/components/toolbox/console/permissionless-l1s/uptime/ValidatorUptimeDashboard';

export default function UptimeDashboardStep() {
  const store = useUptimeProofStore();
  const vmcCtx = useValidatorManagerContext();

  const stakingManagerAddress = vmcCtx.staking?.stakingManagerAddress || vmcCtx.validatorManagerAddress || '';
  const stakingType = vmcCtx.staking?.stakingType || 'native';
  const uptimeBlockchainID = vmcCtx.staking?.settings?.uptimeBlockchainID || '';

  return (
    <div className="space-y-4">
      {!store.subnetIdL1 && <Alert variant="warning">No L1 subnet selected. Go back to the previous step.</Alert>}

      {store.subnetIdL1 && stakingManagerAddress && (
        <ValidatorUptimeDashboard
          stakingManagerAddress={stakingManagerAddress}
          stakingType={stakingType}
          subnetIdL1={store.subnetIdL1}
          blockchainId={vmcCtx.blockchainId || ''}
          uptimeBlockchainID={uptimeBlockchainID}
          nodeUrl={store.nodeUrl}
          onNodeUrlChange={store.setNodeUrl}
        />
      )}

      {store.subnetIdL1 && !stakingManagerAddress && vmcCtx.staking?.isLoading && (
        <div className="text-sm text-zinc-500 text-center py-8">Detecting staking manager...</div>
      )}
    </div>
  );
}
