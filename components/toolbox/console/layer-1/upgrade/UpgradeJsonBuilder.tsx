'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  Download,
  FileJson,
  Plus,
  RotateCw,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/toolbox/components/Button';
import { Input } from '@/components/toolbox/components/Input';
import { RawInput } from '@/components/toolbox/components/Input';
import { SyntaxHighlightedJSON } from '@/components/toolbox/components/genesis/SyntaxHighlightedJSON';
import { useL1UpgradeStore } from '@/components/toolbox/stores/l1UpgradeStore';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils';
import {
  BalanceChange,
  buildUpgradeJson,
  CodeChange,
  emptyUpgradeJson,
  formatUpgradeJson,
  getMaxConfiguredTimestamp,
  parseUpgradeJson,
  PRECOMPILE_DEFINITIONS,
  PrecompileConfigKey,
  PrecompileMode,
  PrecompileSelection,
  splitAddressList,
  validateUpgradePlan,
} from '@/lib/console/upgrade-json';

type RpcCheckResponse = {
  chainConfig: unknown | null;
  activeRules: { precompiles?: Record<string, unknown> } | null;
  errors?: {
    chainConfig?: string | null;
    activeRules?: string | null;
  };
};

type SnapshotResponse = {
  snapshot?: {
    upgrade_json?: unknown;
    updated_at?: string;
    status?: string;
  } | null;
};

type ManagedFetchResponse = {
  managed: boolean;
  exists: boolean;
  upgradeJson: unknown | null;
  nodes?: Array<{ id: string; nodeIndex: number | null; nodeId: string }>;
};

type UiCodeChange = CodeChange & {
  sourceRpcUrl: string;
  sourceAddress: string;
  isFetching?: boolean;
};

const DEFAULT_TIMESTAMP_OFFSET_SECONDS = 10 * 60;

function makeInitialPrecompiles(): PrecompileSelection[] {
  return PRECOMPILE_DEFINITIONS.map((definition) => ({
    key: definition.key,
    mode: 'none' as PrecompileMode,
    quorumNumerator: definition.key === 'warpConfig' ? 67 : undefined,
    requirePrimaryNetworkSigners: definition.key === 'warpConfig' ? true : undefined,
  }));
}

