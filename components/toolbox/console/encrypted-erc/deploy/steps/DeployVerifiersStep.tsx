'use client';

import React, { useState } from 'react';
import { Button } from '@/components/toolbox/components/Button';
import { Alert } from '@/components/toolbox/components/Alert';
import { useContractDeployer } from '@/components/toolbox/hooks/contracts/core/useContractDeployer';
import { useEERCDeployStore } from '@/components/toolbox/stores/eercDeployStore';
import { EERCToolShell } from '../../shared/EERCToolShell';
import { HashChip } from '@/components/explorer-v2/ui';
import { cn } from '@/lib/utils';
import { VERIFIER_SOURCES, EERC_COMMIT } from '@/lib/eerc/contractSources';
import RegistrationArtifact from '@/contracts/encrypted-erc/compiled/verifiers/RegistrationVerifier.json';
import MintArtifact from '@/contracts/encrypted-erc/compiled/verifiers/MintVerifier.json';
import TransferArtifact from '@/contracts/encrypted-erc/compiled/verifiers/TransferVerifier.json';
import WithdrawArtifact from '@/contracts/encrypted-erc/compiled/verifiers/WithdrawVerifier.json';
import BurnArtifact from '@/contracts/encrypted-erc/compiled/verifiers/BurnVerifier.json';
import { BODY, PaneSection, StatusTag, WorkingCaption, type DeployStatus, PANE_HEIGHT } from '../ui';

type VerifierKind = 'registration' | 'mint' | 'transfer' | 'withdraw' | 'burn';

const ARTIFACTS: Record<VerifierKind, { abi: unknown; bytecode: string; label: string; blurb: string }> = {
  registration: {
    abi: RegistrationArtifact.abi,
    bytecode: RegistrationArtifact.bytecode,
    label: 'Registration',
    blurb: 'Checks the 5-signal proof that binds your BJJ public key to your EVM address.',
  },
  mint: {
    abi: MintArtifact.abi,
    bytecode: MintArtifact.bytecode,
    label: 'Mint',
    blurb: 'Checks the 24-signal privateMint proof. Standalone mode only.',
  },
  transfer: {
    abi: TransferArtifact.abi,
    bytecode: TransferArtifact.bytecode,
    label: 'Transfer',
    blurb: 'Checks the 32-signal transfer proof, the heaviest circuit.',
  },
  withdraw: {
    abi: WithdrawArtifact.abi,
    bytecode: WithdrawArtifact.bytecode,
    label: 'Withdraw',
    blurb: 'Checks the 16-signal withdraw proof. Converter mode only.',
  },
  burn: {
    abi: BurnArtifact.abi,
    bytecode: BurnArtifact.bytecode,
    label: 'Burn',
    blurb: 'Checks the 19-signal privateBurn proof. Standalone mode only.',
  },
};

const ORDER: VerifierKind[] = ['registration', 'mint', 'transfer', 'withdraw', 'burn'];

export default function DeployVerifiersStep() {
  const { verifiers, setVerifier, globalError, setGlobalError, setLastTxHash } = useEERCDeployStore();
  const { deploy } = useContractDeployer();
  const [inFlight, setInFlight] = useState<VerifierKind | null>(null);

  const deployOne = async (kind: VerifierKind) => {
    setInFlight(kind);
    setGlobalError(null);
    try {
      const a = ARTIFACTS[kind];
      const result = await deploy({
        abi: a.abi,
        bytecode: a.bytecode,
        args: [],
        name: `${a.label} verifier`,
      });
      setVerifier(kind, result.contractAddress);
      setLastTxHash(result.hash);
    } catch (err) {
      setGlobalError(err instanceof Error ? err.message : 'Deploy failed');
    } finally {
      setInFlight(null);
    }
  };

  const deployAllRemaining = async () => {
    for (const kind of ORDER) {
      if (!verifiers[kind]) await deployOne(kind);
    }
  };

  const doneCount = ORDER.filter((k) => verifiers[k].length > 0).length;
  const allDone = doneCount === ORDER.length;
  const anyDone = doneCount > 0;

  return (
    <EERCToolShell
      contracts={VERIFIER_SOURCES}
      showNav={false}
      height={PANE_HEIGHT}
      academyHref="/academy/encrypted-erc/05-eerc-contracts-flow"
      footerLinks={[
        { label: 'Circom docs', href: 'https://docs.circom.io/' },
        {
          label: 'Source',
          href: `https://github.com/ava-labs/EncryptedERC/tree/${EERC_COMMIT}/contracts/verifiers`,
        },
      ]}
    >
      <p className={BODY}>
        Five Groth16 verifiers, one per circuit. They check the ZK proofs at runtime. Each is independent, so deploy
        them in any order.
      </p>

      <PaneSection
        label="Verifiers"
        action={
          <span className="shrink-0 font-mono text-[11px] tabular-nums text-zinc-500 dark:text-zinc-400">
            <span className="text-zinc-900 dark:text-zinc-100">{doneCount}</span>/{ORDER.length} deployed
          </span>
        }
      >
        <ol className="divide-y divide-zinc-200 border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {ORDER.map((kind, i) => {
            const address = verifiers[kind];
            const deployed = address.length > 0;
            const pending = inFlight === kind;
            const status: DeployStatus = deployed ? 'done' : pending ? 'active' : 'idle';
            return (
              <li key={kind} className="grid grid-cols-[1.5rem_minmax(0,1fr)_auto] items-start gap-x-3 px-4 py-3.5">
                <span
                  className={cn(
                    'pt-0.5 font-mono text-[11px] font-bold tabular-nums',
                    pending ? 'text-[#E6212F]' : 'text-zinc-400 dark:text-zinc-500',
                  )}
                >
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div className="flex min-w-0 flex-col gap-1">
                  <h3 className="text-[13.5px] font-medium text-zinc-900 dark:text-zinc-50">
                    {ARTIFACTS[kind].label} verifier
                  </h3>
                  <p className="text-[12.5px] leading-relaxed text-zinc-500 dark:text-zinc-400">
                    {ARTIFACTS[kind].blurb}
                  </p>
                  {deployed && <HashChip value={address} len={18} className="mt-1" />}
                </div>
                <div className="flex flex-col items-end gap-2">
                  <StatusTag status={status} label={deployed ? 'Deployed' : pending ? 'Deploying' : 'Pending'} />
                  {!deployed && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-auto"
                      onClick={() => deployOne(kind)}
                      loading={pending}
                      loadingText="Deploying…"
                    >
                      Deploy
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </PaneSection>

      {!allDone && (
        <div className="flex flex-col gap-3">
          <Button
            variant="primary"
            onClick={deployAllRemaining}
            loading={inFlight !== null}
            loadingText={inFlight ? `Deploying ${ARTIFACTS[inFlight].label}…` : undefined}
          >
            {anyDone ? 'Deploy remaining' : 'Deploy all 5 verifiers'}
          </Button>
          {inFlight && (
            <WorkingCaption>
              {ARTIFACTS[inFlight].label} verifier, {ORDER.indexOf(inFlight) + 1} of {ORDER.length}. Confirm each deploy
              in your wallet.
            </WorkingCaption>
          )}
        </div>
      )}

      {globalError && <Alert variant="error">{globalError}</Alert>}
    </EERCToolShell>
  );
}
