'use client';

import React from 'react';
import Link from 'next/link';
import { Check, BookOpen, GraduationCap } from 'lucide-react';
import { Button } from '@/components/toolbox/components/Button';
import { useContractDeployer } from '@/components/toolbox/hooks/contracts/core/useContractDeployer';
import { useEERCDeployStore } from '@/components/toolbox/stores/eercDeployStore';
import { ContractDeployViewer } from '@/components/console/contract-deploy-viewer';
import { ENCRYPTED_ERC_SOURCES, EERC_COMMIT } from '@/lib/eerc/contractSources';
import EncryptedERCArtifact from '@/contracts/encrypted-erc/compiled/EncryptedERC.json';
import { linkLibraries } from '@/lib/eerc/linkLibraries';
import type { Hex } from '@/lib/eerc/types';

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

  const done = s.encryptedERCAddress.length > 0;

  return (
    <ContractDeployViewer contracts={ENCRYPTED_ERC_SOURCES}>
      <div className="flex flex-col h-[500px] rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
        <div className="flex-1 overflow-auto p-5 space-y-4">
          {!prereqsMet && (
            <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/10 p-3 text-xs text-amber-700 dark:text-amber-300">
              All previous steps must be completed first.
            </div>
          )}

          <div
            className={
              'p-4 rounded-xl border transition-colors ' +
              (done
                ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800'
                : 'bg-zinc-50 dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-700')
            }
          >
            <div className="flex items-start gap-3">
              <div
                className={
                  'shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-sm font-medium ' +
                  (done ? 'bg-green-500 text-white' : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300')
                }
              >
                {done ? <Check className="w-4 h-4" /> : '1'}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Deploy EncryptedERC</h3>
                <p className="mt-1.5 text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  The main contract. At deploy time we splice the BabyJubJub library address from step 2 into the
                  bytecode (library linking), then pass the four operation verifiers and Registrar as a{' '}
                  <code className="text-[10px] bg-zinc-100 dark:bg-zinc-800 px-1 rounded">
                    CreateEncryptedERCParams
                  </code>{' '}
                  struct.
                </p>
                <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                  <div>
                    Mode: <span className="text-zinc-700 dark:text-zinc-300">{s.mode}</span>
                  </div>
                  <div>
                    Decimals: <span className="text-zinc-700 dark:text-zinc-300">{s.decimals}</span>
                  </div>
                  {s.mode === 'standalone' && (
                    <>
                      <div>
                        Name: <span className="text-zinc-700 dark:text-zinc-300">{s.name || '—'}</span>
                      </div>
                      <div>
                        Symbol: <span className="text-zinc-700 dark:text-zinc-300">{s.symbol || '—'}</span>
                      </div>
                    </>
                  )}
                </div>

                {done ? (
                  <div className="mt-3 flex items-center gap-2">
                    <code className="px-2 py-1 rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 font-mono text-xs break-all">
                      {s.encryptedERCAddress}
                    </code>
                    <button
                      type="button"
                      onClick={() => s.setEncryptedERCAddress('')}
                      className="px-2 py-1 text-xs font-medium text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 border border-zinc-200 dark:border-zinc-700 rounded-md transition-colors"
                    >
                      Redeploy
                    </button>
                  </div>
                ) : (
                  <Button
                    variant="primary"
                    onClick={handle}
                    loading={isDeploying}
                    disabled={isDeploying || !prereqsMet}
                    className="mt-3"
                  >
                    Deploy EncryptedERC
                  </Button>
                )}
              </div>
            </div>
          </div>
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
                href={`https://github.com/ava-labs/EncryptedERC/blob/${EERC_COMMIT}/contracts/EncryptedERC.sol`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
              >
                <BookOpen className="w-3.5 h-3.5" />
                Source
              </a>
            </div>
            <a
              href={`https://github.com/ava-labs/EncryptedERC/tree/${EERC_COMMIT}`}
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
