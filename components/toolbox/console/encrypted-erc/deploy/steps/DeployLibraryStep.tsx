'use client';

import React from 'react';
import { Button } from '@/components/toolbox/components/Button';
import { Alert } from '@/components/toolbox/components/Alert';
import { useContractDeployer } from '@/components/toolbox/hooks/contracts/core/useContractDeployer';
import { useEERCDeployStore } from '@/components/toolbox/stores/eercDeployStore';
import { EERCToolShell } from '../../shared/EERCToolShell';
import { BABYJUBJUB_SOURCES } from '@/lib/eerc/contractSources';
import BabyJubJubArtifact from '@/contracts/encrypted-erc/compiled/BabyJubJub.json';
import { ContractCard, PANE_HEIGHT } from '../ui';

export default function DeployLibraryStep() {
  const { babyJubJubAddress, setBabyJubJubAddress, setLastTxHash, globalError, setGlobalError } = useEERCDeployStore();
  const { deploy, isDeploying } = useContractDeployer();

  const deployLibrary = async () => {
    setGlobalError(null);
    try {
      const result = await deploy({
        abi: BabyJubJubArtifact.abi,
        bytecode: BabyJubJubArtifact.bytecode,
        args: [],
        name: 'BabyJubJub library',
      });
      setBabyJubJubAddress(result.contractAddress);
      setLastTxHash(result.hash);
    } catch (err) {
      setGlobalError(err instanceof Error ? err.message : 'Deploy failed');
    }
  };

  return (
    <EERCToolShell
      contracts={BABYJUBJUB_SOURCES}
      showNav={false}
      height={PANE_HEIGHT}
      footerLinks={[{ label: 'BabyJubJub EIP', href: 'https://eips.ethereum.org/EIPS/eip-2494' }]}
    >
      <ContractCard
        name="BabyJubJub library"
        description="A Solidity library for BabyJubJub curve math on-chain. You deploy it once; its address is linked into the EncryptedERC bytecode in step 5."
        address={babyJubJubAddress}
        deploying={isDeploying}
        onRedeploy={() => setBabyJubJubAddress('')}
        action={
          <Button
            variant="primary"
            onClick={deployLibrary}
            loading={isDeploying}
            loadingText="Deploying…"
            disabled={isDeploying}
          >
            Deploy library
          </Button>
        }
      />
      {globalError && <Alert variant="error">{globalError}</Alert>}
    </EERCToolShell>
  );
}
