'use client';

import React from 'react';
import { Button } from '@/components/toolbox/components/Button';
import { Alert } from '@/components/toolbox/components/Alert';
import { useContractDeployer } from '@/components/toolbox/hooks/contracts/core/useContractDeployer';
import { useEERCDeployStore } from '@/components/toolbox/stores/eercDeployStore';
import { EERCToolShell } from '../../shared/EERCToolShell';
import { HashChip, SpecRow } from '@/components/explorer-v2/ui';
import { REGISTRAR_SOURCES, EERC_COMMIT } from '@/lib/eerc/contractSources';
import RegistrarArtifact from '@/contracts/encrypted-erc/compiled/Registrar.json';
import { ContractCard, Missing, PANE_HEIGHT } from '../ui';

export default function DeployRegistrarStep() {
  const { verifiers, registrarAddress, setRegistrarAddress, setLastTxHash, globalError, setGlobalError } =
    useEERCDeployStore();
  const { deploy, isDeploying } = useContractDeployer();

  const canDeploy = verifiers.registration.length > 0;

  const handle = async () => {
    setGlobalError(null);
    try {
      const result = await deploy({
        abi: RegistrarArtifact.abi,
        bytecode: RegistrarArtifact.bytecode,
        args: [verifiers.registration],
        name: 'Registrar',
      });
      setRegistrarAddress(result.contractAddress);
      setLastTxHash(result.hash);
    } catch (err) {
      setGlobalError(err instanceof Error ? err.message : 'Deploy failed');
    }
  };

  return (
    <EERCToolShell
      contracts={REGISTRAR_SOURCES}
      showNav={false}
      height={PANE_HEIGHT}
      academyHref="/academy/encrypted-erc/05-eerc-contracts-flow"
      footerLinks={[
        {
          label: 'Source',
          href: `https://github.com/ava-labs/EncryptedERC/blob/${EERC_COMMIT}/contracts/Registrar.sol`,
        },
      ]}
    >
      {!canDeploy && <Alert variant="warning">Deploy the registration verifier first. Go back one step.</Alert>}
      <ContractCard
        name="Registrar"
        description="One per chain. It maps EVM addresses to BabyJubJub public keys, so every eERC operation can encrypt amounts to the right party."
        address={registrarAddress}
        deploying={isDeploying}
        blocked={!canDeploy}
        onRedeploy={() => setRegistrarAddress('')}
        inputs={
          <SpecRow label="Registration verifier">
            {canDeploy ? <HashChip value={verifiers.registration} len={18} /> : <Missing />}
          </SpecRow>
        }
        action={
          <Button
            variant="primary"
            onClick={handle}
            loading={isDeploying}
            loadingText="Deploying…"
            disabled={isDeploying || !canDeploy}
          >
            Deploy Registrar
          </Button>
        }
      />
      {globalError && <Alert variant="error">{globalError}</Alert>}
    </EERCToolShell>
  );
}
