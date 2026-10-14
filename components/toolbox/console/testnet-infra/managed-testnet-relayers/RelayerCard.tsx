'use client';
import { Fragment, useState, useEffect } from 'react';
import { ArrowLeftRight, ChevronDown, Loader2, RotateCw, Trash2 } from 'lucide-react';
import { Relayer } from '@/components/toolbox/console/testnet-infra/managed-testnet-relayers/types';
import {
  calculateTimeRemaining,
  formatTimeRemaining,
  getStatusData,
} from '@/components/toolbox/console/testnet-infra/managed-testnet-nodes/useTimeRemaining';
import { CodeBlock, Pre } from 'fumadocs-ui/components/codeblock';
import { formatEther, parseEther, Chain } from 'viem';
import { makePublicClientForChain } from '@/components/toolbox/hooks/usePublicClientForChain';
import { useConnectedWallet } from '@/components/toolbox/contexts/ConnectedWalletContext';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { useL1ListStore, L1ListItem } from '@/components/toolbox/stores/l1ListStore';
import useConsoleNotifications from '@/hooks/useConsoleNotifications';
import { Board, HashChip, LiveDot } from '@/components/explorer-v2/ui';
import { cn } from '@/lib/utils';
import { BalanceRows, BTN_DANGER, BTN_SECONDARY, ChainMark, EYEBROW, resolveChainInfo } from './ui';

interface RelayerCardProps {
  relayer: Relayer;
  onDeleteRelayer: (relayer: Relayer) => void;
  onRestartRelayer: (relayer: Relayer) => void;
  isDeletingRelayer: boolean;
  isRestartingRelayer: boolean;
}

// Helper to safely parse dates that might be timestamps or ISO strings
function parseDateSafely(dateValue: string | number): Date {
  if (!dateValue) return new Date();

  // If it's a number or numeric string
  const numValue = typeof dateValue === 'number' ? dateValue : Number(dateValue);
  if (!Number.isNaN(numValue)) {
    // If it's in seconds (< year 3000 in milliseconds), convert to ms
    const ms = numValue < 10000000000 ? numValue * 1000 : numValue;
    return new Date(ms);
  }

  // Otherwise treat as ISO string
  return new Date(dateValue);
}

function formatDateSafely(dateValue: string | number): string {
  try {
    const date = parseDateSafely(dateValue);
    if (isNaN(date.getTime())) return 'Invalid Date';

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return 'Invalid Date';
  }
}

type Tone = 'ok' | 'warn' | 'bad' | 'off';

const TONE_DOT: Record<Tone, string> = {
  ok: 'bg-emerald-500 dark:bg-emerald-400',
  warn: 'bg-amber-500',
  bad: 'bg-red-500',
  off: 'bg-zinc-400 dark:bg-zinc-600',
};

const TONE_TEXT: Record<Tone, string> = {
  ok: 'text-emerald-700 dark:text-emerald-300',
  warn: 'text-amber-700 dark:text-amber-300',
  bad: 'text-red-700 dark:text-red-300',
  off: 'text-zinc-500 dark:text-zinc-400',
};

function StatusMark({ tone, label, live = false }: { tone: Tone; label: string; live?: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em]',
        TONE_TEXT[tone],
      )}
    >
      {live ? <LiveDot /> : <span aria-hidden className={cn('h-1.5 w-1.5 rounded-full', TONE_DOT[tone])} />}
      {label}
    </span>
  );
}

