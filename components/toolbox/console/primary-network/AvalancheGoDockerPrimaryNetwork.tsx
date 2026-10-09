'use client';

import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Container } from '@/components/toolbox/components/Container';
import { Steps, Step } from '@/components/toolbox/components/Steps';
import { Accordion, Accordions } from 'fumadocs-ui/components/accordion';
import {
  AlertTriangle,
  ArrowRight,
  ChevronDown,
  Cpu,
  HardDrive,
  KeyRound,
  Loader2,
  MemoryStick,
  PenLine,
  RotateCcw,
  ShieldCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { DockerInstallation } from '@/components/toolbox/components/DockerInstallation';
import { ReverseProxySetup } from '@/components/toolbox/components/ReverseProxySetup';
import {
  CELL,
  CHECKBOX,
  COUNT,
  Choice,
  ChoiceGrid,
  CodeBlock,
  EYEBROW,
  GRID,
  HoverArrow,
  INLINE_CODE,
  INPUT,
  LINK,
  NOTE,
  Notice,
  PRIMARY_BTN,
  SECONDARY_BTN,
} from '@/components/toolbox/components/NodeSetupUI';
import { SyntaxHighlightedJSON } from '@/components/toolbox/components/genesis/SyntaxHighlightedJSON';
import {
  GenesisHighlightProvider,
  useGenesisHighlight,
} from '@/components/toolbox/components/genesis/GenesisHighlightContext';
import { StorageRequirements } from '@/components/toolbox/components/StorageRequirements';
import {
  generateChainConfig,
  generatePrimaryNetworkNodeConfig,
  generatePrimaryNetworkDockerCommand,
} from '@/components/toolbox/console/layer-1/nodeConfig';
import { useNodeConfigHighlighting } from '@/components/toolbox/console/layer-1/useNodeConfigHighlighting';
import { C_CHAIN_ID } from '@/components/toolbox/console/layer-1/create/config';
import { useAddToWallet } from '@/hooks/useAddToWallet';
import { buildNodeRpcUrl } from '@/components/toolbox/lib/rpcUrl';

function AvalancheGoDockerPrimaryNetworkInner() {
  const { setHighlightPath, clearHighlight, highlightPath } = useGenesisHighlight();
  const [nodeType, setNodeType] = useState<'validator' | 'rpc' | 'archival'>('validator');
  const [domain, setDomain] = useState('');
  // Same single-source-of-truth pattern as the L1 page (issue #4450): a
  // remote node without a proxy domain has NO URL the wallet could reach.
  const [nodeLocation, setNodeLocation] = useState<'remote' | 'local'>('remote');
  const [enableDebugTrace, setEnableDebugTrace] = useState<boolean>(false);
  const [adminApiEnabled, setAdminApiEnabled] = useState<boolean>(false);
  const [pruningEnabled, setPruningEnabled] = useState<boolean>(true);
  const [logLevel, setLogLevel] = useState<string>('info');
  // min-delay-target: 2000ms is the Subnet-EVM default - when set to default, it's omitted from config
  const [minDelayTarget, setMinDelayTarget] = useState<number>(2000);
  const [configJson, setConfigJson] = useState<string>('');

  // Enable expensive debug-level metrics (disabled by default)
  const [metricsExpensiveEnabled, setMetricsExpensiveEnabled] = useState<boolean>(false);

  // Advanced cache settings
  const [trieCleanCache, setTrieCleanCache] = useState<number>(512);
  const [trieDirtyCache, setTrieDirtyCache] = useState<number>(512);
  const [trieDirtyCommitTarget, setTrieDirtyCommitTarget] = useState<number>(20);
  const [triePrefetcherParallelism, setTriePrefetcherParallelism] = useState<number>(16);
  const [snapshotCache, setSnapshotCache] = useState<number>(256);
  const [commitInterval, setCommitInterval] = useState<number>(4096);
  const [stateSyncServerTrieCache, setStateSyncServerTrieCache] = useState<number>(64);

  // API settings
  const [rpcGasCap, setRpcGasCap] = useState<number>(50000000);
  const [rpcTxFeeCap, setRpcTxFeeCap] = useState<number>(100);
  const [apiMaxBlocksPerRequest, setApiMaxBlocksPerRequest] = useState<number>(0);
  const [allowUnfinalizedQueries, setAllowUnfinalizedQueries] = useState<boolean>(false);
  const [batchRequestLimit, setBatchRequestLimit] = useState<number>(1000); // AvalancheGo default
  const [batchResponseMaxSize, setBatchResponseMaxSize] = useState<number>(25000000);

  // State and history
  const [acceptedCacheSize, setAcceptedCacheSize] = useState<number>(32);
  const [transactionHistory, setTransactionHistory] = useState<number>(0);
  const [stateSyncEnabled, setStateSyncEnabled] = useState<boolean>(true);
  const [skipTxIndexing, setSkipTxIndexing] = useState<boolean>(false);

  // Transaction settings
  const [preimagesEnabled, setPreimagesEnabled] = useState<boolean>(false);
  const [localTxsEnabled, setLocalTxsEnabled] = useState<boolean>(false);

  // Gossip settings (validator specific)
  const [pushGossipNumValidators, setPushGossipNumValidators] = useState<number>(100);
  const [pushGossipPercentStake, setPushGossipPercentStake] = useState<number>(0.9);

  // Profiling
  const [continuousProfilerDir, setContinuousProfilerDir] = useState<string>('');
  const [continuousProfilerFrequency, setContinuousProfilerFrequency] = useState<string>('15m');

  // Show advanced settings
  const [showAdvancedSettings, setShowAdvancedSettings] = useState<boolean>(false);

  // Wallet integration for RPC nodes
  const { addToWallet, isAdding: isAddingToWallet } = useAddToWallet();

  // Network selection — syncs with wallet when connected
  const [selectedNetwork, setSelectedNetwork] = useState<'mainnet' | 'fuji'>('mainnet');

  const { isTestnet: walletIsTestnet } = useWalletStore();
  useEffect(() => {
    setSelectedNetwork(walletIsTestnet ? 'fuji' : 'mainnet');
  }, [walletIsTestnet]);

  // Use selected network for configuration (1 = mainnet, 5 = fuji)
  const effectiveNetworkID = selectedNetwork === 'fuji' ? 5 : 1;

  const isRPC = nodeType === 'rpc' || nodeType === 'archival';

  // Get highlighted lines for JSON preview
  const highlightedLines = useNodeConfigHighlighting(highlightPath, configJson);

  // Generate chain configuration JSON when parameters change
  useEffect(() => {
    try {
      const config = generateChainConfig(
        nodeType,
        enableDebugTrace,
        adminApiEnabled,
        pruningEnabled,
        logLevel,
        minDelayTarget,
        trieCleanCache,
        trieDirtyCache,
        trieDirtyCommitTarget,
        triePrefetcherParallelism,
        snapshotCache,
        commitInterval,
        stateSyncServerTrieCache,
        rpcGasCap,
        rpcTxFeeCap,
        apiMaxBlocksPerRequest,
        allowUnfinalizedQueries,
        batchRequestLimit,
        batchResponseMaxSize,
        acceptedCacheSize,
        transactionHistory,
        stateSyncEnabled,
        skipTxIndexing,
        preimagesEnabled,
        localTxsEnabled,
        pushGossipNumValidators,
        pushGossipPercentStake,
        continuousProfilerDir,
        continuousProfilerFrequency,
        metricsExpensiveEnabled,
      );
      setConfigJson(JSON.stringify(config, null, 2));
    } catch (error) {
      setConfigJson(`Error: ${(error as Error).message}`);
    }
  }, [
    nodeType,
    enableDebugTrace,
    adminApiEnabled,
    pruningEnabled,
    logLevel,
    minDelayTarget,
    trieCleanCache,
    trieDirtyCache,
    trieDirtyCommitTarget,
    triePrefetcherParallelism,
    snapshotCache,
    commitInterval,
    stateSyncServerTrieCache,
    rpcGasCap,
    rpcTxFeeCap,
    apiMaxBlocksPerRequest,
    allowUnfinalizedQueries,
    batchRequestLimit,
    batchResponseMaxSize,
    acceptedCacheSize,
    transactionHistory,
    stateSyncEnabled,
    skipTxIndexing,
    preimagesEnabled,
    localTxsEnabled,
    pushGossipNumValidators,
    pushGossipPercentStake,
    continuousProfilerDir,
    continuousProfilerFrequency,
    metricsExpensiveEnabled,
  ]);

  useEffect(() => {
    if (nodeType === 'validator') {
      // Validator node defaults:
      // - Pruning enabled (reduces disk usage)
      // - State sync enabled (fast bootstrap)
      // - TX indexing OFF (validators don't need to query transactions)
      // - eth-apis: node uses sensible defaults automatically
      setDomain('');
      setEnableDebugTrace(false);
      setAdminApiEnabled(false);
      setPruningEnabled(true);
      setLogLevel('info');
      setMinDelayTarget(2000); // Default value - omitted from config
      setAllowUnfinalizedQueries(false);
      setStateSyncEnabled(true); // Validators benefit from fast sync
      setSkipTxIndexing(true); // Validators don't need tx indexing
      setTransactionHistory(0);
    } else if (nodeType === 'rpc') {
      // RPC node defaults:
      // - Pruning enabled (reduces disk usage - only serves current state)
      // - State sync enabled (fast bootstrap)
      // - TX indexing ON (RPC nodes need to query transactions)
      // - eth-apis: node uses sensible defaults automatically
      // Best for: Cost-effective RPC serving current/recent state
      setPruningEnabled(true);
      setLogLevel('info');
      setAllowUnfinalizedQueries(false); // Default to finalized queries for safety
      setStateSyncEnabled(true); // RPC nodes can use fast sync
      setSkipTxIndexing(false); // RPC nodes need tx indexing for queries
      setTransactionHistory(0);
    } else if (nodeType === 'archival') {
      // Archival node defaults:
      // - Pruning disabled (full historical state)
      // - State sync disabled (need to replay all blocks for full history)
      // - TX indexing ON (archival nodes need full tx history)
      // - eth-apis: node uses sensible defaults automatically
      // Best for: Historical queries, block explorers, analytics
      setPruningEnabled(false);
      setLogLevel('info');
      setAllowUnfinalizedQueries(false); // Default to finalized queries for safety
      setStateSyncEnabled(false); // Archival nodes need full historical data
      setSkipTxIndexing(false); // Archival nodes need tx indexing for queries
      setTransactionHistory(0);
    }
  }, [nodeType]);

  useEffect(() => {
    if (!isRPC) {
      setDomain('');
    }
  }, [isRPC]);

  const handleReset = () => {
    setSelectedNetwork('mainnet');
    setNodeType('validator');
    setDomain('');
    setEnableDebugTrace(false);
    setAdminApiEnabled(false);
    setPruningEnabled(true);
    setLogLevel('info');
    setMinDelayTarget(2000); // Default value - omitted from config
    setConfigJson('');
    setTrieCleanCache(512);
    setTrieDirtyCache(512);
    setTrieDirtyCommitTarget(20);
    setTriePrefetcherParallelism(16);
    setSnapshotCache(256);
    setCommitInterval(4096);
    setStateSyncServerTrieCache(64);
    setRpcGasCap(50000000);
    setRpcTxFeeCap(100);
    setApiMaxBlocksPerRequest(0);
    setAllowUnfinalizedQueries(false);
    setBatchRequestLimit(1000); // AvalancheGo default
    setBatchResponseMaxSize(25000000);
    setAcceptedCacheSize(32);
    setTransactionHistory(0);
    setStateSyncEnabled(true);
    setSkipTxIndexing(false);
    setPreimagesEnabled(false);
    setLocalTxsEnabled(false);
    setPushGossipNumValidators(100);
    setPushGossipPercentStake(0.9);
    setContinuousProfilerDir('');
    setContinuousProfilerFrequency('15m');
    setShowAdvancedSettings(false);
    setMetricsExpensiveEnabled(false); // Expensive metrics disabled by default
  };

  // Generate Docker command for Primary Network (config read from mounted volume)
  const getDockerCommand = () => {
    try {
      return generatePrimaryNetworkDockerCommand(nodeType, effectiveNetworkID);
    } catch (error) {
      return `# Error: ${(error as Error).message}`;
    }
  };

  const walletRpcUrl = buildNodeRpcUrl({ location: nodeLocation, domain, blockchainId: 'C' });

  return (
    <Container
      title="Primary Network Node Setup with Docker"
      description="Configure your node settings, preview the chain config, and run Docker to start your Primary Network node."
      githubUrl="https://github.com/ava-labs/builders-hub/edit/master/components/toolbox/console/primary-network/AvalancheGoDockerPrimaryNetwork.tsx"
    >
      <Steps>
        <Step>
          <h3>Configure Node Settings</h3>
          <p>Choose your network, node type, and settings. The config preview updates as you go.</p>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="flex min-w-0 flex-col gap-5">
              <ChoiceGrid label="Network" cols={2}>
                <Choice
                  selected={selectedNetwork === 'mainnet'}
                  onSelect={() => setSelectedNetwork('mainnet')}
                  title="Mainnet"
                  description="Production network"
                />
                <Choice
                  selected={selectedNetwork === 'fuji'}
                  onSelect={() => setSelectedNetwork('fuji')}
                  title="Fuji"
                  description="Testnet"
                />
              </ChoiceGrid>

              <ChoiceGrid label="Node type" cols={3}>
                <Choice
                  selected={nodeType === 'validator'}
                  onSelect={() => setNodeType('validator')}
                  title="Validator"
                  description="P2P only"
                />
                <Choice
                  selected={nodeType === 'rpc'}
                  onSelect={() => setNodeType('rpc')}
                  title="RPC"
                  description="Pruned"
                />
                <Choice
                  selected={nodeType === 'archival'}
                  onSelect={() => setNodeType('archival')}
                  title="Archival"
                  description="Full history"
                />
              </ChoiceGrid>

              <div onMouseEnter={() => setHighlightPath('logLevel')} onMouseLeave={clearHighlight}>
                <ChoiceGrid label="Log level · info is the default" cols={5}>
                  {[
                    { value: 'error', label: 'Error' },
                    { value: 'warn', label: 'Warn' },
                    { value: 'info', label: 'Info' },
                    { value: 'debug', label: 'Debug' },
                    { value: 'verbo', label: 'Verbose' },
                  ].map((level) => (
                    <Choice
                      key={level.value}
                      compact
                      selected={logLevel === level.value}
                      onSelect={() => setLogLevel(level.value)}
                      title={level.label}
                    />
                  ))}
                </ChoiceGrid>
              </div>

              {/* Pruning and State Sync - grouped together due to their interdependency */}
              <Group label="Storage">
                <Toggle
                  path="pruning"
                  checked={pruningEnabled}
                  onChange={setPruningEnabled}
                  label="Enable Pruning"
                  hint={
                    <>
                      <span className="font-medium text-zinc-700 dark:text-zinc-300">Cuts disk usage by ~44x</span>{' '}
                      (13TB → 300GB) by removing old state data.
                      {nodeType === 'validator' && ' Recommended for validators.'}
                      {nodeType === 'rpc' && ' Recommended for RPC nodes serving current state.'}
                      {nodeType === 'archival' && ' Not recommended for archival nodes that need full historical data.'}
                    </>
                  }
                />
                <Toggle
                  path="stateSyncEnabled"
                  checked={stateSyncEnabled}
                  onChange={setStateSyncEnabled}
                  label="Enable State Sync"
                  hint={
                    <>
                      Bootstraps from a state summary instead of replaying every block.
                      {nodeType === 'validator' && ' Recommended for validators to speed up initial sync.'}
                      {nodeType === 'rpc' && ' Recommended for RPC nodes.'}
                      {nodeType === 'archival' && ' Disable for archival nodes that need full historical data.'}
                    </>
                  }
                />

                {/* Warning when pruning and state sync settings don't match */}
                {pruningEnabled !== stateSyncEnabled && (
                  <div className="p-3">
                    <Notice icon={<AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />}>
                      <span className="font-semibold">Mismatched settings:</span> Pruning and State Sync are usually
                      used together.
                      {pruningEnabled && !stateSyncEnabled
                        ? ' Pruning is on but State Sync is off. For validators, enable both for best performance.'
                        : ' State Sync is on but Pruning is off. For archival RPC nodes, disable both to keep full history.'}
                    </Notice>
                  </div>
                )}
              </Group>

              {isRPC && (
                <Group label="RPC">
                  <Toggle
                    path="ethApis"
                    checked={enableDebugTrace}
                    onChange={setEnableDebugTrace}
                    label="Enable Debug Trace"
                    hint="Enables debug APIs and detailed tracing."
                  />
                  <Toggle
                    path="skipTxIndexing"
                    checked={!skipTxIndexing}
                    onChange={(checked) => setSkipTxIndexing(!checked)}
                    label="Enable Transaction Indexing"
                    hint={
                      <>
                        Required for <code className={INLINE_CODE}>eth_getLogs</code> and transaction lookups. Disable
                        to save disk space.
                      </>
                    }
                  />
                </Group>
              )}

              {/* Advanced Settings */}
              <div className="flex flex-col">
                <button
                  type="button"
                  onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
                  aria-expanded={showAdvancedSettings}
                  className="group/adv flex h-11 w-full items-center justify-between gap-3 border border-zinc-200 bg-white/80 px-4 text-left transition-colors hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950/80 dark:hover:border-zinc-600"
                >
                  <span className="font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-900 dark:text-zinc-100">
                    Advanced settings
                  </span>
                  <ChevronDown
                    className={cn(
                      'h-4 w-4 text-zinc-400 transition-transform group-hover/adv:text-zinc-900 dark:group-hover/adv:text-zinc-100',
                      showAdvancedSettings && 'rotate-180',
                    )}
                  />
                </button>

                {showAdvancedSettings && (
                  <div className="flex flex-col divide-y divide-zinc-200 border-x border-b border-zinc-200 bg-white/80 dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-950/80">
                    <p className={cn(NOTE, 'px-4 py-3')}>
                      For every option, see the{' '}
                      <a
                        href="https://build.avax.network/docs/nodes/configure/configs-flags"
                        target="_blank"
                        className={LINK}
                        rel="noreferrer"
                      >
                        AvalancheGo configuration
                      </a>{' '}
                      and{' '}
                      <a
                        href="https://build.avax.network/docs/nodes/chain-configs/c-chain"
                        target="_blank"
                        className={LINK}
                        rel="noreferrer"
                      >
                        C-Chain configuration
                      </a>{' '}
                      docs.
                    </p>

                    <Section label="Cache">
                      <Fields>
                        <NumberField
                          path="trieCleanCache"
                          label="Trie Clean Cache (MB)"
                          value={trieCleanCache}
                          onChange={(v) => setTrieCleanCache(Math.max(0, parseInt(v) || 0))}
                        />
                        <NumberField
                          path="trieDirtyCache"
                          label="Trie Dirty Cache (MB)"
                          value={trieDirtyCache}
                          onChange={(v) => setTrieDirtyCache(Math.max(0, parseInt(v) || 0))}
                        />
                        <NumberField
                          path="snapshotCache"
                          label="Snapshot Cache (MB)"
                          value={snapshotCache}
                          onChange={(v) => setSnapshotCache(Math.max(0, parseInt(v) || 0))}
                        />
                        <NumberField
                          path="acceptedCacheSize"
                          label="Accepted Cache Size (blocks)"
                          hint="Depth of accepted headers and logs cache"
                          value={acceptedCacheSize}
                          onChange={(v) => setAcceptedCacheSize(Math.max(1, parseInt(v) || 1))}
                        />
                        <NumberField
                          path="trieDirtyCommitTarget"
                          label="Trie Dirty Commit Target (MB)"
                          hint="Memory limit before commit"
                          value={trieDirtyCommitTarget}
                          onChange={(v) => setTrieDirtyCommitTarget(Math.max(1, parseInt(v) || 1))}
                        />
                        <NumberField
                          path="triePrefetcherParallelism"
                          label="Trie Prefetcher Parallelism"
                          hint="Max concurrent disk reads"
                          value={triePrefetcherParallelism}
                          onChange={(v) => setTriePrefetcherParallelism(Math.max(1, parseInt(v) || 1))}
                        />
                        <NumberField
                          path="stateSyncServerTrieCache"
                          label="State Sync Server Trie Cache (MB)"
                          hint="Trie cache for state sync server"
                          value={stateSyncServerTrieCache}
                          onChange={(v) => setStateSyncServerTrieCache(Math.max(0, parseInt(v) || 0))}
                        />
                      </Fields>
                    </Section>

                    <Section label="Metrics" flush>
                      <Toggle
                        path="metricsExpensive"
                        focusHighlight
                        checked={metricsExpensiveEnabled}
                        onChange={setMetricsExpensiveEnabled}
                        label="Enable Expensive Metrics"
                        hint="Debug-level metrics, including Firewood metrics. May impact performance."
                      />
                    </Section>

                    <Section label="Performance">
                      <Fields>
                        <NumberField
                          path="commitInterval"
                          label="Commit Interval (blocks)"
                          hint="Interval to persist EVM and atomic tries"
                          value={commitInterval}
                          onChange={(v) => setCommitInterval(Math.max(1, parseInt(v) || 1))}
                        />
                        <NumberField
                          path="rpcGasCap"
                          label="RPC Gas Cap"
                          hint="Maximum gas limit for RPC calls"
                          value={rpcGasCap}
                          onChange={(v) => setRpcGasCap(Math.max(0, parseInt(v) || 0))}
                        />
                        <NumberField
                          path="rpcTxFeeCap"
                          label="RPC Tx Fee Cap (AVAX)"
                          hint="Maximum transaction fee cap"
                          value={rpcTxFeeCap}
                          onChange={(v) => setRpcTxFeeCap(Math.max(0, parseInt(v) || 0))}
                        />
                      </Fields>
                    </Section>

                    <Section label="API limits">
                      <Fields>
                        <NumberField
                          path="batchRequestLimit"
                          label="Batch Request Limit"
                          hint="Max batched requests (0 = no limit)"
                          value={batchRequestLimit}
                          onChange={(v) => setBatchRequestLimit(Math.max(0, parseInt(v) || 0))}
                        />
                        <NumberField
                          path="batchResponseMaxSize"
                          label="Batch Response Max Size (bytes)"
                          hint="Max batch response size (default: 25MB)"
                          value={batchResponseMaxSize}
                          onChange={(v) => setBatchResponseMaxSize(Math.max(0, parseInt(v) || 0))}
                        />
                      </Fields>
                    </Section>

                    <Section label="Transactions & state">
                      <Fields>
                        <NumberField
                          path="transactionHistory"
                          label="Transaction History (blocks)"
                          hint="Max blocks to keep tx indices. 0 = archive mode (all history)"
                          value={transactionHistory}
                          onChange={(v) => setTransactionHistory(Math.max(0, parseInt(v) || 0))}
                        />
                      </Fields>
                      <div className="-mx-4 -mb-4 mt-4 divide-y divide-zinc-200 border-t border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
                        <Toggle
                          path="skipTxIndexing"
                          focusHighlight
                          checked={!skipTxIndexing}
                          onChange={(checked) => setSkipTxIndexing(!checked)}
                          label="Enable Transaction Indexing"
                          hint="Index transactions for querying (uses more disk space)"
                        />
                        <Toggle
                          path="preimagesEnabled"
                          focusHighlight
                          checked={preimagesEnabled}
                          onChange={setPreimagesEnabled}
                          label="Enable Preimages"
                          hint="Record preimages (uses more disk)"
                        />
                        <Toggle
                          path="localTxsEnabled"
                          focusHighlight
                          checked={localTxsEnabled}
                          onChange={setLocalTxsEnabled}
                          label="Enable Local Transactions"
                          hint="Treat local account txs as local"
                        />
                      </div>
                    </Section>

                    {nodeType === 'validator' && (
                      <Section label="Block timing · validator">
                        <Notice
                          icon={<AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />}
                          className="mb-4"
                        >
                          C-Chain has sub-second block times. Only change these if you understand the consensus
                          implications.
                        </Notice>

                        <div
                          className="mb-4 flex flex-col gap-2"
                          onMouseEnter={() => setHighlightPath('minDelayTarget')}
                          onMouseLeave={clearHighlight}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <label htmlFor="pn-min-delay-target" className={FIELD_LABEL}>
                              Min Delay Target
                            </label>
                            <span className="border border-zinc-200 bg-zinc-50 px-2 py-0.5 font-mono text-[11px] tabular-nums text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100">
                              {minDelayTarget}ms{minDelayTarget === 2000 ? ' (default)' : ''}
                            </span>
                          </div>
                          <input
                            id="pn-min-delay-target"
                            type="range"
                            value={minDelayTarget}
                            onChange={(e) => setMinDelayTarget(parseInt(e.target.value))}
                            onFocus={() => setHighlightPath('minDelayTarget')}
                            onBlur={clearHighlight}
                            min="0"
                            max="2000"
                            step="100"
                            className="w-full cursor-pointer accent-zinc-900 dark:accent-zinc-100"
                          />
                          <div className="flex justify-between font-mono text-[10px] text-zinc-400">
                            <span>0ms (fastest)</span>
                            <span>1000ms</span>
                            <span>2000ms (default)</span>
                          </div>
                          <p className={FIELD_HINT}>
                            Minimum time between blocks. Lower is faster blocks but more network load.
                          </p>
                        </div>

                        <Fields>
                          <NumberField
                            path="pushGossipNumValidators"
                            label="Push Gossip Num Validators"
                            hint="Validators to push gossip to (default: 100)"
                            value={pushGossipNumValidators}
                            onChange={(v) => setPushGossipNumValidators(Math.max(0, parseInt(v) || 0))}
                          />
                          <NumberField
                            path="pushGossipPercentStake"
                            label="Push Gossip Percent Stake"
                            hint="Share of total stake to gossip to (default: 0.9)"
                            value={pushGossipPercentStake}
                            step="0.1"
                            min="0"
                            max="1"
                            onChange={(v) => setPushGossipPercentStake(Math.min(1, Math.max(0, parseFloat(v) || 0)))}
                          />
                        </Fields>
                      </Section>
                    )}

                    {isRPC && (
                      <Section label="RPC-specific">
                        <Fields>
                          <NumberField
                            path="apiMaxBlocksPerRequest"
                            label="API Max Blocks Per Request"
                            hint="0 = no limit. Limits blocks per getLogs request"
                            value={apiMaxBlocksPerRequest}
                            onChange={(v) => setApiMaxBlocksPerRequest(Math.max(0, parseInt(v) || 0))}
                          />
                        </Fields>
                        <div className="-mx-4 -mb-4 mt-4 border-t border-zinc-200 dark:border-zinc-800">
                          <Toggle
                            path="allowUnfinalizedQueries"
                            focusHighlight
                            checked={allowUnfinalizedQueries}
                            onChange={setAllowUnfinalizedQueries}
                            label="Allow Unfinalized Queries"
                            hint={
                              <>
                                Allows block tags like <code className={INLINE_CODE}>pending</code>,{' '}
                                <code className={INLINE_CODE}>safe</code>, and{' '}
                                <code className={INLINE_CODE}>latest</code> that may return data from blocks not yet
                                finalized.
                                <span className="mt-1.5 block text-amber-700 dark:text-amber-400">
                                  <span className="font-semibold">Important:</span> enable this if your apps use these
                                  tags (common in Ethereum tooling). Otherwise only{' '}
                                  <code className={INLINE_CODE}>finalized</code> queries are allowed, which may break
                                  some dApps.
                                </span>
                              </>
                            }
                          />
                        </div>
                      </Section>
                    )}

                    <Section label="Profiling · optional">
                      <Fields>
                        <NumberField
                          path="continuousProfilerDir"
                          type="text"
                          label="Continuous Profiler Directory"
                          hint="Directory for continuous profiler output"
                          placeholder="./profiles (leave empty to disable)"
                          value={continuousProfilerDir}
                          onChange={setContinuousProfilerDir}
                        />
                        {continuousProfilerDir && (
                          <NumberField
                            path="continuousProfilerFrequency"
                            type="text"
                            label="Profiler Frequency"
                            hint="How often to create profiles (e.g., 15m, 1h)"
                            placeholder="15m"
                            value={continuousProfilerFrequency}
                            onChange={setContinuousProfilerFrequency}
                          />
                        )}
                      </Fields>
                    </Section>
                  </div>
                )}
              </div>
            </div>

            {/* Configuration Preview */}
            <div className="h-fit min-w-0 lg:sticky lg:top-4">
              <div className="border border-zinc-200 bg-white/80 dark:border-zinc-800 dark:bg-zinc-950/80">
                <div className="flex min-h-9 items-center justify-between gap-4 border-b border-zinc-200 bg-zinc-50/80 px-4 py-2 dark:border-zinc-800 dark:bg-zinc-900/40">
                  <h4 className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">
                    Configuration Preview
                  </h4>
                  <span className={COUNT}>C-Chain config.json</span>
                </div>
                <div className="max-h-[600px] overflow-auto bg-zinc-50 p-3 dark:bg-zinc-900">
                  {configJson && !configJson.startsWith('Error:') ? (
                    <SyntaxHighlightedJSON code={configJson} highlightedLines={highlightedLines} />
                  ) : (
                    <div className="py-8 text-center text-[13px] text-zinc-500 dark:text-zinc-400">
                      {configJson.startsWith('Error:') ? configJson : 'Configure your node to see the chain config'}
                    </div>
                  )}
                </div>
              </div>

              {/* Storage Requirements Visualization */}
              <StorageRequirements
                nodeType={nodeType}
                pruningEnabled={pruningEnabled}
                skipTxIndexing={skipTxIndexing}
                stateSyncEnabled={stateSyncEnabled}
                debugEnabled={enableDebugTrace}
                network={selectedNetwork}
              />
            </div>
          </div>
        </Step>

        <Step>
          <h3>Set up Instance</h3>
          <p>Provision a server with these specs.</p>

          <div className={cn(GRID, 'grid-cols-3')}>
            <Spec icon={<Cpu className="h-3.5 w-3.5" />} label="CPU" value="4-8+ cores" />
            <Spec icon={<MemoryStick className="h-3.5 w-3.5" />} label="RAM" value="16-32 GB" />
            <Spec
              icon={<HardDrive className="h-3.5 w-3.5" />}
              label="Storage"
              value={`${nodeType === 'archival' ? '20 TB' : '1 TB'}${nodeType === 'validator' ? ' NVMe' : ''}`}
            />
          </div>

          <p className={NOTE}>
            {nodeType === 'validator' ? (
              <>Use local NVMe, not cloud block storage (EBS, Persistent Disk). </>
            ) : nodeType === 'archival' ? (
              <>Full historical state needs a lot of storage. </>
            ) : (
              <>Cloud block storage (EBS, Persistent Disk) is fine. </>
            )}
            <Link href="/docs/nodes/system-requirements" className={LINK}>
              System requirements
            </Link>
          </p>
        </Step>

        <Step>
          <DockerInstallation includeCompose={false} />

          <p className={NOTE}>
            Not using Docker? Follow the{' '}
            <a
              href="https://github.com/ava-labs/avalanchego?tab=readme-ov-file#installation"
              target="_blank"
              className={LINK}
              rel="noreferrer"
            >
              manual installation instructions
            </a>
            .
          </p>
        </Step>

        <Step>
          <h3>Create Configuration Files</h3>
          <p>Run these to write the config files. AvalancheGo reads them from these default paths on startup.</p>

          <Steps>
            <Step>
              <h4 className={SUB_HEADING}>Create config directories</h4>
              <CodeBlock code={`mkdir -p ~/.avalanchego/configs/chains/${C_CHAIN_ID}`} />
            </Step>

            <Step>
              <h4 className={SUB_HEADING}>
                Node config <code className={INLINE_CODE}>~/.avalanchego/configs/node.json</code>
              </h4>
              <CodeBlock
                code={(() => {
                  try {
                    const nodeConfig = generatePrimaryNetworkNodeConfig(nodeType, effectiveNetworkID);
                    return `cat > ~/.avalanchego/configs/node.json << 'EOF'\n${JSON.stringify(nodeConfig, null, 2)}\nEOF`;
                  } catch {
                    return '# Error generating node config';
                  }
                })()}
              />
            </Step>

            <Step>
              <h4 className={SUB_HEADING}>
                C-Chain config{' '}
                <code className={INLINE_CODE}>~/.avalanchego/configs/chains/{C_CHAIN_ID.slice(0, 8)}...</code>
              </h4>
              <CodeBlock
                code={(() => {
                  try {
                    const chainConfig = JSON.parse(configJson);
                    return `cat > ~/.avalanchego/configs/chains/${C_CHAIN_ID}/config.json << 'EOF'\n${JSON.stringify(chainConfig, null, 2)}\nEOF`;
                  } catch {
                    return '# Error generating chain config';
                  }
                })()}
              />
            </Step>
          </Steps>

          <p className={cn(NOTE, 'flex flex-wrap items-center gap-x-3 gap-y-1')}>
            <span className={EYEBROW}>Docs</span>
            <a
              href="https://build.avax.network/docs/nodes/configure/configs-flags"
              target="_blank"
              className={LINK}
              rel="noreferrer"
            >
              Node config
            </a>
            <a
              href="https://build.avax.network/docs/nodes/chain-configs/c-chain"
              target="_blank"
              className={LINK}
              rel="noreferrer"
            >
              C-Chain config
            </a>
          </p>
        </Step>

        <Step>
          <h3>Configure Firewall</h3>
          <p>Open the ports your node needs to talk to the network.</p>

          <div className={cn(GRID, 'grid-cols-2')}>
            <Port port="9651" status="Required" title="P2P / Staking port" detail="Node-to-node communication" />
            <Port
              port="9650"
              status={isRPC ? 'Required' : 'RPC only'}
              title="HTTP / RPC port"
              detail="API requests from clients"
              dimmed={!isRPC}
            />
          </div>

          <CodeBlock
            code={
              isRPC
                ? `# Open SSH, P2P, and RPC ports
sudo ufw allow OpenSSH
sudo ufw allow 9651/tcp comment 'AvalancheGo P2P'
sudo ufw allow 9650/tcp comment 'AvalancheGo RPC'
sudo ufw --force enable
sudo ufw status`
                : `# Open SSH and P2P ports (validators don't expose RPC)
sudo ufw allow OpenSSH
sudo ufw allow 9651/tcp comment 'AvalancheGo P2P'
sudo ufw --force enable
sudo ufw status`
            }
          />

          <p className={NOTE}>
            {isRPC
              ? 'RPC nodes need both ports open. Consider a reverse proxy (nginx) for SSL termination on port 9650.'
              : 'Validators only need the P2P port. The RPC port stays bound to localhost.'}
          </p>
        </Step>

        <Step>
          <h3>Run Docker</h3>
          <p>Start the node. Config is read from the mounted volume, so no env vars are needed.</p>

          <CodeBlock code={getDockerCommand()} />

          <p className={NOTE}>
            Restart anytime with <code className={INLINE_CODE}>docker restart avago</code>. Config changes are picked up
            automatically.
          </p>

          <Accordions type="single" className={ACCORDIONS}>
            <Accordion title="Running Multiple Nodes">
              <div className={ACCORDION_BODY}>
                <p>To run multiple nodes on the same machine, give each node:</p>
                <ul className="list-disc pl-5">
                  <li>
                    A unique container name (change <code className={INLINE_CODE}>--name</code>)
                  </li>
                  <li>Different ports (change the port mappings)</li>
                  <li>
                    A separate data directory (change <code className={INLINE_CODE}>~/.avalanchego</code>)
                  </li>
                </ul>
              </div>
            </Accordion>

            <Accordion title="Monitoring Logs">
              <div className={ACCORDION_BODY}>
                <p>Follow your node&apos;s logs with:</p>
                <CodeBlock code="docker logs -f avago" />
              </div>
            </Accordion>
          </Accordions>
        </Step>

        {isRPC && (
          <Step>
            <ReverseProxySetup
              domain={domain}
              setDomain={setDomain}
              chainId={C_CHAIN_ID}
              showHealthCheck={true}
              nodeLocation={nodeLocation}
              setNodeLocation={setNodeLocation}
            />
          </Step>
        )}

        {isRPC && (
          <Step>
            <h3>Add Network to Wallet</h3>
            <p>Point your wallet at your own C-Chain RPC endpoint.</p>

            <div className={cn(GRID, 'grid-cols-1 sm:grid-cols-[minmax(0,1fr)_12rem]')}>
              <div className={cn(CELL, 'flex min-w-0 flex-col gap-1.5 p-4')}>
                <span className={EYEBROW}>RPC endpoint</span>
                <code
                  className={cn(
                    'break-all font-mono text-[12.5px]',
                    walletRpcUrl ? 'text-zinc-900 dark:text-zinc-50' : 'text-zinc-400 dark:text-zinc-500',
                  )}
                >
                  {walletRpcUrl ?? 'Enter the node IP or domain in the reverse proxy step above'}
                </code>
              </div>
              <div className={cn(CELL, 'flex flex-col gap-1.5 p-4')}>
                <span className={EYEBROW}>EVM chain ID</span>
                <code className="font-mono text-[12.5px] tabular-nums text-zinc-900 dark:text-zinc-50">
                  {selectedNetwork === 'fuji' ? '43113' : '43114'}
                </code>
              </div>
            </div>

            <div>
              <button
                type="button"
                className={PRIMARY_BTN}
                onClick={() => {
                  const rpcUrl = buildNodeRpcUrl({ location: nodeLocation, domain, blockchainId: 'C' });
                  if (!rpcUrl) return;
                  void addToWallet({
                    rpcUrl,
                    chainName: selectedNetwork === 'fuji' ? 'Avalanche Fuji C-Chain' : 'Avalanche C-Chain',
                    chainId: selectedNetwork === 'fuji' ? 43113 : 43114,
                    nativeCurrency: {
                      name: 'AVAX',
                      symbol: 'AVAX',
                      decimals: 18,
                    },
                  });
                }}
                disabled={isAddingToWallet || !buildNodeRpcUrl({ location: nodeLocation, domain, blockchainId: 'C' })}
              >
                {isAddingToWallet && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {isAddingToWallet ? 'Adding...' : 'Add to Wallet'}
                <HoverArrow />
              </button>
            </div>

            {!buildNodeRpcUrl({ location: nodeLocation, domain, blockchainId: 'C' }) && (
              <Notice icon={<AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />}>
                Your wallet can&apos;t reach localhost on a remote server. Enter the node&apos;s IP or domain in the
                reverse proxy step above, or choose &quot;This machine&quot; there if the node runs locally.
              </Notice>
            )}

            <p className={NOTE}>
              Works with Core, MetaMask, and other EVM wallets connected via RainbowKit.
              {selectedNetwork === 'fuji' && ' This adds the Fuji testnet with your own node as the RPC provider.'}
            </p>
          </Step>
        )}

        {nodeType === 'validator' && (
          <>
            <Step>
              <h3>Wait for the Node to Bootstrap</h3>
              <p>
                Your node now bootstraps and syncs the Primary Network (P-Chain, X-Chain, and C-Chain). This can take{' '}
                <strong className="font-medium text-zinc-900 dark:text-zinc-100">several hours to days</strong>{' '}
                depending on your hardware and connection.
              </p>

              <p className={NOTE}>Follow progress in the logs:</p>

              <CodeBlock code="docker logs -f avago" />

              <Accordions type="single" className={ACCORDIONS}>
                <Accordion title="Understanding the Logs">
                  <div className={ACCORDION_BODY}>
                    <p>Bootstrapping syncs all three chains:</p>
                    <ul className="flex flex-col gap-3">
                      <li className="flex flex-col gap-2">
                        <span>
                          <strong className="font-medium text-zinc-900 dark:text-zinc-100">
                            P-Chain (Platform Chain):
                          </strong>{' '}
                          platform operations and staking
                        </span>
                        <CodeBlock code='[05-04|17:14:13.793] INFO <P Chain> bootstrap/bootstrapper.go:615 fetching blocks {"numFetchedBlocks": 10099, "numTotalBlocks": 23657, "eta": "37s"}' />
                      </li>
                      <li className="flex flex-col gap-2">
                        <span>
                          <strong className="font-medium text-zinc-900 dark:text-zinc-100">
                            X-Chain (Exchange Chain):
                          </strong>{' '}
                          asset creation and exchange
                        </span>
                        <CodeBlock code='[05-04|17:14:45.641] INFO <X Chain> bootstrap/storage.go:244 executing blocks {"numExecuted": 9311, "numToExecute": 23657, "eta": "15s"}' />
                      </li>
                      <li className="flex flex-col gap-2">
                        <span>
                          <strong className="font-medium text-zinc-900 dark:text-zinc-100">
                            C-Chain (Contract Chain):
                          </strong>{' '}
                          EVM-compatible smart contract chain
                        </span>
                        <CodeBlock code='[05-04|17:15:12.123] INFO <C Chain> chain/chain_state_manager.go:325 syncing {"current": 1234567, "target": 2345678}' />
                      </li>
                    </ul>
                  </div>
                </Accordion>
              </Accordions>
            </Step>

            <Step>
              <h3>Backup Validator Credentials</h3>
              <p>
                Your validator identity is defined by these files in{' '}
                <code className={INLINE_CODE}>~/.avalanchego/staking/</code>
              </p>

              <div className={cn(GRID, 'grid-cols-1 sm:grid-cols-3')}>
                <KeyFile icon={<ShieldCheck className="h-3.5 w-3.5" />} label="TLS Cert" file="staker.crt">
                  Node identity
                </KeyFile>
                <KeyFile icon={<KeyRound className="h-3.5 w-3.5" />} label="Private Key" file="staker.key" secret>
                  Keep secret
                </KeyFile>
                <KeyFile icon={<PenLine className="h-3.5 w-3.5" />} label="BLS Key" file="signer.key" secret>
                  P-Chain signing
                </KeyFile>
              </div>

              <CodeBlock
                code={`# Backup your validator credentials
mkdir -p ~/avalanche-backup
cp -r ~/.avalanchego/staking ~/avalanche-backup/

# Verify backup
ls -la ~/avalanche-backup/staking/`}
              />

              <div className="flex flex-wrap items-center gap-2">
                <span className={EYEBROW}>Store securely</span>
                {['Encrypted USB', 'Encrypted S3', 'Multiple locations'].map((place) => (
                  <span
                    key={place}
                    className="border border-zinc-200 px-2 py-0.5 font-mono text-[11px] text-zinc-600 dark:border-zinc-800 dark:text-zinc-400"
                  >
                    {place}
                  </span>
                ))}
              </div>

              <ul className={cn(NOTE, 'flex flex-col gap-1.5')}>
                <li className="flex items-baseline gap-2.5">
                  <span aria-hidden className="h-1.5 w-1.5 shrink-0 translate-y-[-1px] rounded-full bg-red-500" />
                  <span>
                    Lost keys mean{' '}
                    <strong className="font-medium text-zinc-900 dark:text-zinc-100">missed staking rewards</strong>{' '}
                    (the validator can&apos;t sign). NVMe drives can fail without warning.
                  </span>
                </li>
                <li className="flex items-baseline gap-2.5">
                  <span aria-hidden className="h-1.5 w-1.5 shrink-0 translate-y-[-1px] rounded-full bg-amber-500" />
                  <span>Never share private keys: anyone with them can impersonate your validator.</span>
                </li>
              </ul>

              <div className="flex flex-wrap gap-x-6 gap-y-2 border-t border-zinc-200 pt-4 dark:border-zinc-800">
                <DocLink href="/docs/nodes/maintain/cube-signer-sidecar">CubeSigner Remote Signing</DocLink>
                <DocLink href="/docs/nodes/maintain/backup-restore">Full Backup Guide</DocLink>
              </div>
            </Step>
          </>
        )}
      </Steps>

      {configJson && !configJson.startsWith('Error:') && (
        <div className="flex border-t border-zinc-200 pt-6 dark:border-zinc-800">
          <button type="button" onClick={handleReset} className={SECONDARY_BTN}>
            <RotateCcw className="h-3.5 w-3.5" />
            Start Over
          </button>
        </div>
      )}
    </Container>
  );
}

export default function AvalancheGoDockerPrimaryNetwork() {
  return (
    <GenesisHighlightProvider>
      <AvalancheGoDockerPrimaryNetworkInner />
    </GenesisHighlightProvider>
  );
}

/* ------------------------------------------------------------------------- */

const FIELD_LABEL = 'text-[12px] font-medium text-zinc-700 dark:text-zinc-300';
const FIELD_HINT = 'text-[11.5px] leading-relaxed text-zinc-500 dark:text-zinc-400';
const SUB_HEADING = 'flex flex-wrap items-center gap-2 text-[13.5px] font-medium text-zinc-900 dark:text-zinc-50';
const ACCORDIONS =
  'rounded-none border-zinc-200 bg-white/80 divide-zinc-200 dark:border-zinc-800 dark:bg-zinc-950/80 dark:divide-zinc-800 [&_h3]:text-[13px] [&_h3]:font-medium [&_h3]:text-zinc-900 dark:[&_h3]:text-zinc-100';
const ACCORDION_BODY =
  'flex flex-col gap-3 pb-2 text-[13px] leading-relaxed text-zinc-600 dark:text-zinc-400 [&_figure]:my-0';

/** A bordered settings group: a mono title bar over hairline-divided rows. */
function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border border-zinc-200 bg-white/80 dark:border-zinc-800 dark:bg-zinc-950/80">
      <div className="flex min-h-9 items-center border-b border-zinc-200 bg-zinc-50/80 px-4 py-2 dark:border-zinc-800 dark:bg-zinc-900/40">
        <p className={EYEBROW}>{label}</p>
      </div>
      <div className="divide-y divide-zinc-200 dark:divide-zinc-800">{children}</div>
    </div>
  );
}

