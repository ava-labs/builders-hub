'use client';

import { useEffect, useMemo, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import { AlertTriangle, FileJson, Plus, RotateCw, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { Step, Steps } from 'fumadocs-ui/components/steps';
import { DynamicCodeBlock } from 'fumadocs-ui/components/dynamic-codeblock';
import { Button } from '@/components/toolbox/components/Button';
import { Input } from '@/components/toolbox/components/Input';
import { Select } from '@/components/toolbox/components/Select';
import {
  BaseConsoleToolProps,
  ConsoleToolMetadata,
  withConsoleToolMetadata,
} from '@/components/toolbox/components/WithConsoleToolMetadata';
import { WalletRequirementsConfigKey } from '@/components/toolbox/hooks/useWalletRequirements';
import { generateConsoleToolGitHubUrl } from '@/components/toolbox/utils/githubUrl';
import AllowList from '@/components/toolbox/components/genesis/AllowList';
import { JsonPreviewPanel } from '@/components/toolbox/components/genesis/JsonPreviewPanel';
import { SectionWrapper } from '@/components/toolbox/components/genesis/SectionWrapper';
import { PrecompileToggleList, type PrecompileItem } from '@/components/toolbox/components/genesis/PrecompileToggleList';
import { PRECOMPILE_INFO, PREDEPLOY_INFO } from '@/components/toolbox/components/genesis/precompileInfo';
import {
  GenesisHighlightProvider,
  useGenesisHighlight,
} from '@/components/toolbox/components/genesis/GenesisHighlightContext';
import type { AddressEntry, AddressRoles, Role } from '@/components/toolbox/components/genesis/types';
import { Switch } from '@/components/ui/switch';
import { useL1UpgradeStore } from '@/components/toolbox/stores/l1UpgradeStore';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import useConsoleNotifications from '@/hooks/useConsoleNotifications';
import { cn } from '@/lib/utils';
import {
  BalanceChange,
  buildUpgradeJson,
  emptyUpgradeJson,
  extractUpgradeJsonFromChainConfig,
  formatUpgradeJson,
  getMaxConfiguredTimestamp,
  parseUpgradeJson,
  PRECOMPILE_DEFINITIONS,
  PrecompileConfigKey,
  PrecompileMode,
  PrecompileSelection,
  isPositiveAmount,
  isValidAddress,
  isValidRuntimeBytecode,
  validateUpgradePlan,
} from '@/lib/console/upgrade-json';
import TransparentUpgradeableProxy from '@/contracts/openzeppelin-4.9/compiled/TransparentUpgradeableProxy.json';
import ProxyAdmin from '@/contracts/openzeppelin-4.9/compiled/ProxyAdmin.json';
import TeleporterMessenger from '@/contracts/icm-contracts/compiled/TeleporterMessenger.json';
import WrappedNativeToken from '@/contracts/icm-contracts/compiled/WrappedNativeToken.json';
import Create2Deployer from '@/contracts/create2-contracts/compiled/Create2Deployer.json';
import Multicall3 from '@/contracts/multicall3-contracts/compiled/Multicall3.json';

const metadata: ConsoleToolMetadata = {
  title: 'Upgrade JSON',
  description: (
    <>
      Schedule{' '}
      <Link href="/docs/avalanche-l1s/upgrade/precompile-upgrades" className="text-primary hover:underline">
        precompile upgrades
      </Link>{' '}
      and state upgrades for a running L1 via <code className="text-xs">upgrade.json</code>. Unlike{' '}
      <Link href="/docs/avalanche-l1s/evm-configuration/customize-avalanche-l1" className="text-primary hover:underline">
        genesis configuration
      </Link>
      , these activate at a scheduled timestamp once every validator node loads the file and restarts.
    </>
  ),
  toolRequirements: [WalletRequirementsConfigKey.WalletConnected],
  githubUrl: generateConsoleToolGitHubUrl(import.meta.url),
};

type RpcCheckResponse = {
  chainConfig: unknown | null;
  activeRules: { precompiles?: Record<string, unknown> } | null;
  latestBlockTimestamp?: number | null;
  errors?: {
    chainConfig?: string | null;
    activeRules?: string | null;
    latestBlock?: string | null;
  };
};

type ManagedFetchResponse = {
  managed: boolean;
  exists: boolean;
  upgradeJson: unknown | null;
  nodes?: Array<{ id: string; nodeIndex: number | null; nodeId: string }>;
  serviceError?: string | null;
};

type ManagedCheckState = 'loading' | 'ok' | 'error';

type UiCodeChange = {
  id: string;
  address: string;
  code: string;
  sourceRpcUrl: string;
  sourceAddress: string;
  sourcePreset: string;
  storage?: Record<string, string>;
  isFetching?: boolean;
};

const DEFAULT_TIMESTAMP_OFFSET_SECONDS = 10 * 60;

type ExistingPrecompileSchedule = {
  mode: Exclude<PrecompileMode, 'none'>;
  blockTimestamp?: number;
};

// Map upgrade.json config keys onto the shared precompile catalog used by the
// genesis builder so both tools show identical names, addresses, and docs.
const UPGRADE_PRECOMPILE_INFO: Record<PrecompileConfigKey, (typeof PRECOMPILE_INFO)[keyof typeof PRECOMPILE_INFO]> = {
  contractDeployerAllowListConfig: PRECOMPILE_INFO.contractDeployerAllowList,
  contractNativeMinterConfig: PRECOMPILE_INFO.nativeMinter,
  txAllowListConfig: PRECOMPILE_INFO.txAllowList,
  feeManagerConfig: PRECOMPILE_INFO.feeManager,
  rewardManagerConfig: PRECOMPILE_INFO.rewardManager,
  warpConfig: PRECOMPILE_INFO.warp,
};

const PRECOMPILE_ACTIONS: Record<PrecompileConfigKey, string> = {
  contractDeployerAllowListConfig: 'deploy contracts',
  contractNativeMinterConfig: 'mint native tokens',
  txAllowListConfig: 'submit transactions',
  feeManagerConfig: 'update fee parameters',
  rewardManagerConfig: 'configure fee rewards',
  warpConfig: 'configure Warp messaging',
};

// Common predeploys offered as bytecode sources — the same catalog (names and
// canonical addresses) the genesis builder installs.
const SOURCE_CONTRACT_PRESETS = Object.entries(PREDEPLOY_INFO).map(([key, info]) => ({
  key,
  name: info.name,
  address: info.address,
}));

// Deployed bytecode + storage initialization per preset, mirroring what
// genGenesis allocates at genesis. Bundling the artifacts means presets never
// depend on the source chain actually having the contract deployed.
const UNINITIALIZED_PROXY_ADDRESS = '0x1212121212121212121212121212121212121212';
const PROXY_ADMIN_ADDRESS = '0xdad0000000000000000000000000000000000000';
const EIP1967_IMPLEMENTATION_SLOT = '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc';
const EIP1967_ADMIN_SLOT = '0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103';
const STORAGE_SLOT_0 = '0x0000000000000000000000000000000000000000000000000000000000000000';
const STORAGE_SLOT_1 = '0x0000000000000000000000000000000000000000000000000000000000000001';
const STORAGE_VALUE_1 = '0x0000000000000000000000000000000000000000000000000000000000000001';
const SAFE_SINGLETON_FACTORY_CODE =
  '0x7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe03601600081602082378035828234f58015156039578182fd5b8082525050506014600cf3';

function hexTo32Bytes(hex: string): string {
  const stripped = hex.startsWith('0x') ? hex.slice(2) : hex;
  return `0x${stripped.toLowerCase().padStart(64, '0')}`;
}

type SourcePresetDetails = {
  code: string;
  storage?: (walletAddress?: string) => Record<string, string> | undefined;
  note?: string;
};

const SOURCE_PRESET_DETAILS: Record<string, SourcePresetDetails> = {
  proxy: {
    code: TransparentUpgradeableProxy.deployedBytecode.object,
    storage: () => ({
      [EIP1967_IMPLEMENTATION_SLOT]: hexTo32Bytes(UNINITIALIZED_PROXY_ADDRESS),
      [EIP1967_ADMIN_SLOT]: hexTo32Bytes(PROXY_ADMIN_ADDRESS),
    }),
    note: 'Initializes the EIP-1967 implementation and admin slots like the genesis predeploy. Upgrade the implementation via the Proxy Admin afterwards.',
  },
  proxyAdmin: {
    code: ProxyAdmin.deployedBytecode.object,
    storage: (walletAddress) =>
      walletAddress && isValidAddress(walletAddress) ? { [STORAGE_SLOT_0]: hexTo32Bytes(walletAddress) } : undefined,
    note: 'The owner storage slot is set to your connected wallet (connect one before picking this preset).',
  },
  icmMessenger: {
    code: TeleporterMessenger.deployedBytecode.object,
    storage: () => ({
      [STORAGE_SLOT_0]: STORAGE_VALUE_1,
      [STORAGE_SLOT_1]: STORAGE_VALUE_1,
    }),
    note: 'Initializes the reentrancy-guard slots the messenger needs before first use.',
  },
  wrappedNativeToken: {
    code: (WrappedNativeToken.deployedBytecode as { object: string }).object,
    note: 'Wrapping works immediately, but name()/symbol() storage is not initialized by code-only injection.',
  },
  safeSingletonFactory: { code: SAFE_SINGLETON_FACTORY_CODE },
  multicall3: { code: Multicall3.deployedBytecode.object },
  create2Deployer: { code: Create2Deployer.deployedBytecode as string },
};

function makeInitialPrecompiles(): PrecompileSelection[] {
  return PRECOMPILE_DEFINITIONS.map((definition) => ({
    key: definition.key,
    mode: 'none' as PrecompileMode,
    quorumNumerator: definition.key === 'warpConfig' ? 67 : undefined,
    requirePrimaryNetworkSigners: definition.key === 'warpConfig' ? true : undefined,
  }));
}

function getExistingPrecompileSchedules(
  config: Record<string, unknown>,
): Partial<Record<PrecompileConfigKey, ExistingPrecompileSchedule>> {
  const schedules: Partial<Record<PrecompileConfigKey, ExistingPrecompileSchedule>> = {};
  const upgrades = config.precompileUpgrades;
  if (!Array.isArray(upgrades)) return schedules;

  for (const entry of upgrades) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
    for (const definition of PRECOMPILE_DEFINITIONS) {
      const rawConfig = (entry as Record<string, unknown>)[definition.key];
      if (!rawConfig || typeof rawConfig !== 'object' || Array.isArray(rawConfig)) continue;
      const upgradeConfig = rawConfig as Record<string, unknown>;
      const rawTimestamp = upgradeConfig.blockTimestamp;
      schedules[definition.key] = {
        mode: upgradeConfig.disable === true ? 'disable' : 'enable',
        blockTimestamp:
          typeof rawTimestamp === 'number'
            ? rawTimestamp
            : typeof rawTimestamp === 'string' && /^\d+$/.test(rawTimestamp)
              ? Number(rawTimestamp)
              : undefined,
      };
    }
  }

  return schedules;
}

function UpgradeJsonBuilderInner() {
  const store = useL1UpgradeStore();
  const selectedSubnetId = store((state) => state.subnetId);
  const selectedBlockchainId = store((state) => state.blockchainId);
  const selectedRpcUrl = store((state) => state.rpcUrl);
  const selectedChainName = store((state) => state.chainName);
  const selectedIsManaged = store((state) => state.isManaged);
  const selectedManagedNodeCount = store((state) => state.managedNodeCount);
  const walletAddress = useWalletStore((state) => state.walletEVMAddress || state.coreEthAddress);
  const { notify } = useConsoleNotifications();
  const { highlightPath, setHighlightPath, clearHighlight } = useGenesisHighlight();
  const selection = useMemo(
    () => ({
      subnetId: selectedSubnetId,
      blockchainId: selectedBlockchainId,
      rpcUrl: selectedRpcUrl,
      chainName: selectedChainName,
      isManaged: selectedIsManaged,
      managedNodeCount: selectedManagedNodeCount,
    }),
    [
      selectedBlockchainId,
      selectedChainName,
      selectedIsManaged,
      selectedManagedNodeCount,
      selectedRpcUrl,
      selectedSubnetId,
    ],
  );

  const [baseText, setBaseText] = useState(formatUpgradeJson(emptyUpgradeJson()));
  const [baseSource, setBaseSource] = useState('empty');
  const [isLoadingSource, setIsLoadingSource] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);
  const [rpcCheck, setRpcCheck] = useState<RpcCheckResponse | null>(null);
  const [rpcError, setRpcError] = useState<string | null>(null);
  const [managedInfo, setManagedInfo] = useState<ManagedFetchResponse | null>(null);
  const [managedCheckState, setManagedCheckState] = useState<ManagedCheckState>('loading');
  const [precompiles, setPrecompiles] = useState<PrecompileSelection[]>(makeInitialPrecompiles);
  const [activationTimestamp, setActivationTimestamp] = useState(
    () => Math.floor(Date.now() / 1000) + DEFAULT_TIMESTAMP_OFFSET_SECONDS,
  );
  const timestampTouchedRef = useRef(false);
  const [balanceChanges, setBalanceChanges] = useState<BalanceChange[]>([]);
  const [codeChanges, setCodeChanges] = useState<UiCodeChange[]>([]);
  const [isApplyingManaged, setIsApplyingManaged] = useState(false);
  const [managedApplied, setManagedApplied] = useState(false);

  const parsedBase = useMemo(() => parseUpgradeJson(baseText), [baseText]);
  const baseConfig = parsedBase.config ?? emptyUpgradeJson();
  const latestExistingTimestamp = getMaxConfiguredTimestamp(baseConfig);
  const existingPrecompileSchedules = useMemo(() => getExistingPrecompileSchedules(baseConfig), [baseConfig]);

  const planInput = useMemo(
    () => ({
      baseConfig,
      activationTimestamp,
      precompiles,
      balanceChanges,
      codeChanges: codeChanges.map(({ id, address, code, storage }) => ({ id, address, code, storage })),
    }),
    [activationTimestamp, balanceChanges, baseConfig, codeChanges, precompiles],
  );

  const validation = useMemo(() => validateUpgradePlan(planInput), [planInput]);
  const generatedConfig = useMemo(() => buildUpgradeJson(planInput), [planInput]);
  const generatedJson = useMemo(() => formatUpgradeJson(generatedConfig), [generatedConfig]);
  const activePrecompileKeys = useMemo(
    () => Object.keys(rpcCheck?.activeRules?.precompiles ?? {}),
    [rpcCheck?.activeRules],
  );
  const suggestedActivationTimestamp = useMemo(() => {
    const chainTimestamp = rpcCheck?.latestBlockTimestamp;
    if (!chainTimestamp) return null;
    return chainTimestamp + DEFAULT_TIMESTAMP_OFFSET_SECONDS;
  }, [rpcCheck?.latestBlockTimestamp]);

  useEffect(() => {
    if (!selection.subnetId || !selection.blockchainId) return;
    let cancelled = false;

    async function loadInitialState() {
      setIsLoadingSource(true);
      setRpcError(null);
      setManagedApplied(false);
      setManagedCheckState('loading');
      try {
        // The managed check always runs — node type comes from the backend's
        // registration table, never from the hint carried in the store.
        const [managedResult, rpcResult] = await Promise.allSettled([
          fetch(
            `/api/console/l1-upgrade/managed?subnetId=${encodeURIComponent(selection.subnetId)}&blockchainId=${encodeURIComponent(selection.blockchainId)}`,
          ),
          selection.rpcUrl
            ? fetch('/api/console/l1-upgrade/rpc', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rpcUrl: selection.rpcUrl }),
              })
            : Promise.resolve(null),
        ]);

        if (cancelled) return;

        let managed: ManagedFetchResponse | null = null;
        if (managedResult.status === 'fulfilled' && managedResult.value?.ok) {
          managed = (await managedResult.value.json()) as ManagedFetchResponse;
          setManagedInfo(managed);
          setManagedCheckState('ok');
        } else {
          setManagedInfo(null);
          setManagedCheckState('error');
        }

        let rpcData: RpcCheckResponse | null = null;
        if (rpcResult.status === 'fulfilled' && rpcResult.value) {
          if (rpcResult.value.ok) {
            rpcData = (await rpcResult.value.json()) as RpcCheckResponse;
            setRpcCheck(rpcData);
          } else {
            const data = (await rpcResult.value.json().catch(() => null)) as { error?: string } | null;
            setRpcError(data?.error ?? 'RPC check failed.');
            setRpcCheck(null);
          }
        } else {
          setRpcCheck(null);
        }

        // Existing file: the managed node's real upgrade.json wins; otherwise
        // the chain's current upgrade config read over RPC; otherwise empty.
        const onChainUpgrades = extractUpgradeJsonFromChainConfig(rpcData?.chainConfig);
        if (managed?.exists && managed.upgradeJson) {
          setBaseText(formatUpgradeJson(managed.upgradeJson as Record<string, unknown>));
          setBaseSource('managed node');
        } else if (onChainUpgrades) {
          setBaseText(formatUpgradeJson(onChainUpgrades));
          setBaseSource('on-chain config (RPC)');
        } else {
          setBaseText(formatUpgradeJson(emptyUpgradeJson()));
          setBaseSource('empty');
        }
      } finally {
        if (!cancelled) setIsLoadingSource(false);
      }
    }

    loadInitialState();
    return () => {
      cancelled = true;
    };
  }, [reloadTick, selection.blockchainId, selection.rpcUrl, selection.subnetId]);

  // Default the activation timestamp to a sensible future value (chain tip +
  // offset, past any already-scheduled upgrade) until the user edits it.
  // Manual input is never overridden — out-of-range values surface as
  // validation errors instead.
  useEffect(() => {
    if (timestampTouchedRef.current) return;
    const recommended = Math.max(
      Math.floor(Date.now() / 1000) + DEFAULT_TIMESTAMP_OFFSET_SECONDS,
      suggestedActivationTimestamp ?? 0,
      latestExistingTimestamp > 0 ? latestExistingTimestamp + DEFAULT_TIMESTAMP_OFFSET_SECONDS : 0,
    );
    setActivationTimestamp(recommended);
  }, [latestExistingTimestamp, suggestedActivationTimestamp]);

  if (!selection.subnetId || !selection.blockchainId) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4">
        <div className="p-4 rounded-full bg-yellow-100 dark:bg-yellow-900/30 mb-4">
          <AlertTriangle className="h-8 w-8 text-yellow-600 dark:text-yellow-400" />
        </div>
        <h3 className="text-sm font-semibold text-center mb-2">No L1 Selected</h3>
        <p className="text-sm text-muted-foreground text-center max-w-md">
          Go back to the previous step and select the L1 before building upgrade.json.
        </p>
      </div>
    );
  }

  // Node type is whatever the backend says. The store's hint only fills the
  // gap while the check is in flight or failed (e.g. signed out).
  const managedNodeCount = managedInfo?.nodes?.length ?? 0;
  const isManagedVerified = managedInfo?.managed === true && managedNodeCount > 0;
  const effectiveIsManaged = managedCheckState === 'ok' ? isManagedVerified : selection.isManaged;
  const nodeTypeLabel =
    managedCheckState === 'loading'
      ? 'Checking…'
      : effectiveIsManaged
        ? `Managed (${managedCheckState === 'ok' ? managedNodeCount : selection.managedNodeCount} active)${managedCheckState === 'error' ? ' — unverified' : ''}`
        : `Self-hosted/manual${managedCheckState === 'error' ? ' — unverified' : ''}`;
  const canApplyManaged = managedCheckState === 'ok' && isManagedVerified && validation.valid && !parsedBase.error;
  const timestampError = validation.errors.find((error) => error.includes('Activation timestamp')) ?? null;

  const handleImportFile = async (file: File | null) => {
    if (!file) return;
    const text = await file.text();
    // Load the file as-is; invalid JSON surfaces through the inline parse
    // error under the editor rather than being silently rejected.
    setBaseText(text);
    setBaseSource(file.name);
  };

  // One-click apply: write upgrade.json to every managed node, then restart
  // them so AvalancheGo loads the file. Mirrors what the self-hosted
  // instructions tell users to do by hand.
  const applyManaged = async () => {
    setIsApplyingManaged(true);
    try {
      const writePromise = (async () => {
        const response = await fetch('/api/console/l1-upgrade/managed', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subnetId: selection.subnetId,
            blockchainId: selection.blockchainId,
            chainName: selection.chainName,
            rpcUrl: selection.rpcUrl,
            upgradeJson: generatedConfig,
          }),
        });
        if (!response.ok) {
          const data = (await response.json().catch(() => null)) as { message?: string } | null;
          throw new Error(data?.message ?? 'Failed to write managed upgrade.json.');
        }
      })();
      notify({ name: 'Managed upgrade.json Write', type: 'local' }, writePromise);
      await writePromise;

      const restartPromise = (async () => {
        const response = await fetch('/api/console/l1-upgrade/managed/restart', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subnetId: selection.subnetId,
            blockchainId: selection.blockchainId,
          }),
        });
        if (!response.ok) {
          const data = (await response.json().catch(() => null)) as { message?: string } | null;
          throw new Error(data?.message ?? 'Failed to restart managed nodes.');
        }
      })();
      notify({ name: 'Managed Node Restart', type: 'local' }, restartPromise);
      await restartPromise;
      setManagedApplied(true);
    } catch {
      // Failures are surfaced via the console notifications.
    } finally {
      setIsApplyingManaged(false);
    }
  };

  return (
    <div className="space-y-6">
      <HeaderPanel
        chainName={selection.chainName}
        subnetId={selection.subnetId}
        blockchainId={selection.blockchainId}
        rpcUrl={selection.rpcUrl}
        nodeTypeLabel={nodeTypeLabel}
        rpcError={rpcError}
        chainConfigError={rpcCheck?.errors?.chainConfig ?? null}
        activeRulesError={rpcCheck?.errors?.activeRules ?? null}
        managedServiceError={managedInfo?.serviceError ?? null}
        isRefreshing={isLoadingSource}
        onRefresh={() => setReloadTick((n) => n + 1)}
      />

      <Steps>
        {/* Step 1: Build the upgrade.json */}
        <Step>
          <div>
            <h2 className="text-sm font-semibold mb-1">Configure Upgrade</h2>
            <p className="text-xs text-muted-foreground">
              Toggle precompiles and add state upgrades. New entries are appended to the existing upgrade.json.
            </p>
          </div>

          <div className="flex flex-col bg-white dark:bg-zinc-950 rounded-lg border border-zinc-200 dark:border-zinc-800">
            <div className="px-5 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Upgrade Configuration</span>
              <label className="inline-flex items-center justify-center gap-2 rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 text-xs font-medium cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                <FileJson className="h-4 w-4" />
                Import upgrade.json
                <input
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  onChange={(event) => void handleImportFile(event.target.files?.[0] ?? null)}
                />
              </label>
            </div>

            <div className="flex flex-col lg:flex-row">
              {/* Left panel — configuration */}
              <div className="flex-1 p-5 bg-white dark:bg-zinc-950 text-[13px] min-w-0">
                <div className="space-y-8">
                  <SectionWrapper
                    title="Existing upgrade.json"
                    titleTooltip="The file currently loaded on your nodes (or your last saved snapshot). Existing entries are preserved and new entries are appended after them."
                    sectionId="existingUpgrade"
                  >
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground">
                        Source: {isLoadingSource ? 'loading...' : baseSource}
                      </p>
                      <textarea
                        value={baseText}
                        onChange={(event) => {
                          setBaseText(event.target.value);
                          setBaseSource('custom input');
                        }}
                        className={cn(
                          'w-full min-h-40 px-4 py-3 bg-zinc-900 dark:bg-zinc-950 text-zinc-100 rounded-lg border font-mono text-xs resize-y focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
                          parsedBase.error ? 'border-red-500' : 'border-zinc-700 dark:border-zinc-800',
                        )}
                        spellCheck={false}
                      />
                      {parsedBase.error && (
                        <p className="text-xs text-red-600 dark:text-red-400">{parsedBase.error}</p>
                      )}
                      {latestExistingTimestamp > 0 && (
                        <p className="text-xs text-muted-foreground">
                          Latest existing upgrade timestamp: <span className="font-mono">{latestExistingTimestamp}</span>
                        </p>
                      )}
                    </div>
                  </SectionWrapper>

                  <SectionWrapper
                    title="Activation Timing"
                    titleTooltip="Unix timestamp when validators activate the new rules. It must be in the future and after every already-scheduled upgrade. Multiple generated entries are scheduled one second apart."
                    sectionId="activationTiming"
                  >
                    <Input
                      label="Scheduled Activation"
                      type="number"
                      value={activationTimestamp}
                      onChange={(value) => {
                        timestampTouchedRef.current = true;
                        setActivationTimestamp(Number(value));
                      }}
                      error={timestampError}
                      helperText={
                        timestampError
                          ? undefined
                          : `Activates ~${new Date(activationTimestamp * 1000).toLocaleString()}${
                              suggestedActivationTimestamp ? ' (auto-filled from the latest chain timestamp)' : ''
                            }`
                      }
                      className="max-w-xs"
                    />
                  </SectionWrapper>

                  <PrecompileUpgradesSection
                    precompiles={precompiles}
                    activePrecompileKeys={activePrecompileKeys}
                    existingSchedules={existingPrecompileSchedules}
                    validationErrors={validation.errors}
                    walletAddress={walletAddress}
                    onChange={setPrecompiles}
                    onToggleHighlight={(key, enabled) => {
                      if (!enabled) return;
                      setTimeout(() => {
                        setHighlightPath(`config.${key}`);
                        setTimeout(() => clearHighlight(), 2000);
                      }, 100);
                    }}
                  />

                  <StateUpgradesSection
                    rpcUrl={selection.rpcUrl}
                    walletAddress={walletAddress}
                    balanceChanges={balanceChanges}
                    codeChanges={codeChanges}
                    validationErrors={validation.errors}
                    setBalanceChanges={setBalanceChanges}
                    setCodeChanges={setCodeChanges}
                    notify={notify}
                    onAddHighlight={() => {
                      setTimeout(() => {
                        setHighlightPath('stateUpgrades');
                        setTimeout(() => clearHighlight(), 2000);
                      }, 100);
                    }}
                  />
                </div>
              </div>

              {/* Right panel — JSON preview */}
              <div className="w-full lg:w-[480px] xl:w-[560px] border-t lg:border-t-0 border-zinc-200 dark:border-zinc-800 lg:sticky lg:top-4 lg:self-start">
                <JsonPreviewPanel
                  jsonData={generatedJson}
                  title="upgrade.json"
                  fileName="upgrade.json"
                  sizeLimitKiB={null}
                  highlightPath={highlightPath || undefined}
                />
              </div>
            </div>
          </div>
        </Step>

        {/* Step 2: Apply the upgrade */}
        <Step>
          <div>
            <h2 className="text-sm font-semibold mb-1">Apply the Upgrade</h2>
            <p className="text-xs text-muted-foreground">
              Every validator node must load the file and restart before the activation timestamp.
            </p>
          </div>

          <div className="space-y-4">
            {managedCheckState === 'loading' && (
              <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4">
                <p className="text-xs text-muted-foreground">Checking whether this L1 uses managed nodes…</p>
              </div>
            )}

            {/* Managed L1s get the one-click apply; everything else gets the
                docker commands. Never both. */}
            {managedCheckState === 'ok' && isManagedVerified && (
              <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4">
                <div>
                  <h3 className="text-sm font-semibold">Apply to managed nodes</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Builder Hub writes upgrade.json to {managedNodeCount > 0 ? `all ${managedNodeCount}` : 'your'}{' '}
                    managed node{managedNodeCount === 1 ? '' : 's'}, then restarts them to load it.
                  </p>
                </div>
                <div className="mt-4 space-y-2">
                  <Button
                    variant="primary"
                    loading={isApplyingManaged}
                    loadingText="Applying upgrade…"
                    disabled={!canApplyManaged}
                    onClick={() => void applyManaged()}
                  >
                    Apply Upgrade to {managedNodeCount} Managed Node{managedNodeCount === 1 ? '' : 's'}
                  </Button>
                  {managedApplied && (
                    <p className="text-xs text-green-700 dark:text-green-400">
                      upgrade.json written to all managed nodes and restart requested. The upgrade activates at the
                      scheduled timestamp.
                    </p>
                  )}
                </div>
              </div>
            )}

            {managedCheckState !== 'loading' && !(managedCheckState === 'ok' && isManagedVerified) && (
              <>
                {managedCheckState === 'error' && (
                  <p className="text-xs text-yellow-700 dark:text-yellow-400">
                    Couldn&apos;t verify managed node status — showing self-hosted commands. Sign in to Builder Hub if
                    this L1 uses managed nodes.
                  </p>
                )}
                <SelfHostedInstructions
                  blockchainId={selection.blockchainId}
                  rpcUrl={selection.rpcUrl}
                  upgradeJson={generatedJson}
                />
              </>
            )}
          </div>
        </Step>
      </Steps>
    </div>
  );
}

