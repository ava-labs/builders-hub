'use client';

import React from 'react';
import { Button } from '@/components/toolbox/components/Button';
import { Alert } from '@/components/toolbox/components/Alert';
import { useContractDeployer } from '@/components/toolbox/hooks/contracts/core/useContractDeployer';
import { useEERCDeployStore } from '@/components/toolbox/stores/eercDeployStore';
import { EERCToolShell } from '../../shared/EERCToolShell';
import { HashChip, SpecRow } from '@/components/explorer-v2/ui';
import { ENCRYPTED_ERC_SOURCES, EERC_COMMIT } from '@/lib/eerc/contractSources';
import EncryptedERCArtifact from '@/contracts/encrypted-erc/compiled/EncryptedERC.json';
import { linkLibraries } from '@/lib/eerc/linkLibraries';
import type { Hex } from '@/lib/eerc/types';
import { Code } from '../../shared/ui';
import { ContractCard, Missing, PANE_HEIGHT } from '../ui';

export default function DeployEERCStep() {
  const s = useEERCDeployStore();
  const { deploy, isDeploying } = useContractDeployer();

  const prereqsMet =
    s.babyJubJubAddress.length > 0 &&
    s.verifiers.mint.length > 0 &&
    s.verifiers.transfer.length > 0 &&
    s.verifiers.withdraw.length > 0 &&
    s.verifiers.burn.length > 0 &&
    s.registrarAddress.length > 0;

  const handle = async () => {
    s.setGlobalError(null);
    try {
      const linkedBytecode = linkLibraries(
        EncryptedERCArtifact.bytecode as Hex,
        (EncryptedERCArtifact as { linkReferences?: Parameters<typeof linkLibraries>[1] }).linkReferences,
        { BabyJubJub: s.babyJubJubAddress as Hex },
      );

      const params = {
        registrar: s.registrarAddress,
        isConverter: s.mode === 'converter',
        name: s.mode === 'standalone' ? s.name : '',
        symbol: s.mode === 'standalone' ? s.symbol : '',
        decimals: s.decimals,
        mintVerifier: s.verifiers.mint,
        withdrawVerifier: s.verifiers.withdraw,
        transferVerifier: s.verifiers.transfer,
        burnVerifier: s.verifiers.burn,
      };

      const result = await deploy({
        abi: EncryptedERCArtifact.abi,
        bytecode: linkedBytecode,
        args: [params],
        name: `EncryptedERC (${s.mode})`,
      });
      s.setEncryptedERCAddress(result.contractAddress);
      s.setLastTxHash(result.hash);
    } catch (err) {
      s.setGlobalError(err instanceof Error ? err.message : 'Deploy failed');
    }
  };

  const linked: { label: string; value: string }[] = [
    { label: 'Registrar', value: s.registrarAddress },
    { label: 'BabyJubJub lib', value: s.babyJubJubAddress },
    { label: 'Mint verifier', value: s.verifiers.mint },
    { label: 'Transfer verifier', value: s.verifiers.transfer },
    { label: 'Withdraw verifier', value: s.verifiers.withdraw },
    { label: 'Burn verifier', value: s.verifiers.burn },
  ];

  return (
    <EERCToolShell
      contracts={ENCRYPTED_ERC_SOURCES}
      showNav={false}
      height={PANE_HEIGHT}
      academyHref="/academy/encrypted-erc/05-eerc-contracts-flow"
      footerLinks={[
        {
          label: 'Source',
          href: `https://github.com/ava-labs/EncryptedERC/blob/${EERC_COMMIT}/contracts/EncryptedERC.sol`,
        },
      ]}
    >
      {!prereqsMet && <Alert variant="warning">Complete all previous steps first.</Alert>}
      <ContractCard
        name="EncryptedERC"
        description={
          <>
            The main contract. The BabyJubJub address from step 2 is linked into its bytecode, and the four operation
            verifiers and the Registrar go in as a <Code>CreateEncryptedERCParams</Code> struct.
          </>
        }
        address={s.encryptedERCAddress}
        deploying={isDeploying}
        blocked={!prereqsMet}
        onRedeploy={() => s.setEncryptedERCAddress('')}
        inputs={
          <>
            <SpecRow label="Mode">
              <span className="font-mono text-[12.5px] uppercase tracking-[0.08em]">{s.mode}</span>
            </SpecRow>
            {s.mode === 'standalone' && (
              <>
                <SpecRow label="Name">{s.name || <Missing>—</Missing>}</SpecRow>
                <SpecRow label="Symbol">
                  {s.symbol ? <span className="font-mono">{s.symbol}</span> : <Missing>—</Missing>}
                </SpecRow>
              </>
            )}
            <SpecRow label="Decimals">
              <span className="font-mono">{s.decimals}</span>
            </SpecRow>
            {linked.map((l) => (
              <SpecRow key={l.label} label={l.label}>
                {l.value ? <HashChip value={l.value} len={18} /> : <Missing />}
              </SpecRow>
            ))}
          </>
        }
        action={
          <Button
            variant="primary"
            onClick={handle}
            loading={isDeploying}
            loadingText="Deploying…"
            disabled={isDeploying || !prereqsMet}
          >
            Deploy EncryptedERC
          </Button>
        }
      />
      {s.globalError && <Alert variant="error">{s.globalError}</Alert>}
    </EERCToolShell>
  );
}
