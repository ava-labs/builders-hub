'use client';

import { useEffect, useState, useCallback } from 'react';
import { Check, ArrowUpRight, RefreshCw, Copy, RotateCcw } from 'lucide-react';
import { Steps, Step } from '@/components/toolbox/components/Steps';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { Button } from '../../components/Button';
import { Alert } from '../../components/Alert';
import { Board, BoardHeader, HashChip, SpecPlate, SpecRow, UNIT } from '@/components/explorer-v2/ui';
import { CoreWalletTransactionButton } from '@/components/toolbox/components/CoreWalletTransactionButton';
import SelectValidationID, { ValidationSelection } from '../../components/SelectValidationID';
import SelectSubnetId from '../../components/SelectSubnetId';
import { WalletRequirementsConfigKey } from '../../hooks/useWalletRequirements';
import {
  BaseConsoleToolProps,
  ConsoleToolMetadata,
  withConsoleToolMetadata,
} from '../../components/WithConsoleToolMetadata';
import { useConnectedWallet } from '@/components/toolbox/contexts/ConnectedWalletContext';
import { generateConsoleToolGitHubUrl } from '@/components/toolbox/utils/githubUrl';
import useConsoleNotifications from '@/hooks/useConsoleNotifications';
import { SDKCodeViewer, type SDKCodeSource } from '@/components/console/sdk-code-viewer';
import { cn } from '@/lib/utils';
import { parsePChainError } from '@/components/toolbox/hooks/contracts';
import { useSubmitPChainTx } from '@/components/toolbox/hooks/useSubmitPChainTx';
import { waitForPChainConfirmation } from '@/components/toolbox/utils/pchainConfirmation';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const metadata: ConsoleToolMetadata = {
  title: 'Validator Balance Increase',
  description: 'Increase the balance of a validator to extend its validation period and maintain network participation',
  toolRequirements: [WalletRequirementsConfigKey.WalletConnected],
  githubUrl: generateConsoleToolGitHubUrl(import.meta.url),
};

// The actual source code from components/toolbox/coreViem/methods/increaseL1ValidatorBalance.ts
const INCREASE_BALANCE_SOURCE = `import type { AvalancheWalletClient } from "@avalanche-sdk/client";

export type IncreaseL1ValidatorBalanceParams = {
    validationId: string;
    balanceInAvax: number;
}

export async function increaseL1ValidatorBalance(
    client: AvalancheWalletClient,
    params: IncreaseL1ValidatorBalanceParams
): Promise<string> {
    // Prepare the transaction using Avalanche SDK
    const txnRequest = await client.pChain.prepareIncreaseL1ValidatorBalanceTxn({
        validationId: params.validationId,
        balanceInAvax: params.balanceInAvax,
    });

    // Send the transaction
    const result = await client.sendXPTransaction(txnRequest);

    return result.txHash;
}`;

const SDK_SOURCES: SDKCodeSource[] = [
  {
    name: 'TypeScript',
    filename: 'increaseL1ValidatorBalance.ts',
    code: INCREASE_BALANCE_SOURCE,
    description:
      'Increase L1 validator balance using the Avalanche SDK. The balance funds continuous validation fees on the P-Chain.',
    githubUrl:
      'https://github.com/ava-labs/builders-hub/blob/master/components/toolbox/coreViem/methods/increaseL1ValidatorBalance.ts',
  },
];