function HeaderPanel({
  chainName,
  subnetId,
  blockchainId,
  rpcUrl,
  nodeTypeLabel,
  rpcError,
  chainConfigError,
  activeRulesError,
  managedServiceError,
  isRefreshing,
  onRefresh,
}: {
  chainName: string;
  subnetId: string;
  blockchainId: string;
  rpcUrl: string;
  nodeTypeLabel: string;
  rpcError: string | null;
  chainConfigError: string | null;
  activeRulesError: string | null;
  managedServiceError: string | null;
  isRefreshing: boolean;
  onRefresh: () => void;
}) {
  const warning = rpcError || chainConfigError || activeRulesError || managedServiceError;
  return (
    <section className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4">
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {chainName || blockchainId.slice(0, 8)}
          </h3>
          <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2 text-xs">
            <InfoLine label="Subnet" value={subnetId} />
            <InfoLine label="Blockchain" value={blockchainId} />
            <InfoLine label="RPC" value={rpcUrl || 'Not set'} />
            <InfoLine label="Node type" value={nodeTypeLabel} />
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="w-auto shrink-0"
          icon={<RotateCw className="h-4 w-4" />}
          loading={isRefreshing}
          onClick={onRefresh}
        >
          Refresh
        </Button>
      </div>
      {warning && (
        <div className="mt-3 rounded-lg border border-yellow-200 dark:border-yellow-900 bg-yellow-50 dark:bg-yellow-950/30 p-3 text-xs text-yellow-800 dark:text-yellow-200">
          {warning}
        </div>
      )}
    </section>
  );
}

