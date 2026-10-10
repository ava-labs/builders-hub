'use client';
import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { ArrowDownUp, Clock } from 'lucide-react';
import { Button } from '@/components/toolbox/components/Button';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { pvm, Utxo, TransferOutput, evm } from '@avalabs/avalanchejs';
import { toNanoAvax } from '@/components/toolbox/coreViem/utils/units';
import { getRPCEndpoint } from '@/components/toolbox/coreViem/utils/rpc';
import { useAvalancheContext } from '@/components/toolbox/hooks/useAvalancheContext';
import { WalletRequirementsConfigKey } from '@/components/toolbox/hooks/useWalletRequirements';
import { AmountInput } from '@/components/toolbox/components/AmountInput';
import { StepIndicator } from '@/components/toolbox/components/StepCard';
import { useConnectedWallet } from '@/components/toolbox/contexts/ConnectedWalletContext';
import {
  BaseConsoleToolProps,
  ConsoleToolMetadata,
  withConsoleToolMetadata,
} from '../../components/WithConsoleToolMetadata';
import { generateConsoleToolGitHubUrl } from '@/components/toolbox/utils/githubUrl';
import { SDKCodeViewer, type SDKCodeSource } from '@/components/console/sdk-code-viewer';
import { AutoSwitchChainGate } from '@/components/console/auto-switch-chain-gate';
import { CliAlternative } from '@/components/console/cli-alternative';
import useConsoleNotifications from '@/hooks/useConsoleNotifications';
import { classifyEvmTxError } from '@/components/toolbox/lib/evmErrors';
import { WALLET_REJECTED_TEXT } from '@/components/toolbox/lib/walletRejection';
import {
  baseFeeNanoAvax,
  blockedUtxosText,
  maxSpendableNanoAvax,
  MORE_UTXOS_TEXT,
  nanoAvaxText,
  newImportFeeCache,
  readImportableShare,
  readSharedMemory,
  toSdkUtxos,
  UTXO_PAGE_SIZE,
} from '@/components/toolbox/utils/sharedMemoryImport';
import Link from 'next/link';

// Extended props for this specific tool
interface CrossChainTransferProps extends BaseConsoleToolProps {
  /** Suggested amount to pre-fill in the transfer form */
  suggestedAmount?: string;
}

// Atomic export fee buffer: ~0.001 AVAX on both C-Chain (base-fee burn) and
// P-Chain (flat tx fee). MAX subtracts this so the user always has gas left.
const EXPORT_FEE_BUFFER_NAVAX = 1_000_000n;

const INVALID_AMOUNT_TEXT = 'Please enter a valid positive amount.';

/**
 * The error of the typed export amount, or null when the page can export it. maxSpendable: the balance less the fee
 * buffer, in nAVAX (maxSpendableNanoAvax).
 */
export function exportAmountError(amount: string, maxSpendable: bigint): string | null {
  const numericAmount = Number(amount);
  if (isNaN(numericAmount) || numericAmount <= 0) return INVALID_AMOUNT_TEXT;

  let amountNAvax: bigint;
  try {
    amountNAvax = toNanoAvax(amount);
  } catch {
    return INVALID_AMOUNT_TEXT;
  }
  // toNanoAvax rounds the 10th decimal, so an amount below 0.5 nAVAX becomes 0
  if (amountNAvax <= 0n) return 'Amount is below the smallest exportable unit (1 nAVAX).';
  if (amountNAvax > maxSpendable) {
    return `Amount exceeds available balance of ${nanoAvaxText(maxSpendable)} AVAX (your balance less 0.001 AVAX for the fees).`;
  }
  return null;
}

// Public API nodes no longer serve avax.getAtomicTxStatus after Helicon, so the
// SDK's waitForTxn fails for C-Chain atomic txs. Poll avax.getAtomicTx instead:
// it returns blockHeight once the tx is accepted, and a "not found" error before.
async function waitForCChainAtomicTx(isTestnet: boolean, txID: string, sleepTime = 2000, maxRetries = 30) {
  const endpoint = `${getRPCEndpoint(isTestnet)}/ext/bc/C/avax`;
  for (let i = 0; i < maxRetries; i++) {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'avax.getAtomicTx', params: { txID, encoding: 'hex' } }),
    });
    const { result, error } = (await res.json()) as {
      result?: { blockHeight?: string };
      error?: { message?: string };
    };
    if (result?.blockHeight) return;
    if (error && !/not found|could not find tx/i.test(error.message ?? '')) {
      throw new Error(`avax.getAtomicTx failed for ${txID}: ${error.message}`);
    }
    await new Promise((resolve) => setTimeout(resolve, sleepTime));
  }
  throw new Error(`Transaction ${txID} was not accepted on C-Chain after ${maxRetries} attempts`);
}

