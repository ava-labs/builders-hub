'use client';

import { useState, useEffect } from 'react';
import { useManagedTestnetRelayers } from '@/hooks/useManagedTestnetRelayers';
import { Relayer, RelayerConfig } from './types';
import { Steps, Step } from '@/components/toolbox/components/Steps';
import Link from 'next/link';
import useConsoleNotifications from '@/hooks/useConsoleNotifications';
import { ConsoleToolMetadata, withConsoleToolMetadata } from '@/components/toolbox/components/WithConsoleToolMetadata';
import { WalletRequirementsConfigKey } from '@/components/toolbox/hooks/useWalletRequirements';
import { generateConsoleToolGitHubUrl } from '@/components/toolbox/utils/githubUrl';
import { useL1ListStore, L1ListItem } from '@/components/toolbox/stores/l1ListStore';
import { ArrowUpRight, Loader2 } from 'lucide-react';
import { Board, BoardHeader, HashChip } from '@/components/explorer-v2/ui';
import {
  BalanceRows,
  BTN_PRIMARY,
  BTN_SECONDARY,
  ChainPicker,
  EYEBROW,
  HoverArrow,
  Notice,
  resolveChainInfo,
  SelectionSummary,
} from './ui';
import { formatEther, parseEther, Chain } from 'viem';
import { makePublicClientForChain } from '@/components/toolbox/hooks/usePublicClientForChain';
import { useConnectedWallet } from '@/components/toolbox/contexts/ConnectedWalletContext';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';

const metadata: ConsoleToolMetadata = {
  title: 'Create Managed Testnet Relayer',
  description:
    'A free Fuji ICM relayer that carries messages between your L1s. It shuts down after 3 days, so use it for quick tests; run your own relayer for production or longer testing. Needs a Builder Hub account.',
  toolRequirements: [WalletRequirementsConfigKey.TestnetRequired],
  githubUrl: generateConsoleToolGitHubUrl(import.meta.url),
};

