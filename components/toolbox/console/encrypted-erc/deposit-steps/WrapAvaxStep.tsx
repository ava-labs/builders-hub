'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useAccount, usePublicClient } from 'wagmi';
import { formatUnits, parseAbi, parseEther } from 'viem';
import { BookOpen, Check } from 'lucide-react';
import { Button } from '@/components/toolbox/components/Button';
import { RawInput } from '@/components/toolbox/components/Input';
import { useWrappedNativeToken } from '@/components/toolbox/hooks/useWrappedNativeToken';
import { useEERCDeployment } from '@/hooks/eerc/useEERCDeployment';
import { EERCToolShell } from '../shared/EERCToolShell';
import { EERCTxLink } from '../shared/EERCTxLink';
import { WAVAX_SOURCES } from '@/lib/eerc/contractSources';

type Mode = 'wrap' | 'unwrap';

/**
 * Step 1 of the Deposit flow. Supports both directions — new users wrap AVAX
 * into WAVAX before deposit, while users unwinding an eERC position call
 * Withdraw first (which returns WAVAX) and then use this step's Unwrap mode
 * to get back to native AVAX.
 */
export default function WrapAvaxStep() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const converter = useEERCDeployment('converter');
  const token = converter.deployment?.supportedTokens?.[0]; // WAVAX
  const wrapped = useWrappedNativeToken();

  const [avaxBalance, setAvaxBalance] = useState<bigint | null>(null);
  const [wavaxBalance, setWavaxBalance] = useState<bigint | null>(null);
  const [mode, setMode] = useState<Mode>('wrap');
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

  // Clear the amount field when toggling modes so a "max" value for one
  // direction doesn't silently become the input for the other.
  useEffect(() => {
    setAmount('');
    setError(null);
    setTxHash(null);
  }, [mode]);

  const amountWei = (() => {
    if (!amount) return 0n;
    try {
      return parseEther(amount);
    } catch {
      return 0n;
    }
  })();
  const sourceBalance = mode === 'wrap' ? avaxBalance : wavaxBalance;
  // Wrap leaves 0.1 AVAX headroom for gas; unwrap has no gas-on-same-token concern.
  const canSubmit =
    amountWei > 0n &&
    sourceBalance !== null &&
    (mode === 'wrap' ? amountWei < sourceBalance : amountWei <= sourceBalance);

  const hasWavax = wavaxBalance !== null && wavaxBalance > 0n;

  const setMax = () => {
    if (!sourceBalance) return;
    if (mode === 'wrap') {
      setAmount(formatUnits(sourceBalance > 10n ** 17n ? sourceBalance - 10n ** 17n : 0n, 18));
    } else {
      setAmount(formatUnits(sourceBalance, 18));
    }
  };

  const submit = async () => {
    if (!amount || !publicClient) return;
    setError(null);
    setTxHash(null);
    setBusy(true);
    try {
      const hash = mode === 'wrap' ? await wrapped.deposit(amount) : await wrapped.withdraw(amount);
      setTxHash(hash);
      await publicClient.waitForTransactionReceipt({ hash: hash as `0x${string}` });
      await refresh();
      setAmount('');
    } catch (e) {
      setError(e instanceof Error ? e.message : `${mode === 'wrap' ? 'Wrap' : 'Unwrap'} failed`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <EERCToolShell
      contracts={WAVAX_SOURCES}
      footerLinks={[
        { label: 'ERC-20', href: 'https://eips.ethereum.org/EIPS/eip-20', icon: <BookOpen className="w-3.5 h-3.5" /> },
      ]}
    >
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="AVAX (native)" value={avaxBalance === null ? '…' : formatUnits(avaxBalance, 18).slice(0, 7)} />
        <StatCard
          label="WAVAX (ERC20)"
          value={wavaxBalance === null ? '…' : formatUnits(wavaxBalance, 18).slice(0, 7)}
          done={hasWavax}
        />
      </div>

      {/* Direction toggle */}
      <div className="flex items-center gap-1 p-1 rounded-lg bg-zinc-100 dark:bg-zinc-800/60 w-fit">
        <ToggleChip active={mode === 'wrap'} onClick={() => setMode('wrap')}>
          Wrap → WAVAX
        </ToggleChip>
        <ToggleChip active={mode === 'unwrap'} onClick={() => setMode('unwrap')}>
          Unwrap → AVAX
        </ToggleChip>
      </div>

      <div
        className={
          'p-4 rounded-xl border transition-colors ' +
          (hasWavax && mode === 'wrap'
            ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800'
            : 'bg-zinc-50 dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-700')
        }
      >
        <div className="flex items-start gap-3">
          <div
            className={
              'shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-sm font-medium ' +
              (hasWavax && mode === 'wrap'
                ? 'bg-green-500 text-white'
                : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300')
            }
          >
            {hasWavax && mode === 'wrap' ? <Check className="w-4 h-4" /> : '1'}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              {mode === 'wrap' ? 'Wrap AVAX → WAVAX' : 'Unwrap WAVAX → AVAX'}
            </h3>
            <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
              {mode === 'wrap'
                ? 'WAVAX.deposit() is payable — the contract mints you 1 WAVAX for every 1 AVAX sent. Users with WAVAX already can skip this step.'
                : 'WAVAX.withdraw(amount) burns your WAVAX and returns the equivalent amount of native AVAX. Use this after an eERC Withdraw to get back to native AVAX.'}
            </p>

            {/* Single-row layout: input + Max + primary CTA all share `h-10`
                so they sit on the same baseline. The previous Input wrapper
                added a label slot + mb-6, which left the buttons visually
                floating below the input field. */}
            <div className="mt-3 flex flex-col sm:flex-row sm:items-center gap-2">
              <RawInput
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={mode === 'wrap' ? 'Amount of AVAX' : 'Amount of WAVAX'}
                className="h-10 flex-1 rounded-md"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={setMax}
                  className="h-10 px-3 text-xs font-medium rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors whitespace-nowrap"
                  title={mode === 'wrap' ? 'Use max AVAX (reserves 0.1 for gas)' : 'Use full WAVAX balance'}
                >
                  Max
                </button>
                <Button
                  variant="primary"
                  loading={busy}
                  disabled={!canSubmit || busy}
                  onClick={submit}
                  className="h-10 !w-auto px-5"
                >
                  {mode === 'wrap' ? 'Wrap' : 'Unwrap'}
                </Button>
              </div>
            </div>
            {error && <div className="mt-2 text-[11px] text-red-600 dark:text-red-400">{error}</div>}
            {txHash && (
              <div className="mt-2 text-[11px]">
                <EERCTxLink chainId={converter.chainId} txHash={txHash}>
                  {mode === 'wrap' ? 'Wrapped' : 'Unwrapped'} — {txHash.slice(0, 10)}...
                </EERCTxLink>
              </div>
            )}
            {hasWavax && mode === 'wrap' && (
              <div className="mt-3 text-[11px] text-zinc-500 dark:text-zinc-400">
                You have WAVAX. Click <strong>Next</strong> to deposit.
              </div>
            )}
          </div>
        </div>
      </div>
    </EERCToolShell>
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

function ToggleChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? 'px-3 py-1.5 text-xs font-medium rounded-md bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-sm transition-colors'
          : 'px-3 py-1.5 text-xs font-medium rounded-md text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors'
      }
    >
      {children}
    </button>
  );
}