const metadata: ConsoleToolMetadata = {
  title: 'Cross-Chain Transfer',
  description: (
    <>
      Transfer AVAX between the{' '}
      <Link href="/docs/rpcs/c-chain" className="text-primary hover:underline">
        C-Chain
      </Link>{' '}
      and{' '}
      <Link href="/docs/rpcs/p-chain" className="text-primary hover:underline">
        P-Chain
      </Link>
      . Requires two{' '}
      <Link href="/docs/rpcs/p-chain/txn-format" className="text-primary hover:underline">
        transactions
      </Link>
      : export from the source, then import to the destination.
    </>
  ),
  toolRequirements: [WalletRequirementsConfigKey.WalletConnected],
  githubUrl: generateConsoleToolGitHubUrl(import.meta.url),
};

function CrossChainTransfer({ suggestedAmount = '0.0', onSuccess }: CrossChainTransferProps) {
  const [amount, setAmount] = useState<string>(suggestedAmount);
  const [sourceChain, setSourceChain] = useState<string>('c-chain');
  const [destinationChain, setDestinationChain] = useState<string>('p-chain');
  const [exportLoading, setExportLoading] = useState<boolean>(false);
  const [importLoading, setImportLoading] = useState<boolean>(false);
  const [exportTxId, setExportTxId] = useState<string>('');
  const [completedExportTxId, setCompletedExportTxId] = useState<string>('');
  const [_completedExportXPChain, setCompletedExportXPChain] = useState<'P' | 'C'>('P');
  const [_completedImportXPChain, setCompletedImportXPChain] = useState<'P' | 'C'>('P');
  const [importTxId, setImportTxId] = useState<string | null>(null);
  // The error of the export: the wallet, the network parameters, or the tx. The next Export click or a swap clears it.
  const [error, setError] = useState<string | null>(null);
  // The error of the typed amount (exportAmountError). A new amount or a new direction clears it.
  const [amountError, setAmountError] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  // The UTXOs of the next import: the wallet's own unlocked AVAX that one import takes, when the total is above the
  // import fee (sharedMemoryImport.ts). handleImport gives the SDK exactly these UTXOs.
  const [cToP_UTXOs, setC_To_P_UTXOs] = useState<Utxo<TransferOutput>[]>([]);
  const [pToC_UTXOs, setP_To_C_UTXOs] = useState<Utxo<TransferOutput>[]>([]);
  // The UTXOs in shared memory that this wallet cannot import, by the chain that would import them
  const [blockedUtxos, setBlockedUtxos] = useState<Record<'P' | 'C', number>>({ P: 0, C: 0 });
  // True for a side when shared memory holds more UTXOs than the page reads (readSharedMemory)
  const [moreUtxos, setMoreUtxos] = useState<Record<'P' | 'C', boolean>>({ P: false, C: false });
  // The fee price by side and set of UTXOs, so the 5 s poll reads the price once per set
  const importFeeCacheRef = useRef(newImportFeeCache());
  const isFetchingRef = useRef(false);
  const autoImportTriggeredRef = useRef(false);
  const handleImportRef = useRef<() => Promise<void>>(undefined);
  const [criticalError, setCriticalError] = useState<Error | null>(null);

  // Add states for step collapse timing
  const [step1AutoCollapse, setStep1AutoCollapse] = useState(false);
  const [step2AutoCollapse, setStep2AutoCollapse] = useState(false);

  // Throw critical errors during render to crash the component
  // This pattern is necessary for Next.js because:
  // 1. Error boundaries only catch errors during synchronous render
  // 2. Async errors (in callbacks, promises) need to be captured in state
  // 3. On next render, we throw synchronously so the error boundary catches it
  // This ensures blockchain-critical errors properly crash the component
  if (criticalError) {
    throw criticalError;
  }

  const { coreWalletClient } = useConnectedWallet();
  const { updateCChainBalance, updatePChainBalance } = useWalletStore();
  const { notify } = useConsoleNotifications();

  const isTestnet = useWalletStore((s) => s.isTestnet);
  const cChainBalance = useWalletStore((s) => s.balances.cChain);
  const pChainBalance = useWalletStore((s) => s.balances.pChain);
  const pChainAddress = useWalletStore((s) => s.pChainAddress);
  const walletEVMAddress = useWalletStore((s) => s.walletEVMAddress);
  const coreEthAddress = useWalletStore((s) => s.coreEthAddress);
  // Resolve the network Context server-side and pass it into the SDK so it never
  // fetches the AVAX assetID via a direct browser call to the public X-Chain
  // (which bypasses the wallet transport and fails from non-production origins).
  const { context: avalancheContext, error: contextError } = useAvalancheContext(Boolean(isTestnet));

  const sourceBalance = sourceChain === 'c-chain' ? cChainBalance : pChainBalance;
  // The most that the page exports: the balance less the fee buffer. The Max line, MAX and exportAmountError use it.
  const maxSpendable = maxSpendableNanoAvax(sourceBalance, EXPORT_FEE_BUFFER_NAVAX);
  const maxSpendableText = nanoAvaxText(maxSpendable);

  // Calculate total AVAX in UTXOs
  const totalCToPUtxoAmount = cToP_UTXOs.reduce((sum, utxo) => {
    return sum + Number(utxo.output.amt.value()) / 1_000_000_000;
  }, 0);

  const totalPToCUtxoAmount = pToC_UTXOs.reduce((sum, utxo) => {
    return sum + Number(utxo.output.amt.value()) / 1_000_000_000;
  }, 0);

  const onBalanceChanged = useCallback(async () => {
    try {
      await Promise.all([updateCChainBalance(), updatePChainBalance()]);
    } catch (e) {
      // Critical balance update failure - set error state to crash on next render
      setCriticalError(new Error(`Failed to update balances: ${e instanceof Error ? e.message : String(e)}`));
    }
  }, [updateCChainBalance, updatePChainBalance]);

  // Fetch UTXOs from both chains, page by page (readSharedMemory). Anyone can export a UTXO to the wallet's address, so
  // the page keeps only the wallet's own unlocked AVAX that one import takes when its total is above the import fee,
  // and counts the others (readImportableShare).
  const fetchUTXOs = useCallback(async () => {
    if (!pChainAddress || !walletEVMAddress || !avalancheContext || isFetchingRef.current) return false;

    isFetchingRef.current = true;

    // Store previous counts for comparison
    const prevCToPCount = cToP_UTXOs.length;
    const prevPToCCount = pToC_UTXOs.length;

    try {
      const platformEndpoint = getRPCEndpoint(Boolean(isTestnet));
      const pvmApi = new pvm.PVMApi(platformEndpoint);
      const evmApi = new evm.EVMApi(platformEndpoint);
      const feeCache = importFeeCacheRef.current;

      // Get C-chain UTXOs (for C->P transfers)
      const cChainUTXOs = await readSharedMemory((startIndex) =>
        pvmApi.getUTXOs({ addresses: [pChainAddress], sourceChain: 'C', limit: UTXO_PAGE_SIZE, startIndex }),
      );
      const toP = await readImportableShare({
        side: 'P',
        utxos: cChainUTXOs.utxos,
        address: pChainAddress,
        context: avalancheContext,
        readPrice: async () => (await pvmApi.getFeeState()).price,
        feeCache,
      });
      setC_To_P_UTXOs(toP.utxos);

      // Get P-chain UTXOs (for P->C transfers)
      const pChainUTXOs = await readSharedMemory((startIndex) =>
        evmApi.getUTXOs({ addresses: [coreEthAddress], sourceChain: 'P', limit: UTXO_PAGE_SIZE, startIndex }),
      );
      const toC = await readImportableShare({
        side: 'C',
        utxos: pChainUTXOs.utxos,
        address: coreEthAddress,
        context: avalancheContext,
        readPrice: async () => baseFeeNanoAvax(await evmApi.getBaseFee()),
        feeCache,
      });
      setP_To_C_UTXOs(toC.utxos);
      setBlockedUtxos((prev) =>
        prev.P === toP.blocked && prev.C === toC.blocked ? prev : { P: toP.blocked, C: toC.blocked },
      );
      const more = { P: !cChainUTXOs.complete, C: !pChainUTXOs.complete };
      setMoreUtxos((prev) => (prev.P === more.P && prev.C === more.C ? prev : more));

      // Return true if the number of importable UTXOs changed
      return prevCToPCount !== toP.utxos.length || prevPToCCount !== toC.utxos.length;
    } catch (e) {
      console.error('Error fetching UTXOs:', e);
      return false;
    } finally {
      isFetchingRef.current = false;
    }
  }, [
    pChainAddress,
    walletEVMAddress,
    coreEthAddress,
    isTestnet,
    avalancheContext,
    cToP_UTXOs.length,
    pToC_UTXOs.length,
  ]);

  const pollForUTXOChanges = useCallback(async () => {
    try {
      for (let i = 0; i < 15; i++) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        const utxosChanged = await fetchUTXOs();
        if (utxosChanged) break;
      }
    } catch (e) {
      // Critical UTXO fetch failure - blockchain state unknown
      setCriticalError(new Error(`Failed to fetch UTXOs: ${e instanceof Error ? e.message : String(e)}`));
    }
  }, [fetchUTXOs]);

  // Initial fetch of UTXOs and balances
  useEffect(() => {
    fetchUTXOs();
    onBalanceChanged();
  }, [coreWalletClient, walletEVMAddress, pChainAddress, fetchUTXOs, onBalanceChanged]);

  // Persistent polling for pending export UTXOs
  useEffect(() => {
    let interval: NodeJS.Timeout | undefined;
    let stopped = false;
    const poll = async () => {
      if (stopped) return;
      await fetchUTXOs();
    };
    // Poll every 5 seconds
    interval = setInterval(poll, 5000);
    // Initial fetch
    poll();
    return () => {
      stopped = true;
      if (interval) clearInterval(interval);
    };
  }, [walletEVMAddress, pChainAddress, fetchUTXOs]);

  // A new amount clears the error of the old amount. It keeps the error of the export.
  const changeAmount = (value: string) => {
    setAmount(value);
    setAmountError(null);
  };

  const handleMaxAmount = () => {
    changeAmount(maxSpendableText);
  };

  // Handler to swap source and destination chains
  const handleSwapChains = () => {
    const tempChain = sourceChain;
    setSourceChain(destinationChain);
    setDestinationChain(tempChain);
    setError(null);
    setAmountError(null);
    setImportError(null);
  };

  // Add handlers for buttons
  const handleExport = async () => {
    // A click starts a new attempt, so the error of the last attempt goes
    setError(null);
    const invalidAmount = exportAmountError(amount, maxSpendable);
    setAmountError(invalidAmount);
    if (invalidAmount) return;
    if (!coreWalletClient) {
      setError(
        'Cross-chain transfers require Core Wallet for P-Chain signing. Please connect with Core Wallet or use the CLI alternative below.',
      );
      return;
    }
    if (!avalancheContext) {
      setError(
        contextError
          ? `Could not load network parameters: ${contextError}`
          : 'Network parameters are still loading. Try again in a moment.',
      );
      return;
    }

    setExportLoading(true);
    autoImportTriggeredRef.current = false;

    // P-Chain/X-Chain transfer amounts are nAVAX (1 AVAX = 1e9 nAVAX). Parse
    // the typed decimal: `BigInt(0.5)` and the float drift from `amount * 1e9`
    // (e.g. 1.005 * 1e9 = 1004999999.9999999) both throw, and the SDK's
    // avaxToNanoAvax does exactly that multiplication. exportAmountError
    // checked above that the amount parses to at least 1 nAVAX.
    const amountNAvax = toNanoAvax(amount);

    const exportPromise = (async () => {
      if (sourceChain === 'c-chain') {
        const txnRequest = await coreWalletClient.cChain.prepareExportTxn({
          destinationChain: 'P',
          exportedOutput: {
            addresses: [pChainAddress],
            amount: amountNAvax,
          },
          fromAddress: walletEVMAddress as `0x${string}`,
          context: avalancheContext,
        });
        const txnResponse = await coreWalletClient.sendXPTransaction(txnRequest);
        await waitForCChainAtomicTx(Boolean(isTestnet), String(txnResponse.txHash));
        return { txHash: txnResponse.txHash, xpChain: 'C' as const };
      } else {
        const txnRequest = await coreWalletClient.pChain.prepareExportTxn({
          exportedOutputs: [
            {
              addresses: [coreEthAddress],
              amount: amountNAvax,
            },
          ],
          destinationChain: 'C',
          context: avalancheContext,
        });
        const txnResponse = await coreWalletClient.sendXPTransaction(txnRequest);
        await coreWalletClient.waitForTxn({ ...txnResponse, sleepTime: 2000, maxRetries: 30 });
        return { txHash: txnResponse.txHash, xpChain: 'P' as const };
      }
    })();

    // The result names the chain of the tx, so the history lists a C-Chain export as a C-Chain tx
    notify('exportCross', exportPromise);

    try {
      const { txHash, xpChain } = await exportPromise;
      setExportTxId(txHash);
      setCompletedExportTxId(txHash);
      setCompletedExportXPChain(xpChain);

      await pollForUTXOChanges();
      onBalanceChanged();
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      if (classifyEvmTxError(error).kind === 'user-rejected') {
        setError(WALLET_REJECTED_TEXT);
      } else if (/invalid nonce/i.test(msg)) {
        setError(
          'Export failed: another C-Chain transaction from this wallet is still pending. Wait for it to confirm (or reset the account in Core: Settings → Advanced → Reset Account) and try again.',
        );
      } else {
        setError(`Export failed: ${msg}`);
      }
    } finally {
      setExportLoading(false);
    }
  };

  const handleImport = async () => {
    if (!coreWalletClient) {
      setImportError('Cross-chain transfers require Core Wallet for P-Chain signing.');
      return;
    }
    if (!avalancheContext) {
      setImportError(
        contextError
          ? `Could not load network parameters: ${contextError}`
          : 'Network parameters are still loading. Try again in a moment.',
      );
      return;
    }
    // Guard against importing before the exported UTXOs have arrived. Otherwise
    // the SDK rejects with a raw "insufficient funds" (the bulk of importCross errors).
    const utxosReady = destinationChain === 'p-chain' ? cToP_UTXOs : pToC_UTXOs;
    if (utxosReady.length === 0) {
      setImportError(
        'No funds available to import yet. Wait for the export to confirm and the UTXOs to arrive on the destination chain.',
      );
      return;
    }
    setImportLoading(true);
    setImportError(null);

    // Give the SDK exactly the page's selection. Without `utxos`, the SDK reads every UTXO at the address again. Then
    // a UTXO that the wallet cannot spend can lower the fee of a C-Chain import below what coreth takes, and too many
    // inputs can put the import above coreth's gas limit or the P-Chain's gas capacity (sharedMemoryImport.ts).
    const importPromise = (async () => {
      if (destinationChain === 'p-chain') {
        const txnRequest = await coreWalletClient.pChain.prepareImportTxn({
          sourceChain: 'C',
          importedOutput: {
            addresses: [pChainAddress],
          },
          utxos: toSdkUtxos('P', cToP_UTXOs),
          context: avalancheContext,
        });
        const txnResponse = await coreWalletClient.sendXPTransaction(txnRequest);
        await coreWalletClient.waitForTxn({ ...txnResponse, sleepTime: 2000, maxRetries: 30 });
        return { txHash: String(txnResponse.txHash), xpChain: 'P' as const };
      } else {
        const txnRequest = await coreWalletClient.cChain.prepareImportTxn({
          sourceChain: 'P',
          toAddress: walletEVMAddress as `0x${string}`,
          utxos: toSdkUtxos('C', pToC_UTXOs),
          context: avalancheContext,
        });
        const txnResponse = await coreWalletClient.sendXPTransaction(txnRequest);
        await waitForCChainAtomicTx(Boolean(isTestnet), String(txnResponse.txHash));
        return { txHash: String(txnResponse.txHash), xpChain: 'C' as const };
      }
    })();

    // The result names the chain of the tx, so the history lists a C-Chain import as a C-Chain tx
    notify('importCross', importPromise);

    try {
      const { txHash, xpChain } = await importPromise;
      setImportTxId(txHash);
      setCompletedImportXPChain(xpChain);

      await pollForUTXOChanges();
      onBalanceChanged();

      onSuccess?.();
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      setImportError(
        classifyEvmTxError(error).kind === 'user-rejected' ? WALLET_REJECTED_TEXT : `Import failed: ${msg}`,
      );
    } finally {
      setImportLoading(false);
      setExportTxId('');
    }
  };

  // Keep import ref in sync for auto-import effect
  handleImportRef.current = handleImport;

  // Get the available UTXOs based on current direction
  const availableUTXOs = destinationChain === 'p-chain' ? cToP_UTXOs : pToC_UTXOs;
  const totalUtxoAmount = destinationChain === 'p-chain' ? totalCToPUtxoAmount : totalPToCUtxoAmount;
  const importSide = destinationChain === 'p-chain' ? 'P' : 'C';
  const blockedText = blockedUtxosText(blockedUtxos[importSide]);
  const moreText = moreUtxos[importSide] ? MORE_UTXOS_TEXT : null;
  // One Export click sets at most one of the two: an amount error stops the click before the export starts
  const exportError = amountError ?? error;

  // Step status logic with auto-collapse flow
  const getStep1Status = (): 'pending' | 'active' | 'waiting' | 'completed' | 'error' => {
    if (exportError) return 'error';
    if (step1AutoCollapse) return 'completed';
    if (completedExportTxId) return 'waiting'; // Show as waiting after success, before auto-collapse
    if (exportLoading) return 'active';
    return 'active';
  };

  const getStep2Status = (): 'pending' | 'active' | 'waiting' | 'completed' | 'error' => {
    if (importError) return 'error';
    if (step2AutoCollapse) return 'completed';
    if (importTxId) return 'waiting'; // Show as waiting after success, before auto-collapse
    if (importLoading || (completedExportTxId && availableUTXOs.length > 0)) return 'active';
    return 'pending';
  };

  // Collapse step 1 when step 2 becomes actionable (UTXOs arrived or import started)
  useEffect(() => {
    if (completedExportTxId && !step1AutoCollapse && (availableUTXOs.length > 0 || importLoading)) {
      setStep1AutoCollapse(true);
    }
  }, [completedExportTxId, step1AutoCollapse, availableUTXOs.length, importLoading]);

  useEffect(() => {
    if (importTxId && !step2AutoCollapse) {
      const timer = setTimeout(() => {
        setStep2AutoCollapse(true);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [importTxId, step2AutoCollapse]);

  // Auto-trigger import after export completes and UTXOs arrive
  useEffect(() => {
    if (
      completedExportTxId &&
      completedExportTxId !== 'utxo-available' &&
      availableUTXOs.length > 0 &&
      !importTxId &&
      !importLoading &&
      !autoImportTriggeredRef.current
    ) {
      autoImportTriggeredRef.current = true;
      handleImportRef.current?.();
    }
  }, [completedExportTxId, availableUTXOs.length, importTxId, importLoading]);

  // Auto-skip to step 2 if UTXOs are already available
  useEffect(() => {
    if (availableUTXOs.length > 0 && !completedExportTxId && !exportTxId && !importTxId) {
      // Skip step 1 and mark it as completed (simulate export was done previously)
      setCompletedExportTxId('utxo-available');
      setStep1AutoCollapse(true);
    }
  }, [availableUTXOs.length, completedExportTxId, exportTxId, importTxId]);

  // Auto-switch to direction with pending UTXOs (only on initial load)
  const hasAutoSwitchedRef = useRef(false);
  useEffect(() => {
    if (hasAutoSwitchedRef.current) return;
    if (!exportTxId && !completedExportTxId && !importTxId) {
      // The page now offers the pending import, so an amount error of an earlier Export click goes
      if (cToP_UTXOs.length > 0 && pToC_UTXOs.length === 0) {
        setSourceChain('c-chain');
        setDestinationChain('p-chain');
        setAmountError(null);
        hasAutoSwitchedRef.current = true;
      } else if (pToC_UTXOs.length > 0 && cToP_UTXOs.length === 0) {
        setSourceChain('p-chain');
        setDestinationChain('c-chain');
        setAmountError(null);
        hasAutoSwitchedRef.current = true;
      }
    }
  }, [cToP_UTXOs.length, pToC_UTXOs.length, exportTxId, completedExportTxId, importTxId]);

  const sdkSources: SDKCodeSource[] = useMemo(() => {
    const isCtoP = sourceChain === 'c-chain';
    return [
      {
        name: 'Export',
        filename: isCtoP ? 'exportCtoP.ts' : 'exportPtoC.ts',
        code: isCtoP
          ? `import { CoreWalletClient } from "@core-wallet/sdk";

// Export AVAX from C-Chain to P-Chain
const txnRequest = await coreWalletClient.cChain.prepareExportTxn({
  destinationChain: "P",
  exportedOutput: {
    addresses: ["${pChainAddress || '<your-p-chain-address>'}"],
    amount: ${amount || '0'},
  },
  fromAddress: "${walletEVMAddress || '<your-evm-address>'}",
});

const txnResponse = await coreWalletClient.sendXPTransaction(txnRequest);
// Poll avax.getAtomicTx until the result has blockHeight (waitForTxn uses the deprecated avax.getAtomicTxStatus)
console.log("Export tx:", txnResponse.txHash);`
          : `import { CoreWalletClient } from "@core-wallet/sdk";

// Export AVAX from P-Chain to C-Chain
const txnRequest = await coreWalletClient.pChain.prepareExportTxn({
  exportedOutputs: [{
    addresses: ["${coreEthAddress || '<your-core-eth-address>'}"],
    amount: ${amount || '0'},
  }],
  destinationChain: "C",
});

const txnResponse = await coreWalletClient.sendXPTransaction(txnRequest);
await coreWalletClient.waitForTxn({ ...txnResponse, sleepTime: 2000, maxRetries: 30 });
console.log("Export tx:", txnResponse.txHash);`,
        description: isCtoP
          ? 'Export AVAX from C-Chain to P-Chain using Core Wallet SDK'
          : 'Export AVAX from P-Chain to C-Chain using Core Wallet SDK',
      },
      {
        name: 'Import',
        filename: isCtoP ? 'importToP.ts' : 'importToC.ts',
        code: isCtoP
          ? `import { CoreWalletClient } from "@core-wallet/sdk";

// Import AVAX to P-Chain from C-Chain
// Set \`utxos\` to the wallet's own spendable AVAX UTXOs only. Without it, the SDK uses every UTXO at the address.
const txnRequest = await coreWalletClient.pChain.prepareImportTxn({
  sourceChain: "C",
  importedOutput: {
    addresses: ["${pChainAddress || '<your-p-chain-address>'}"],
  },
});

const txnResponse = await coreWalletClient.sendXPTransaction(txnRequest);
await coreWalletClient.waitForTxn({ ...txnResponse, sleepTime: 2000, maxRetries: 30 });
console.log("Import tx:", txnResponse.txHash);`
          : `import { CoreWalletClient } from "@core-wallet/sdk";

// Import AVAX to C-Chain from P-Chain
// Set \`utxos\` to the wallet's own spendable AVAX UTXOs only. Without it, the SDK uses every UTXO at the address.
const txnRequest = await coreWalletClient.cChain.prepareImportTxn({
  sourceChain: "P",
  toAddress: "${walletEVMAddress || '<your-evm-address>'}",
});

const txnResponse = await coreWalletClient.sendXPTransaction(txnRequest);
// Poll avax.getAtomicTx until the result has blockHeight (waitForTxn uses the deprecated avax.getAtomicTxStatus)
console.log("Import tx:", txnResponse.txHash);`,
        description: isCtoP ? 'Import the exported AVAX to P-Chain' : 'Import the exported AVAX to C-Chain',
      },
    ];
  }, [sourceChain, amount, pChainAddress, walletEVMAddress, coreEthAddress]);

  const cliCommand =
    sourceChain === 'c-chain'
      ? `platform-cli transfer c-to-p --amount ${amount || '<amount>'} --network ${isTestnet ? 'fuji' : 'mainnet'}`
      : `platform-cli transfer p-to-c --amount ${amount || '<amount>'} --network ${isTestnet ? 'fuji' : 'mainnet'}`;

  const sourceChainName = sourceChain === 'c-chain' ? 'C-Chain' : 'P-Chain';
  const destChainName = destinationChain === 'c-chain' ? 'C-Chain' : 'P-Chain';
  const destBalance = destinationChain === 'c-chain' ? cChainBalance : pChainBalance;

  const chainLogo = (chain: string) =>
    chain === 'c-chain'
      ? 'https://images.ctfassets.net/gcj8jwzm6086/5VHupNKwnDYJvqMENeV7iJ/3e4b8ff10b69bfa31e70080a4b142cd0/avalanche-avax-logo.svg'
      : 'https://images.ctfassets.net/gcj8jwzm6086/42aMwoCLblHOklt6Msi6tm/1e64aa637a8cead39b2db96fe3225c18/pchain-square.svg';

  // The SDK's cChain.prepareExportTxn/prepareImportTxn fetch the nonce and
  // base fee via plain eth_* calls through the wallet transport, which Core
  // routes to the *active* chain. With an L1 selected, the export tx gets
  // built with the L1's nonce and the C-Chain node rejects it ("invalid
  // nonce"). Gate the whole tool on the C-Chain so those reads can't hit the
  // wrong network. `null` while isTestnet is unresolved keeps the gate open
  // rather than flashing a switch prompt against an unknown target.
  const requiredCChainId = isTestnet === undefined ? null : isTestnet ? 43113 : 43114;

  return (
    <SDKCodeViewer sources={sdkSources} height="auto">
      <AutoSwitchChainGate
        requiredChainId={requiredCChainId}
        requiredChainName={isTestnet ? 'Fuji C-Chain' : 'C-Chain'}
      >
        <div className="space-y-4">
          {/* Transfer Widget */}
          <div className="rounded-lg border border-border overflow-hidden">
            {/* From */}
            <div className="p-4 bg-card">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <img src={chainLogo(sourceChain)} alt="" className="h-5 w-5" />
                  <span className="text-sm font-medium text-foreground">From {sourceChainName}</span>
                </div>
                <span className="text-xs text-muted-foreground">Balance: {sourceBalance.toFixed(4)} AVAX</span>
              </div>
              <AmountInput
                label=""
                aria-label="Amount"
                value={amount}
                onChange={changeAmount}
                type="number"
                min="0"
                max={maxSpendableText}
                step="0.000001"
                required
                disabled={exportLoading || importLoading}
                error={exportError ?? undefined}
                button={
                  <Button onClick={handleMaxAmount} disabled={exportLoading || maxSpendable <= 0n} stickLeft>
                    MAX
                  </Button>
                }
              />
            </div>

            {/* Swap Divider */}
            <div className="relative flex justify-center">
              <div className="absolute inset-x-0 top-1/2 border-t border-border" />
              <button
                type="button"
                onClick={handleSwapChains}
                disabled={exportLoading || importLoading}
                className="relative z-10 flex h-8 w-8 items-center justify-center rounded-full bg-muted border border-border hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Swap chains"
              >
                <ArrowDownUp className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </div>

            {/* To */}
            <div className="p-4 bg-card">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <img src={chainLogo(destinationChain)} alt="" className="h-5 w-5" />
                  <span className="text-sm font-medium text-foreground">To {destChainName}</span>
                </div>
                <span className="text-xs text-muted-foreground">Balance: {destBalance.toFixed(4)} AVAX</span>
              </div>
            </div>
          </div>

          {/* Step Progress */}
          <div className="flex items-center justify-center gap-3">
            <StepIndicator stepNumber={1} title="Export" status={getStep1Status()} />
            <StepIndicator stepNumber={2} title="Import" status={getStep2Status()} isLast />
          </div>

          {/* Action Area */}
          <div className="space-y-3">
            {/* Export phase */}
            {!completedExportTxId && !exportLoading && availableUTXOs.length === 0 && (
              <Button
                variant="primary"
                onClick={handleExport}
                disabled={Number(amount) <= 0 || !!amountError}
                icon={<img src="/images/core.svg" alt="" className="w-4 h-4" />}
                className="w-full"
              >
                Export {amount || '0'} AVAX from {sourceChainName}
              </Button>
            )}

            {/* Export loading */}
            {exportLoading && (
              <Button
                variant="primary"
                disabled
                loading
                loadingText={`Exporting from ${sourceChainName}...`}
                className="w-full"
              >
                Exporting...
              </Button>
            )}

            {/* Export error */}
            {exportError && (
              <div className="p-3 rounded-lg border border-destructive/30 bg-destructive/5">
                <p className="text-sm text-destructive">{exportError}</p>
              </div>
            )}

            {/* Waiting for UTXOs after export */}
            {completedExportTxId && availableUTXOs.length === 0 && !exportLoading && (
              <div className="flex items-center justify-center gap-2 py-3 text-sm text-muted-foreground">
                <Clock className="h-4 w-4 animate-pulse" />
                Waiting for UTXOs to arrive...
              </div>
            )}

            {/* Import phase - auto-importing after export */}
            {importLoading && (
              <Button
                variant="primary"
                disabled
                loading
                loadingText={`Importing to ${destChainName}...`}
                className="w-full"
              >
                Importing...
              </Button>
            )}

            {/* Import phase - manual button for pre-existing UTXOs only */}
            {availableUTXOs.length > 0 && !importTxId && !importLoading && completedExportTxId === 'utxo-available' && (
              <>
                <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/50 border border-border text-sm">
                  <span className="text-muted-foreground">Pending import from a previous transfer</span>
                  <span className="font-mono font-medium text-foreground">{totalUtxoAmount.toFixed(6)} AVAX</span>
                </div>

                <Button
                  variant="primary"
                  onClick={handleImport}
                  icon={<img src="/images/core.svg" alt="" className="w-4 h-4" />}
                  className="w-full"
                >
                  Import {totalUtxoAmount.toFixed(6)} AVAX to {destChainName}
                </Button>
              </>
            )}

            {/* Import error */}
            {importError && (
              <div className="p-3 rounded-lg border border-destructive/30 bg-destructive/5">
                <p className="text-sm text-destructive">{importError}</p>
                <Button variant="secondary" onClick={handleImport} disabled={importLoading} className="w-full mt-2">
                  Retry Import
                </Button>
              </div>
            )}

            {/* Transfer complete */}
            {importTxId && (
              <>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setExportTxId('');
                    setCompletedExportTxId('');
                    setImportTxId(null);
                    setAmount('');
                    setError(null);
                    setAmountError(null);
                    setImportError(null);
                    setStep1AutoCollapse(false);
                    setStep2AutoCollapse(false);
                    autoImportTriggeredRef.current = false;
                    setTimeout(() => {
                      if (availableUTXOs.length > 0) {
                        setCompletedExportTxId('utxo-available');
                        setStep1AutoCollapse(true);
                      }
                    }, 100);
                  }}
                  className="w-full"
                >
                  Start New Transfer
                </Button>
              </>
            )}

            {/* UTXOs that the wallet cannot import now: locked, other owners, another asset, not above the fee of
                their own input, above the gas limit of one import, or below the fee of the import */}
            {blockedText && <p className="text-xs text-muted-foreground px-1">{blockedText}</p>}
            {moreText && <p className="text-xs text-muted-foreground px-1">{moreText}</p>}
          </div>

          {/* Fee */}
          <div className="flex justify-between items-center text-xs text-muted-foreground px-1">
            <span>Estimated fee</span>
            <span>~0.001 AVAX</span>
          </div>

          <CliAlternative command={cliCommand} />
        </div>
      </AutoSwitchChainGate>
    </SDKCodeViewer>
  );
}

export default withConsoleToolMetadata(CrossChainTransfer, metadata);
