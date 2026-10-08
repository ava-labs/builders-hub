'use client';

import { CliAlternative } from '@/components/console/cli-alternative';
import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { AlertTriangle, ArrowDownUp, ArrowLeftRight, ArrowRight, Check, Copy, Loader2 } from 'lucide-react';
import { codeToHtml } from 'shiki';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { pvm, Utxo, TransferOutput, evm } from '@avalabs/avalanchejs';
import { toNanoAvax } from '@/components/toolbox/coreViem/utils/units';
import { getRPCEndpoint } from '@/components/toolbox/coreViem/utils/rpc';
import { useAvalancheContext } from '@/components/toolbox/hooks/useAvalancheContext';
import { WalletRequirementsConfigKey } from '@/components/toolbox/hooks/useWalletRequirements';
import { ConnectedWalletIcon } from '@/components/toolbox/components/ConnectedWalletIcon';
import { useConnectedWallet } from '@/components/toolbox/contexts/ConnectedWalletContext';
import {
  BaseConsoleToolProps,
  ConsoleToolMetadata,
  withConsoleToolMetadata,
} from '../../components/WithConsoleToolMetadata';
import { generateConsoleToolGitHubUrl } from '@/components/toolbox/utils/githubUrl';
import type { SDKCodeSource } from '@/components/console/sdk-code-viewer';
import { AutoSwitchChainGate } from '@/components/console/auto-switch-chain-gate';
import useConsoleNotifications from '@/hooks/useConsoleNotifications';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Board, FIG, HashChip, Rise, SectionHeader, SpecPlate, SpecRow, UNIT } from '@/components/explorer-v2/ui';

// Extended props for this specific tool
interface CrossChainTransferProps extends BaseConsoleToolProps {
  /** Suggested amount to pre-fill in the transfer form */
  suggestedAmount?: string;
}

// Atomic export fee buffer: ~0.001 AVAX on both C-Chain (base-fee burn) and
// P-Chain (flat tx fee). MAX subtracts this so the user always has gas left.
const EXPORT_FEE_BUFFER_NAVAX = 1_000_000;

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

const EYEBROW = 'font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400';
const COUNT = 'font-mono text-[10px] uppercase tracking-[0.14em] tabular-nums text-zinc-400 dark:text-zinc-500';
const LINK =
  'text-zinc-600 underline decoration-zinc-300 underline-offset-4 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:decoration-zinc-600 dark:hover:text-zinc-100';
const CELL = 'border-zinc-200 bg-white/80 p-5 dark:border-zinc-800 dark:bg-zinc-950/80';
const BUTTON =
  'group/btn inline-flex h-10 w-full items-center justify-center gap-2 border px-4 font-mono text-[11px] font-bold uppercase tracking-[0.14em] transition-colors disabled:cursor-not-allowed disabled:opacity-50';
const PRIMARY_BUTTON = cn(
  BUTTON,
  'border-zinc-900 bg-zinc-900 text-white hover:bg-zinc-700 disabled:hover:bg-zinc-900 dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300 dark:disabled:hover:bg-zinc-100',
);
const SECONDARY_BUTTON = cn(
  BUTTON,
  'border-zinc-300 text-zinc-700 hover:border-zinc-900 hover:text-zinc-900 disabled:hover:border-zinc-300 disabled:hover:text-zinc-700 dark:border-zinc-700 dark:text-zinc-200 dark:hover:border-zinc-100 dark:hover:text-zinc-50 dark:disabled:hover:border-zinc-700 dark:disabled:hover:text-zinc-200',
);
/** Shiki emits its own <pre> with an inline background; the board supplies the surface. */
const SHIKI =
  'min-w-0 flex-1 overflow-x-auto px-4 py-4 [&_.line]:block [&_.line]:min-h-[1.5em] [&_code]:flex [&_code]:flex-col [&_pre]:m-0! [&_pre]:bg-transparent! [&_pre]:p-0!';

