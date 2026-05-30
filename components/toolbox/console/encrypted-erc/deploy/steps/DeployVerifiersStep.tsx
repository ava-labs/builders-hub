'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Check, BookOpen, GraduationCap } from 'lucide-react';
import { Button } from '@/components/toolbox/components/Button';
import { useContractDeployer } from '@/components/toolbox/hooks/contracts/core/useContractDeployer';
import { useEERCDeployStore } from '@/components/toolbox/stores/eercDeployStore';
import { ContractDeployViewer } from '@/components/console/contract-deploy-viewer';
import { VERIFIER_SOURCES, EERC_COMMIT } from '@/lib/eerc/contractSources';
import RegistrationArtifact from '@/contracts/encrypted-erc/compiled/verifiers/RegistrationVerifier.json';
import MintArtifact from '@/contracts/encrypted-erc/compiled/verifiers/MintVerifier.json';
import TransferArtifact from '@/contracts/encrypted-erc/compiled/verifiers/TransferVerifier.json';
import WithdrawArtifact from '@/contracts/encrypted-erc/compiled/verifiers/WithdrawVerifier.json';
import BurnArtifact from '@/contracts/encrypted-erc/compiled/verifiers/BurnVerifier.json';

type VerifierKind = 'registration' | 'mint' | 'transfer' | 'withdraw' | 'burn';

const ARTIFACTS: Record<VerifierKind, { abi: unknown; bytecode: string; label: string; blurb: string }> = {
  registration: {
    abi: RegistrationArtifact.abi,
    bytecode: RegistrationArtifact.bytecode,
    label: 'Registration',
    blurb: 'Checks the 5-signal proof that binds your BJJ pubkey to your EVM address.',
  },
  mint: {
    abi: MintArtifact.abi,
    bytecode: MintArtifact.bytecode,
    label: 'Mint',
    blurb: 'Verifies the 24-signal privateMint proof (standalone mode only).',
  },
  transfer: {
    abi: TransferArtifact.abi,
    bytecode: TransferArtifact.bytecode,
    label: 'Transfer',
    blurb: 'Verifies the 32-signal transfer proof — the heaviest circuit.',
  },
  withdraw: {
    abi: WithdrawArtifact.abi,
    bytecode: WithdrawArtifact.bytecode,
    label: 'Withdraw',
    blurb: 'Verifies the 16-signal withdraw proof (converter mode only).',
  },
  burn: {
    abi: BurnArtifact.abi,
    bytecode: BurnArtifact.bytecode,
    label: 'Burn',
    blurb: 'Verifies the 19-signal privateBurn proof (standalone mode only).',
  },
};

const ORDER: VerifierKind[] = ['registration', 'mint', 'transfer', 'withdraw', 'burn'];

export default function DeployVerifiersStep() {
  const { verifiers, setVerifier, setGlobalError, setLastTxHash } = useEERCDeployStore();
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

  const allDone = ORDER.every((k) => verifiers[k].length > 0);
  const anyDone = ORDER.some((k) => verifiers[k].length > 0);

  return (
    <ContractDeployViewer contracts={VERIFIER_SOURCES}>
      <div className="flex flex-col h-[500px] rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
        <div className="flex-1 overflow-auto p-5 space-y-3">
          <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed mb-1">
            Five Groth16 verifiers — one per circuit. Each is independent and can be deployed in any order. These
            contracts actually check the ZK proofs at runtime.
          </p>

          {ORDER.map((kind, i) => {
            const address = verifiers[kind];
            const deployed = address.length > 0;
            const pending = inFlight === kind;
            return (
              <div
                key={kind}
                className={
                  'p-3 rounded-xl border transition-colors ' +
                  (deployed
                    ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800'
                    : 'bg-zinc-50 dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-700')
                }
              >
                <div className="flex items-start gap-3">
                  <div
                    className={
                      'shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-sm font-medium ' +
                      (deployed
                        ? 'bg-green-500 text-white'
                        : pending
                          ? 'bg-blue-500 text-white animate-pulse'
                          : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300')
                    }
                  >
                    {deployed ? <Check className="w-4 h-4" /> : i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                          {ARTIFACTS[kind].label} verifier
                        </h3>
                        <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                          {ARTIFACTS[kind].blurb}
                        </p>
                      </div>
                      {!deployed && (
                        <Button variant="secondary" size="sm" onClick={() => deployOne(kind)} loading={pending}>
                          Deploy
                        </Button>
                      )}
                    </div>
                    {deployed && (
                      <code className="mt-2 block break-all px-2 py-1 rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 font-mono text-[11px]">
                        {address}
                      </code>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {!allDone && (
            <Button variant="primary" onClick={deployAllRemaining} loading={inFlight !== null} className="w-full">
              {inFlight
                ? `Deploying ${ARTIFACTS[inFlight].label}...`
                : anyDone
                  ? 'Deploy remaining'
                  : 'Deploy all 5 verifiers'}
            </Button>
          )}
        </div>

        <div className="shrink-0 px-5 py-4 border-t border-zinc-200/80 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Link
                href="/academy/encrypted-erc/05-eerc-contracts-flow"
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
              >
                <GraduationCap className="w-3.5 h-3.5" />
                Academy
              </Link>
              <a
                href="https://docs.circom.io/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
              >
                <BookOpen className="w-3.5 h-3.5" />
                Circom docs
              </a>
            </div>
            <a
              href={`https://github.com/ava-labs/EncryptedERC/tree/${EERC_COMMIT}/contracts/verifiers`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 font-mono transition-colors"
            >
              @{EERC_COMMIT.slice(0, 7)}
            </a>
          </div>
        </div>
      </div>
    </ContractDeployViewer>
  );
}
