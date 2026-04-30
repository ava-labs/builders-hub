'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAccount, usePublicClient } from 'wagmi';
import { formatUnits, parseAbi, parseUnits } from 'viem';
import { ArrowRight, BookOpen, Check, GraduationCap } from 'lucide-react';
import { Button } from '@/components/toolbox/components/Button';
import { Input } from '@/components/toolbox/components/Input';
import { useEERCDeployment } from '@/hooks/eerc/useEERCDeployment';
import { useEERCDeposit } from '@/hooks/eerc/useEERCDeposit';
import { useEERCAuditorAndTokenId } from '@/hooks/eerc/useEERCAuditorAndTokenId';
import { ContractDeployViewer } from '@/components/console/contract-deploy-viewer';
import { EERCStepNav } from '../shared/EERCStepNav';
import { EERCTxLink } from '../shared/EERCTxLink';
import { ENCRYPTED_ERC_SOURCES, EERC_COMMIT } from '@/lib/eerc/contractSources';

/**
 * Step 2 of the Deposit flow — wrap WAVAX into its encrypted form. Requires
 * the user to have already completed step 1 (hold some WAVAX) and to have
 * registered a BJJ identity.
 */
export default function DepositStep() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const converter = useEERCDeployment('converter');
  const deployment = converter.deployment;
  const token = deployment?.supportedTokens?.[0];
  const aud = useEERCAuditorAndTokenId(deployment, token?.address);
  const dep = useEERCDeposit(deployment, token);

  const [wavaxBalance, setWavaxBalance] = useState<bigint | null>(null);
  const [amount, setAmount] = useState('');

  const refresh = useCallback(async () => {
    if (!address || !publicClient || !token) return;
    const bal = (await publicClient.readContract({
      address: token.address,
      abi: parseAbi(['function balanceOf(address) view returns (uint256)']),
      functionName: 'balanceOf',
      args: [address],
    })) as bigint;
    setWavaxBalance(bal);
  }, [address, publicClient, token]);
  useEffect(() => {
    refresh();
  }, [refresh]);
  useEffect(() => {
    if (dep.status === 'success') refresh();
  }, [dep.status, refresh]);

  let depositWei: bigint | null = null;
  let parseError: string | null = null;
  if (amount && token) {
    try {
      depositWei = parseUnits(amount, token.decimals);
    } catch {
      parseError = 'Invalid amount';
    }
  }
  const preview = depositWei !== null ? dep.preview(depositWei) : { cents: 0n, dustWei: 0n };
  const busy =
    dep.status === 'checking-allowance' ||
    dep.status === 'approving' ||
    dep.status === 'depositing' ||
    dep.status === 'confirming';
  const done = dep.status === 'success';

  const canSubmit =
    depositWei !== null &&
    depositWei > 0n &&
    preview.cents > 0n &&
    wavaxBalance !== null &&
    depositWei <= wavaxBalance &&
    aud.isAuditorSet;
  const hasAllowance = depositWei !== null && dep.currentAllowance !== null && dep.currentAllowance >= depositWei;
  const canApprove =
    depositWei !== null && depositWei > 0n && wavaxBalance !== null && depositWei <= wavaxBalance && !hasAllowance;

  useEffect(() => {
    if (depositWei !== null && depositWei > 0n) {
      dep.refreshAllowance().catch(() => {
        /* surfaced when the user tries to submit */
      });
    }
  }, [depositWei, dep.refreshAllowance]);

  if (!deployment || !token) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/50 p-6 text-sm">
        <p className="font-medium mb-1 text-zinc-900 dark:text-zinc-100">No converter deployment on this chain.</p>
        <p className="text-zinc-600 dark:text-zinc-400">Switch to Avalanche Fuji to use the canonical converter.</p>
      </div>
    );
  }

  return (
    <>
      {/* Persistent step-nav so users can hop to Register / Withdraw /
          Balance / Auditor without bouncing back to /overview. */}
      <EERCStepNav />
      <ContractDeployViewer contracts={ENCRYPTED_ERC_SOURCES}>
        <div className="flex flex-col h-[540px] rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
          <div className="flex-1 overflow-auto p-5 space-y-4">
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 p-3 flex items-center justify-between">
              <div className="text-[10px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                WAVAX (public)
              </div>
              <div className="font-mono text-sm text-zinc-900 dark:text-zinc-100">
                {wavaxBalance === null ? '…' : formatUnits(wavaxBalance, 18).slice(0, 7)}
              </div>
            </div>

            {!aud.isAuditorSet && !aud.isLoading && (
              <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/10 p-3 text-xs text-amber-700 dark:text-amber-300">
                Auditor public key not set on this deployment — deposits will revert. The deployment owner must complete{' '}
                <Link href="/console/encrypted-erc/register" className="underline font-medium">
                  Register
                </Link>{' '}
                +{' '}
                <Link href="/console/encrypted-erc/deploy/auditor" className="underline font-medium">
                  Set Auditor
                </Link>{' '}
                first.
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
                  {done ? <Check className="w-4 h-4" /> : '2'}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Deposit WAVAX → eWAVAX</h3>
                  <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    Signs an ERC20{' '}
                    <code className="text-[10px] bg-zinc-100 dark:bg-zinc-800 px-1 rounded">approve</code> (if allowance
                    is insufficient), then calls{' '}
                    <code className="text-[10px] bg-zinc-100 dark:bg-zinc-800 px-1 rounded">
                      EncryptedERC.deposit(amount, token, amountPCT[7])
                    </code>
                    . No ZK proof — just a Poseidon ciphertext of the amount encrypted under your public key.
                  </p>

                  <div className="mt-3">
                    <Input
                      label=""
                      value={amount}
                      onChange={setAmount}
                      placeholder="Amount of WAVAX to deposit"
                      type="number"
                      step="0.01"
                    />
                  </div>

                  {depositWei !== null && depositWei > 0n && (
                    <div className="mt-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-3 text-xs space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-zinc-500 dark:text-zinc-400">Public</span>
                        <span className="font-mono text-zinc-800 dark:text-zinc-200">
                          {formatUnits(depositWei, token.decimals)} WAVAX
                        </span>
                      </div>
                      <div className="flex items-center justify-center text-zinc-400 dark:text-zinc-600">
                        <ArrowRight className="w-3 h-3" />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-zinc-500 dark:text-zinc-400">Encrypted credit</span>
                        <span className="font-mono text-emerald-700 dark:text-emerald-400">
                          {(Number(preview.cents) / 100).toFixed(2)} eWAVAX
                        </span>
                      </div>
                      {preview.dustWei > 0n && (
                        <div className="mt-2 rounded border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/10 p-2 text-amber-700 dark:text-amber-300">
                          <strong>Dust refund:</strong> {formatUnits(preview.dustWei, token.decimals)} WAVAX won't fit
                          eERC's {deployment.decimals}-decimal form — the contract transfers dust back to you.
                        </div>
                      )}
                      {preview.cents === 0n && (
                        <div className="mt-2 rounded border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10 p-2 text-red-700 dark:text-red-300">
                          Amount too small — converts to 0 cents. Enter at least 0.01 WAVAX.
                        </div>
                      )}
                      {wavaxBalance !== null && depositWei > wavaxBalance && (
                        <div className="mt-2 rounded border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10 p-2 text-red-700 dark:text-red-300">
                          Exceeds your WAVAX balance ({formatUnits(wavaxBalance, token.decimals)}). Go back to step 1 to
                          wrap more.
                        </div>
                      )}
                    </div>
                  )}

                  {parseError && <div className="mt-2 text-[11px] text-red-600 dark:text-red-400">{parseError}</div>}
                  {dep.error && <div className="mt-2 text-[11px] text-red-600 dark:text-red-400">{dep.error}</div>}
                  {dep.status === 'success' && dep.txHash && (
                    <div className="mt-2 text-[11px]">
                      <EERCTxLink chainId={converter.chainId} txHash={dep.txHash}>
                        Deposited — {dep.txHash.slice(0, 10)}...
                      </EERCTxLink>
                    </div>
                  )}

                  <div className="mt-3">
                    <p className="mb-2 text-[11px] text-zinc-500 dark:text-zinc-400">
                      {depositWei === null || depositWei <= 0n
                        ? 'Enter an amount to see the next transaction.'
                        : dep.currentAllowance === null
                          ? 'Checking WAVAX allowance...'
                          : hasAllowance
                            ? 'Allowance is ready. The next transaction deposits into EncryptedERC.'
                            : 'Approval required first. The deposit transaction appears after approval confirms.'}
                    </p>
                    {!hasAllowance ? (
                      <Button
                        variant="primary"
                        loading={dep.status === 'approving' || dep.status === 'confirming'}
                        disabled={!canApprove || busy}
                        onClick={() => {
                          if (depositWei !== null)
                            dep.approve(depositWei).catch(() => {
                              /* surfaced via dep.error */
                            });
                        }}
                      >
                        {dep.status === 'approving'
                          ? 'Approving WAVAX...'
                          : dep.status === 'confirming'
                            ? 'Confirming approval...'
                            : 'Approve WAVAX'}
                      </Button>
                    ) : (
                      <Button
                        variant="primary"
                        loading={dep.status === 'depositing' || dep.status === 'confirming'}
                        disabled={!canSubmit || busy}
                        onClick={() => {
                          if (depositWei !== null)
                            dep.deposit(depositWei).catch(() => {
                              /* surfaced via dep.error */
                            });
                        }}
                      >
                        {dep.status === 'depositing'
                          ? 'Depositing...'
                          : dep.status === 'confirming'
                            ? 'Confirming deposit...'
                            : 'Deposit'}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="shrink-0 px-5 py-4 border-t border-zinc-200/80 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Link
                  href="/academy/encrypted-erc/04-usability-eerc"
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
                >
                  <GraduationCap className="w-3.5 h-3.5" />
                  Academy
                </Link>
                <a
                  href={`https://github.com/ava-labs/EncryptedERC/blob/${EERC_COMMIT}/contracts/EncryptedERC.sol#L250`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  deposit() source
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
    </>
  );
}