type ChainKey = 'c-chain' | 'p-chain';
const CHAINS: Record<ChainKey, { name: string; role: string; logo: string }> = {
  'c-chain': {
    name: 'C-Chain',
    role: 'Contract chain · EVM',
    logo: 'https://images.ctfassets.net/gcj8jwzm6086/5VHupNKwnDYJvqMENeV7iJ/3e4b8ff10b69bfa31e70080a4b142cd0/avalanche-avax-logo.svg',
  },
  'p-chain': {
    name: 'P-Chain',
    role: 'Platform chain · staking and L1s',
    logo: 'https://images.ctfassets.net/gcj8jwzm6086/42aMwoCLblHOklt6Msi6tm/1e64aa637a8cead39b2db96fe3225c18/pchain-square.svg',
  },
};

type StepStatus = 'pending' | 'active' | 'waiting' | 'completed' | 'error';

function ButtonLabel({ children }: { children: React.ReactNode }) {
  return (
    <>
      <span className="truncate">{children}</span>
      <ArrowRight className="h-3.5 w-3.5 shrink-0 -translate-x-1 text-[#E6212F] opacity-0 transition-all group-hover/btn:translate-x-0 group-hover/btn:opacity-100 group-disabled/btn:hidden" />
    </>
  );
}

function ChainCell({
  side,
  chain,
  balance,
  network,
  note,
  className,
}: {
  side: 'From' | 'To';
  chain: ChainKey;
  balance: number;
  network?: string;
  note?: React.ReactNode;
  className?: string;
}) {
  const { name, role, logo } = CHAINS[chain];
  return (
    <div className={cn(CELL, 'flex flex-col gap-5 border-b border-r md:px-7', className)}>
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center border border-zinc-200 bg-white p-1.5 dark:border-zinc-800 dark:bg-zinc-900">
          <img src={logo} alt="" className="h-full w-full object-contain" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex items-center justify-between gap-3">
            <span className={EYEBROW}>{side}</span>
            {network && <span className={COUNT}>{network}</span>}
          </div>
          <h3 className="truncate text-[15px] font-semibold text-zinc-900 dark:text-zinc-50">{name}</h3>
          <p className="truncate text-[13px] text-zinc-500 dark:text-zinc-400">{role}</p>
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <span className={EYEBROW}>Balance</span>
        <span className={FIG}>
          {balance.toFixed(4)}
          <span className={cn(UNIT, 'ml-1.5')}>AVAX</span>
        </span>
        {note}
      </div>
    </div>
  );
}

