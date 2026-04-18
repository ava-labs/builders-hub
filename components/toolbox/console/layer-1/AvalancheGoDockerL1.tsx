'use client';

// L1 Node Docker Setup
import { useState, useEffect, useRef, useMemo } from 'react';
import { useWalletStore } from '../../stores/walletStore';
import { useCreateChainStore } from '../../stores/createChainStore';
import { Container } from '../../components/Container';
import { getBlockchainInfoForNetwork, getSubnetInfoForNetwork } from '../../coreViem/utils/glacier';
import InputSubnetId from '../../components/InputSubnetId';
import BlockchainDetailsDisplay from '../../components/BlockchainDetailsDisplay';
import { DynamicCodeBlock } from 'fumadocs-ui/components/dynamic-codeblock';
import { Accordion, Accordions } from 'fumadocs-ui/components/accordion';
import { Button } from '../../components/Button';
import { Steps, Step } from 'fumadocs-ui/components/steps';
import { SyntaxHighlightedJSON } from '../../components/genesis/SyntaxHighlightedJSON';
import { ReverseProxySetup } from '../../components/ReverseProxySetup';
import { GenesisHighlightProvider, useGenesisHighlight } from '../../components/genesis/GenesisHighlightContext';
import { SUBNET_EVM_VM_ID } from '@/constants/console';
import {
  generateChainConfig,
  generateNodeConfig,
  generateDockerCommand,
  generateAllConfigCommands,
} from './nodeConfig';
import { useNodeConfigHighlighting } from './useNodeConfigHighlighting';
import {
  AlertCircle,
  AlertTriangle,
  Database,
  HardDrive,
  ChevronDown,
  ShieldCheck,
  KeyRound,
  Key,
  FileText,
  Server,
  Terminal,
  CheckCircle2,
  Copy,
  ExternalLink,
} from 'lucide-react';
import { useAddToWallet } from '@/hooks/useAddToWallet';
import { nipify } from '../../components/HostInput';
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
    setNodeType(forceNodeType ?? 'validator');
    setDomain('');
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

  return (
    <Container
      title="L1 Node Setup with Docker"
      description="Configure your node settings, select your L1, and run Docker to start your node."
      githubUrl="https://github.com/ava-labs/builders-hub/edit/master/components/toolbox/console/layer-1/AvalancheGoDockerL1.tsx"
    >
      <Steps>
        {showPrerequisites && (
          <Step>
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-1">Prerequisites</h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
              Before you start, make sure your host machine is ready.
            </p>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="rounded-lg p-3 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
                <Server className="w-4 h-4 text-zinc-500 mb-2" />
                <div className="text-xs font-medium text-zinc-900 dark:text-zinc-100">Docker 20.10+</div>
                <div className="text-[10px] text-zinc-500 mt-1">
                  <a
                    href="https://docs.docker.com/engine/install/"
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-500 hover:underline"
                  >
                    Install guide
                  </a>
                </div>
              </div>
              <div className="rounded-lg p-3 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
                <HardDrive className="w-4 h-4 text-zinc-500 mb-2" />
                <div className="text-xs font-medium text-zinc-900 dark:text-zinc-100">Disk</div>
                <div className="text-[10px] text-zinc-500 mt-1">{isTestnet ? '~40 GB Fuji' : '~200 GB Mainnet'}</div>
              </div>
              <div className="rounded-lg p-3 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
                <Database className="w-4 h-4 text-zinc-500 mb-2" />
                <div className="text-xs font-medium text-zinc-900 dark:text-zinc-100">RAM / CPU</div>
                <div className="text-[10px] text-zinc-500 mt-1">8 GB RAM · 4 vCPU</div>
              </div>
              <div className="rounded-lg p-3 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
                <ShieldCheck className="w-4 h-4 text-zinc-500 mb-2" />
                <div className="text-xs font-medium text-zinc-900 dark:text-zinc-100">Open ports</div>
                <div className="text-[10px] text-zinc-500 mt-1">9651 (P2P), 9650 (RPC opt.)</div>
              </div>
            </div>

            <div className="mt-4 flex items-start gap-2 text-xs text-zinc-600 dark:text-zinc-400">
              <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-zinc-500" />
              <span>
                For a production L1 we recommend <strong>5+ validator nodes</strong> spread across regions. A single
                node is fine for local dev and quick demos.
              </span>
            </div>
          </Step>
        )}

        <Step>
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-1">Configure Node Settings</h3>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
            Choose your node type and configure settings. The configuration preview updates in real-time.
          </p>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-2">Network</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedNetwork('mainnet')}
                    className={`p-3 rounded-xl border-2 text-left transition-all ${
                      selectedNetwork === 'mainnet'
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600'
                    }`}
                  >
                    <div className="font-medium text-sm">Mainnet</div>
                    <div className="text-xs text-zinc-500">Production network</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedNetwork('fuji')}
                    className={`p-3 rounded-xl border-2 text-left transition-all ${
                      selectedNetwork === 'fuji'
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600'
                    }`}
                  >
                    <div className="font-medium text-sm">Fuji</div>
                    <div className="text-xs text-zinc-500">Testnet</div>
                  </button>
                </div>
              </div>

              {!forceNodeType && (
                <div>
                  <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-2">
                    Node Type
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setNodeType('validator')}
                      className={`p-3 rounded-xl border-2 text-left transition-all ${
                        nodeType === 'validator'
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600'
                      }`}
                    >
                      <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Validator</div>
                      <div className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5">P2P only</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setNodeType('rpc')}
                      className={`p-3 rounded-xl border-2 text-left transition-all ${
                        nodeType === 'rpc'
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600'
                      }`}
                    >
                      <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">RPC</div>
                      <div className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5">Pruned</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setNodeType('archival')}
                      className={`p-3 rounded-xl border-2 text-left transition-all ${
                        nodeType === 'archival'
                          ? isTestnet
                            ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20'
                            : 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600'
                      }`}
                    >
                      <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                        {isTestnet ? 'Both' : 'Archival'}
                      </div>
                      <div className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                        {isTestnet ? 'Validator + RPC' : 'Full history'}
                      </div>
                    </button>
                  </div>
                  {nodeType === 'archival' && isTestnet && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" />
                      Not recommended for production. Combines validator and RPC for testnet convenience.
                    </p>
                  )}
                </div>
              )}

              {forceNodeType && (
                <div className="rounded-lg p-3 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 flex items-start gap-2">
                  <ShieldCheck className="w-4 h-4 text-zinc-500 mt-0.5 flex-shrink-0" />
                  <div className="text-xs text-zinc-600 dark:text-zinc-400">
                    <span className="font-medium text-zinc-900 dark:text-zinc-100">Running a validator node. </span>
                    Your L1 needs validators to reach consensus. After bootstrap, grab the node&apos;s ID + BLS key from
                    the Verify step and return to Convert to L1.
                  </div>
                </div>
              )}

              <div onMouseEnter={() => setHighlightPath('logLevel')} onMouseLeave={clearHighlight}>
                <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-2">Log Level</label>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { value: 'error', label: 'Error' },
                    { value: 'warn', label: 'Warn' },
                    { value: 'info', label: 'Info', default: true },
                    { value: 'debug', label: 'Debug' },
                    { value: 'verbo', label: 'Verbose' },
                  ].map((level) => (
                    <button
                      key={level.value}
                      type="button"
                      onClick={() => setCfg((c) => ({ ...c, logLevel: level.value }))}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                        cfg.logLevel === level.value
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                          : 'border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-600'
                      }`}
                    >
                      {level.label}
                      {level.default && cfg.logLevel !== level.value && (
                        <span className="ml-1 text-[10px] text-zinc-400">(default)</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {isValidator && (
                <div onMouseEnter={() => setHighlightPath('minDelayTarget')} onMouseLeave={clearHighlight}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400">Min Block Delay</span>
                    <span className="text-xs font-mono text-zinc-900 dark:text-zinc-100 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded">
                      {cfg.minDelayTarget}ms
                    </span>
                  </div>
                  <input
                    type="range"
                    value={cfg.minDelayTarget}
                    onChange={(e) => setCfg((c) => ({ ...c, minDelayTarget: parseInt(e.target.value) }))}
                    onFocus={() => setHighlightPath('minDelayTarget')}
                    onBlur={clearHighlight}
                    min="0"
                    max="2000"
                    step="50"
                    className="w-full h-2 bg-zinc-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                  <div className="flex justify-between text-[10px] text-zinc-400 mt-1">
                    <span>0ms (fastest)</span>
                    <span>1000ms</span>
                    <span>2000ms (default)</span>
                  </div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2">
                    Minimum time between blocks. Lower values = faster blocks but more network load.
                  </p>
                </div>
              )}

              {/* Storage settings — pruning & state-sync are interdependent */}
              <div className="border border-zinc-200 dark:border-zinc-700 rounded-lg p-4 space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <Database className="w-4 h-4 text-zinc-500" />
                  <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Storage Settings</span>
                </div>

                <div onMouseEnter={() => setHighlightPath('pruning')} onMouseLeave={clearHighlight}>
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={cfg.pruningEnabled}
                      onChange={(e) => setCfg((c) => ({ ...c, pruningEnabled: e.target.checked }))}
                      className="rounded"
                    />
                    <span className="text-sm font-medium">Enable Pruning</span>
                  </label>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 ml-6">
                    Removes old state data to reduce disk usage. Storage savings depend on your L1&apos;s transaction
                    volume.
                    {(nodeType === 'validator' || nodeType === 'rpc') &&
                      ' Recommended for validators and pruned RPC nodes.'}
                    {nodeType === 'archival' && ' Disable for archival nodes that need full historical state.'}
                  </p>
                </div>

                <div onMouseEnter={() => setHighlightPath('stateSyncEnabled')} onMouseLeave={clearHighlight}>
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={cfg.stateSyncEnabled}
                      onChange={(e) => setCfg((c) => ({ ...c, stateSyncEnabled: e.target.checked }))}
                      className="rounded"
                    />
                    <span className="text-sm font-medium">Enable State Sync</span>
                  </label>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 ml-6">
                    Bootstrap from a recent state snapshot instead of replaying all blocks from genesis.
                    {(nodeType === 'validator' || nodeType === 'rpc') && ' Recommended for faster initial sync.'}
                    {nodeType === 'archival' && ' Disable to replay full history for archival queries.'}
                  </p>
                </div>

                {cfg.pruningEnabled !== cfg.stateSyncEnabled && (
                  <div className="flex items-start gap-2 p-2 rounded-md bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                    <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-700 dark:text-amber-300">
                      <strong>Mismatched settings:</strong> Pruning and State Sync are typically enabled together for
                      validators, or both disabled for archival RPC nodes.
                    </p>
                  </div>
                )}
              </div>

              <div onMouseEnter={() => setHighlightPath('adminApi')} onMouseLeave={clearHighlight}>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={cfg.adminApiEnabled}
                    onChange={(e) => setCfg((c) => ({ ...c, adminApiEnabled: e.target.checked }))}
                    className="rounded"
                  />
                  <span className="text-sm">Enable Admin API</span>
                </label>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                  Enables administrative APIs. Only enable if needed and secured.
                </p>
              </div>

              {isRPC && (
                <>
                  <div onMouseEnter={() => setHighlightPath('ethApis')} onMouseLeave={clearHighlight}>
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={cfg.enableDebugTrace}
                        onChange={(e) => {
                          debugTraceUserSet.current = true;
                          setCfg((c) => ({ ...c, enableDebugTrace: e.target.checked }));
                        }}
                        className="rounded"
                      />
                      <span className="text-sm">Enable Debug Trace</span>
                    </label>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                      Enables debug APIs and detailed tracing capabilities
                    </p>
                  </div>

                  <div onMouseEnter={() => setHighlightPath('skipTxIndexing')} onMouseLeave={clearHighlight}>
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={!cfg.skipTxIndexing}
                        onChange={(e) => setCfg((c) => ({ ...c, skipTxIndexing: !e.target.checked }))}
                        className="rounded"
                      />
                      <span className="text-sm">Enable Transaction Indexing</span>
                    </label>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                      Required for eth_getLogs and transaction lookups. Disable to save disk space.
                    </p>
                  </div>
                </>
              )}

              {/* Advanced Settings */}
              <div className="border-t pt-4">
                <button
                  type="button"
                  onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
                  className="flex items-center justify-between w-full text-left"
                >
                  <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Advanced Settings</span>
                  <ChevronDown className={`w-5 h-5 transition-transform ${showAdvancedSettings ? 'rotate-180' : ''}`} />
                </button>

                {showAdvancedSettings && (
                  <div className="space-y-4 mt-4">
                    <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      For advanced configuration options, see the{' '}
                      <a
                        href="https://build.avax.network/docs/nodes/configure/configs-flags"
                        target="_blank"
                        className="text-blue-600 dark:text-blue-400 hover:underline"
                        rel="noreferrer"
                      >
                        AvalancheGo configuration
                      </a>{' '}
                      and{' '}
                      <a
                        href="https://build.avax.network/docs/nodes/chain-configs/subnet-evm"
                        target="_blank"
                        className="text-blue-600 dark:text-blue-400 hover:underline"
                        rel="noreferrer"
                      >
                        Subnet-EVM configuration
                      </a>{' '}
                      documentation.
                    </span>
                    <div>
                      <h4 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">Cache Settings</h4>
                      <div className="space-y-3">
                        <NumberField
                          label="Trie Clean Cache (MB)"
                          path="trieCleanCache"
                          value={cfg.trieCleanCache}
                          onChange={(v) => setCfg((c) => ({ ...c, trieCleanCache: Math.max(0, v) }))}
                          setHighlightPath={setHighlightPath}
                          clearHighlight={clearHighlight}
                        />
                        <NumberField
                          label="Trie Dirty Cache (MB)"
                          path="trieDirtyCache"
                          value={cfg.trieDirtyCache}
                          onChange={(v) => setCfg((c) => ({ ...c, trieDirtyCache: Math.max(0, v) }))}
                          setHighlightPath={setHighlightPath}
                          clearHighlight={clearHighlight}
                        />
                        <NumberField
                          label="Snapshot Cache (MB)"
                          path="snapshotCache"
                          value={cfg.snapshotCache}
                          onChange={(v) => setCfg((c) => ({ ...c, snapshotCache: Math.max(0, v) }))}
                          setHighlightPath={setHighlightPath}
                          clearHighlight={clearHighlight}
                        />
                        <NumberField
                          label="Accepted Cache Size (blocks)"
                          path="acceptedCacheSize"
                          value={cfg.acceptedCacheSize}
                          onChange={(v) => setCfg((c) => ({ ...c, acceptedCacheSize: Math.max(1, v) }))}
                          hint="Depth of accepted headers and logs cache"
                          setHighlightPath={setHighlightPath}
                          clearHighlight={clearHighlight}
                        />
                        <NumberField
                          label="Trie Dirty Commit Target (MB)"
                          path="trieDirtyCommitTarget"
                          value={cfg.trieDirtyCommitTarget}
                          onChange={(v) => setCfg((c) => ({ ...c, trieDirtyCommitTarget: Math.max(1, v) }))}
                          hint="Memory limit before commit"
                          setHighlightPath={setHighlightPath}
                          clearHighlight={clearHighlight}
                        />
                        <NumberField
                          label="Trie Prefetcher Parallelism"
                          path="triePrefetcherParallelism"
                          value={cfg.triePrefetcherParallelism}
                          onChange={(v) => setCfg((c) => ({ ...c, triePrefetcherParallelism: Math.max(1, v) }))}
                          hint="Max concurrent disk reads"
                          setHighlightPath={setHighlightPath}
                          clearHighlight={clearHighlight}
                        />
                        <NumberField
                          label="State Sync Server Trie Cache (MB)"
                          path="stateSyncServerTrieCache"
                          value={cfg.stateSyncServerTrieCache}
                          onChange={(v) => setCfg((c) => ({ ...c, stateSyncServerTrieCache: Math.max(0, v) }))}
                          hint="Trie cache for state sync server"
                          setHighlightPath={setHighlightPath}
                          clearHighlight={clearHighlight}
                        />
                      </div>
                    </div>

                    <div className="border-t pt-3">
                      <h4 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">Metrics Settings</h4>
                      <div onMouseEnter={() => setHighlightPath('metricsExpensive')} onMouseLeave={clearHighlight}>
                        <label className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={cfg.metricsExpensiveEnabled}
                            onChange={(e) => setCfg((c) => ({ ...c, metricsExpensiveEnabled: e.target.checked }))}
                            onFocus={() => setHighlightPath('metricsExpensive')}
                            onBlur={clearHighlight}
                            className="rounded"
                          />
                          <span className="text-xs text-zinc-600 dark:text-zinc-400">Enable Expensive Metrics</span>
                        </label>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 ml-6">
                          Enables debug-level metrics including Firewood metrics. May impact performance.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Configuration Preview */}
            <div className="lg:sticky lg:top-4 h-fit">
              <div className="border rounded-lg bg-white dark:bg-zinc-950 overflow-hidden">
                <div className="border-b p-3 bg-zinc-50 dark:bg-zinc-900">
                  <h4 className="text-sm font-semibold">Configuration Preview</h4>
                </div>
                <div className="max-h-[600px] overflow-auto p-3 bg-zinc-50 dark:bg-zinc-950">
                  {configJson && !configJson.startsWith('Error:') ? (
                    <SyntaxHighlightedJSON code={configJson} highlightedLines={highlightedLines} />
                  ) : (
                    <div className="text-sm text-zinc-500 dark:text-zinc-400 text-center py-8">
                      {configJson.startsWith('Error:')
                        ? configJson
                        : 'Configure your node to see the Subnet-EVM chain config'}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </Step>

        <Step>
          <h3 className="text-xl font-bold mb-4">Select L1</h3>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
            {subnetId && subnetId === (defaultSubnetId ?? createChainSubnetId)
              ? 'Pre-filled from your Create Chain step — edit if you meant a different L1.'
              : 'Enter the Avalanche Subnet ID of the L1 you want to run a node for.'}
          </p>

          <InputSubnetId value={subnetId} onChange={setSubnetId} error={subnetIdError} />

          {subnet && subnet.blockchains && subnet.blockchains.length > 0 && (
            <div className="space-y-4 mt-4">
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
        </Step>

        {subnetId && blockchainInfo && (
          <>
            <Step>
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-1">
                Create Configuration Files
              </h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
                Run these commands to create the config files. AvalancheGo reads from these default locations on
                startup.
              </p>

              {combinedSetupScript && (
                <Accordions type="single" className="mb-4">
                  <Accordion title="One-shot setup script (all configs)">
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-2">
                      Run the full setup in a single shell invocation, or save as <code>setup.sh</code> and{' '}
                      <code>chmod +x setup.sh &amp;&amp; ./setup.sh</code>.
                    </p>
                    <DynamicCodeBlock lang="bash" code={combinedSetupScript} />
                  </Accordion>
                </Accordions>
              )}

              <Steps>
                <Step>
                  <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5 text-zinc-500" />
                    Create config directories
                  </h4>
                  <DynamicCodeBlock
                    lang="bash"
                    code={`mkdir -p ~/.avalanchego/configs/chains/${chainId}\nmkdir -p ~/.avalanchego/configs/vms`}
                  />
                </Step>

                <Step>
                  <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5 text-zinc-500" />
                    Node config{' '}
                    <code className="text-xs bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded ml-1">
                      ~/.avalanchego/configs/node.json
                    </code>
                  </h4>
                  <DynamicCodeBlock
                    lang="bash"
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
                  <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5 text-zinc-500" />
                    Chain config{' '}
                    <code className="text-xs bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded ml-1">
                      ~/.avalanchego/configs/chains/{chainId.slice(0, 8)}...
                    </code>
                  </h4>
                  <DynamicCodeBlock
                    lang="bash"
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
                    <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                      <FileText className="w-3.5 h-3.5 text-zinc-500" />
                      VM aliases{' '}
                      <code className="text-xs bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded ml-1">
                        ~/.avalanchego/configs/vms/aliases.json
                      </code>
                    </h4>
                    <DynamicCodeBlock
                      lang="bash"
                      code={`cat > ~/.avalanchego/configs/vms/aliases.json << 'EOF'\n${JSON.stringify({ [blockchainInfo.vmId]: [SUBNET_EVM_VM_ID] }, null, 2)}\nEOF`}
                    />
                  </Step>
                )}
              </Steps>

              <div className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
                Docs:{' '}
                <a
                  href="https://build.avax.network/docs/nodes/configure/configs-flags"
                  target="_blank"
                  className="text-blue-500 hover:underline"
                  rel="noreferrer"
                >
                  Node config
                </a>
                {' · '}
                <a
                  href="https://build.avax.network/docs/nodes/chain-configs/subnet-evm"
                  target="_blank"
                  className="text-blue-500 hover:underline"
                  rel="noreferrer"
                >
                  Chain config
                </a>
              </div>
            </Step>

            <Step>
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-1">Configure Firewall</h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
                Open the required ports for your node to communicate with the network.
              </p>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div
                  className={`rounded-lg p-3 border ${isRPC ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' : 'bg-zinc-50 dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-800'}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-mono font-medium text-zinc-900 dark:text-zinc-100">9651</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                      Required
                    </span>
                  </div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400">P2P / Staking port</div>
                  <div className="text-[10px] text-zinc-400 mt-1">Node-to-node communication</div>
                </div>
                <div
                  className={`rounded-lg p-3 border ${isRPC ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' : 'bg-zinc-50 dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-800 opacity-50'}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-mono font-medium text-zinc-900 dark:text-zinc-100">9650</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded ${isRPC ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'}`}
                    >
                      {isRPC ? 'Required' : 'RPC only'}
                    </span>
                  </div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400">HTTP / RPC port</div>
                  <div className="text-[10px] text-zinc-400 mt-1">API requests from clients</div>
                </div>
              </div>

              <DynamicCodeBlock
                lang="bash"
                code={
                  isRPC
                    ? `# Open P2P and RPC ports
sudo ufw allow 9651/tcp comment 'AvalancheGo P2P'
sudo ufw allow 9650/tcp comment 'AvalancheGo RPC'
sudo ufw --force enable
sudo ufw status`
                    : `# Open P2P port only (validators don't expose RPC)
sudo ufw allow 9651/tcp comment 'AvalancheGo P2P'
sudo ufw --force enable
sudo ufw status`
                }
              />

              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-3">
                {isRPC
                  ? 'RPC nodes need both ports open. Consider using a reverse proxy (nginx) for SSL termination on port 9650.'
                  : 'Validators only need the P2P port. The RPC port is bound to localhost for security.'}
              </p>
            </Step>

            <Step>
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-1">Run Docker</h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
                Start the node. Config is read from the mounted volume — no env vars needed.
              </p>

              <DynamicCodeBlock
                lang="bash"
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

              <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="rounded-lg p-2.5 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Terminal className="w-3.5 h-3.5 text-zinc-500" />
                    <span className="text-[11px] font-medium text-zinc-700 dark:text-zinc-300">Follow logs</span>
                  </div>
                  <code className="text-[11px] text-zinc-900 dark:text-zinc-100">docker logs -f avago</code>
                </div>
                <div className="rounded-lg p-2.5 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Terminal className="w-3.5 h-3.5 text-zinc-500" />
                    <span className="text-[11px] font-medium text-zinc-700 dark:text-zinc-300">Restart</span>
                  </div>
                  <code className="text-[11px] text-zinc-900 dark:text-zinc-100">docker restart avago</code>
                </div>
                <div className="rounded-lg p-2.5 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Terminal className="w-3.5 h-3.5 text-zinc-500" />
                    <span className="text-[11px] font-medium text-zinc-700 dark:text-zinc-300">Stop</span>
                  </div>
                  <code className="text-[11px] text-zinc-900 dark:text-zinc-100">docker stop avago</code>
                </div>
              </div>

              <Accordions type="single" className="mt-4">
                {isCustomVM && (
                  <Accordion title="Custom VM Configuration">
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">
                      This blockchain uses a non-standard Virtual Machine ID. The Docker command includes VM aliases
                      mapping.
                    </p>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-2">
                      <strong>VM ID:</strong> {blockchainInfo.vmId}
                      <br />
                      <strong>Aliases to:</strong> {SUBNET_EVM_VM_ID}
                    </p>
                  </Accordion>
                )}
                <Accordion title="Running Multiple Nodes">
                  <p className="text-sm">To run multiple nodes on the same machine, ensure each node has:</p>
                  <ul className="list-disc pl-5 mt-1 text-sm">
                    <li>
                      Unique container name (change <code>--name</code> parameter)
                    </li>
                    <li>Different ports (modify port mappings)</li>
                    <li>
                      Separate data directories (change <code>~/.avalanchego</code> path)
                    </li>
                  </ul>
                </Accordion>
              </Accordions>
            </Step>

            <Step>
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-1">Verify the Node</h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
                Wait for bootstrap, then grab the <code>nodeID</code> and BLS proof-of-possession — these are the inputs
                for the Convert to L1 step.
              </p>

              <DynamicCodeBlock lang="bash" code={verifySnippet} />

              <div className="mt-3 flex items-start gap-2 text-xs text-zinc-600 dark:text-zinc-400">
                <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-green-500" />
                <span>
                  Bootstrap can take from a few minutes (Fuji) to several hours (Mainnet full sync). The node is ready
                  when <code>isBootstrapped</code> returns <code>true</code>.
                </span>
              </div>
              {isValidator && (
                <div className="mt-3 flex items-start gap-2 text-xs text-zinc-600 dark:text-zinc-400">
                  <Copy className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-zinc-500" />
                  <span>
                    Copy the <code>nodeID</code>, <code>nodePOP.publicKey</code>, and{' '}
                    <code>nodePOP.proofOfPossession</code> from the second response — paste them into the Convert to L1
                    step.
                  </span>
                </div>
              )}
            </Step>

            {isValidator && (
              <Step>
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-1">
                  Backup Validator Credentials
                </h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
                  Your validator identity is defined by these files in{' '}
                  <code className="px-1 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded text-xs">
                    ~/.avalanchego/staking/
                  </code>
                </p>

                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="bg-zinc-50 dark:bg-zinc-900/50 rounded-lg p-3 border border-zinc-200 dark:border-zinc-800">
                    <div className="flex items-center gap-2 mb-1">
                      <ShieldCheck className="w-4 h-4 text-zinc-500" />
                      <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">TLS Cert</span>
                    </div>
                    <div className="text-sm font-mono text-zinc-900 dark:text-zinc-100">staker.crt</div>
                    <div className="text-[10px] text-zinc-400 mt-1">Node identity</div>
                  </div>
                  <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3 border border-red-200 dark:border-red-800">
                    <div className="flex items-center gap-2 mb-1">
                      <Key className="w-4 h-4 text-red-500" />
                      <span className="text-xs font-medium text-red-600 dark:text-red-400">Private Key</span>
                    </div>
                    <div className="text-sm font-mono text-red-700 dark:text-red-300">staker.key</div>
                    <div className="text-[10px] text-red-400 mt-1">Keep secret!</div>
                  </div>
                  <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3 border border-red-200 dark:border-red-800">
                    <div className="flex items-center gap-2 mb-1">
                      <KeyRound className="w-4 h-4 text-red-500" />
                      <span className="text-xs font-medium text-red-600 dark:text-red-400">BLS Key</span>
                    </div>
                    <div className="text-sm font-mono text-red-700 dark:text-red-300">signer.key</div>
                    <div className="text-[10px] text-red-400 mt-1">L1 signing</div>
                  </div>
                </div>

                <DynamicCodeBlock
                  lang="bash"
                  code={`# Backup your validator credentials
mkdir -p ~/avalanche-backup
cp -r ~/.avalanchego/staking ~/avalanche-backup/

# Verify backup
ls -la ~/avalanche-backup/staking/`}
                />

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">Store securely:</span>
                  <span className="px-2 py-0.5 rounded text-xs bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                    Encrypted USB
                  </span>
                  <span className="px-2 py-0.5 rounded text-xs bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                    Encrypted S3
                  </span>
                  <span className="px-2 py-0.5 rounded text-xs bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                    Multiple locations
                  </span>
                </div>

                <div className="text-xs text-zinc-500 dark:text-zinc-400 space-y-1.5 mt-4">
                  <p className="flex items-start gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-red-500 mt-0.5 flex-shrink-0" />
                    <span>
                      Lost keys ={' '}
                      <strong className="text-zinc-700 dark:text-zinc-300">your validator stops working</strong>. NVMe
                      drives can fail without warning.
                    </span>
                  </p>
                  <p className="flex items-start gap-1.5">
                    <Key className="w-3.5 h-3.5 text-amber-500 mt-0.5 flex-shrink-0" />
                    <span>Never share private keys — anyone with them can impersonate your validator.</span>
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800 flex flex-wrap gap-4 text-xs">
                  <a
                    href="/docs/nodes/maintain/backup-restore"
                    className="text-blue-500 hover:underline flex items-center gap-1"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Full Backup Guide
                  </a>
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
                />
              </Step>
            )}

            {isRPC && (
              <Step>
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-1">Add Network to Wallet</h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
                  Add your L1&apos;s RPC endpoint to your browser wallet to start interacting with the network.
                </p>

                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-zinc-50 dark:bg-zinc-900/50 rounded-lg p-3 border border-zinc-200 dark:border-zinc-800">
                      <div className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 mb-1">RPC Endpoint</div>
                      <code className="text-xs text-zinc-900 dark:text-zinc-100 break-all">
                        {domain
                          ? `https://${nipify(domain)}/ext/bc/${selectedRPCBlockchainId || chainId}/rpc`
                          : `http://localhost:9650/ext/bc/${selectedRPCBlockchainId || chainId}/rpc`}
                      </code>
                    </div>
                    {blockchainInfo?.evmChainId && (
                      <div className="bg-zinc-50 dark:bg-zinc-900/50 rounded-lg p-3 border border-zinc-200 dark:border-zinc-800">
                        <div className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 mb-1">
                          EVM Chain ID
                        </div>
                        <code className="text-sm text-zinc-900 dark:text-zinc-100">{blockchainInfo.evmChainId}</code>
                      </div>
                    )}
                  </div>

                  <Button
                    onClick={async () => {
                      const rpcUrl = domain
                        ? `https://${nipify(domain)}/ext/bc/${selectedRPCBlockchainId || chainId}/rpc`
                        : `http://localhost:9650/ext/bc/${selectedRPCBlockchainId || chainId}/rpc`;
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
                          });
                        }
                      }

                      const prevIsTestnet = useWalletStore.getState().isTestnet;
                      const prevNetworkID = useWalletStore.getState().avalancheNetworkID;

                      setWalletIsTestnet(isTestnetL1);
                      setAvalancheNetworkID(isTestnetL1 ? networkIDs.FujiID : networkIDs.MainnetID);

                      const success = await addToWallet({
                        rpcUrl,
                        chainName: name,
                        chainId: evmChainId,
                        isTestnet: isTestnetL1,
                      });

                      if (success && evmChainId) {
                        setWalletChainId(evmChainId);
                        setTimeout(() => updateL1Balance(evmChainId.toString()), 800);
                      } else if (!success) {
                        setWalletIsTestnet(prevIsTestnet);
                        setAvalancheNetworkID(prevNetworkID);
                      }
                    }}
                    disabled={isAddingToWallet}
                  >
                    {isAddingToWallet ? 'Adding...' : 'Add to Wallet & Switch'}
                  </Button>
                </div>

                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-3">
                  Works with Core, MetaMask, and other EVM wallets connected via RainbowKit.
                </p>
              </Step>
            )}
          </>
        )}
      </Steps>

      {configJson && !configJson.startsWith('Error:') && (
        <div className="mt-6 flex justify-center">
          <Button onClick={handleReset} variant="outline">
            Start Over
          </Button>
        </div>
      )}
    </Container>
  );
}

/** Small presentational helper for the Advanced Settings number inputs. */
function NumberField({
  label,
  path,
  value,
  onChange,
  hint,
  setHighlightPath,
  clearHighlight,
}: {
  label: string;
  path: string;
  value: number;
  onChange: (v: number) => void;
  hint?: string;
  setHighlightPath: (p: string) => void;
  clearHighlight: () => void;
}) {
  return (
    <div onMouseEnter={() => setHighlightPath(path)} onMouseLeave={clearHighlight}>
      <label className="block text-xs text-zinc-600 dark:text-zinc-400 mb-1">{label}</label>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value) || 0)}
        onFocus={() => setHighlightPath(path)}
        onBlur={clearHighlight}
        className="w-full px-2 py-1.5 text-sm border border-zinc-200 dark:border-zinc-700 rounded-md dark:bg-zinc-800 dark:text-white"
      />
      {hint && <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">{hint}</p>}
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