function StatusBadge({
  isActive,
  schedule,
}: {
  isActive: boolean;
  schedule?: ExistingPrecompileSchedule;
}) {
  if (isActive) {
    return (
      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full border border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-400">
        Active
      </span>
    );
  }
  if (schedule) {
    return (
      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400">
        {schedule.mode === 'enable' ? 'Scheduled' : 'Disable scheduled'}
      </span>
    );
  }
  return null;
}

function PrecompileUpgradesSection({
  precompiles,
  activePrecompileKeys,
  existingSchedules,
  validationErrors,
  walletAddress,
  onChange,
  onToggleHighlight,
}: {
  precompiles: PrecompileSelection[];
  activePrecompileKeys: string[];
  existingSchedules: Partial<Record<PrecompileConfigKey, ExistingPrecompileSchedule>>;
  validationErrors: string[];
  walletAddress?: string;
  onChange: (value: PrecompileSelection[]) => void;
  onToggleHighlight: (key: PrecompileConfigKey, enabled: boolean) => void;
}) {
  const update = (key: PrecompileConfigKey, patch: Partial<PrecompileSelection>) => {
    onChange(precompiles.map((item) => (item.key === key ? { ...item, ...patch } : item)));
  };

  const toggleTarget = (key: PrecompileConfigKey, currentTargetEnabled: boolean, baseTargetEnabled: boolean) => {
    const nextEnabled = !currentTargetEnabled;
    const value = precompiles.find((item) => item.key === key);
    const nextMode = nextEnabled === baseTargetEnabled ? 'none' : nextEnabled ? 'enable' : 'disable';
    const patch: Partial<PrecompileSelection> = { mode: nextMode };
    // Auto-add the connected wallet as Admin when enabling an allowlist
    // precompile, mirroring the genesis builder's PermissioningSection.
    if (
      nextMode === 'enable' &&
      key !== 'warpConfig' &&
      walletAddress &&
      isValidAddress(walletAddress) &&
      (value?.adminAddresses ?? []).length === 0
    ) {
      patch.adminAddresses = [walletAddress];
    }
    update(key, patch);
    onToggleHighlight(key, nextMode === 'enable');
  };

  // Entry point for changing an already-active allowlist precompile: schedules
  // the disable + re-enable pair subnet-evm requires for config changes.
  const startAllowlistUpdate = (key: PrecompileConfigKey) => {
    const value = precompiles.find((item) => item.key === key);
    const patch: Partial<PrecompileSelection> = { mode: 'update' };
    if (walletAddress && isValidAddress(walletAddress) && (value?.adminAddresses ?? []).length === 0) {
      patch.adminAddresses = [walletAddress];
    }
    update(key, patch);
    onToggleHighlight(key, true);
  };

  const items: PrecompileItem[] = PRECOMPILE_DEFINITIONS.map((definition) => {
    const value = precompiles.find((item) => item.key === definition.key)!;
    const isActive = activePrecompileKeys.includes(definition.key);
    const existingSchedule = existingSchedules[definition.key];
    const baseTargetEnabled = existingSchedule ? existingSchedule.mode === 'enable' : isActive;
    const targetEnabled =
      value.mode === 'enable' || value.mode === 'update'
        ? true
        : value.mode === 'disable'
          ? false
          : baseTargetEnabled;
    const rowErrors = validationErrors.filter((error) => error.includes(definition.key));

    let expandedContent: ReactNode;
    if ((value.mode === 'enable' || value.mode === 'update') && definition.supportsAllowList) {
      expandedContent = (
        <div className="space-y-2">
          {value.mode === 'update' && (
            <div className="flex items-start justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                Schedules a disable entry followed by a re-enable with this allowlist — the sequence required to
                change an active precompile&apos;s configuration.
              </p>
              <button
                type="button"
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline shrink-0"
                onClick={() => update(definition.key, { mode: 'none' })}
              >
                Cancel update
              </button>
            </div>
          )}
          {rowErrors.map((error) => (
            <p key={error} className="text-xs text-red-600 dark:text-red-400">
              {error}
            </p>
          ))}
          <AllowList
            addresses={selectionToAddressRoles(value)}
            precompileAction={PRECOMPILE_ACTIONS[definition.key]}
            onUpdateAllowlist={(addresses) => update(definition.key, addressRolesToSelectionPatch(addresses))}
          />
        </div>
      );
    } else if (value.mode === 'none' && baseTargetEnabled && definition.supportsAllowList) {
      expandedContent = (
        <div className="flex items-center justify-between gap-3 rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-900/40 px-3 py-2">
          <p className="text-xs text-muted-foreground">
            Already enabled. Schedule an allowlist update to change who can {PRECOMPILE_ACTIONS[definition.key]}.
          </p>
          <Button
            size="sm"
            variant="outline"
            className="w-auto shrink-0"
            onClick={() => startAllowlistUpdate(definition.key)}
          >
            Update Allowlist
          </Button>
        </div>
      );
    } else if (value.mode === 'enable' && definition.supportsWarpConfig) {
      expandedContent = (
        <div className="space-y-2">
          {rowErrors.map((error) => (
            <p key={error} className="text-xs text-red-600 dark:text-red-400">
              {error}
            </p>
          ))}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
            <Input
              label="Quorum Numerator"
              type="number"
              value={value.quorumNumerator ?? 67}
              onChange={(raw) => update(definition.key, { quorumNumerator: Number(raw) })}
              helperText="Percent threshold for Warp signer quorum."
            />
            <div className="flex items-center justify-between gap-3 rounded-md border border-zinc-200 dark:border-zinc-800 px-3 py-2 mt-7">
              <span className="text-[12px] font-medium text-zinc-800 dark:text-zinc-200">
                Require Primary Network signers
              </span>
              <Switch
                checked={value.requirePrimaryNetworkSigners ?? true}
                onCheckedChange={(checked) => update(definition.key, { requirePrimaryNetworkSigners: checked })}
              />
            </div>
          </div>
        </div>
      );
    }

    return {
      id: definition.key,
      label: definition.label,
      checked: targetEnabled,
      onCheckedChange: () => toggleTarget(definition.key, targetEnabled, baseTargetEnabled),
      info: UPGRADE_PRECOMPILE_INFO[definition.key],
      badge: <StatusBadge isActive={isActive} schedule={existingSchedule} />,
      expandedContent,
    };
  });

  // Errors for rows whose expanded editor is hidden (e.g. a disable entry)
  // would otherwise be invisible — surface them under the list.
  const hiddenErrors = validationErrors.filter((error) =>
    PRECOMPILE_DEFINITIONS.some((definition) => {
      if (!error.includes(definition.key)) return false;
      const mode = precompiles.find((item) => item.key === definition.key)?.mode;
      return mode !== 'enable' && mode !== 'update';
    }),
  );

  return (
    <SectionWrapper
      title="Precompile Upgrades"
      titleTooltip="Active state comes from the RPC; scheduled state comes from the loaded upgrade.json. Each toggle appends a new enable or disable entry at the activation timestamp."
      titleTooltipLink={{
        href: '/docs/avalanche-l1s/upgrade/precompile-upgrades',
        text: 'Learn more about precompile upgrades',
      }}
      sectionId="precompileUpgrades"
    >
      <div className="space-y-2">
        <PrecompileToggleList items={items} showEnabledCount={false} />
        {hiddenErrors.map((error) => (
          <p key={error} className="text-xs text-red-600 dark:text-red-400">
            {error}
          </p>
        ))}
      </div>
    </SectionWrapper>
  );
}

