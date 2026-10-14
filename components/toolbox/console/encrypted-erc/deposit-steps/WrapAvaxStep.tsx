'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useAccount, usePublicClient } from 'wagmi';
import { formatUnits, parseAbi, parseEther } from 'viem';
import { BookOpen, Check } from 'lucide-react';
import { Button } from '@/components/toolbox/components/Button';
import { RawInput } from '@/components/toolbox/components/Input';
import { Alert } from '@/components/toolbox/components/Alert';
import { useWrappedNativeToken } from '@/components/toolbox/hooks/useWrappedNativeToken';
import { useEERCDeployment } from '@/hooks/eerc/useEERCDeployment';
import { EERCToolShell } from '../shared/EERCToolShell';
import { EERCTxLink } from '../shared/EERCTxLink';
import { Choice, ChoiceGroup, Code, HairlineGrid, Panel, Reading } from '../shared/ui';
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
      showNav={false}
      footerLinks={[{ label: 'ERC-20', href: 'https://eips.ethereum.org/EIPS/eip-20', icon: <BookOpen /> }]}
    >
      <HairlineGrid cols={2}>
        <Reading
          label="AVAX (native)"
          value={avaxBalance === null ? '' : formatUnits(avaxBalance, 18).slice(0, 7)}
          loading={avaxBalance === null}
          sub="Pays gas"
        />
        <Reading
          label="WAVAX (ERC20)"
          value={wavaxBalance === null ? '' : formatUnits(wavaxBalance, 18).slice(0, 7)}
          loading={wavaxBalance === null}
          sub={
            hasWavax ? (
              <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                <Check className="h-3 w-3" />
                Ready to deposit
              </span>
            ) : (
              'Deposit spends this'
            )
          }
        />
      </HairlineGrid>

      <ChoiceGroup label="Direction">
        <Choice selected={mode === 'wrap'} onSelect={() => setMode('wrap')} title="Wrap" hint="AVAX → WAVAX" />
        <Choice selected={mode === 'unwrap'} onSelect={() => setMode('unwrap')} title="Unwrap" hint="WAVAX → AVAX" />
      </ChoiceGroup>

      <Panel label={mode === 'wrap' ? 'Wrap AVAX → WAVAX' : 'Unwrap WAVAX → AVAX'} bodyClassName="flex flex-col gap-4">
        <p className="text-[13px] leading-relaxed text-zinc-600 dark:text-zinc-400">
          {mode === 'wrap' ? (
            <>
              <Code>WAVAX.deposit()</Code> is payable: you get 1 WAVAX for every 1 AVAX sent. Already hold WAVAX? Skip
              this step.
            </>
          ) : (
            <>
              <Code>WAVAX.withdraw(amount)</Code> burns WAVAX and returns the same amount of native AVAX. Use it after
              an Encrypted ERC withdraw.
            </>
          )}
        </p>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch sm:gap-0">
          <RawInput
            type="number"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={mode === 'wrap' ? 'Amount of AVAX' : 'Amount of WAVAX'}
            className="h-10 flex-1 font-mono"
          />
          <div className="flex gap-2 sm:gap-0">
            <button
              type="button"
              onClick={setMax}
              className="h-10 whitespace-nowrap border border-zinc-200 px-3 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-zinc-600 transition-colors hover:border-zinc-900 hover:text-zinc-900 sm:-ml-px dark:border-zinc-800 dark:text-zinc-300 dark:hover:border-zinc-100 dark:hover:text-zinc-50"
              title={mode === 'wrap' ? 'Use max AVAX (keeps 0.1 for gas)' : 'Use full WAVAX balance'}
            >
              Max
            </button>
            <Button
              variant="primary"
              loading={busy}
              loadingText={mode === 'wrap' ? 'Wrapping…' : 'Unwrapping…'}
              disabled={!canSubmit || busy}
              onClick={submit}
              stickLeft
              className="h-10 flex-1 px-5 sm:flex-none"
            >
              {mode === 'wrap' ? 'Wrap' : 'Unwrap'}
            </Button>
          </div>
        </div>

        {error && <Alert variant="error">{error}</Alert>}
        {txHash && (
          <Alert variant={busy ? 'info' : 'success'}>
            {mode === 'wrap' ? 'Wrapped' : 'Unwrapped'}.{' '}
            <EERCTxLink chainId={converter.chainId} txHash={txHash}>
              {txHash.slice(0, 10)}…
            </EERCTxLink>
          </Alert>
        )}
        {hasWavax && mode === 'wrap' && (
          <p className="font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
            You have WAVAX. Click <span className="text-zinc-900 dark:text-zinc-50">Next</span> to deposit.
          </p>
        )}
      </Panel>
    </EERCToolShell>
  );
}