export default function RelayerCard({
  relayer,
  onDeleteRelayer,
  onRestartRelayer,
  isDeletingRelayer,
  isRestartingRelayer,
}: RelayerCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [balances, setBalances] = useState<Record<string, string>>({});
  const [isLoadingBalances, setIsLoadingBalances] = useState(false);
  const [tokenAmounts, setTokenAmounts] = useState<Record<string, string>>({});
  const [isSending, setIsSending] = useState(false);

  const { walletClient } = useConnectedWallet();
  const { walletEVMAddress } = useWalletStore();
  const { l1List } = useL1ListStore()();
  const { notify } = useConsoleNotifications();

  const timeRemaining = calculateTimeRemaining(String(relayer.expiresAt));
  const statusData = getStatusData(timeRemaining);

  // Helper to get chain info from L1 list or fallback
  const getChainInfo = (config: (typeof relayer.configs)[0]) => resolveChainInfo(config, l1List);

  const updateTokenAmount = (blockchainId: string, amount: string) => {
    setTokenAmounts((prev) => ({
      ...prev,
      [blockchainId]: amount,
    }));
  };

  const fetchBalances = async () => {
    setIsLoadingBalances(true);
    try {
      const newBalances: Record<string, string> = {};
      if (!relayer.relayerId) {
        setBalances(newBalances);
        return;
      }
      for (const config of relayer.configs) {
        try {
          const client = makePublicClientForChain(config.rpcUrl);
          if (!client) throw new Error('Unreachable RPC');
          const balance = await client.getBalance({ address: relayer.relayerId as `0x${string}` });
          newBalances[config.blockchainId] = formatEther(balance);
        } catch (error) {
          console.error(`Failed to fetch balance for ${config.blockchainId}:`, error);
          newBalances[config.blockchainId] = 'Error';
        }
      }
      setBalances(newBalances);
    } catch (error) {
      console.error('Failed to fetch balances:', error);
    } finally {
      setIsLoadingBalances(false);
    }
  };

  useEffect(() => {
    if (relayer.relayerId) {
      fetchBalances();
    }
  }, [relayer.relayerId]);

  const sendFunds = async (config: (typeof relayer.configs)[0]) => {
    setIsSending(true);
    try {
      const amount = tokenAmounts[config.blockchainId] || '1';
      if (!amount || parseFloat(amount) <= 0) {
        throw new Error('Please enter a valid amount');
      }

      // Get chain info for the transaction
      const chainInfo = getChainInfo(config);
      const l1 = l1List.find((item: L1ListItem) => item.id === config.blockchainId);
      // Resolve the EVM chain ID — prefer the L1 list; for anything else
      // query the RPC directly. The previous fallback, parseInt(cb58.slice(0,8), 16),
      // silently returned NaN for non-hex base58 characters and left
      // walletClient.switchChain with an invalid id.
      let evmChainId: number | undefined = l1?.evmChainId;
      if (!evmChainId) {
        try {
          const probe = makePublicClientForChain(config.rpcUrl);
          if (!probe) throw new Error('no client');
          evmChainId = await probe.getChainId();
        } catch {
          throw new Error(
            `Could not reach ${config.blockchainId.slice(0, 8)}… to determine its EVM chain ID. Check that the relayer's RPC URL is online.`,
          );
        }
      }
      if (!evmChainId || !Number.isFinite(evmChainId)) {
        throw new Error('Could not determine the EVM chain ID for this relayer config.');
      }

      const viemChain: Chain = {
        id: evmChainId,
        name: chainInfo.name,
        rpcUrls: {
          default: { http: [config.rpcUrl] },
        },
        nativeCurrency: {
          name: chainInfo.coinName,
          symbol: chainInfo.coinName,
          decimals: 18,
        },
      };

      // Switch chain in Core wallet
      await walletClient.switchChain({ id: evmChainId });

      const publicClient = makePublicClientForChain(config.rpcUrl);
      if (!publicClient) throw new Error(`Could not create public client for ${config.rpcUrl}`);

      const nextNonce = await publicClient.getTransactionCount({
        address: walletEVMAddress as `0x${string}`,
        blockTag: 'pending',
      });

      const transactionPromise = walletClient.sendTransaction({
        to: relayer.relayerId as `0x${string}`,
        value: parseEther(amount),
        account: walletEVMAddress as `0x${string}`,
        chain: viemChain,
        nonce: nextNonce,
      });

      notify(
        {
          type: 'transfer',
          name: 'Fund Relayer',
        },
        transactionPromise,
        viemChain,
      );

      const hash = await transactionPromise;
      await publicClient.waitForTransactionReceipt({ hash });
      await fetchBalances();
    } catch (error) {
      throw error;
    } finally {
      setIsSending(false);
    }
  };

  const getHealthStatus = (): { label: string; tone: Tone } => {
    if (!relayer.health) return { label: 'Unreachable', tone: 'off' };
    if (relayer.health.status === 'up') return { label: 'Healthy', tone: 'ok' };
    // Check if any component is healthy (degraded state)
    const hasHealthyComponent =
      relayer.health.details && Object.values(relayer.health.details).some((v) => v?.status === 'up');
    return hasHealthyComponent ? { label: 'Degraded', tone: 'warn' } : { label: 'Unhealthy', tone: 'bad' };
  };

  const healthStatus = getHealthStatus();
  const lifecycleTone: Tone =
    statusData.iconType === 'expired' ? 'off' : statusData.iconType === 'warning' ? 'warn' : 'ok';
  const chains = relayer.configs.map((config) => ({ config, info: getChainInfo(config) }));

  return (
    <Board className="min-w-0 border-x border-t">
      {/* Status bar: health on the left, time left on the right */}
      <div className="flex min-h-9 flex-wrap items-center justify-between gap-x-4 gap-y-1 bg-zinc-50/80 px-5 py-2 dark:bg-zinc-900/40">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <StatusMark tone={healthStatus.tone} label={healthStatus.label} live={healthStatus.tone === 'ok'} />
          <StatusMark tone={lifecycleTone} label={statusData.label} />
        </div>
        <p className="font-mono text-[11px] tabular-nums text-zinc-500 dark:text-zinc-400">
          {timeRemaining.expired ? (
            'Expired'
          ) : (
            <>
              <span className={cn('font-bold', TONE_TEXT[lifecycleTone])}>{formatTimeRemaining(timeRemaining)}</span>{' '}
              left
            </>
          )}
        </p>
      </div>

      {/* Route: every chain it serves, messages flow both ways between them */}
      <div className="flex flex-col gap-4 px-5 py-5">
        <p className={EYEBROW}>Route</p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          {chains.map(({ config, info }, i) => (
            <Fragment key={config.blockchainId}>
              {i > 0 && <ArrowLeftRight aria-label="relays both ways" className="h-3.5 w-3.5 shrink-0 text-zinc-400" />}
              <span className="inline-flex items-center gap-2">
                <ChainMark name={info.name} logoUrl={info.logoUrl} isCChain={info.isCChain} />
                <span className="text-[15px] font-semibold text-zinc-900 dark:text-zinc-50">{info.name}</span>
              </span>
            </Fragment>
          ))}
        </div>
      </div>

      {/* Facts: address and dates in one hairline strip */}
      <dl className="grid grid-cols-1 divide-y divide-zinc-200 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)] sm:divide-x sm:divide-y-0 dark:divide-zinc-800">
        <div className="flex min-w-0 flex-col gap-1.5 px-5 py-3.5">
          <dt className={EYEBROW}>Relayer address</dt>
          <dd className="min-w-0">
            {relayer.relayerId ? (
              <HashChip value={relayer.relayerId} len={14} />
            ) : (
              <span className="font-mono text-[13px] text-zinc-400">—</span>
            )}
          </dd>
        </div>
        <div className="flex flex-col gap-1.5 px-5 py-3.5">
          <dt className={EYEBROW}>Created</dt>
          <dd className="font-mono text-[13px] tabular-nums text-zinc-900 dark:text-zinc-50">
            {formatDateSafely(relayer.createdAt)}
          </dd>
        </div>
        <div className="flex flex-col gap-1.5 px-5 py-3.5">
          <dt className={EYEBROW}>Expires</dt>
          <dd className="font-mono text-[13px] tabular-nums text-zinc-900 dark:text-zinc-50">
            {formatDateSafely(relayer.expiresAt)}
          </dd>
        </div>
      </dl>

      <BalanceRows
        configs={relayer.configs}
        chainInfo={getChainInfo}
        balances={balances}
        isLoadingBalances={isLoadingBalances}
        onRefresh={fetchBalances}
        tokenAmounts={tokenAmounts}
        onAmountChange={updateTokenAmount}
        onSend={sendFunds}
        isSending={isSending}
      />

      {/* Chain configuration disclosure */}
      <div>
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          aria-expanded={isExpanded}
          className="group/disclosure flex w-full items-center justify-between gap-3 px-5 py-3 text-left"
        >
          <span className={cn(EYEBROW, 'underline-offset-4 group-hover/disclosure:underline')}>
            Chain configuration
          </span>
          <ChevronDown
            className={cn(
              'h-3.5 w-3.5 text-zinc-400 transition-transform group-hover/disclosure:text-zinc-900 dark:group-hover/disclosure:text-zinc-100',
              isExpanded && 'rotate-180',
            )}
          />
        </button>
        {isExpanded && (
          <div className="px-5 pb-4 [&_figure]:my-0 [&_figure]:rounded-none">
            <CodeBlock lang="json" allowCopy={true}>
              <Pre>{JSON.stringify(relayer.configs, null, 2)}</Pre>
            </CodeBlock>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center justify-end gap-2 px-5 py-3">
        <button
          type="button"
          onClick={() => onRestartRelayer(relayer)}
          disabled={isRestartingRelayer}
          className={BTN_SECONDARY}
        >
          {isRestartingRelayer ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RotateCw className="h-3.5 w-3.5" />
          )}
          {isRestartingRelayer ? 'Restarting' : 'Restart'}
        </button>
        <button
          type="button"
          onClick={() => onDeleteRelayer(relayer)}
          disabled={isDeletingRelayer}
          className={BTN_DANGER}
        >
          {isDeletingRelayer ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
          {isDeletingRelayer ? 'Deleting' : 'Delete'}
        </button>
      </div>
    </Board>
  );
}