export default function UpgradeJsonBuilder() {
  const store = useL1UpgradeStore();
  const selectedSubnetId = store((state) => state.subnetId);
  const selectedBlockchainId = store((state) => state.blockchainId);
  const selectedRpcUrl = store((state) => state.rpcUrl);
  const selectedChainName = store((state) => state.chainName);
  const selectedIsManaged = store((state) => state.isManaged);
  const selectedManagedNodeCount = store((state) => state.managedNodeCount);
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
  const [rpcCheck, setRpcCheck] = useState<RpcCheckResponse | null>(null);
  const [rpcError, setRpcError] = useState<string | null>(null);
  const [managedInfo, setManagedInfo] = useState<ManagedFetchResponse | null>(null);
  const [precompiles, setPrecompiles] = useState<PrecompileSelection[]>(makeInitialPrecompiles);
  const [activationTimestamp, setActivationTimestamp] = useState(() =>
    Math.floor(Date.now() / 1000) + DEFAULT_TIMESTAMP_OFFSET_SECONDS,
  );
  const [balanceChanges, setBalanceChanges] = useState<BalanceChange[]>([]);
  const [codeChanges, setCodeChanges] = useState<UiCodeChange[]>([]);
  const [isSavingSnapshot, setIsSavingSnapshot] = useState(false);
  const [isWritingManaged, setIsWritingManaged] = useState(false);
  const [isRestartingManaged, setIsRestartingManaged] = useState(false);
  const [managedWritten, setManagedWritten] = useState(false);

  const parsedBase = useMemo(() => parseUpgradeJson(baseText), [baseText]);
  const baseConfig = parsedBase.config ?? emptyUpgradeJson();
  const latestExistingTimestamp = getMaxConfiguredTimestamp(baseConfig);

  const planInput = useMemo(
    () => ({
      baseConfig,
      activationTimestamp,
      precompiles,
      balanceChanges,
      codeChanges: codeChanges.map(({ id, address, code }) => ({ id, address, code })),
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

  useEffect(() => {
    if (!selection.subnetId || !selection.blockchainId) return;
    let cancelled = false;

    async function loadInitialState() {
      setIsLoadingSource(true);
      setRpcError(null);
      setManagedWritten(false);
      try {
        const [snapshotResult, managedResult, rpcResult] = await Promise.allSettled([
          fetch(
            `/api/console/l1-upgrade/snapshot?subnetId=${encodeURIComponent(selection.subnetId)}&blockchainId=${encodeURIComponent(selection.blockchainId)}`,
          ),
          selection.isManaged
            ? fetch(
                `/api/console/l1-upgrade/managed?subnetId=${encodeURIComponent(selection.subnetId)}&blockchainId=${encodeURIComponent(selection.blockchainId)}`,
              )
            : Promise.resolve(null),
          selection.rpcUrl
            ? fetch('/api/console/l1-upgrade/rpc', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rpcUrl: selection.rpcUrl }),
              })
            : Promise.resolve(null),
        ]);

        if (cancelled) return;

        let snapshot: SnapshotResponse | null = null;
        if (snapshotResult.status === 'fulfilled' && snapshotResult.value?.ok) {
          snapshot = (await snapshotResult.value.json()) as SnapshotResponse;
        }

        let managed: ManagedFetchResponse | null = null;
        if (managedResult.status === 'fulfilled' && managedResult.value?.ok) {
          managed = (await managedResult.value.json()) as ManagedFetchResponse;
          setManagedInfo(managed);
        } else {
          setManagedInfo(null);
        }

        if (rpcResult.status === 'fulfilled' && rpcResult.value) {
          if (rpcResult.value.ok) {
            setRpcCheck((await rpcResult.value.json()) as RpcCheckResponse);
          } else {
            const data = (await rpcResult.value.json().catch(() => null)) as { error?: string } | null;
            setRpcError(data?.error ?? 'RPC check failed.');
            setRpcCheck(null);
          }
        } else {
          setRpcCheck(null);
        }

        if (managed?.exists && managed.upgradeJson) {
          setBaseText(formatUpgradeJson(managed.upgradeJson as Record<string, unknown>));
          setBaseSource('managed node');
        } else if (snapshot?.snapshot?.upgrade_json) {
          setBaseText(formatUpgradeJson(snapshot.snapshot.upgrade_json as Record<string, unknown>));
          setBaseSource(`Builder Hub snapshot${snapshot.snapshot.status ? ` (${snapshot.snapshot.status})` : ''}`);
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
  }, [selection.blockchainId, selection.isManaged, selection.rpcUrl, selection.subnetId]);

  useEffect(() => {
    if (latestExistingTimestamp > 0 && activationTimestamp <= latestExistingTimestamp) {
      setActivationTimestamp(latestExistingTimestamp + DEFAULT_TIMESTAMP_OFFSET_SECONDS);
    }
  }, [activationTimestamp, latestExistingTimestamp]);

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

  const hasGeneratedChanges =
    precompiles.some((precompile) => precompile.mode !== 'none') ||
    balanceChanges.length > 0 ||
    codeChanges.length > 0;

  const canWriteManaged = selection.isManaged && validation.valid && !parsedBase.error;

  const handleImportFile = async (file: File | null) => {
    if (!file) return;
    const text = await file.text();
    const parsed = parseUpgradeJson(text);
    if (parsed.error) {
      toast.error('Invalid upgrade.json', parsed.error, { id: 'upgrade-json-import' });
      return;
    }
    setBaseText(text);
    setBaseSource(file.name);
  };

  const saveSnapshot = async (status = 'draft') => {
    setIsSavingSnapshot(true);
    try {
      const response = await fetch('/api/console/l1-upgrade/snapshot', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subnetId: selection.subnetId,
          blockchainId: selection.blockchainId,
          chainName: selection.chainName,
          rpcUrl: selection.rpcUrl,
          upgradeJson: generatedConfig,
          source: 'builder',
          status,
        }),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(data?.message ?? 'Failed to save snapshot.');
      }
      toast.success('Snapshot saved', undefined, { id: 'upgrade-json-snapshot' });
    } catch (error) {
      toast.error('Could not save snapshot', error instanceof Error ? error.message : undefined, {
        id: 'upgrade-json-snapshot',
      });
    } finally {
      setIsSavingSnapshot(false);
    }
  };

  const writeManaged = async () => {
    setIsWritingManaged(true);
    try {
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
      setManagedWritten(true);
      toast.success('upgrade.json written', 'Review restart timing before applying it.', { id: 'managed-write' });
    } catch (error) {
      toast.error('Managed write failed', error instanceof Error ? error.message : undefined, { id: 'managed-write' });
    } finally {
      setIsWritingManaged(false);
    }
  };

  const restartManaged = async () => {
    setIsRestartingManaged(true);
    try {
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
      await saveSnapshot('restart-requested');
      toast.success('Restart requested', 'Verify the loaded config after nodes come back.', { id: 'managed-restart' });
    } catch (error) {
      toast.error('Restart failed', error instanceof Error ? error.message : undefined, { id: 'managed-restart' });
    } finally {
      setIsRestartingManaged(false);
    }
  };

  const downloadJson = () => {
    const blob = new Blob([generatedJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'upgrade.json';
    link.click();
    URL.revokeObjectURL(url);
  };

  const copyJson = async () => {
    try {
      await navigator.clipboard.writeText(generatedJson);
      toast.success('upgrade.json copied', undefined, { id: 'upgrade-json-copy' });
    } catch (error) {
      toast.error('Could not copy', error instanceof Error ? error.message : undefined, { id: 'upgrade-json-copy' });
    }
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(520px,640px)] gap-5 items-start">
        <div className="space-y-5 min-w-0">
          <HeaderPanel
            chainName={selection.chainName}
            subnetId={selection.subnetId}
            blockchainId={selection.blockchainId}
            rpcUrl={selection.rpcUrl}
            isManaged={selection.isManaged}
            managedNodeCount={managedInfo?.nodes?.length ?? selection.managedNodeCount}
            rpcError={rpcError}
            activePrecompileKeys={activePrecompileKeys}
            chainConfigError={rpcCheck?.errors?.chainConfig ?? null}
            activeRulesError={rpcCheck?.errors?.activeRules ?? null}
          />

          <section className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-sm font-semibold">Existing upgrade.json</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Source: {isLoadingSource ? 'loading...' : baseSource}. Existing entries are preserved and new entries are appended.
                </p>
              </div>
              <label className="inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-xs font-medium cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900">
                <FileJson className="h-4 w-4" />
                Import file
                <input
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  onChange={(event) => void handleImportFile(event.target.files?.[0] ?? null)}
                />
              </label>
            </div>
            <textarea
              value={baseText}
              onChange={(event) => {
                setBaseText(event.target.value);
                setBaseSource('custom input');
              }}
              className="w-full min-h-40 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-950 text-zinc-100 p-3 font-mono text-xs resize-y focus:outline-none focus:ring-2 focus:ring-primary/30"
              spellCheck={false}
            />
            {parsedBase.error && <p className="text-xs text-red-600 dark:text-red-400 mt-2">{parsedBase.error}</p>}
            {latestExistingTimestamp > 0 && (
              <p className="text-xs text-muted-foreground mt-2">
                Latest existing upgrade timestamp: <span className="font-mono">{latestExistingTimestamp}</span>
              </p>
            )}
          </section>

          <section className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4">
            <h3 className="text-sm font-semibold mb-4">Activation timing</h3>
            <Input
              label="First new blockTimestamp"
              type="number"
              value={activationTimestamp}
              onChange={(value) => setActivationTimestamp(Number(value))}
              helperText="Multiple generated entries are scheduled one second apart from this timestamp to keep upgrade order deterministic."
            />
          </section>

          <PrecompileControls
            precompiles={precompiles}
            activePrecompileKeys={activePrecompileKeys}
            onChange={setPrecompiles}
          />

          <StateUpgradeControls
            rpcUrl={selection.rpcUrl}
            balanceChanges={balanceChanges}
            codeChanges={codeChanges}
            onBalanceChanges={setBalanceChanges}
            onCodeChanges={setCodeChanges}
          />
        </div>

        <aside className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 sticky top-4 self-start min-w-0">
          <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold">upgrade.json</h3>
              <p className="text-xs text-muted-foreground">
                {(new Blob([generatedJson]).size / 1024).toFixed(2)} KiB
              </p>
            </div>
            <div className="flex items-center gap-2">
              <IconButton label="Copy" icon={<Copy className="h-4 w-4" />} onClick={copyJson} />
              <IconButton label="Download" icon={<Download className="h-4 w-4" />} onClick={downloadJson} />
            </div>
          </div>
          <div className="max-h-[640px] overflow-auto json-preview-scroll">
            <SyntaxHighlightedJSON code={generatedJson} highlightedLine={null} />
          </div>
        </aside>
      </div>

      <ValidationPanel
        parseError={parsedBase.error}
        errors={validation.errors}
        warnings={validation.warnings}
        hasGeneratedChanges={hasGeneratedChanges}
      />

      <section className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold">Apply or export</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Managed nodes can write the file through Builder Hub. Self-hosted nodes use the commands below.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" stickLeft loading={isSavingSnapshot} onClick={() => void saveSnapshot()}>
              Save snapshot
            </Button>
            {selection.isManaged && (
              <>
                <Button
                  size="sm"
                  variant="secondary"
                  stickLeft
                  loading={isWritingManaged}
                  disabled={!canWriteManaged}
                  onClick={() => void writeManaged()}
                >
                  Write managed file
                </Button>
                <Button
                  size="sm"
                  variant="primary"
                  stickLeft
                  loading={isRestartingManaged}
                  disabled={!managedWritten}
                  onClick={() => void restartManaged()}
                >
                  Restart managed nodes
                </Button>
              </>
            )}
          </div>
        </div>
      </section>

      <SelfHostedInstructions blockchainId={selection.blockchainId} rpcUrl={selection.rpcUrl} upgradeJson={generatedJson} />
    </div>
  );
}

function HeaderPanel({
  chainName,
  subnetId,
  blockchainId,
  rpcUrl,
  isManaged,
  managedNodeCount,
  rpcError,
  activePrecompileKeys,
  chainConfigError,
  activeRulesError,
}: {
  chainName: string;
  subnetId: string;
  blockchainId: string;
  rpcUrl: string;
  isManaged: boolean;
  managedNodeCount: number;
  rpcError: string | null;
  activePrecompileKeys: string[];
  chainConfigError: string | null;
  activeRulesError: string | null;
}) {
  return (
    <section className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4">
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            {chainName || blockchainId.slice(0, 8)}
          </h2>
          <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2 text-xs">
            <InfoLine label="Subnet" value={subnetId} />
            <InfoLine label="Blockchain" value={blockchainId} />
            <InfoLine label="RPC" value={rpcUrl || 'Not set'} />
            <InfoLine label="Node type" value={isManaged ? `Managed (${managedNodeCount} active)` : 'Self-hosted/manual'} />
          </div>
        </div>
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 px-3 py-2 min-w-56">
          <div className="text-xs font-medium text-muted-foreground">Active precompiles from RPC</div>
          {activePrecompileKeys.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {activePrecompileKeys.map((key) => (
                <span key={key} className="rounded-md bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 px-2 py-1 text-[11px]">
                  {key}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground mt-2">None reported or RPC check unavailable.</p>
          )}
        </div>
      </div>
      {(rpcError || chainConfigError || activeRulesError) && (
        <div className="mt-3 rounded-lg border border-yellow-200 dark:border-yellow-900 bg-yellow-50 dark:bg-yellow-950/30 p-3 text-xs text-yellow-800 dark:text-yellow-200">
          {rpcError || chainConfigError || activeRulesError}
        </div>
      )}
    </section>
  );
}

function PrecompileControls({
  precompiles,
  activePrecompileKeys,
  onChange,
}: {
  precompiles: PrecompileSelection[];
  activePrecompileKeys: string[];
  onChange: (value: PrecompileSelection[]) => void;
}) {
  const update = (key: PrecompileConfigKey, patch: Partial<PrecompileSelection>) => {
    onChange(precompiles.map((item) => (item.key === key ? { ...item, ...patch } : item)));
  };

  return (
    <section className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4">
      <h3 className="text-sm font-semibold">Precompile upgrades</h3>
      <p className="text-xs text-muted-foreground mt-1 mb-4">
        Choose no change, enable, or disable. Enable entries can initialize role lists; disable entries clear the precompile storage when activated.
      </p>
      <div className="space-y-3">
        {PRECOMPILE_DEFINITIONS.map((definition) => {
          const value = precompiles.find((item) => item.key === definition.key)!;
          const isActive = activePrecompileKeys.includes(definition.key);
          return (
            <div key={definition.key} className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-3">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-medium">{definition.label}</h4>
                    {isActive && (
                      <span className="rounded-md bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 text-[11px]">
                        active
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{definition.description}</p>
                </div>
                <div className="grid grid-cols-3 rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden min-w-[240px]">
                  {(['none', 'enable', 'disable'] as PrecompileMode[]).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => update(definition.key, { mode })}
                      className={cn(
                        'px-3 py-2 text-xs font-medium border-r last:border-r-0 border-zinc-200 dark:border-zinc-800 transition-colors',
                        value.mode === mode
                          ? mode === 'disable'
                            ? 'bg-red-600 text-white'
                            : 'bg-primary text-primary-foreground'
                          : 'hover:bg-zinc-50 dark:hover:bg-zinc-900 text-muted-foreground',
                      )}
                    >
                      {mode === 'none' ? 'No change' : mode === 'enable' ? 'Enable' : 'Disable'}
                    </button>
                  ))}
                </div>
              </div>
              {value.mode === 'enable' && definition.supportsAllowList && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
                  <AddressListInput
                    label="Admin addresses"
                    value={value.adminAddresses ?? []}
                    onChange={(addresses) => update(definition.key, { adminAddresses: addresses })}
                  />
                  <AddressListInput
                    label="Manager addresses"
                    value={value.managerAddresses ?? []}
                    onChange={(addresses) => update(definition.key, { managerAddresses: addresses })}
                  />
                  <AddressListInput
                    label="Enabled addresses"
                    value={value.enabledAddresses ?? []}
                    onChange={(addresses) => update(definition.key, { enabledAddresses: addresses })}
                  />
                </div>
              )}
              {value.mode === 'enable' && definition.supportsWarpConfig && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                  <Input
                    label="Quorum numerator"
                    type="number"
                    value={value.quorumNumerator ?? 67}
                    onChange={(raw) => update(definition.key, { quorumNumerator: Number(raw) })}
                    helperText="Percent threshold for Warp signer quorum."
                  />
                  <label className="flex items-center gap-3 rounded-lg border border-zinc-200 dark:border-zinc-800 px-3 py-2 h-fit mt-7">
                    <input
                      type="checkbox"
                      checked={value.requirePrimaryNetworkSigners ?? true}
                      onChange={(event) =>
                        update(definition.key, { requirePrimaryNetworkSigners: event.target.checked })
                      }
                    />
                    <span className="text-sm">Require Primary Network signers</span>
                  </label>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function StateUpgradeControls({
  rpcUrl,
  balanceChanges,
  codeChanges,
  onBalanceChanges,
  onCodeChanges,
}: {
  rpcUrl: string;
  balanceChanges: BalanceChange[];
  codeChanges: UiCodeChange[];
  onBalanceChanges: (value: BalanceChange[]) => void;
  onCodeChanges: (value: UiCodeChange[]) => void;
}) {
  const addBalance = () =>
    onBalanceChanges([...balanceChanges, { id: crypto.randomUUID(), address: '', amount: '' }]);
  const addCode = () =>
    onCodeChanges([
      ...codeChanges,
      { id: crypto.randomUUID(), address: '', code: '', sourceRpcUrl: rpcUrl, sourceAddress: '' },
    ]);

  const fetchCode = async (change: UiCodeChange) => {
    onCodeChanges(codeChanges.map((item) => (item.id === change.id ? { ...item, isFetching: true } : item)));
    try {
      const response = await fetch('/api/console/l1-upgrade/code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rpcUrl: change.sourceRpcUrl, address: change.sourceAddress }),
      });
      const data = (await response.json()) as { code?: string; error?: string };
      if (!response.ok || !data.code) throw new Error(data.error ?? 'Failed to fetch bytecode.');
      onCodeChanges(
        codeChanges.map((item) => (item.id === change.id ? { ...item, code: data.code!, isFetching: false } : item)),
      );
      toast.success('Runtime bytecode loaded', undefined, { id: `fetch-code-${change.id}` });
    } catch (error) {
      onCodeChanges(codeChanges.map((item) => (item.id === change.id ? { ...item, isFetching: false } : item)));
      toast.error('Could not fetch bytecode', error instanceof Error ? error.message : undefined, {
        id: `fetch-code-${change.id}`,
      });
    }
  };

  return (
    <section className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="text-sm font-semibold">State upgrades</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Add positive balance changes or replace account runtime bytecode. Storage-slot editing is intentionally not part of this v1 UI.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" stickLeft icon={<Plus className="h-4 w-4" />} onClick={addBalance}>
            Balance
          </Button>
          <Button size="sm" variant="outline" stickLeft icon={<Plus className="h-4 w-4" />} onClick={addCode}>
            Bytecode
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        {balanceChanges.map((change) => (
          <div key={change.id} className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-3">
            <div className="flex items-center justify-between gap-3 mb-3">
              <h4 className="text-sm font-medium">Balance change</h4>
              <IconButton
                label="Remove"
                icon={<Trash2 className="h-4 w-4" />}
                onClick={() => onBalanceChanges(balanceChanges.filter((item) => item.id !== change.id))}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input
                label="Account address"
                value={change.address}
                onChange={(address) =>
                  onBalanceChanges(balanceChanges.map((item) => (item.id === change.id ? { ...item, address } : item)))
                }
              />
              <Input
                label="Amount to add"
                value={change.amount}
                onChange={(amount) =>
                  onBalanceChanges(balanceChanges.map((item) => (item.id === change.id ? { ...item, amount } : item)))
                }
                helperText="Wei amount as decimal or hex. This adds to the balance; it does not set an absolute balance."
              />
            </div>
          </div>
        ))}

        {codeChanges.map((change) => (
          <div key={change.id} className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-3">
            <div className="flex items-center justify-between gap-3 mb-3">
              <h4 className="text-sm font-medium">Runtime bytecode change</h4>
              <IconButton
                label="Remove"
                icon={<Trash2 className="h-4 w-4" />}
                onClick={() => onCodeChanges(codeChanges.filter((item) => item.id !== change.id))}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input
                label="Target account"
                value={change.address}
                onChange={(address) =>
                  onCodeChanges(codeChanges.map((item) => (item.id === change.id ? { ...item, address } : item)))
                }
              />
              <Input
                label="Source contract address"
                value={change.sourceAddress}
                onChange={(sourceAddress) =>
                  onCodeChanges(
                    codeChanges.map((item) => (item.id === change.id ? { ...item, sourceAddress } : item)),
                  )
                }
                helperText="Optional: fetch runtime bytecode from an already deployed contract."
              />
              <Input
                label="Source RPC URL"
                value={change.sourceRpcUrl}
                onChange={(sourceRpcUrl) =>
                  onCodeChanges(
                    codeChanges.map((item) => (item.id === change.id ? { ...item, sourceRpcUrl } : item)),
                  )
                }
              />
              <div className="pt-7">
                <Button
                  size="sm"
                  variant="secondary"
                  stickLeft
                  loading={change.isFetching}
                  icon={<RotateCw className="h-4 w-4" />}
                  onClick={() => void fetchCode(change)}
                >
                  Fetch code
                </Button>
              </div>
            </div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Runtime bytecode</label>
            <textarea
              value={change.code}
              onChange={(event) =>
                onCodeChanges(codeChanges.map((item) => (item.id === change.id ? { ...item, code: event.target.value } : item)))
              }
              className="w-full min-h-28 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-950 text-zinc-100 p-3 font-mono text-xs resize-y focus:outline-none focus:ring-2 focus:ring-primary/30"
              spellCheck={false}
              placeholder="0x..."
            />
          </div>
        ))}

        {balanceChanges.length === 0 && codeChanges.length === 0 && (
          <p className="text-sm text-muted-foreground">No state upgrades added.</p>
        )}
      </div>
    </section>
  );
}

function ValidationPanel({
  parseError,
  errors,
  warnings,
  hasGeneratedChanges,
}: {
  parseError: string | null;
  errors: string[];
  warnings: string[];
  hasGeneratedChanges: boolean;
}) {
  if (!parseError && errors.length === 0 && warnings.length === 0) {
    return (
      <div className="rounded-lg border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/30 p-4 flex items-start gap-3">
        <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 mt-0.5" />
        <div>
          <h3 className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">Configuration looks valid</h3>
          <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-1">
            {hasGeneratedChanges
              ? 'Review validator coordination before applying this network upgrade.'
              : 'No generated changes have been added yet.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-yellow-200 dark:border-yellow-900 bg-yellow-50 dark:bg-yellow-950/30 p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-yellow-700 dark:text-yellow-300 mt-0.5" />
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-yellow-900 dark:text-yellow-100">Review before applying</h3>
          {parseError && <p className="text-xs text-red-700 dark:text-red-300">Imported JSON: {parseError}</p>}
          {errors.map((error) => (
            <p key={error} className="text-xs text-red-700 dark:text-red-300">
              {error}
            </p>
          ))}
          {warnings.map((warning) => (
            <p key={warning} className="text-xs text-yellow-800 dark:text-yellow-200">
              {warning}
            </p>
          ))}
        </div>
      </div>
    </div>
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

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(command);
      toast.success('Commands copied', undefined, { id: 'upgrade-commands-copy' });
    } catch (error) {
      toast.error('Could not copy commands', error instanceof Error ? error.message : undefined, {
        id: 'upgrade-commands-copy',
      });
    }
  };

  return (
    <section className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
      <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Self-hosted node commands</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Run these on every validator node that must participate in the upgrade.
          </p>
        </div>
        <IconButton label="Copy commands" icon={<Copy className="h-4 w-4" />} onClick={copy} />
      </div>
      <pre className="overflow-auto p-4 bg-zinc-950 text-zinc-100 text-xs leading-relaxed font-mono">
        <code>{command}</code>
      </pre>
    </section>
  );
}

function AddressListInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string[];
  onChange: (value: string[]) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">{label}</label>
      <RawInput
        value={value.join(', ')}
        onChange={(event) => onChange(splitAddressList(event.target.value))}
        placeholder="0x..., 0x..."
        className="rounded-md"
      />
      <p className="text-xs text-muted-foreground mt-1">Comma or space separated.</p>
    </div>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-muted-foreground">{label}</div>
      <div className="font-mono break-all text-zinc-900 dark:text-zinc-100">{value}</div>
    </div>
  );
}

function IconButton({
  label,
  icon,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
    >
      {icon}
    </button>
  );
}