/** One titled block inside the advanced settings panel. */
function Section({ label, flush = false, children }: { label: string; flush?: boolean; children: React.ReactNode }) {
  return (
    <div className={flush ? 'flex flex-col' : 'flex flex-col p-4'}>
      <p className={cn(EYEBROW, flush ? 'px-4 pt-4' : 'mb-3')}>{label}</p>
      {children}
    </div>
  );
}

function Fields({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">{children}</div>;
}

/** A checkbox row; hovering it highlights its key in the config preview. */
function Toggle({
  path,
  checked,
  onChange,
  label,
  hint,
  focusHighlight = false,
}: {
  path: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  hint?: React.ReactNode;
  focusHighlight?: boolean;
}) {
  const { setHighlightPath, clearHighlight } = useGenesisHighlight();
  return (
    <div className="px-4 py-3" onMouseEnter={() => setHighlightPath(path)} onMouseLeave={clearHighlight}>
      <label className="flex cursor-pointer items-center gap-2.5">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          {...(focusHighlight ? { onFocus: () => setHighlightPath(path), onBlur: clearHighlight } : {})}
          className={CHECKBOX}
        />
        <span className="text-[13px] font-medium text-zinc-900 dark:text-zinc-100">{label}</span>
      </label>
      {hint && <p className={cn(FIELD_HINT, 'ml-6 mt-1')}>{hint}</p>}
    </div>
  );
}

/** A labelled input; hovering or focusing it highlights its key in the config preview. */
function NumberField({
  path,
  label,
  hint,
  value,
  onChange,
  type = 'number',
  placeholder,
  step,
  min,
  max,
}: {
  path: string;
  label: string;
  hint?: string;
  value: number | string;
  onChange: (value: string) => void;
  type?: 'number' | 'text';
  placeholder?: string;
  step?: string;
  min?: string;
  max?: string;
}) {
  const { setHighlightPath, clearHighlight } = useGenesisHighlight();
  const id = `pn-${path}`;
  return (
    <div className="flex flex-col gap-1.5" onMouseEnter={() => setHighlightPath(path)} onMouseLeave={clearHighlight}>
      <label htmlFor={id} className={FIELD_LABEL}>
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        step={step}
        min={min}
        max={max}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setHighlightPath(path)}
        onBlur={clearHighlight}
        className={INPUT}
      />
      {hint && <p className={FIELD_HINT}>{hint}</p>}
    </div>
  );
}