function CreateManagedTestnetRelayerBase() {
  const { createRelayer, fetchRelayers, relayers } = useManagedTestnetRelayers();
  const { notify } = useConsoleNotifications();
  const { l1List } = useL1ListStore()();
  const { walletClient } = useConnectedWallet();
  const { walletEVMAddress } = useWalletStore();

  // Step 1: Network selection
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [selectedDestinations, setSelectedDestinations] = useState<string[]>([]);
  const [selectionError, setSelectionError] = useState<string | null>(null);

  // Step 2: Relayer creation
  const [createdRelayerResponse, setCreatedRelayerResponse] = useState<Relayer | null>(null);
  const [createdRelayer, setCreatedRelayer] = useState<Relayer | null>(null);
  const [isCreatingRelayer, setIsCreatingRelayer] = useState(false);

  // Step 3: Funding
  const [balances, setBalances] = useState<Record<string, string>>({});
  const [isLoadingBalances, setIsLoadingBalances] = useState(false);
  const [tokenAmounts, setTokenAmounts] = useState<Record<string, string>>({});
  const [isSending, setIsSending] = useState(false);

  // Initialize with first chain if available
  useEffect(() => {
    if (l1List.length > 0 && selectedSources.length === 0 && selectedDestinations.length === 0) {
      setSelectedSources([l1List[0].id]);
      setSelectedDestinations([l1List[0].id]);
    }
  }, [l1List]);

  // Validate selections
  useEffect(() => {
    if (selectedSources.length === 0 || selectedDestinations.length === 0) {
      setSelectionError('You must select at least one source and one destination network');
      return;
    }

    if (
      selectedSources.length === 1 &&
      selectedDestinations.length === 1 &&
      selectedSources[0] === selectedDestinations[0]
    ) {
      setSelectionError('Source and destination cannot be the same network when selecting one each');
      return;
    }

    setSelectionError(null);
  }, [selectedSources, selectedDestinations]);

  // Load relayers when component mounts
  useEffect(() => {
    fetchRelayers();
  }, [fetchRelayers]);

  // Find the created relayer in the relayers list after creation
  // We find the most recently created relayer since relayers are already filtered by user
  useEffect(() => {
    if (createdRelayerResponse && relayers.length > 0) {
      // Sort by createdAt descending (most recent first) and take the first one
      const sortedRelayers = [...relayers].sort((a, b) => {
        const timeA = typeof a.createdAt === 'number' ? a.createdAt : new Date(a.createdAt).getTime();
        const timeB = typeof b.createdAt === 'number' ? b.createdAt : new Date(b.createdAt).getTime();
        return timeB - timeA;
      });

      const mostRecentRelayer = sortedRelayers[0];
      if (mostRecentRelayer) {
        setCreatedRelayer(mostRecentRelayer);
      }
    }
  }, [relayers, createdRelayerResponse]);

  const handleToggleSource = (l1Id: string) => {
    setSelectedSources((prev) => (prev.includes(l1Id) ? prev.filter((id) => id !== l1Id) : [...prev, l1Id]));
  };

  const handleToggleDestination = (l1Id: string) => {
    setSelectedDestinations((prev) => (prev.includes(l1Id) ? prev.filter((id) => id !== l1Id) : [...prev, l1Id]));
  };

  // Helper to get chain info from L1 list or fallback
  const getChainInfo = (config: RelayerConfig) => resolveChainInfo(config, l1List);

  const updateTokenAmount = (blockchainId: string, amount: string) => {
    setTokenAmounts((prev) => ({
      ...prev,
      [blockchainId]: amount,
    }));
  };

  const fetchBalances = async () => {
    if (!createdRelayer?.relayerId) return;

    setIsLoadingBalances(true);
    try {
      const newBalances: Record<string, string> = {};
      for (const config of createdRelayer.configs) {
        try {
          const client = makePublicClientForChain(config.rpcUrl);
          if (!client) throw new Error('Unreachable RPC');
          const balance = await client.getBalance({ address: createdRelayer.relayerId as `0x${string}` });
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
    if (createdRelayer?.relayerId) {
      fetchBalances();
    }
  }, [createdRelayer?.relayerId]);

  const sendFunds = async (config: RelayerConfig) => {
    if (!createdRelayer?.relayerId) return;

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
        to: createdRelayer.relayerId as `0x${string}`,
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

  const handleCreate = async () => {
    if (selectionError) return;

    setIsCreatingRelayer(true);
    try {
      // Get unique chains from both sources and destinations
      const allChainIds = [...new Set([...selectedSources, ...selectedDestinations])];

      const configs: RelayerConfig[] = l1List
        .filter((l1: L1ListItem) => allChainIds.includes(l1.id))
        .map((l1: L1ListItem) => ({
          subnetId: l1.subnetId,
          blockchainId: l1.id,
          rpcUrl: l1.rpcUrl,
          wsUrl: l1.rpcUrl.replace('http', 'ws').replace('/rpc', '/ws'),
        }));

      const createRelayerPromise = createRelayer(configs);
      notify(
        {
          name: 'Managed Testnet Relayer Creation',
          type: 'local',
        },
        createRelayerPromise,
      );

      const response = await createRelayerPromise;
      setCreatedRelayerResponse(response);
    } finally {
      setIsCreatingRelayer(false);
      await fetchRelayers();
    }
  };

  return (
    <Steps>
      <Step>
        <h2>Select networks</h2>
        <p>Pick the chains to watch for messages and the chains to deliver them to.</p>
        {selectionError && l1List.length > 0 && <Notice tone="error">{selectionError}</Notice>}
        <ChainPicker
          l1List={l1List}
          sources={selectedSources}
          destinations={selectedDestinations}
          onToggleSource={handleToggleSource}
          onToggleDestination={handleToggleDestination}
        />
      </Step>

      <Step>
        <h2>Create relayer</h2>
        <p>Check the route, then create the relayer. It runs for 3 days.</p>
        <Board className="border-x border-t">
          <BoardHeader label="Your relayer" display />
          <SelectionSummary l1List={l1List} sources={selectedSources} destinations={selectedDestinations} />
          <div className="flex justify-end px-5 py-4">
            <button
              type="button"
              onClick={handleCreate}
              disabled={!!selectionError || l1List.length === 0 || isCreatingRelayer}
              className={BTN_PRIMARY}
            >
              {isCreatingRelayer && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {isCreatingRelayer ? 'Creating' : 'Create relayer'}
              <HoverArrow />
            </button>
          </div>
        </Board>
      </Step>

      <Step>
        <h2>Fund relayer</h2>
        <p>Send gas tokens to the relayer address on every chain it serves.</p>
        {createdRelayerResponse && !createdRelayer && (
          <div
            role="status"
            className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400"
          >
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Loading relayer details
          </div>
        )}
        {createdRelayer && createdRelayer.relayerId ? (
          <Board className="border-x border-t">
            <div className="flex flex-col gap-1.5 px-5 py-3.5">
              <p className={EYEBROW}>Relayer address</p>
              <HashChip value={createdRelayer.relayerId} len={14} />
            </div>
            <BalanceRows
              configs={createdRelayer.configs}
              chainInfo={getChainInfo}
              balances={balances}
              isLoadingBalances={isLoadingBalances}
              onRefresh={fetchBalances}
              tokenAmounts={tokenAmounts}
              onAmountChange={updateTokenAmount}
              onSend={sendFunds}
              isSending={isSending}
            />
          </Board>
        ) : (
          !createdRelayerResponse && (
            <p className="border border-zinc-200 px-5 py-4 text-[13px] text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
              The relayer&apos;s address and balances show here once it&apos;s created.
            </p>
          )
        )}
      </Step>

      <Step>
        <h2>Manage relayer</h2>
        <p>Open the relayer manager to view, fund, restart or delete all your relayers.</p>
        <div>
          {createdRelayer ? (
            <Link href="/console/testnet-infra/icm-relayer" target="_blank" className={BTN_SECONDARY}>
              Open relayer manager
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          ) : (
            <button type="button" disabled className={BTN_SECONDARY}>
              Open relayer manager
              <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </Step>
    </Steps>
  );
}

export default withConsoleToolMetadata(CreateManagedTestnetRelayerBase, metadata);