function StateUpgradesSection({
  rpcUrl,
  walletAddress,
  balanceChanges,
  codeChanges,
  validationErrors,
  setBalanceChanges,
  setCodeChanges,
  notify,
  onAddHighlight,
}: {
  rpcUrl: string;
  walletAddress?: string;
  balanceChanges: BalanceChange[];
  codeChanges: UiCodeChange[];
  validationErrors: string[];
  setBalanceChanges: Dispatch<SetStateAction<BalanceChange[]>>;
  setCodeChanges: Dispatch<SetStateAction<UiCodeChange[]>>;
  notify: ReturnType<typeof useConsoleNotifications>['notify'];
  onAddHighlight: () => void;
}) {
  const addBalance = () => {
    setBalanceChanges((prev) => [...prev, { id: crypto.randomUUID(), address: '', amount: '' }]);
    onAddHighlight();
  };
  const addCode = () => {
    setCodeChanges((prev) => [
      ...prev,
      { id: crypto.randomUUID(), address: '', code: '', sourceRpcUrl: rpcUrl, sourceAddress: '', sourcePreset: 'custom' },
    ]);
    onAddHighlight();
  };

  const applySourcePreset = (change: UiCodeChange, presetKey: string) => {
    if (presetKey === 'custom') {
      updateCode(change.id, { sourcePreset: 'custom', storage: undefined });
      return;
    }
    const preset = SOURCE_CONTRACT_PRESETS.find((item) => item.key === presetKey);
    const details = SOURCE_PRESET_DETAILS[presetKey];
    if (!preset || !details) return;
    updateCode(change.id, {
      sourcePreset: preset.key,
      sourceAddress: preset.address,
      // Bundled artifact bytecode — no dependency on the source chain having
      // the contract deployed.
      code: details.code,
      storage: details.storage?.(walletAddress),
      // Predeploys live at the same canonical address on every chain, so
      // default the injection target to it when the user hasn't set one.
      ...(change.address ? {} : { address: preset.address }),
    });
  };

  const updateBalance = (id: string, patch: Partial<BalanceChange>) =>
    setBalanceChanges((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  const updateCode = (id: string, patch: Partial<UiCodeChange>) =>
    setCodeChanges((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));

  const fetchCode = async (change: UiCodeChange) => {
    updateCode(change.id, { isFetching: true });
    const promise = (async () => {
      const response = await fetch('/api/console/l1-upgrade/code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rpcUrl: change.sourceRpcUrl, address: change.sourceAddress }),
      });
      const data = (await response.json()) as { code?: string; error?: string };
      if (!response.ok || !data.code) throw new Error(data.error ?? 'Failed to fetch bytecode.');
      return data.code;
    })();
    notify({ name: 'Runtime Bytecode Fetch', type: 'local' }, promise);
    try {
      const code = await promise;
      // Fetched on-chain code replaces any preset artifact, so preset storage
      // no longer applies.
      updateCode(change.id, { code, storage: undefined, isFetching: false });
    } catch {
      updateCode(change.id, { isFetching: false });
    }
  };

  const generalErrors = validationErrors.filter(
    (error) => error.includes('balance-change') || error.includes('Balance change') || error.includes('bytecode'),
  );

  return (
    <SectionWrapper
      title="State Upgrades"
      titleTooltip="Add native token balances or replace account runtime bytecode at the activation timestamp. Storage-slot editing is intentionally not part of this v1 UI."
      sectionId="stateUpgrades"
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="w-auto"
            icon={<Plus className="h-4 w-4" />}
            onClick={addBalance}
          >
            Add Balance Change
          </Button>
          <Button size="sm" variant="outline" className="w-auto" icon={<Plus className="h-4 w-4" />} onClick={addCode}>
            Add Bytecode Change
          </Button>
        </div>

        {balanceChanges.map((change) => (
          <div key={change.id} className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-3">
            <div className="flex items-center justify-between gap-3 mb-3">
              <h4 className="text-sm font-medium">Balance change</h4>
              <Button
                size="sm"
                variant="outline"
                className="w-auto"
                icon={<Trash2 className="h-4 w-4" />}
                onClick={() => setBalanceChanges((prev) => prev.filter((item) => item.id !== change.id))}
              >
                Remove
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-3">
              <Input
                label="Account Address"
                value={change.address}
                onChange={(address) => updateBalance(change.id, { address })}
                placeholder="0x..."
                error={
                  change.address && !isValidAddress(change.address)
                    ? `Invalid balance-change address: ${change.address}`
                    : null
                }
              />
              <Input
                label="Amount to Add"
                value={change.amount}
                onChange={(amount) => updateBalance(change.id, { amount })}
                helperText="Wei amount as decimal or hex. Adds to the balance; it does not set an absolute balance."
                error={
                  change.amount && !isPositiveAmount(change.amount)
                    ? `Balance change for ${change.address || 'an address'} must be positive.`
                    : null
                }
              />
            </div>
          </div>
        ))}

        {codeChanges.map((change) => (
          <div key={change.id} className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-3">
            <div className="flex items-center justify-between gap-3 mb-3">
              <h4 className="text-sm font-medium">Runtime bytecode change</h4>
              <Button
                size="sm"
                variant="outline"
                className="w-auto"
                icon={<Trash2 className="h-4 w-4" />}
                onClick={() => setCodeChanges((prev) => prev.filter((item) => item.id !== change.id))}
              >
                Remove
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-3">
              <Input
                label="Target Account"
                value={change.address}
                onChange={(address) => updateCode(change.id, { address })}
                placeholder="0x..."
                error={
                  change.address && !isValidAddress(change.address)
                    ? `Invalid bytecode target address: ${change.address}`
                    : null
                }
              />
              <div className="mb-4">
                <Select
                  label="Source Contract"
                  value={change.sourcePreset ?? 'custom'}
                  onChange={(value) => applySourcePreset(change, String(value))}
                  options={[
                    { value: 'custom', label: 'Custom address…' },
                    ...SOURCE_CONTRACT_PRESETS.map((preset) => ({ value: preset.key, label: preset.name })),
                  ]}
                  notesUnderInput="Presets fill the canonical address and bundled bytecode — no fetch needed."
                />
              </div>
              <Input
                label="Source Contract Address"
                value={change.sourceAddress}
                onChange={(sourceAddress) => updateCode(change.id, { sourceAddress, sourcePreset: 'custom' })}
                placeholder="0x..."
                helperText={
                  change.sourcePreset && change.sourcePreset !== 'custom'
                    ? `${SOURCE_CONTRACT_PRESETS.find((preset) => preset.key === change.sourcePreset)?.name} canonical address.`
                    : 'Optional: fetch runtime bytecode from an already deployed contract.'
                }
                error={
                  change.sourceAddress && !isValidAddress(change.sourceAddress)
                    ? `Invalid source contract address: ${change.sourceAddress}`
                    : null
                }
              />
              {/* Presets already carry bundled runtime bytecode, so fetching
                  from a source chain is unnecessary — and 404s for predeploys
                  the chain doesn't have at their canonical address. Only show
                  the RPC fetch controls for the custom path. */}
              {change.sourcePreset === 'custom' && (
                <>
                  <Input
                    label="Source RPC URL"
                    value={change.sourceRpcUrl}
                    onChange={(sourceRpcUrl) => updateCode(change.id, { sourceRpcUrl })}
                    placeholder="https://..."
                  />
                  <div className="md:pt-7">
                    <Button
                      size="sm"
                      variant="secondary"
                      className="w-auto"
                      loading={change.isFetching}
                      icon={<RotateCw className="h-4 w-4" />}
                      onClick={() => void fetchCode(change)}
                    >
                      Fetch Code
                    </Button>
                  </div>
                </>
              )}
            </div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Runtime Bytecode</label>
            <textarea
              value={change.code}
              onChange={(event) => updateCode(change.id, { code: event.target.value, storage: undefined })}
              className="w-full min-h-28 px-4 py-3 bg-zinc-900 dark:bg-zinc-950 text-zinc-100 rounded-lg border border-zinc-700 dark:border-zinc-800 font-mono text-xs resize-y focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              spellCheck={false}
              placeholder="0x..."
            />
            {change.code && !isValidRuntimeBytecode(change.code) && (
              <p className="text-xs text-red-600 dark:text-red-400 mt-2">
                Runtime bytecode for {change.address || 'an address'} must be non-empty 0x-prefixed hex bytecode.
              </p>
            )}
            {change.sourcePreset !== 'custom' && SOURCE_PRESET_DETAILS[change.sourcePreset]?.note && (
              <p className="text-xs text-muted-foreground mt-2">{SOURCE_PRESET_DETAILS[change.sourcePreset].note}</p>
            )}
            {change.storage && Object.keys(change.storage).length > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                Includes {Object.keys(change.storage).length} storage slot initialization
                {Object.keys(change.storage).length === 1 ? '' : 's'} (visible in the JSON preview).
              </p>
            )}
          </div>
        ))}

        {balanceChanges.length === 0 && codeChanges.length === 0 && (
          <p className="text-sm text-muted-foreground">No state upgrades added.</p>
        )}
        {generalErrors.map((error) => (
          <p key={error} className="text-xs text-red-600 dark:text-red-400">
            {error}
          </p>
        ))}
      </div>
    </SectionWrapper>
  );
}

