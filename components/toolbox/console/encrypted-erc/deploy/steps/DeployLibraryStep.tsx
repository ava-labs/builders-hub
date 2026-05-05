'use client';

import React from 'react';
import Link from 'next/link';
import { Check, BookOpen, GraduationCap } from 'lucide-react';
import { Button } from '@/components/toolbox/components/Button';
import { useContractDeployer } from '@/components/toolbox/hooks/contracts/core/useContractDeployer';
import { useEERCDeployStore } from '@/components/toolbox/stores/eercDeployStore';
import { ContractDeployViewer } from '@/components/console/contract-deploy-viewer';
import { BABYJUBJUB_SOURCES, EERC_COMMIT } from '@/lib/eerc/contractSources';
import BabyJubJubArtifact from '@/contracts/encrypted-erc/compiled/BabyJubJub.json';

export default function DeployLibraryStep() {
  const { babyJubJubAddress, setBabyJubJubAddress, setLastTxHash, setGlobalError } = useEERCDeployStore();
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

  const done = babyJubJubAddress.length > 0;

  return (
    <ContractDeployViewer contracts={BABYJUBJUB_SOURCES}>
      <div className="flex flex-col h-[500px] rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
        <div className="flex-1 overflow-auto p-5 space-y-4">
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
                <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Deploy BabyJubJub library</h3>
                <p className="mt-1.5 text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  Solidity library implementing BabyJubJub curve operations on-chain. Deployed once and linked into the
                  EncryptedERC contract's bytecode in step 5.
                </p>

                {done ? (
                  <div className="mt-3 flex items-center gap-2">
                    <code className="px-2 py-1 rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 font-mono text-xs break-all">
                      {babyJubJubAddress}
                    </code>
                    <button
                      type="button"
                      onClick={() => setBabyJubJubAddress('')}
                      className="px-2 py-1 text-xs font-medium text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 border border-zinc-200 dark:border-zinc-700 rounded-md transition-colors"
                    >
                      Redeploy
                    </button>
                  </div>
                ) : (
                  <Button
                    variant="primary"
                    onClick={deployLibrary}
                    loading={isDeploying}
                    disabled={isDeploying}
                    className="mt-3"
                  >
                    Deploy library
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
                href="/academy/encrypted-erc"
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
              >
                <GraduationCap className="w-3.5 h-3.5" />
                Academy
              </Link>
              <a
                href="https://eips.ethereum.org/EIPS/eip-2494"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
              >
                <BookOpen className="w-3.5 h-3.5" />
                BabyJubJub EIP
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
