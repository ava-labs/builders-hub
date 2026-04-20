'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAccount, usePublicClient } from 'wagmi';
import { formatUnits, parseAbi, parseEther } from 'viem';
import { BookOpen, Check, GraduationCap } from 'lucide-react';
import { Button } from '@/components/toolbox/components/Button';
import { Input } from '@/components/toolbox/components/Input';
import { useWrappedNativeToken } from '@/components/toolbox/hooks/useWrappedNativeToken';
import { useEERCDeployment } from '@/hooks/eerc/useEERCDeployment';
import { ContractDeployViewer } from '@/components/console/contract-deploy-viewer';
import { WAVAX_SOURCES, EERC_COMMIT } from '@/lib/eerc/contractSources';

/**
 * Step 1 of the Deposit flow — wrap AVAX into WAVAX. eERC's converter only
 * accepts ERC20s, so users with native AVAX (every Fuji wallet with faucet)
 * need this one-line intermediate before they can deposit.
 */
export default function WrapAvaxStep() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const converter = useEERCDeployment('converter');
  const token = converter.deployment?.supportedTokens?.[0]; // WAVAX
  const wrapped = useWrappedNativeToken();

  const [avaxBalance, setAvaxBalance] = useState<bigint | null>(null);
  const [wavaxBalance, setWavaxBalance] = useState<bigint | null>(null);
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!address || !publicClient || !token) return;
    const [n, w] = await Promise.all([
      publicClient.getBalance({ address }),
      publicClient.readContract({
        address: token.address,
        abi: parseAbi(['function balanceOf(address) view returns (uint256)']),
        functionName: 'balanceOf',
        args: [address],
      }) as Promise<bigint>,
    ]);
    setAvaxBalance(n);
    setWavaxBalance(w);
  }, [address, publicClient, token]);
  useEffect(() => {
    refresh();
  }, [refresh]);

  const wrapWei = (() => {
    if (!amount) return 0n;
    try {
      return parseEther(amount);
    } catch {
      return 0n;
    }
  })();
  // Leave 0.1 AVAX for gas on max.
  const canWrap = wrapWei > 0n && avaxBalance !== null && wrapWei < avaxBalance;
  const done = wavaxBalance !== null && wavaxBalance > 0n;

  const handleWrap = async () => {
    if (!amount || !publicClient) return;
    setError(null);
    setTxHash(null);
    setBusy(true);
    try {
      const hash = await wrapped.deposit(amount);
      setTxHash(hash);
      await publicClient.waitForTransactionReceipt({ hash: hash as `0x${string}` });
      await refresh();
      setAmount('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Wrap failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ContractDeployViewer contracts={WAVAX_SOURCES}>
      <div className="flex flex-col h-[540px] rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
        <div className="flex-1 overflow-auto p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              label="AVAX (native)"
              value={avaxBalance === null ? '…' : formatUnits(avaxBalance, 18).slice(0, 7)}
            />
            <StatCard
              label="WAVAX (ERC20)"
              value={wavaxBalance === null ? '…' : formatUnits(wavaxBalance, 18).slice(0, 7)}
              done={done}
            />
          </div>

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
                <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Wrap AVAX → WAVAX</h3>
                <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  WAVAX.deposit() is payable — the contract mints you 1 WAVAX for every 1 AVAX sent. Users with WAVAX
                  already can skip this step and jump to Deposit.
                </p>

                <div className="mt-3 flex flex-col sm:flex-row gap-2">
                  <div className="flex-1">
                    <Input
                      label=""
                      value={amount}
                      onChange={setAmount}
                      placeholder="Amount of AVAX"
                      type="number"
                      step="0.01"
                    />
                  </div>
                  <div className="flex items-end gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        avaxBalance &&
                        setAmount(formatUnits(avaxBalance > 10n ** 17n ? avaxBalance - 10n ** 17n : 0n, 18))
                      }
                      className="h-10 px-3 text-xs font-medium rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors whitespace-nowrap"
                      title="Use max AVAX (reserves 0.1 for gas)"
                    >
                      Max
                    </button>
                    <Button variant="primary" loading={busy} disabled={!canWrap || busy} onClick={handleWrap}>
                      Wrap
                    </Button>
                  </div>
                </div>
                {error && <div className="mt-2 text-[11px] text-red-600 dark:text-red-400">{error}</div>}
                {txHash && (
                  <div className="mt-2 text-[11px]">
                    <a
                      href={`https://testnet.snowtrace.io/tx/${txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline text-emerald-600 dark:text-emerald-400"
                    >
                      Wrapped — {txHash.slice(0, 10)}...
                    </a>
                  </div>
                )}
                {done && (
                  <div className="mt-3 text-[11px] text-zinc-500 dark:text-zinc-400">
                    You have WAVAX. Click <strong>Next</strong> to deposit.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <FooterStrip />
      </div>
    </ContractDeployViewer>
  );
}

function StatCard({ label, value, done }: { label: string; value: string; done?: boolean }) {
  return (
    <div
      className={
        done
          ? 'rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/50 dark:bg-emerald-900/10 p-3'
          : 'rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 p-3'
      }
    >
      <div className="text-[10px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{label}</div>
      <div className="font-mono text-sm mt-0.5 text-zinc-900 dark:text-zinc-100">{value}</div>
    </div>
  );
}

function FooterStrip() {
  return (
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
            href="https://eips.ethereum.org/EIPS/eip-20"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
          >
            <BookOpen className="w-3.5 h-3.5" />
            ERC-20
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
  );
}
