'use client';

// L1 Node Docker Setup
import { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import { useWalletStore } from '../../stores/walletStore';
import { useCreateChainStore } from '../../stores/createChainStore';
import { Container } from '../../components/Container';
import { getBlockchainInfoForNetwork, getSubnetInfoForNetwork } from '../../coreViem/utils/glacier';
import InputSubnetId from '../../components/InputSubnetId';
import BlockchainDetailsDisplay from '../../components/BlockchainDetailsDisplay';
import { Accordion, Accordions } from 'fumadocs-ui/components/accordion';
import { Button } from '../../components/Button';
import { Steps, Step } from '@/components/toolbox/components/Steps';
import { SyntaxHighlightedJSON } from '../../components/genesis/SyntaxHighlightedJSON';
import { ReverseProxySetup } from '../../components/ReverseProxySetup';
import { DockerInstallation } from '../../components/DockerInstallation';
import { StorageRequirements } from '../../components/StorageRequirements';
import { GenesisHighlightProvider, useGenesisHighlight } from '../../components/genesis/GenesisHighlightContext';
import {
  ACCORDION_BODY,
  ACCORDIONS,
  CELL,
  CHECKBOX,
  COUNT,
  Choice,
  ChoiceGrid,
  CodeBlock,
  DocLink,
  EYEBROW,
  FIELD_HINT,
  FIELD_LABEL,
  GRID,
  Group,
  HoverArrow,
  INLINE_CODE,
  INPUT,
  KeyFile,
  LINK,
  NOTE,
  Notice,
  Port,
  SUB_HEADING,
  Spec,
} from '@/components/toolbox/components/NodeSetupUI';
import { SUBNET_EVM_VM_ID } from '@/constants/console';
import {
  generateChainConfig,
  generateNodeConfig,
  generateDockerCommand,
  generateAllConfigCommands,
} from './nodeConfig';
import { useNodeConfigHighlighting } from './useNodeConfigHighlighting';
import {
  AlertTriangle,
  ArrowRight,
  ChevronDown,
  Cpu,
  HardDrive,
  KeyRound,
  Loader2,
  MemoryStick,
  Network,
  PenLine,
  RotateCcw,
  ShieldCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAddToWallet } from '@/hooks/useAddToWallet';
import { buildNodeRpcUrl } from '../../lib/rpcUrl';
import { useL1ListStore, type L1ListItem } from '../../stores/l1ListStore';
import { networkIDs } from '@avalabs/avalanchejs';

export interface AvalancheGoDockerL1Props {
  /**
   * Pre-fill the subnet ID input. When set, the component mounts with the
   * subnet already selected — used when coming from the Create L1 flow where
   * the subnet was just created.
   */
  defaultSubnetId?: string;
  /**
   * Hide the node-type selector and force the given type. Used in the Create
   * L1 flow where the user must run a validator (they just created a
   * validator set) — RPC/Archival options are noise in that context.
   */
  forceNodeType?: 'validator' | 'rpc' | 'archival';
  /**
   * Render the Prerequisites step. Useful in standalone mode or the Create L1
   * flow where the user hasn't thought about Docker/disk/ports yet.
   */
  showPrerequisites?: boolean;
}

function AvalanchegoDockerInner({
  defaultSubnetId,
  forceNodeType,
  showPrerequisites = true,
}: AvalancheGoDockerL1Props) {
  const { setHighlightPath, clearHighlight, highlightPath } = useGenesisHighlight();

  // ── Flow context ──────────────────────────────────────────────
  // Autofill subnet ID from the create-chain store when we arrive via the
  // Create L1 flow. Prop wins over store (callers can override explicitly).
  const createChainSubnetId = useCreateChainStore()((state) => state.subnetId);
  const createChainGenesisData = useCreateChainStore()((state) => state.genesisData);
  const initialSubnetId = defaultSubnetId ?? createChainSubnetId ?? '';

  // ── Wallet / network sync ─────────────────────────────────────
  const {
    isTestnet: walletIsTestnet,
    setIsTestnet: setWalletIsTestnet,
    setAvalancheNetworkID,
    setWalletChainId,
    updateL1Balance,
  } = useWalletStore();

  // Default to wallet's isTestnet on first mount so users coming from a Fuji
  // flow don't land on a Mainnet card they didn't ask for.
  const [selectedNetwork, setSelectedNetwork] = useState<'mainnet' | 'fuji'>(walletIsTestnet ? 'fuji' : 'mainnet');
  useEffect(() => {
    setSelectedNetwork(walletIsTestnet ? 'fuji' : 'mainnet');
  }, [walletIsTestnet]);

  // ── L1 lookup ────────────────────────────────────────────────
  const [chainId, setChainId] = useState('');
  const [subnetId, setSubnetId] = useState(initialSubnetId);
  const [subnet, setSubnet] = useState<any>(null);
  const [blockchainInfo, setBlockchainInfo] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [subnetIdError, setSubnetIdError] = useState<string | null>(null);
  const [selectedRPCBlockchainId, setSelectedRPCBlockchainId] = useState<string>('');

  // Sync prop/store default into local state if it arrives late (common in
  // the flow after CreateSubnet finishes and stores the ID).
  useEffect(() => {
    if (defaultSubnetId && !subnetId) setSubnetId(defaultSubnetId);
  }, [defaultSubnetId, subnetId]);
  useEffect(() => {
    if (!defaultSubnetId && createChainSubnetId && !subnetId) setSubnetId(createChainSubnetId);
  }, [createChainSubnetId, defaultSubnetId, subnetId]);

  // ── Node-type & run shape ────────────────────────────────────
  const [nodeType, setNodeType] = useState<'validator' | 'rpc' | 'archival'>(forceNodeType ?? 'validator');
  useEffect(() => {
    if (forceNodeType) setNodeType(forceNodeType);
  }, [forceNodeType]);
  const [domain, setDomain] = useState('');
  // Where the node runs. Remote is the default: this page's own setup
  // commands target a server, and a remote node has NO localhost URL the
  // console could honestly offer (issue #4450).
  const [nodeLocation, setNodeLocation] = useState<'remote' | 'local'>('remote');
  const [proxyHealthOk, setProxyHealthOk] = useState<boolean | null>(null);
  // Set when the wallet already has this chain under a DIFFERENT RPC URL:
  // the add call cannot fix that (wallets dedupe it), only the user can.
  const [walletRpcMismatch, setWalletRpcMismatch] = useState<string | null>(null);
  useEffect(() => {
    setProxyHealthOk(null);
  }, [domain]);

  // ── Advanced / chain config (consolidated reducer state) ──────
  // Track every cache/api/gossip/profiling knob via a single reducer instead
  // of ~25 separate `useState`s. Makes Start-Over a one-line reset and lets
  // node-type presets patch in only the keys they care about.
  const [cfg, setCfg] = useState({
    enableDebugTrace: selectedNetwork === 'fuji',
    adminApiEnabled: false,
    pruningEnabled: true,
    logLevel: 'info',
    minDelayTarget: 2000,
    // Cache
    trieCleanCache: 512,
    trieDirtyCache: 512,
    trieDirtyCommitTarget: 20,
    triePrefetcherParallelism: 16,
    snapshotCache: 256,
    commitInterval: 4096,
    stateSyncServerTrieCache: 64,
    // API
    rpcGasCap: 50000000,
    rpcTxFeeCap: 100,
    apiMaxBlocksPerRequest: 0,
    allowUnfinalizedQueries: false,
    batchRequestLimit: 1000,
    batchResponseMaxSize: 25000000,
    // State & history
    acceptedCacheSize: 32,
    transactionHistory: 0,
    stateSyncEnabled: true,
    skipTxIndexing: false,
    // Tx
    preimagesEnabled: false,
    localTxsEnabled: false,
    // Gossip
    pushGossipNumValidators: 100,
    pushGossipPercentStake: 0.9,
    // Profiling
    continuousProfilerDir: '',
    continuousProfilerFrequency: '15m',
    // Metrics
    metricsExpensiveEnabled: false,
  });

  const [configJson, setConfigJson] = useState<string>('');
  const [showAdvancedSettings, setShowAdvancedSettings] = useState<boolean>(false);

  // Track whether the user has manually touched enableDebugTrace. Without
  // this, switching networks silently overrides their choice — a UX bug
  // where a user turns off debug trace, switches Fuji→Mainnet→Fuji, and
  // has debug trace flipped back on without touching the checkbox.
  const debugTraceUserSet = useRef(false);

  const { addToWallet, isAdding: isAddingToWallet } = useAddToWallet();
  const l1ListStore = useL1ListStore();

  // Numeric network ID used by generateNodeConfig/Docker command builders.
  // Wire through `networkIDs.*` instead of hard-coding 1/5.
  const effectiveNetworkID = selectedNetwork === 'fuji' ? networkIDs.FujiID : networkIDs.MainnetID;
  const isTestnet = selectedNetwork === 'fuji';
  const isRPC = nodeType === 'rpc' || nodeType === 'archival';
  const isValidator = nodeType === 'validator' || (nodeType === 'archival' && isTestnet);

  // The one RPC URL for this node: display, the L1 list entry, and the
  // wallet all read this value. Null when no correct URL exists yet
  // (remote node without a proxy domain).
  const nodeRpcUrl = buildNodeRpcUrl({
    location: nodeLocation,
    domain,
    blockchainId: selectedRPCBlockchainId || chainId,
  });

  const highlightedLines = useNodeConfigHighlighting(highlightPath, configJson);

  // Regenerate the Subnet-EVM chain config JSON whenever any relevant knob
  // changes. Kept as a single dep array on `cfg` (+ nodeType) since the
  // reducer-ish shape means one field change == one state transition.
  useEffect(() => {
    try {
      const config = generateChainConfig(
        nodeType,
        cfg.enableDebugTrace,
        cfg.adminApiEnabled,
        cfg.pruningEnabled,
        cfg.logLevel,
        cfg.minDelayTarget,
        cfg.trieCleanCache,
        cfg.trieDirtyCache,
        cfg.trieDirtyCommitTarget,
        cfg.triePrefetcherParallelism,
        cfg.snapshotCache,
        cfg.commitInterval,
        cfg.stateSyncServerTrieCache,
        cfg.rpcGasCap,
        cfg.rpcTxFeeCap,
        cfg.apiMaxBlocksPerRequest,
        cfg.allowUnfinalizedQueries,
        cfg.batchRequestLimit,
        cfg.batchResponseMaxSize,
        cfg.acceptedCacheSize,
        cfg.transactionHistory,
        cfg.stateSyncEnabled,
        cfg.skipTxIndexing,
        cfg.preimagesEnabled,
        cfg.localTxsEnabled,
        cfg.pushGossipNumValidators,
        cfg.pushGossipPercentStake,
        cfg.continuousProfilerDir,
        cfg.continuousProfilerFrequency,
        cfg.metricsExpensiveEnabled,
      );
      setConfigJson(JSON.stringify(config, null, 2));
    } catch (error) {
      setConfigJson(`Error: ${(error as Error).message}`);
    }
  }, [nodeType, cfg]);

  // Node-type preset. Patches only the fields this type has a strong
  // opinion about — cache/gossip knobs, user's domain, etc. survive.
  useEffect(() => {
    if (nodeType === 'validator') {
      setDomain('');
      setCfg((c) => ({
        ...c,
        adminApiEnabled: false,
        pruningEnabled: true,
        logLevel: 'info',
        minDelayTarget: 2000,
        allowUnfinalizedQueries: false,
        stateSyncEnabled: true,
        skipTxIndexing: true,
        transactionHistory: 0,
      }));
    } else if (nodeType === 'rpc') {
      setCfg((c) => ({
        ...c,
        pruningEnabled: true,
        logLevel: 'info',
        allowUnfinalizedQueries: false,
        stateSyncEnabled: true,
        skipTxIndexing: false,
        transactionHistory: 0,
      }));
    } else if (nodeType === 'archival') {
      setCfg((c) => ({
        ...c,
        pruningEnabled: false,
        logLevel: 'info',
        minDelayTarget: 2000,
        allowUnfinalizedQueries: false,
        stateSyncEnabled: false,
        skipTxIndexing: false,
        transactionHistory: 0,
      }));
    }
  }, [nodeType]);

  // Default debug trace on/off by network — but only if the user hasn't
  // explicitly toggled it. Prior logic overwrote user intent on every
  // network flip; the ref-guard keeps manual changes sticky.
  useEffect(() => {
    if (debugTraceUserSet.current) return;
    setCfg((c) => ({ ...c, enableDebugTrace: selectedNetwork === 'fuji' }));
  }, [selectedNetwork]);

  // Default to running both Validator + RPC on Fuji — the common single-box
  // testnet shape. Effect only re-fires when selectedNetwork actually changes,
  // so a manual mid-Fuji click on Validator or RPC still sticks. The reset
  // happens cleanly on every Mainnet → Fuji entry, matching the user's mental
  // model of "picking Fuji starts a fresh testnet flow".
  useEffect(() => {
    if (forceNodeType) return;
    if (selectedNetwork === 'fuji') setNodeType('archival');
  }, [selectedNetwork, forceNodeType]);

  // L1 lookup — refetch on subnet/network change, with AbortController.
  useEffect(() => {
    setSubnetIdError(null);
    setChainId('');
    setSubnet(null);
    setBlockchainInfo(null);
    if (!subnetId) return;

    const abortController = new AbortController();
    setIsLoading(true);

    const loadSubnetData = async () => {
      const network = selectedNetwork === 'fuji' ? 'testnet' : 'mainnet';
      try {
        const subnetInfo = await getSubnetInfoForNetwork(network, subnetId, abortController.signal);
        if (abortController.signal.aborted) return;
        setSubnet(subnetInfo);

        if (subnetInfo.blockchains && subnetInfo.blockchains.length > 0) {
          const blockchainId = subnetInfo.blockchains[0].blockchainId;
          setChainId(blockchainId);
          setSelectedRPCBlockchainId(blockchainId);

          try {
            const chainInfo = await getBlockchainInfoForNetwork(network, blockchainId, abortController.signal);
            if (abortController.signal.aborted) return;
            setBlockchainInfo(chainInfo);
          } catch (error) {
            if (!abortController.signal.aborted) {
              setSubnetIdError((error as Error).message);
            }
          }
        }
      } catch {
        if (!abortController.signal.aborted) {
          setSubnetIdError(`L1 not found on ${selectedNetwork}. Try switching networks.`);
        }
      } finally {
        if (!abortController.signal.aborted) setIsLoading(false);
      }
    };

    loadSubnetData();
    return () => abortController.abort();
  }, [subnetId, selectedNetwork]);

  useEffect(() => {
    if (!isRPC) setDomain('');
  }, [isRPC]);

  const handleReset = () => {
    setSelectedNetwork(walletIsTestnet ? 'fuji' : 'mainnet');
    setChainId('');
    setSubnetId(defaultSubnetId ?? createChainSubnetId ?? '');
    setSubnet(null);
    setBlockchainInfo(null);
    setNodeType(forceNodeType ?? (walletIsTestnet ? 'archival' : 'validator'));
    setDomain('');
    setNodeLocation('remote');
    setProxyHealthOk(null);
    setSubnetIdError(null);
    setSelectedRPCBlockchainId('');
    setConfigJson('');
    setShowAdvancedSettings(false);
    debugTraceUserSet.current = false;
    setCfg({
      enableDebugTrace: selectedNetwork === 'fuji',
      adminApiEnabled: false,
      pruningEnabled: true,
      logLevel: 'info',
      minDelayTarget: 2000,
      trieCleanCache: 512,
      trieDirtyCache: 512,
      trieDirtyCommitTarget: 20,
      triePrefetcherParallelism: 16,
      snapshotCache: 256,
      commitInterval: 4096,
      stateSyncServerTrieCache: 64,
      rpcGasCap: 50000000,
      rpcTxFeeCap: 100,
      apiMaxBlocksPerRequest: 0,
      allowUnfinalizedQueries: false,
      batchRequestLimit: 1000,
      batchResponseMaxSize: 25000000,
      acceptedCacheSize: 32,
      transactionHistory: 0,
      stateSyncEnabled: true,
      skipTxIndexing: false,
      preimagesEnabled: false,
      localTxsEnabled: false,
      pushGossipNumValidators: 100,
      pushGossipPercentStake: 0.9,
      continuousProfilerDir: '',
      continuousProfilerFrequency: '15m',
      metricsExpensiveEnabled: false,
    });
  };

  const isCustomVM = blockchainInfo && blockchainInfo.vmId !== SUBNET_EVM_VM_ID;

  // Combined setup.sh for one-shot deploys. Easier than copy/pasting three
  // separate cat-heredoc blocks.
  const combinedSetupScript = useMemo(() => {
    if (!subnetId || !chainId || !configJson || configJson.startsWith('Error:')) return '';
    try {
      const nodeConfig = generateNodeConfig(subnetId, nodeType, effectiveNetworkID);
      const chainConfig = JSON.parse(configJson);
      const vmId = blockchainInfo?.vmId || SUBNET_EVM_VM_ID;
      return `#!/bin/bash\n# AvalancheGo L1 node config — generated by console\nset -euo pipefail\n\n${generateAllConfigCommands(
        subnetId,
        chainId,
        nodeConfig,
        chainConfig,
        vmId,
      )}\n\necho "Config files written to ~/.avalanchego/configs/"\n`;
    } catch {
      return '';
    }
  }, [subnetId, chainId, configJson, nodeType, effectiveNetworkID, blockchainInfo]);

  const verifySnippet = `# Check bootstrap progress — returns {"isBootstrapped": true} when ready
curl -s -X POST --data '{"jsonrpc":"2.0","id":1,"method":"info.isBootstrapped","params":{"chain":"P"}}' \\
  -H 'content-type:application/json;' http://localhost:9650/ext/info | jq

# Get nodeID + BLS proof-of-possession (inputs for Convert to L1)
curl -s -X POST --data '{"jsonrpc":"2.0","id":1,"method":"info.getNodeID"}' \\
  -H 'content-type:application/json;' http://localhost:9650/ext/info | jq`;

  const warnIcon = <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />;

  return (
    <Container
      title="L1 Node Setup with Docker"
      description="Configure your node settings, select your L1, and run Docker to start your node."
      githubUrl="https://github.com/ava-labs/builders-hub/edit/master/components/toolbox/console/layer-1/AvalancheGoDockerL1.tsx"
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

              {!forceNodeType && (
                <div className="flex flex-col gap-3">
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
                      title={isTestnet ? 'Both' : 'Archival'}
                      description={isTestnet ? 'Validator + RPC' : 'Full history'}
                    />
                  </ChoiceGrid>
                  {nodeType === 'archival' && isTestnet && (
                    <Notice icon={warnIcon}>
                      Not for production. Runs validator and RPC on one node for testnet convenience.
                    </Notice>
                  )}
                </div>
              )}

              {forceNodeType && (
                <Notice tone="info" icon={<ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-400" />}>
                  <span className="font-semibold text-zinc-900 dark:text-zinc-100">Running a validator node.</span> Your
                  L1 needs validators to reach consensus. After bootstrap, copy the node ID and BLS key from the Verify
                  step and return to Convert to L1.
                </Notice>
              )}

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
                      selected={cfg.logLevel === level.value}
                      onSelect={() => setCfg((c) => ({ ...c, logLevel: level.value }))}
                      title={level.label}
                    />
                  ))}
                </ChoiceGrid>
              </div>

              {isValidator && (
                <div
                  className="flex flex-col gap-2"
                  onMouseEnter={() => setHighlightPath('minDelayTarget')}
                  onMouseLeave={clearHighlight}
                >
                  <div className="flex items-center justify-between gap-3">
                    <label htmlFor="l1-min-delay-target" className={EYEBROW}>
                      Min block delay
                    </label>
                    <span className="border border-zinc-200 bg-zinc-50 px-2 py-0.5 font-mono text-[11px] tabular-nums text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100">
                      {cfg.minDelayTarget}ms
                    </span>
                  </div>
                  <input
                    id="l1-min-delay-target"
                    type="range"
                    value={cfg.minDelayTarget}
                    onChange={(e) => setCfg((c) => ({ ...c, minDelayTarget: parseInt(e.target.value) }))}
                    onFocus={() => setHighlightPath('minDelayTarget')}
                    onBlur={clearHighlight}
                    min="0"
                    max="2000"
                    step="50"
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
              )}

              {/* Pruning and state sync are interdependent, so they share a group. */}
              <Group label="Storage">
                <Toggle
                  path="pruning"
                  checked={cfg.pruningEnabled}
                  onChange={(checked) => setCfg((c) => ({ ...c, pruningEnabled: checked }))}
                  label="Enable Pruning"
                  hint={
                    <>
                      Removes old state data to cut disk usage. Savings depend on your L1&apos;s transaction volume.
                      {(nodeType === 'validator' || nodeType === 'rpc') &&
                        ' Recommended for validators and pruned RPC nodes.'}
                      {nodeType === 'archival' && ' Disable for archival nodes that need full historical state.'}
                    </>
                  }
                />
                <Toggle
                  path="stateSyncEnabled"
                  checked={cfg.stateSyncEnabled}
                  onChange={(checked) => setCfg((c) => ({ ...c, stateSyncEnabled: checked }))}
                  label="Enable State Sync"
                  hint={
                    <>
                      Bootstraps from a recent state snapshot instead of replaying every block from genesis.
                      {(nodeType === 'validator' || nodeType === 'rpc') && ' Recommended for faster initial sync.'}
                      {nodeType === 'archival' && ' Disable to replay full history for archival queries.'}
                    </>
                  }
                />

                {cfg.pruningEnabled !== cfg.stateSyncEnabled && (
                  <div className="p-3">
                    <Notice icon={warnIcon}>
                      <span className="font-semibold">Mismatched settings:</span> Pruning and State Sync are usually
                      both on for validators, or both off for archival RPC nodes.
                    </Notice>
                  </div>
                )}
              </Group>

              <Group label="API">
                <Toggle
                  path="adminApi"
                  checked={cfg.adminApiEnabled}
                  onChange={(checked) => setCfg((c) => ({ ...c, adminApiEnabled: checked }))}
                  label="Enable Admin API"
                  hint="Enables administrative APIs. Only enable if needed and secured."
                />
                {isRPC && (
                  <>
                    <Toggle
                      path="ethApis"
                      checked={cfg.enableDebugTrace}
                      onChange={(checked) => {
                        debugTraceUserSet.current = true;
                        setCfg((c) => ({ ...c, enableDebugTrace: checked }));
                      }}
                      label="Enable Debug Trace"
                      hint="Enables debug APIs and detailed tracing."
                    />
                    <Toggle
                      path="skipTxIndexing"
                      checked={!cfg.skipTxIndexing}
                      onChange={(checked) => setCfg((c) => ({ ...c, skipTxIndexing: !checked }))}
                      label="Enable Transaction Indexing"
                      hint={
                        <>
                          Required for <code className={INLINE_CODE}>eth_getLogs</code> and transaction lookups. Disable
                          to save disk space.
                        </>
                      }
                    />
                  </>
                )}
              </Group>

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
                        href="https://build.avax.network/docs/nodes/chain-configs/subnet-evm"
                        target="_blank"
                        className={LINK}
                        rel="noreferrer"
                      >
                        Subnet-EVM configuration
                      </a>{' '}
                      docs.
                    </p>

                    <Section label="Cache">
                      <Fields>
                        <NumberField
                          label="Trie Clean Cache (MB)"
                          path="trieCleanCache"
                          value={cfg.trieCleanCache}
                          onChange={(v) => setCfg((c) => ({ ...c, trieCleanCache: Math.max(0, v) }))}
                        />
                        <NumberField
                          label="Trie Dirty Cache (MB)"
                          path="trieDirtyCache"
                          value={cfg.trieDirtyCache}
                          onChange={(v) => setCfg((c) => ({ ...c, trieDirtyCache: Math.max(0, v) }))}
                        />
                        <NumberField
                          label="Snapshot Cache (MB)"
                          path="snapshotCache"
                          value={cfg.snapshotCache}
                          onChange={(v) => setCfg((c) => ({ ...c, snapshotCache: Math.max(0, v) }))}
                        />
                        <NumberField
                          label="Accepted Cache Size (blocks)"
                          path="acceptedCacheSize"
                          value={cfg.acceptedCacheSize}
                          onChange={(v) => setCfg((c) => ({ ...c, acceptedCacheSize: Math.max(1, v) }))}
                          hint="Depth of accepted headers and logs cache"
                        />
                        <NumberField
                          label="Trie Dirty Commit Target (MB)"
                          path="trieDirtyCommitTarget"
                          value={cfg.trieDirtyCommitTarget}
                          onChange={(v) => setCfg((c) => ({ ...c, trieDirtyCommitTarget: Math.max(1, v) }))}
                          hint="Memory limit before commit"
                        />
                        <NumberField
                          label="Trie Prefetcher Parallelism"
                          path="triePrefetcherParallelism"
                          value={cfg.triePrefetcherParallelism}
                          onChange={(v) => setCfg((c) => ({ ...c, triePrefetcherParallelism: Math.max(1, v) }))}
                          hint="Max concurrent disk reads"
                        />
                        <NumberField
                          label="State Sync Server Trie Cache (MB)"
                          path="stateSyncServerTrieCache"
                          value={cfg.stateSyncServerTrieCache}
                          onChange={(v) => setCfg((c) => ({ ...c, stateSyncServerTrieCache: Math.max(0, v) }))}
                          hint="Trie cache for state sync server"
                        />
                      </Fields>
                    </Section>

                    <Section label="Metrics" flush>
                      <Toggle
                        path="metricsExpensive"
                        focusHighlight
                        checked={cfg.metricsExpensiveEnabled}
                        onChange={(checked) => setCfg((c) => ({ ...c, metricsExpensiveEnabled: checked }))}
                        label="Enable Expensive Metrics"
                        hint="Debug-level metrics, including Firewood metrics. May impact performance."
                      />
                    </Section>
                  </div>
                )}
              </div>
            </div>

            <div className="h-fit min-w-0 lg:sticky lg:top-4">
              <div className="border border-zinc-200 bg-white/80 dark:border-zinc-800 dark:bg-zinc-950/80">
                <div className="flex min-h-9 items-center justify-between gap-4 border-b border-zinc-200 bg-zinc-50/80 px-4 py-2 dark:border-zinc-800 dark:bg-zinc-900/40">
                  <h4 className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">
                    Configuration Preview
                  </h4>
                  <span className={COUNT}>Subnet-EVM config.json</span>
                </div>
                <div className="max-h-[600px] overflow-auto bg-zinc-50 p-3 dark:bg-zinc-900">
                  {configJson && !configJson.startsWith('Error:') ? (
                    <SyntaxHighlightedJSON code={configJson} highlightedLines={highlightedLines} />
                  ) : (
                    <div className="py-8 text-center text-[13px] text-zinc-500 dark:text-zinc-400">
                      {configJson.startsWith('Error:')
                        ? configJson
                        : 'Configure your node to see the Subnet-EVM chain config'}
                    </div>
                  )}
                </div>
              </div>

              {/* variant="l1" anchors the baseline on the L1 storage figures, not the Primary Network's. */}
              <StorageRequirements
                nodeType={nodeType}
                pruningEnabled={cfg.pruningEnabled}
                skipTxIndexing={cfg.skipTxIndexing}
                stateSyncEnabled={cfg.stateSyncEnabled}
                debugEnabled={cfg.enableDebugTrace}
                network={selectedNetwork}
                variant="l1"
              />
            </div>
          </div>
        </Step>

        {showPrerequisites && (
          <Step>
            <h3>Set up Instance</h3>
            <p>Provision a server with these specs.</p>

            <div className={cn(GRID, 'grid-cols-2 md:grid-cols-4')}>
              <Spec icon={<Cpu className="h-3.5 w-3.5" />} label="CPU" value="4 vCPU" />
              <Spec icon={<MemoryStick className="h-3.5 w-3.5" />} label="RAM" value="8 GB" />
              <Spec
                icon={<HardDrive className="h-3.5 w-3.5" />}
                label="Storage"
                value={isTestnet ? '~40 GB Fuji' : '~200 GB Mainnet'}
              />
              <Spec icon={<Network className="h-3.5 w-3.5" />} label="Open ports" value="9651 · 9650" />
            </div>

            <p className={NOTE}>
              Port <span className="font-mono">9651</span> is P2P and <span className="font-mono">9650</span> is RPC.
              For a production L1, run{' '}
              <strong className="font-medium text-zinc-900 dark:text-zinc-100">5+ validator nodes</strong> across
              regions. A single node is fine for local dev and quick demos.
            </p>
          </Step>
        )}

        {showPrerequisites && (
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
        )}

        <Step>
          <h3>Select L1</h3>
          <p>
            {subnetId && subnetId === (defaultSubnetId ?? createChainSubnetId)
              ? 'Pre-filled from your Create Chain step. Edit it if you meant a different L1.'
              : 'Enter the Subnet ID of the L1 you want to run a node for.'}
          </p>

          <InputSubnetId value={subnetId} onChange={setSubnetId} error={subnetIdError} />

          {isLoading && !subnet && (
            <p className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Looking up the L1 on {isTestnet ? 'Fuji' : 'Mainnet'}
            </p>
          )}

          {subnet && subnet.blockchains && subnet.blockchains.length > 0 && (
            <div className="flex flex-col gap-4">
              {subnet.blockchains.map(
                (blockchain: {
                  blockchainId: string;
                  blockchainName: string;
                  createBlockTimestamp: number;
                  createBlockNumber: string;
                  vmId: string;
                  subnetId: string;
                  evmChainId: number;
                }) => (
                  <BlockchainDetailsDisplay
                    key={blockchain.blockchainId}
                    blockchain={{
                      ...blockchain,
                      isTestnet: selectedNetwork === 'fuji',
                    }}
                    isLoading={isLoading}
                    customTitle={`${blockchain.blockchainName} Blockchain Details`}
                  />
                ),
              )}
            </div>
          )}

          {!subnetId && (
            <Empty label="No L1 selected">Enter a Subnet ID to generate the config files and Docker command.</Empty>
          )}

          {subnet && !isLoading && !(subnet.blockchains?.length > 0) && (
            <Empty
              label="No blockchain"
              action={
                <Link
                  href="/console/create-l1"
                  className="group/empty inline-flex w-fit items-center gap-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-zinc-900 underline-offset-4 hover:underline dark:text-zinc-100"
                >
                  Create an L1
                  <ArrowRight className="h-3 w-3 -translate-x-1 text-[#E6212F] opacity-0 transition-all group-hover/empty:translate-x-0 group-hover/empty:opacity-100" />
                </Link>
              }
            >
              This subnet has no blockchain yet, so there is nothing to run a node for.
            </Empty>
          )}
        </Step>

        {subnetId && blockchainInfo && (
          <>
            <Step>
              <h3>Create Configuration Files</h3>
              <p>Run these to write the config files. AvalancheGo reads them from these default paths on startup.</p>

              {combinedSetupScript && (
                <Accordions type="single" className={ACCORDIONS}>
                  <Accordion title="One-shot setup script (all configs)">
                    <div className={ACCORDION_BODY}>
                      <p>
                        Run the full setup in one go, or save it as <code className={INLINE_CODE}>setup.sh</code> and
                        run <code className={INLINE_CODE}>chmod +x setup.sh &amp;&amp; ./setup.sh</code>.
                      </p>
                      <CodeBlock code={combinedSetupScript} />
                    </div>
                  </Accordion>
                </Accordions>
              )}

              <Steps>
                <Step>
                  <h4 className={SUB_HEADING}>Create config directories</h4>
                  <CodeBlock
                    code={`mkdir -p ~/.avalanchego/configs/chains/${chainId}\nmkdir -p ~/.avalanchego/configs/vms`}
                  />
                </Step>

                <Step>
                  <h4 className={SUB_HEADING}>
                    Node config <code className={INLINE_CODE}>~/.avalanchego/configs/node.json</code>
                  </h4>
                  <CodeBlock
                    code={(() => {
                      try {
                        const nodeConfig = generateNodeConfig(subnetId, nodeType, effectiveNetworkID);
                        return `cat > ~/.avalanchego/configs/node.json << 'EOF'\n${JSON.stringify(nodeConfig, null, 2)}\nEOF`;
                      } catch {
                        return '# Error generating node config';
                      }
                    })()}
                  />
                </Step>

                <Step>
                  <h4 className={SUB_HEADING}>
                    Chain config{' '}
                    <code className={INLINE_CODE}>~/.avalanchego/configs/chains/{chainId.slice(0, 8)}...</code>
                  </h4>
                  <CodeBlock
                    code={(() => {
                      try {
                        const chainConfig = JSON.parse(configJson);
                        return `cat > ~/.avalanchego/configs/chains/${chainId}/config.json << 'EOF'\n${JSON.stringify(chainConfig, null, 2)}\nEOF`;
                      } catch {
                        return '# Error generating chain config';
                      }
                    })()}
                  />
                </Step>

                {blockchainInfo?.vmId && blockchainInfo.vmId !== SUBNET_EVM_VM_ID && (
                  <Step>
                    <h4 className={SUB_HEADING}>
                      VM aliases <code className={INLINE_CODE}>~/.avalanchego/configs/vms/aliases.json</code>
                    </h4>
                    <CodeBlock
                      code={`cat > ~/.avalanchego/configs/vms/aliases.json << 'EOF'\n${JSON.stringify({ [blockchainInfo.vmId]: [SUBNET_EVM_VM_ID] }, null, 2)}\nEOF`}
                    />
                  </Step>
                )}
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
                  href="https://build.avax.network/docs/nodes/chain-configs/subnet-evm"
                  target="_blank"
                  className={LINK}
                  rel="noreferrer"
                >
                  Chain config
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
                    ? `# Open SSH, P2P, RPC, and reverse-proxy ports
sudo ufw allow OpenSSH
sudo ufw allow 9651/tcp comment 'AvalancheGo P2P'
sudo ufw allow 9650/tcp comment 'AvalancheGo RPC'
sudo ufw allow 80,443/tcp comment 'Caddy reverse proxy (TLS)'
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
                  ? 'On a cloud host (AWS, GCP, Azure), open the same ports in your security group too. The host firewall alone is not enough.'
                  : 'Validators only need the P2P port. The RPC port stays bound to localhost.'}
              </p>
            </Step>

            <Step>
              <h3>Run Docker</h3>
              <p>Start the node. Config is read from the mounted volume, so no env vars are needed.</p>

              <CodeBlock
                code={(() => {
                  try {
                    const config = JSON.parse(configJson);
                    const vmId = blockchainInfo?.vmId || SUBNET_EVM_VM_ID;
                    return generateDockerCommand(subnetId, chainId, config, nodeType, effectiveNetworkID, vmId);
                  } catch {
                    return '# Error generating Docker command';
                  }
                })()}
              />

              <div className={cn(GRID, 'grid-cols-1 sm:grid-cols-3')}>
                {[
                  { label: 'Follow logs', command: 'docker logs -f avago' },
                  { label: 'Restart', command: 'docker restart avago' },
                  { label: 'Stop', command: 'docker stop avago' },
                ].map((item) => (
                  <div key={item.label} className={cn(CELL, 'flex min-w-0 flex-col gap-1.5 p-4')}>
                    <span className={EYEBROW}>{item.label}</span>
                    <code className="break-all font-mono text-[12px] text-zinc-900 dark:text-zinc-50">
                      {item.command}
                    </code>
                  </div>
                ))}
              </div>

              <Accordions type="single" className={ACCORDIONS}>
                {isCustomVM && (
                  <Accordion title="Custom VM Configuration">
                    <div className={ACCORDION_BODY}>
                      <p>
                        This blockchain uses a non-standard VM ID. The Docker command includes the VM alias mapping.
                      </p>
                      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5">
                        <dt className={EYEBROW}>VM ID</dt>
                        <dd className="break-all font-mono text-[12px] text-zinc-900 dark:text-zinc-50">
                          {blockchainInfo.vmId}
                        </dd>
                        <dt className={EYEBROW}>Aliases to</dt>
                        <dd className="break-all font-mono text-[12px] text-zinc-900 dark:text-zinc-50">
                          {SUBNET_EVM_VM_ID}
                        </dd>
                      </dl>
                    </div>
                  </Accordion>
                )}
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
              </Accordions>
            </Step>

            <Step>
              <h3>Verify the Node</h3>
              <p>
                Wait for bootstrap, then get the <code className={INLINE_CODE}>nodeID</code> and BLS proof of
                possession. Convert to L1 needs both.
              </p>

              <CodeBlock code={verifySnippet} />

              <ul className={cn(NOTE, 'flex flex-col gap-1.5')}>
                <li className="flex items-baseline gap-2.5">
                  <span aria-hidden className="h-1.5 w-1.5 shrink-0 translate-y-[-1px] rounded-full bg-emerald-500" />
                  <span>
                    Bootstrap takes a few minutes on Fuji and up to several hours for a full Mainnet sync. The node is
                    ready when <code className={INLINE_CODE}>isBootstrapped</code> returns{' '}
                    <code className={INLINE_CODE}>true</code>.
                  </span>
                </li>
                {isValidator && (
                  <li className="flex items-baseline gap-2.5">
                    <span aria-hidden className="h-1.5 w-1.5 shrink-0 translate-y-[-1px] rounded-full bg-zinc-400" />
                    <span>
                      Copy <code className={INLINE_CODE}>nodeID</code>,{' '}
                      <code className={INLINE_CODE}>nodePOP.publicKey</code>, and{' '}
                      <code className={INLINE_CODE}>nodePOP.proofOfPossession</code> from the second response into the
                      Convert to L1 step.
                    </span>
                  </li>
                )}
              </ul>
            </Step>

            {isValidator && (
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
                    L1 signing
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
                      <strong className="font-medium text-zinc-900 dark:text-zinc-100">
                        your validator stops working
                      </strong>
                      . NVMe drives can fail without warning.
                    </span>
                  </li>
                  <li className="flex items-baseline gap-2.5">
                    <span aria-hidden className="h-1.5 w-1.5 shrink-0 translate-y-[-1px] rounded-full bg-amber-500" />
                    <span>Never share private keys: anyone with them can impersonate your validator.</span>
                  </li>
                </ul>

                <div className="flex flex-wrap gap-x-6 gap-y-2 border-t border-zinc-200 pt-4 dark:border-zinc-800">
                  <DocLink href="/docs/nodes/maintain/backup-restore">Full Backup Guide</DocLink>
                </div>
              </Step>
            )}

            {isRPC && (
              <Step>
                <ReverseProxySetup
                  domain={domain}
                  setDomain={setDomain}
                  chainId={selectedRPCBlockchainId || chainId}
                  showHealthCheck={true}
                  nodeLocation={nodeLocation}
                  setNodeLocation={setNodeLocation}
                  onHealthCheckResult={({ success }) => setProxyHealthOk(success)}
                />
              </Step>
            )}

            {isRPC && (
              <Step>
                <h3>Add Network to Wallet</h3>
                <p>Add your L1&apos;s RPC endpoint to your browser wallet to start using the network.</p>

                <div
                  className={cn(
                    GRID,
                    blockchainInfo?.evmChainId ? 'grid-cols-1 sm:grid-cols-[minmax(0,1fr)_12rem]' : 'grid-cols-1',
                  )}
                >
                  <div className={cn(CELL, 'flex min-w-0 flex-col gap-1.5 p-4')}>
                    <span className={EYEBROW}>RPC endpoint</span>
                    <code
                      className={cn(
                        'break-all font-mono text-[12.5px]',
                        nodeRpcUrl ? 'text-zinc-900 dark:text-zinc-50' : 'text-zinc-400 dark:text-zinc-500',
                      )}
                    >
                      {nodeRpcUrl ?? 'Enter the node IP or domain in the reverse proxy step above'}
                    </code>
                  </div>
                  {blockchainInfo?.evmChainId && (
                    <div className={cn(CELL, 'flex flex-col gap-1.5 p-4')}>
                      <span className={EYEBROW}>EVM chain ID</span>
                      <code className="font-mono text-[12.5px] tabular-nums text-zinc-900 dark:text-zinc-50">
                        {blockchainInfo.evmChainId}
                      </code>
                    </div>
                  )}
                </div>

                <div>
                  <Button
                    className="group/btn w-auto"
                    onClick={async () => {
                      if (!nodeRpcUrl) return;
                      const rpcUrl = nodeRpcUrl;
                      const evmChainId = blockchainInfo?.evmChainId;
                      const name = blockchainInfo?.blockchainName || 'Avalanche L1';
                      const isTestnetL1 = selectedNetwork === 'fuji';

                      if (evmChainId) {
                        const existing = l1ListStore.getState().l1List;
                        if (!existing.find((l: L1ListItem) => l.evmChainId === evmChainId)) {
                          l1ListStore.getState().addL1({
                            id: selectedRPCBlockchainId || chainId,
                            name,
                            rpcUrl,
                            evmChainId,
                            coinName: 'AVAX',
                            isTestnet: isTestnetL1,
                            subnetId,
                            wrappedTokenAddress: '',
                            validatorManagerAddress: '',
                            logoUrl: '',
                            genesisData: createChainGenesisData?.trim() || undefined,
                          });
                        } else {
                          // Re-running this step repairs a previously stored
                          // URL (e.g. localhost written before the proxy
                          // existed) instead of silently keeping it.
                          l1ListStore.getState().updateL1(evmChainId, { rpcUrl });
                        }
                      }

                      const prevIsTestnet = useWalletStore.getState().isTestnet;
                      const prevNetworkID = useWalletStore.getState().avalancheNetworkID;

                      setWalletIsTestnet(isTestnetL1);
                      setAvalancheNetworkID(isTestnetL1 ? networkIDs.FujiID : networkIDs.MainnetID);

                      const result = await addToWallet({
                        rpcUrl,
                        chainName: name,
                        chainId: evmChainId,
                        isTestnet: isTestnetL1,
                      });
                      setWalletRpcMismatch(result.rpcUrlMismatch ? (result.walletRpcUrl ?? '') : null);

                      if (result.ok && evmChainId) {
                        setWalletChainId(evmChainId);
                        setTimeout(() => updateL1Balance(evmChainId.toString()), 800);
                      } else if (!result.ok) {
                        setWalletIsTestnet(prevIsTestnet);
                        setAvalancheNetworkID(prevNetworkID);
                      }
                    }}
                    disabled={!nodeRpcUrl}
                    loading={isAddingToWallet}
                    loadingText="Adding..."
                  >
                    Add to Wallet & Switch
                    <HoverArrow />
                  </Button>
                </div>

                {!nodeRpcUrl && (
                  <Notice icon={warnIcon}>
                    Your wallet can&apos;t reach localhost on a remote server. Enter the node&apos;s IP or domain in the
                    reverse proxy step above, or choose &quot;This machine&quot; there if the node runs locally.
                  </Notice>
                )}
                {nodeRpcUrl && nodeLocation === 'remote' && proxyHealthOk !== true && (
                  <p className={NOTE}>
                    Tip: run the proxy health check above first, so you don&apos;t add an unreachable URL to your
                    wallet.
                  </p>
                )}
                {walletRpcMismatch !== null && nodeRpcUrl && (
                  <Notice icon={warnIcon}>
                    This chain is already in your wallet with a different RPC URL
                    {walletRpcMismatch ? (
                      <>
                        {' '}
                        (<code className="break-all font-mono">{walletRpcMismatch}</code>)
                      </>
                    ) : null}
                    . Wallets don&apos;t let sites update it: open your wallet&apos;s network settings for this chain
                    and set the RPC URL to <code className="break-all font-mono">{nodeRpcUrl}</code>.
                  </Notice>
                )}

                <p className={NOTE}>Works with Core, MetaMask, and other EVM wallets connected via RainbowKit.</p>
              </Step>
            )}
          </>
        )}
      </Steps>

      {configJson && !configJson.startsWith('Error:') && (
        <div className="flex border-t border-zinc-200 pt-6 dark:border-zinc-800">
          <Button
            onClick={handleReset}
            variant="outline"
            className="w-auto"
            icon={<RotateCcw className="h-3.5 w-3.5" />}
          >
            Start Over
          </Button>
        </div>
      )}
    </Container>
  );
}

/** A hairline board for a step with nothing to show yet. */
function Empty({ label, action, children }: { label: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 border border-zinc-200 bg-white px-4 py-4 dark:border-zinc-800 dark:bg-zinc-950">
      <p className={EYEBROW}>{label}</p>
      <p className="text-[13px] leading-relaxed text-zinc-600 dark:text-zinc-400">{children}</p>
      {action}
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

/** A labelled number input; hovering or focusing it highlights its key in the config preview. */
function NumberField({
  label,
  path,
  value,
  onChange,
  hint,
}: {
  label: string;
  path: string;
  value: number;
  onChange: (v: number) => void;
  hint?: string;
}) {
  const { setHighlightPath, clearHighlight } = useGenesisHighlight();
  const id = `l1-${path}`;
  return (
    <div className="flex flex-col gap-1.5" onMouseEnter={() => setHighlightPath(path)} onMouseLeave={clearHighlight}>
      <label htmlFor={id} className={FIELD_LABEL}>
        {label}
      </label>
      <input
        id={id}
        type="number"
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value) || 0)}
        onFocus={() => setHighlightPath(path)}
        onBlur={clearHighlight}
        className={INPUT}
      />
      {hint && <p className={FIELD_HINT}>{hint}</p>}
    </div>
  );
}

export default function AvalanchegoDocker(props: AvalancheGoDockerL1Props = {}) {
  return (
    <GenesisHighlightProvider>
      <AvalanchegoDockerInner {...props} />
    </GenesisHighlightProvider>
  );
}