/** Export then Import as a two-segment track: done in ink, current in red, upcoming in grey. */
function TransferTrack({ steps }: { steps: { title: string; status: StepStatus; label: string }[] }) {
  return (
    <ol aria-label="Transfer progress" className="grid grid-cols-2 gap-1">
      {steps.map((step, i) => {
        const done = step.status === 'completed';
        const current = step.status === 'active' || step.status === 'waiting' || step.status === 'error';
        return (
          <li key={step.title} aria-current={current ? 'step' : undefined} className="flex min-w-0 flex-col gap-2">
            <span
              aria-hidden
              className={cn(
                'block h-1 transition-colors',
                done ? 'bg-zinc-900 dark:bg-zinc-100' : current ? 'bg-[#E6212F]' : 'bg-zinc-200 dark:bg-zinc-800',
              )}
            />
            <span className="flex min-w-0 items-baseline justify-between gap-2">
              <span className="flex min-w-0 items-baseline gap-1.5">
                <span
                  className={cn(
                    'font-mono text-[10px] font-bold tabular-nums',
                    done
                      ? 'text-zinc-900 dark:text-zinc-100'
                      : current
                        ? 'text-[#E6212F]'
                        : 'text-zinc-400 dark:text-zinc-600',
                  )}
                >
                  {done ? (
                    <Check className="inline h-3 w-3 -translate-y-px" aria-label="Completed" />
                  ) : (
                    String(i + 1).padStart(2, '0')
                  )}
                </span>
                <span
                  className={cn(
                    'truncate text-[12.5px]',
                    current || done
                      ? 'font-medium text-zinc-900 dark:text-zinc-50'
                      : 'text-zinc-400 dark:text-zinc-500',
                  )}
                >
                  {step.title}
                </span>
              </span>
              <span
                className={cn(
                  'shrink-0 font-mono text-[10px] uppercase tracking-[0.14em]',
                  step.status === 'error' ? 'text-red-600 dark:text-red-400' : 'text-zinc-400 dark:text-zinc-500',
                )}
              >
                {step.label}
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function ErrorNotice({ id, children }: { id?: string; children: React.ReactNode }) {
  return (
    <div
      id={id}
      role="alert"
      className="flex items-start gap-3 border border-red-300 bg-red-50 px-4 py-3 text-[13px] leading-relaxed text-red-800 dark:border-red-900/70 dark:bg-red-950/20 dark:text-red-300"
    >
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <div className="min-w-0 flex-1 [overflow-wrap:anywhere]">{children}</div>
    </div>
  );
}

function useCopy(text: string) {
  const [copied, setCopied] = useState(false);
  const copy = useCallback(async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [text]);
  return { copied, copy };
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const { copied, copy } = useCopy(text);
  return (
    <button
      type="button"
      onClick={copy}
      aria-label={label}
      className="inline-flex shrink-0 items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 transition-colors hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-zinc-100"
    >
      {copied ? <Check className="h-3 w-3 text-[#E6212F]" /> : <Copy className="h-3 w-3" />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

/** The SDK calls behind each step, as a quiet board with one tab per file. */
function CodeBoard({ sources }: { sources: SDKCodeSource[] }) {
  const [active, setActive] = useState(0);
  const [highlighted, setHighlighted] = useState<Record<string, { light: string; dark: string }>>({});
  const source = sources[active] ?? sources[0];

  useEffect(() => {
    if (!source) return;
    let cancelled = false;
    Promise.all([
      codeToHtml(source.code, { lang: 'typescript', theme: 'github-light' }),
      codeToHtml(source.code, { lang: 'typescript', theme: 'github-dark' }),
    ]).then(([light, dark]) => {
      if (!cancelled) setHighlighted((prev) => ({ ...prev, [source.code]: { light, dark } }));
    });
    return () => {
      cancelled = true;
    };
  }, [source]);

  if (!source) return null;
  const html = highlighted[source.code];
  const lineCount = source.code.split('\n').length;

  return (
    <Board className="border-x border-t" divide={false}>
      <div className="flex min-h-9 items-center justify-between gap-4 border-b border-zinc-200 bg-zinc-50/80 px-5 md:px-6 dark:border-zinc-800 dark:bg-zinc-900/40">
        <div role="tablist" aria-label="SDK code" className="flex items-center gap-5 self-stretch">
          {sources.map((s, i) => (
            <button
              key={s.filename}
              type="button"
              role="tab"
              id={`cross-chain-sdk-tab-${i}`}
              aria-selected={i === active}
              aria-controls="cross-chain-sdk-panel"
              onClick={() => setActive(i)}
              className={cn(
                '-mb-px h-full border-b-2 pt-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.18em] transition-colors',
                i === active
                  ? 'border-[#E6212F] text-zinc-900 dark:text-zinc-50'
                  : 'border-transparent text-zinc-400 hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-zinc-100',
              )}
            >
              {s.filename}
            </button>
          ))}
        </div>
        <CopyButton text={source.code} label="Copy code" />
      </div>
      <div
        id="cross-chain-sdk-panel"
        role="tabpanel"
        aria-labelledby={`cross-chain-sdk-tab-${active}`}
        className="flex font-mono text-[12px] leading-[1.5]"
      >
        <div
          aria-hidden
          className="shrink-0 select-none border-r border-zinc-200 bg-zinc-50/60 py-4 pl-5 pr-3 text-right tabular-nums text-zinc-400 md:pl-6 dark:border-zinc-800 dark:bg-zinc-900/30 dark:text-zinc-600"
        >
          {Array.from({ length: lineCount }, (_, i) => (
            <div key={i}>{i + 1}</div>
          ))}
        </div>
        {html ? (
          <>
            <div className={cn(SHIKI, 'dark:hidden')} dangerouslySetInnerHTML={{ __html: html.light }} />
            <div className={cn(SHIKI, 'hidden dark:block')} dangerouslySetInnerHTML={{ __html: html.dark }} />
          </>
        ) : (
          <pre className="min-w-0 flex-1 overflow-x-auto whitespace-pre px-4 py-4 text-zinc-800 dark:text-zinc-200">
            {source.code}
          </pre>
        )}
      </div>
      {source.description && (
        <p className="border-t border-zinc-200 px-5 py-3 text-[12px] text-zinc-500 md:px-6 dark:border-zinc-800 dark:text-zinc-400">
          {source.description}
        </p>
      )}
    </Board>
  );
}

const metadata: ConsoleToolMetadata = {
  title: 'Cross-Chain Transfer',
  description: (
    <>
      Transfer AVAX between the{' '}
      <Link href="/docs/rpcs/c-chain/api" className={LINK}>
        C-Chain
      </Link>{' '}
      and{' '}
      <Link href="/docs/rpcs/p-chain/api" className={LINK}>
        P-Chain
      </Link>
      . Requires two{' '}
      <Link href="/docs/rpcs/p-chain/txn-format" className={LINK}>
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
  const [error, setError] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [cToP_UTXOs, setC_To_P_UTXOs] = useState<Utxo<TransferOutput>[]>([]);
  const [pToC_UTXOs, setP_To_C_UTXOs] = useState<Utxo<TransferOutput>[]>([]);
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

  // Fetch UTXOs from both chains
  const fetchUTXOs = useCallback(async () => {
    if (!pChainAddress || !walletEVMAddress || isFetchingRef.current) return false;

    isFetchingRef.current = true;

    // Store previous counts for comparison
    const prevCToPCount = cToP_UTXOs.length;
    const prevPToCCount = pToC_UTXOs.length;

    try {
      const platformEndpoint = getRPCEndpoint(Boolean(isTestnet));
      const pvmApi = new pvm.PVMApi(platformEndpoint);

      const cChainUTXOs = await pvmApi.getUTXOs({
        addresses: [pChainAddress],
        sourceChain: 'C',
      });
      setC_To_P_UTXOs(cChainUTXOs.utxos as Utxo<TransferOutput>[]);

      const evmApi = new evm.EVMApi(platformEndpoint);

      // Get P-chain UTXOs (for P->C transfers)
      const pChainUTXOs = await evmApi.getUTXOs({
        addresses: [coreEthAddress],
        sourceChain: 'P',
      });
      setP_To_C_UTXOs(pChainUTXOs.utxos as Utxo<TransferOutput>[]);

      // Check if the number of UTXOs has changed
      const newCToPCount = cChainUTXOs.utxos.length;
      const newPToCCount = pChainUTXOs.utxos.length;

      // Return true if UTXOs count changed
      return prevCToPCount !== newCToPCount || prevPToCCount !== newPToCCount;
    } catch (e) {
      console.error('Error fetching UTXOs:', e);
      return false;
    } finally {
      isFetchingRef.current = false;
    }
  }, [pChainAddress, walletEVMAddress, coreEthAddress, isTestnet, cToP_UTXOs.length, pToC_UTXOs.length]);

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

  const handleMaxAmount = () => {
    setError(null);
    const balance = sourceChain === 'c-chain' ? cChainBalance : pChainBalance;
    if (!Number.isFinite(balance) || balance <= 0) {
      setAmount('0');
      return;
    }
    const balanceNAvax = Math.floor(balance * 1e9);
    const spendableNAvax = balanceNAvax - EXPORT_FEE_BUFFER_NAVAX;
    if (spendableNAvax <= 0) {
      setAmount('0');
      return;
    }
    setAmount((spendableNAvax / 1e9).toString());
  };

  // Handler to swap source and destination chains
  const handleSwapChains = () => {
    const tempChain = sourceChain;
    setSourceChain(destinationChain);
    setDestinationChain(tempChain);
    setError(null);
    setImportError(null);
  };

  const validateAmount = (): boolean => {
    const numericAmount = Number(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      setError('Please enter a valid positive amount.');
      return false;
    }

    const currentBalance = sourceChain === 'c-chain' ? cChainBalance : pChainBalance;
    if (numericAmount > currentBalance) {
      setError(`Amount exceeds available balance of ${currentBalance.toFixed(4)} AVAX.`);
      return false;
    }

    setError(null);
    return true;
  };

  // Add handlers for buttons
  const handleExport = async () => {
    if (!validateAmount()) return;
    if (!coreWalletClient) {
      setError(
        'Cross-chain transfers sign on the P-Chain, which needs Core or a Console wallet. Connect one from the top bar, or use the CLI alternative below.',
      );
      return;
    }
    if (!avalancheContext) {
      setError(
        contextError
          ? `Could not load network parameters: ${contextError}`
          : 'Network parameters are still loading — please try again in a moment.',
      );
      return;
    }

    setExportLoading(true);
    setError(null);
    autoImportTriggeredRef.current = false;

    // P-Chain/X-Chain transfer amounts are nAVAX (1 AVAX = 1e9 nAVAX). Parse
    // the typed decimal: `BigInt(0.5)` and the float drift from `amount * 1e9`
    // (e.g. 1.005 * 1e9 = 1004999999.9999999) both throw, and the SDK's
    // avaxToNanoAvax does exactly that multiplication.
    const amountNAvax = toNanoAvax(amount);
    if (amountNAvax <= 0n) {
      setError('Amount is below the smallest exportable unit (1 nAVAX).');
      setExportLoading(false);
      return;
    }

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

    notify(
      'exportCross',
      exportPromise.then((r) => r.txHash),
    );

    try {
      const { txHash, xpChain } = await exportPromise;
      setExportTxId(txHash);
      setCompletedExportTxId(txHash);
      setCompletedExportXPChain(xpChain);

      await pollForUTXOChanges();
      onBalanceChanged();
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      if (/invalid nonce/i.test(msg)) {
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
      setImportError('Cross-chain transfers sign on the P-Chain, which needs Core or a Console wallet.');
      return;
    }
    if (!avalancheContext) {
      setImportError(
        contextError
          ? `Could not load network parameters: ${contextError}`
          : 'Network parameters are still loading — please try again in a moment.',
      );
      return;
    }
    // Guard against importing before the exported UTXOs have arrived — otherwise
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

    const importPromise = (async () => {
      if (destinationChain === 'p-chain') {
        const txnRequest = await coreWalletClient.pChain.prepareImportTxn({
          sourceChain: 'C',
          importedOutput: {
            addresses: [pChainAddress],
          },
          context: avalancheContext,
        });
        const txnResponse = await coreWalletClient.sendXPTransaction(txnRequest);
        await coreWalletClient.waitForTxn({ ...txnResponse, sleepTime: 2000, maxRetries: 30 });
        return { txHash: String(txnResponse.txHash), xpChain: 'P' as const };
      } else {
        const txnRequest = await coreWalletClient.cChain.prepareImportTxn({
          sourceChain: 'P',
          toAddress: walletEVMAddress as `0x${string}`,
          context: avalancheContext,
        });
        const txnResponse = await coreWalletClient.sendXPTransaction(txnRequest);
        await waitForCChainAtomicTx(Boolean(isTestnet), String(txnResponse.txHash));
        return { txHash: String(txnResponse.txHash), xpChain: 'C' as const };
      }
    })();

    notify(
      'importCross',
      importPromise.then((r) => r.txHash),
    );

    try {
      const { txHash, xpChain } = await importPromise;
      setImportTxId(txHash);
      setCompletedImportXPChain(xpChain);

      await pollForUTXOChanges();
      onBalanceChanged();

      onSuccess?.();
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      setImportError(`Import failed: ${msg}`);
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

  // Step status logic with auto-collapse flow
  const getStep1Status = (): 'pending' | 'active' | 'waiting' | 'completed' | 'error' => {
    if (error) return 'error';
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
      if (cToP_UTXOs.length > 0 && pToC_UTXOs.length === 0) {
        setSourceChain('c-chain');
        setDestinationChain('p-chain');
        hasAutoSwitchedRef.current = true;
      } else if (pToC_UTXOs.length > 0 && cToP_UTXOs.length === 0) {
        setSourceChain('p-chain');
        setDestinationChain('c-chain');
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
          ? 'Export AVAX from C-Chain to P-Chain with the Avalanche SDK'
          : 'Export AVAX from P-Chain to C-Chain with the Avalanche SDK',
      },
      {
        name: 'Import',
        filename: isCtoP ? 'importToP.ts' : 'importToC.ts',
        code: isCtoP
          ? `import { CoreWalletClient } from "@core-wallet/sdk";

// Import AVAX to P-Chain from C-Chain
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
  const sourceBalance = sourceChain === 'c-chain' ? cChainBalance : pChainBalance;
  const destBalance = destinationChain === 'c-chain' ? cChainBalance : pChainBalance;

  const network = isTestnet === undefined ? undefined : isTestnet ? 'Fuji' : 'Mainnet';
  const busy = exportLoading || importLoading;
  const step1Status = getStep1Status();
  const step2Status = getStep2Status();
  const exportedTxId = completedExportTxId && completedExportTxId !== 'utxo-available' ? completedExportTxId : '';

  const step1Label =
    step1Status === 'error'
      ? 'Error'
      : step1Status === 'completed'
        ? 'Done'
        : step1Status === 'waiting'
          ? 'Confirming'
          : exportLoading
            ? 'Signing'
            : 'Ready';
  const step2Label =
    step2Status === 'error'
      ? 'Error'
      : step2Status === 'completed' || step2Status === 'waiting'
        ? 'Done'
        : importLoading
          ? 'Importing'
          : step2Status === 'active'
            ? 'Ready'
            : 'Up next';

  // The SDK's cChain.prepareExportTxn/prepareImportTxn fetch the nonce and
  // base fee via plain eth_* calls through the wallet transport, which Core
  // routes to the *active* chain. With an L1 selected, the export tx gets
  // built with the L1's nonce and the C-Chain node rejects it ("invalid
  // nonce"). Gate the whole tool on the C-Chain so those reads can't hit the
  // wrong network. `null` while isTestnet is unresolved keeps the gate open
  // rather than flashing a switch prompt against an unknown target.
  const requiredCChainId = isTestnet === undefined ? null : isTestnet ? 43113 : 43114;

  return (
    <div className="not-prose flex flex-col gap-10">
      <AutoSwitchChainGate
        requiredChainId={requiredCChainId}
        requiredChainName={isTestnet ? 'Fuji C-Chain' : 'C-Chain'}
      >
        <Rise className="flex flex-col gap-10">
          <section className="flex flex-col gap-4">
            <SectionHeader
              label="Transfer"
              action={
                <span className={COUNT}>
                  {sourceChainName} → {destChainName}
                </span>
              }
            />

            <div>
              {/* From and To share one hairline; the swap control sits on it. */}
              <div className="relative grid grid-cols-1 border-l border-t border-zinc-200 md:grid-cols-2 dark:border-zinc-800">
                <ChainCell side="From" chain={sourceChain as ChainKey} balance={sourceBalance} network={network} />
                <ChainCell
                  side="To"
                  chain={destinationChain as ChainKey}
                  balance={destBalance}
                  network={network}
                  note={
                    availableUTXOs.length > 0 && !importTxId ? (
                      <span className="font-mono text-[11px] tabular-nums text-amber-700 dark:text-amber-400">
                        +{totalUtxoAmount.toFixed(6)} AVAX pending import
                      </span>
                    ) : undefined
                  }
                />
                <button
                  type="button"
                  onClick={handleSwapChains}
                  disabled={busy}
                  aria-label={`Swap direction: transfer from ${destChainName} to ${sourceChainName}`}
                  title="Swap direction"
                  className="absolute left-1/2 top-1/2 z-10 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center border border-zinc-300 bg-white text-zinc-600 transition-colors hover:border-zinc-900 hover:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-zinc-300 disabled:hover:text-zinc-600 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:border-zinc-100 dark:hover:text-zinc-50"
                >
                  <ArrowDownUp className="h-3.5 w-3.5 md:hidden" />
                  <ArrowLeftRight className="hidden h-3.5 w-3.5 md:block" />
                </button>
              </div>

              {/* Amount */}
              <div className={cn(CELL, 'flex flex-col gap-2 border-x border-b md:px-7')}>
                <label htmlFor="cross-chain-amount" className={EYEBROW}>
                  Amount
                </label>
                <div className="flex">
                  <div className="relative min-w-0 flex-1">
                    <input
                      id="cross-chain-amount"
                      value={amount}
                      onChange={(e) => {
                        setAmount(e.target.value);
                        // A new amount gets validated again on Export; a stale error would keep the button disabled.
                        setError(null);
                      }}
                      type="number"
                      inputMode="decimal"
                      min="0"
                      max={sourceBalance.toString()}
                      step="0.000001"
                      required
                      disabled={busy}
                      aria-invalid={!!error}
                      aria-describedby={error ? 'cross-chain-error' : 'cross-chain-amount-hint'}
                      placeholder="0.0"
                      className={cn(
                        'h-12 w-full border bg-white pl-3 pr-16 font-mono text-lg tabular-nums text-zinc-900 transition-colors placeholder:text-zinc-300 focus:outline-none disabled:cursor-not-allowed disabled:bg-zinc-50 disabled:text-zinc-500 dark:bg-zinc-950 dark:text-zinc-50 dark:placeholder:text-zinc-700 dark:disabled:bg-zinc-900',
                        '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
                        error
                          ? 'border-red-400 focus:border-red-600 dark:border-red-800 dark:focus:border-red-500'
                          : 'border-zinc-300 focus:border-zinc-900 dark:border-zinc-700 dark:focus:border-zinc-100',
                      )}
                    />
                    <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center font-mono text-[11px] uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
                      AVAX
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleMaxAmount}
                    disabled={exportLoading || sourceBalance <= 0}
                    className="-ml-px h-12 shrink-0 border border-zinc-300 bg-white px-4 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-zinc-700 transition-colors hover:z-10 hover:border-zinc-900 hover:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-zinc-300 disabled:hover:text-zinc-700 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:border-zinc-100 dark:hover:text-zinc-50"
                  >
                    Max
                  </button>
                </div>
                <p
                  id="cross-chain-amount-hint"
                  className="flex flex-wrap justify-between gap-x-4 gap-y-1 font-mono text-[11px] tabular-nums text-zinc-400 dark:text-zinc-500"
                >
                  <span>
                    Available {sourceBalance.toFixed(4)} AVAX on {sourceChainName}
                  </span>
                  <span>Est. fee ~0.001 AVAX</span>
                </p>
              </div>

              {/* Progress and actions */}
              <div className={cn(CELL, 'flex flex-col gap-5 border-x border-b md:px-7')}>
                <TransferTrack
                  steps={[
                    { title: `Export from ${sourceChainName}`, status: step1Status, label: step1Label },
                    { title: `Import to ${destChainName}`, status: step2Status, label: step2Label },
                  ]}
                />

                {(exportedTxId || importTxId) && (
                  <SpecPlate className="border-y border-zinc-200 dark:border-zinc-800">
                    {exportedTxId && (
                      <SpecRow label="Export tx">
                        <HashChip value={exportedTxId} len={14} />
                      </SpecRow>
                    )}
                    {importTxId && (
                      <SpecRow label="Import tx">
                        <HashChip value={importTxId} len={14} />
                      </SpecRow>
                    )}
                  </SpecPlate>
                )}

                <div className="flex flex-col gap-3">
                  {/* Export phase */}
                  {!completedExportTxId && !exportLoading && availableUTXOs.length === 0 && (
                    <button
                      type="button"
                      onClick={handleExport}
                      disabled={Number(amount) <= 0 || !!error}
                      className={PRIMARY_BUTTON}
                    >
                      <ConnectedWalletIcon className="h-3.5 w-3.5 shrink-0" />
                      <ButtonLabel>
                        Export {amount || '0'} AVAX from {sourceChainName}
                      </ButtonLabel>
                    </button>
                  )}

                  {/* Export loading */}
                  {exportLoading && (
                    <button type="button" disabled aria-busy className={PRIMARY_BUTTON}>
                      <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
                      <span className="truncate">Exporting from {sourceChainName}…</span>
                    </button>
                  )}

                  {/* Export error */}
                  {error && <ErrorNotice id="cross-chain-error">{error}</ErrorNotice>}

                  {/* Waiting for UTXOs after export */}
                  {completedExportTxId && availableUTXOs.length === 0 && !exportLoading && (
                    <p
                      role="status"
                      className="flex items-center justify-center gap-2 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400"
                    >
                      <span aria-hidden className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
                      Waiting for UTXOs on {destChainName}
                    </p>
                  )}

                  {/* Import phase - auto-importing after export */}
                  {importLoading && (
                    <button type="button" disabled aria-busy className={PRIMARY_BUTTON}>
                      <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
                      <span className="truncate">Importing to {destChainName}…</span>
                    </button>
                  )}

                  {/* Import phase - manual button for pre-existing UTXOs only */}
                  {availableUTXOs.length > 0 &&
                    !importTxId &&
                    !importLoading &&
                    completedExportTxId === 'utxo-available' && (
                      <>
                        <div className="flex items-center justify-between gap-4 border border-zinc-200 px-4 py-3 dark:border-zinc-800">
                          <span className="flex min-w-0 flex-col gap-0.5">
                            <span className={EYEBROW}>Pending import</span>
                            <span className="text-[13px] text-zinc-600 dark:text-zinc-300">
                              Exported earlier, not yet imported to {destChainName}
                            </span>
                          </span>
                          <span className="shrink-0 font-mono text-[13px] tabular-nums text-zinc-900 dark:text-zinc-50">
                            {totalUtxoAmount.toFixed(6)} <span className="text-zinc-400 dark:text-zinc-500">AVAX</span>
                          </span>
                        </div>

                        <button type="button" onClick={handleImport} className={PRIMARY_BUTTON}>
                          <ConnectedWalletIcon className="h-3.5 w-3.5 shrink-0" />
                          <ButtonLabel>
                            Import {totalUtxoAmount.toFixed(6)} AVAX to {destChainName}
                          </ButtonLabel>
                        </button>
                      </>
                    )}

                  {/* Import error */}
                  {importError && (
                    <>
                      <ErrorNotice>{importError}</ErrorNotice>
                      <button
                        type="button"
                        onClick={handleImport}
                        disabled={importLoading}
                        className={SECONDARY_BUTTON}
                      >
                        <ButtonLabel>Retry import</ButtonLabel>
                      </button>
                    </>
                  )}

                  {/* Transfer complete */}
                  {importTxId && (
                    <>
                      <p
                        role="status"
                        className="flex items-center justify-center gap-2 py-1 font-mono text-[11px] uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-400"
                      >
                        <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400" />
                        Transfer complete
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setExportTxId('');
                          setCompletedExportTxId('');
                          setImportTxId(null);
                          setAmount('');
                          setError(null);
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
                        className={SECONDARY_BUTTON}
                      >
                        <ButtonLabel>Start new transfer</ButtonLabel>
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </section>

          <CliAlternative command={cliCommand} />
        </Rise>
      </AutoSwitchChainGate>

      <Rise delay={0.06} className="flex flex-col gap-4">
        <SectionHeader label="SDK code" action={<span className={COUNT}>{sdkSources.length} files</span>} />
        <CodeBoard sources={sdkSources} />
      </Rise>
    </div>
  );
}

export default withConsoleToolMetadata(CrossChainTransfer, metadata);