function ValidatorBalanceIncrease({ onSuccess }: BaseConsoleToolProps) {
  const [amount, setAmount] = useState<string>('');
  const [subnetId, setSubnetId] = useState<string>('');
  const [validatorSelection, setValidatorSelection] = useState<ValidationSelection>({ validationId: '', nodeId: '' });
  const [loading, setLoading] = useState<boolean>(false);
  const [operationSuccessful, setOperationSuccessful] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [validatorTxId, setValidatorTxId] = useState<string>('');
  const [txCopied, setTxCopied] = useState(false);

  const { pChainAddress, isTestnet } = useWalletStore();
  const updatePChainBalance = useWalletStore((s) => s.updatePChainBalance);
  const pChainBalance = useWalletStore((s) => s.balances.pChain);
  const { coreWalletClient } = useConnectedWallet();
  const { notify } = useConsoleNotifications();
  const { submitPChainTx } = useSubmitPChainTx();

  useEffect(() => {
    if (pChainAddress) {
      updatePChainBalance();
      const interval = setInterval(updatePChainBalance, 10000);
      return () => clearInterval(interval);
    }
  }, [pChainAddress, updatePChainBalance]);

  const increaseValidatorBalance = async () => {
    if (!pChainAddress || !validatorSelection.validationId || !amount) {
      setError('Missing required information');
      return;
    }
    const amountNumber = Number(amount);
    if (isNaN(amountNumber) || amountNumber <= 0) {
      setError('Invalid amount provided.');
      return;
    }
    if (amountNumber > pChainBalance) {
      setError('Amount exceeds available P-Chain balance.');
      return;
    }

    setLoading(true);
    setError(null);
    setOperationSuccessful(false);
    setValidatorTxId('');

    try {
      if (!coreWalletClient) {
        setError(
          'P-Chain transactions need Core or a Console wallet. Connect one from the top bar, or use the CLI alternative below.',
        );
        setLoading(false);
        return;
      }

      const txHash = await submitPChainTx(async (client) => {
        const txPromise = client.increaseL1ValidatorBalance({
          validationId: validatorSelection.validationId,
          balanceInAvax: amountNumber,
        });
        notify('increaseL1ValidatorBalance', txPromise);
        return txPromise;
      });

      // Wait for P-Chain confirmation before declaring success
      await waitForPChainConfirmation(txHash, isTestnet);

      setValidatorTxId(txHash);
      setOperationSuccessful(true);
      onSuccess?.();

      await delay(2000);
      await updatePChainBalance();
    } catch (error) {
      console.error('Error increasing validator balance:', error);
      setError(parsePChainError(error));
    } finally {
      setLoading(false);
    }
  };

  const clearForm = () => {
    setAmount('');
    setSubnetId('');
    setValidatorSelection({ validationId: '', nodeId: '' });
    setError(null);
    setOperationSuccessful(false);
    setValidatorTxId('');
  };

  const handleCopyTx = useCallback(async () => {
    await navigator.clipboard.writeText(validatorTxId);
    setTxCopied(true);
    setTimeout(() => setTxCopied(false), 2000);
  }, [validatorTxId]);

  const explorerUrl = `/explorer/${isTestnet ? 'fuji' : 'mainnet'}/p-chain/tx/${validatorTxId}`;
  const isDisabled =
    loading || !validatorSelection.validationId || !amount || Number(amount) <= 0 || Number(amount) > pChainBalance;

  const lowerError = error?.toLowerCase() ?? '';
  const amountError = error && (lowerError.includes('amount') || lowerError.includes('balance')) ? error : null;
  const generalError =
    error &&
    !lowerError.includes('amount') &&
    !lowerError.includes('balance') &&
    !lowerError.includes('validation') &&
    !lowerError.includes('subnet')
      ? error
      : null;
  const overBalance = amount !== '' && Number(amount) > pChainBalance;

  return (
    <SDKCodeViewer sources={SDK_SOURCES} height="auto">
      <div className="not-prose">
        {operationSuccessful ? (
          <div className="flex flex-col gap-4">
            <Board className="border-x border-t">
              <BoardHeader label="Balance increased" display action={<Confirmed />} />
              <SpecPlate className="px-5 md:px-6">
                <SpecRow label="Added">
                  <span className="font-mono tabular-nums">
                    {amount} <span className={UNIT}>AVAX</span>
                  </span>
                </SpecRow>
                {subnetId && (
                  <SpecRow label="L1">
                    <HashChip value={subnetId} len={16} />
                  </SpecRow>
                )}
                <SpecRow label="Validation ID">
                  <HashChip value={validatorSelection.validationId} len={16} />
                </SpecRow>
                <SpecRow label="Transaction">
                  <span className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1">
                    <span className="inline-flex min-w-0 items-center gap-1.5">
                      <code className="min-w-0 break-all font-mono text-[13px] text-zinc-700 dark:text-zinc-300">
                        {validatorTxId}
                      </code>
                      <button
                        type="button"
                        onClick={handleCopyTx}
                        aria-label="Copy transaction ID"
                        className="-m-1.5 shrink-0 p-1.5 text-zinc-400 transition-colors hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-zinc-100"
                      >
                        {txCopied ? <Check className="h-3 w-3 text-[#E6212F]" /> : <Copy className="h-3 w-3" />}
                      </button>
                    </span>
                    <a
                      href={explorerUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group/tx inline-flex shrink-0 items-center gap-1 font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-zinc-700 underline-offset-4 hover:text-zinc-900 hover:underline dark:text-zinc-300 dark:hover:text-zinc-100"
                    >
                      Explorer
                      <ArrowUpRight className="h-3 w-3 text-[#E6212F] transition-transform group-hover/tx:-translate-y-0.5 group-hover/tx:translate-x-0.5" />
                    </a>
                  </span>
                </SpecRow>
              </SpecPlate>
            </Board>

            <Button variant="outline" onClick={clearForm} icon={<RotateCcw className="h-3.5 w-3.5" />}>
              Increase Another Balance
            </Button>
          </div>
        ) : (
          <Steps>
            <Step>
              <h3>Select L1</h3>
              <p>Choose the L1 your validator runs on.</p>
              <SelectSubnetId
                value={subnetId}
                onChange={setSubnetId}
                hidePrimaryNetwork={true}
                error={error && error.toLowerCase().includes('subnet') ? error : undefined}
              />
            </Step>

            <Step>
              <h3>Select Validator</h3>
              <p>Choose the validator whose balance you want to increase.</p>
              <SelectValidationID
                value={validatorSelection.validationId}
                onChange={setValidatorSelection}
                format="cb58"
                subnetId={subnetId}
                error={error && error.toLowerCase().includes('validation') ? error : undefined}
              />
            </Step>

            <Step>
              <h3>Enter Amount</h3>
              <p>The AVAX to add to the validator&apos;s balance. It pays the continuous validation fee.</p>

              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-3">
                  <label htmlFor="balance-topup-amount" className={EYEBROW}>
                    Amount
                  </label>
                  <span className="inline-flex items-center gap-2">
                    <span className={EYEBROW}>P-Chain balance</span>
                    <span
                      className={cn(
                        'font-mono text-[12px] tabular-nums',
                        overBalance ? 'text-red-600 dark:text-red-400' : 'text-zinc-900 dark:text-zinc-50',
                      )}
                    >
                      {pChainBalance.toFixed(4)} <span className={UNIT}>AVAX</span>
                    </span>
                    <button
                      type="button"
                      onClick={loading ? undefined : updatePChainBalance}
                      disabled={loading}
                      aria-label="Refresh P-Chain balance"
                      className="-m-1 p-1 text-zinc-400 transition-colors hover:text-zinc-900 disabled:opacity-50 dark:text-zinc-500 dark:hover:text-zinc-100"
                    >
                      <RefreshCw className="h-3 w-3" />
                    </button>
                  </span>
                </div>
                <div className="relative">
                  <input
                    id="balance-topup-amount"
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.0"
                    step="0.001"
                    min="0"
                    disabled={loading}
                    aria-invalid={amountError ? true : undefined}
                    className={cn(
                      'h-10 w-full border bg-white px-3 pr-16 font-mono text-[13px] tabular-nums text-zinc-900 transition-colors placeholder:text-zinc-400 focus:outline-none disabled:opacity-60 dark:bg-zinc-950 dark:text-zinc-100',
                      '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
                      amountError || overBalance
                        ? 'border-red-500 focus:border-red-600 dark:border-red-500 dark:focus:border-red-400'
                        : 'border-zinc-300 focus:border-zinc-900 dark:border-zinc-700 dark:focus:border-zinc-100',
                    )}
                  />
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-y-0 right-3 flex items-center font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500"
                  >
                    AVAX
                  </span>
                </div>
                {amountError ? (
                  <p className="text-[12px] text-red-600 dark:text-red-400">{amountError}</p>
                ) : overBalance ? (
                  <p className="text-[12px] text-red-600 dark:text-red-400">More than your P-Chain balance.</p>
                ) : null}
              </div>

              <Board className="border-x border-t">
                <BoardHeader
                  label="Summary"
                  action={<span className={EYEBROW}>{isTestnet ? 'Fuji' : 'Mainnet'}</span>}
                />
                <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 px-5 py-4 text-[13px] md:px-6">
                  <dt className="text-zinc-500 dark:text-zinc-400">Validation ID</dt>
                  <dd className="flex min-w-0 justify-end text-right">
                    {validatorSelection.validationId ? (
                      <HashChip value={validatorSelection.validationId} len={12} />
                    ) : (
                      <span className="font-mono text-zinc-400 dark:text-zinc-500">—</span>
                    )}
                  </dd>
                  <dt className="text-zinc-500 dark:text-zinc-400">Amount</dt>
                  <dd className="text-right font-mono tabular-nums text-zinc-900 dark:text-zinc-50">
                    {amount || '—'} <span className={UNIT}>AVAX</span>
                  </dd>
                </dl>
              </Board>

              {generalError && <Alert variant="error">{generalError}</Alert>}

              <CoreWalletTransactionButton
                onClick={increaseValidatorBalance}
                loading={loading}
                loadingText="Increasing Balance..."
                disabled={isDisabled}
                className="w-full"
                cliCommand={`platform-cli l1 increase-validator-balance --validation-id ${validatorSelection.validationId || '<validation-id>'} --balance ${amount || '<amount>'} --network ${isTestnet ? 'fuji' : 'mainnet'} --key-name <your-key-name>`}
              >
                Increase Balance
              </CoreWalletTransactionButton>
            </Step>
          </Steps>
        )}
      </div>
    </SDKCodeViewer>
  );
}

function Confirmed() {
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-400">
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400" />
      Confirmed
    </span>
  );
}

const EYEBROW = 'font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400';

export default withConsoleToolMetadata(ValidatorBalanceIncrease, metadata);