function Spec({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className={cn(CELL, 'flex flex-col gap-2 p-4')}>
      <span className={cn(EYEBROW, 'flex items-center gap-1.5')}>
        <span className="text-zinc-400">{icon}</span>
        {label}
      </span>
      <span className="font-mono text-[15px] tabular-nums text-zinc-900 dark:text-zinc-50">{value}</span>
    </div>
  );
}

function Port({
  port,
  status,
  title,
  detail,
  dimmed = false,
}: {
  port: string;
  status: string;
  title: string;
  detail: string;
  dimmed?: boolean;
}) {
  const required = status === 'Required';
  return (
    <div className={cn(CELL, 'flex flex-col gap-1.5 p-4', dimmed && 'opacity-50')}>
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-lg tabular-nums text-zinc-900 dark:text-zinc-50">{port}</span>
        <span
          className={cn(
            'inline-flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em]',
            required ? 'text-emerald-700 dark:text-emerald-400' : 'text-zinc-500 dark:text-zinc-400',
          )}
        >
          <span aria-hidden className={cn('h-1.5 w-1.5 rounded-full', required ? 'bg-emerald-500' : 'bg-zinc-400')} />
          {status}
        </span>
      </div>
      <span className="text-[13px] text-zinc-700 dark:text-zinc-300">{title}</span>
      <span className="text-[11.5px] text-zinc-500 dark:text-zinc-400">{detail}</span>
    </div>
  );
}

function KeyFile({
  icon,
  label,
  file,
  secret = false,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  file: string;
  secret?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={cn(CELL, 'flex flex-col gap-1.5 p-4')}>
      <div className="flex items-center justify-between gap-2">
        <span className={cn(EYEBROW, 'flex items-center gap-1.5')}>
          <span className={secret ? 'text-[#E6212F]' : 'text-zinc-400'}>{icon}</span>
          {label}
        </span>
        {secret && (
          <span className="inline-flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-red-700 dark:text-red-400">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-red-500" />
            Secret
          </span>
        )}
      </div>
      <span className="font-mono text-[14px] text-zinc-900 dark:text-zinc-50">{file}</span>
      <span className="text-[11.5px] text-zinc-500 dark:text-zinc-400">{children}</span>
    </div>
  );
}

function DocLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      className="group/doc inline-flex items-center gap-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-zinc-700 transition-colors hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"
    >
      {children}
      <ArrowRight className="h-3 w-3 -translate-x-1 text-[#E6212F] opacity-0 transition-all group-hover/doc:translate-x-0 group-hover/doc:opacity-100" />
    </a>
  );
}