function SelfHostedInstructions({
  blockchainId,
  rpcUrl,
  upgradeJson,
}: {
  blockchainId: string;
  rpcUrl: string;
  upgradeJson: string;
}) {
  const command = `mkdir -p ~/.avalanchego/configs/chains/${blockchainId}
cat > ~/.avalanchego/configs/chains/${blockchainId}/upgrade.json << 'EOF'
${upgradeJson}
EOF

# Restart the node so AvalancheGo loads upgrade.json.
# Use the command that matches your setup:
docker compose restart
# or:
docker restart avago

# Verify the node loaded the upgrade config:
curl --location --request POST '${rpcUrl || '<RPC_URL>'}' \\
  --header 'Content-Type: application/json' \\
  --data-raw '{"jsonrpc":"2.0","id":1,"method":"eth_getChainConfig","params":[]}'`;

  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4 space-y-3">
      <div>
        <h3 className="text-sm font-semibold">Self-hosted node commands</h3>
        <p className="text-xs text-muted-foreground mt-1">
          Run these on every validator node that must participate in the upgrade.
        </p>
      </div>
      <DynamicCodeBlock lang="bash" code={command} />
    </div>
  );
}

function selectionToAddressRoles(selection: PrecompileSelection): AddressRoles {
  return {
    Admin: addressesToEntries(selection.adminAddresses ?? [], 'Admin'),
    Manager: addressesToEntries(selection.managerAddresses ?? [], 'Manager'),
    Enabled: addressesToEntries(selection.enabledAddresses ?? [], 'Enabled'),
  };
}

function addressRolesToSelectionPatch(addresses: AddressRoles): Partial<PrecompileSelection> {
  return {
    adminAddresses: entriesToAddresses(addresses.Admin),
    managerAddresses: entriesToAddresses(addresses.Manager),
    enabledAddresses: entriesToAddresses(addresses.Enabled),
  };
}

function addressesToEntries(addresses: string[], role: Role): AddressEntry[] {
  return addresses.map((address, index) => ({
    id: `${role}-${address.toLowerCase()}-${index}`,
    address,
    error: isValidAddress(address) ? undefined : 'Invalid Ethereum address format',
  }));
}

function entriesToAddresses(entries: AddressEntry[]): string[] {
  return entries.map((entry) => entry.address).filter(Boolean);
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-muted-foreground">{label}</div>
      <div className="font-mono break-all text-zinc-900 dark:text-zinc-100">{value}</div>
    </div>
  );
}

function UpgradeJsonBuilder(_props: BaseConsoleToolProps) {
  return (
    <GenesisHighlightProvider>
      <UpgradeJsonBuilderInner />
    </GenesisHighlightProvider>
  );
}

export { UpgradeJsonBuilder };
export default withConsoleToolMetadata(UpgradeJsonBuilder, metadata);
