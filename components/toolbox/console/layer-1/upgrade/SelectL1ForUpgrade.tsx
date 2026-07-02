'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import SelectSubnet, { type SubnetSelection } from '@/components/toolbox/components/SelectSubnet';
import { Input } from '@/components/toolbox/components/Input';
import { Select } from '@/components/toolbox/components/Select';
import {
  BaseConsoleToolProps,
  ConsoleToolMetadata,
  withConsoleToolMetadata,
} from '@/components/toolbox/components/WithConsoleToolMetadata';
import { WalletRequirementsConfigKey } from '@/components/toolbox/hooks/useWalletRequirements';
import { generateConsoleToolGitHubUrl } from '@/components/toolbox/utils/githubUrl';
import { useL1UpgradeStore } from '@/components/toolbox/stores/l1UpgradeStore';
import { useL1ListStore, type L1ListItem } from '@/components/toolbox/stores/l1ListStore';
import { useCreateChainStore } from '@/components/toolbox/stores/createChainStore';
import { useMyL1s, type MyL1 } from '@/hooks/useMyL1s';
import { validateL1UpgradeSelection } from '@/lib/console/l1-upgrade-selection';

const metadata: ConsoleToolMetadata = {
  title: 'Select L1',
  description: (
    <>
      Choose the{' '}
      <Link href="/docs/avalanche-l1s" className="text-primary hover:underline">
        Avalanche L1
      </Link>{' '}
      you want to upgrade. Post-launch{' '}
      <Link href="/docs/avalanche-l1s/upgrade/precompile-upgrades" className="text-primary hover:underline">
        precompile and state upgrades
      </Link>{' '}
      are configured per chain via an <code className="text-xs">upgrade.json</code> file loaded by every validator
      node.
    </>
  ),
  toolRequirements: [WalletRequirementsConfigKey.WalletConnected],
  githubUrl: generateConsoleToolGitHubUrl(import.meta.url),
};

type SubnetBlockchain = {
  blockchainId: string;
  blockchainName?: string;
  vmId?: string;
  evmChainId?: number;
  subnetId?: string;
};

type BlockchainOption = {
  blockchainId: string;
  name: string;
  rpcUrl: string;
  source: 'subnet' | 'wallet' | 'managed' | 'created';
};

function SelectL1ForUpgradeInner() {
  const store = useL1UpgradeStore();
  const setSelection = store((state) => state.setSelection);
  const selectedSubnetId = store((state) => state.subnetId);
  const selectedBlockchainId = store((state) => state.blockchainId);
  const selectedRpcUrl = store((state) => state.rpcUrl);
  const selectedChainName = store((state) => state.chainName);
  const selectedIsManaged = store((state) => state.isManaged);
  const selected = useMemo(
    () => ({
      subnetId: selectedSubnetId,
      blockchainId: selectedBlockchainId,
      rpcUrl: selectedRpcUrl,
      chainName: selectedChainName,
      isManaged: selectedIsManaged,
    }),
    [selectedBlockchainId, selectedChainName, selectedIsManaged, selectedRpcUrl, selectedSubnetId],
  );

  const searchParams = useSearchParams();
  const { l1List } = useL1ListStore()();
  const createChainStore = useCreateChainStore();
  const createdSubnetId = createChainStore((state) => state.subnetId);
  const createdBlockchainId = createChainStore((state) => state.chainID);
  const createdChainName = createChainStore((state) => state.chainName);

  const { l1s: managedL1s, isLoading: isLoadingManaged } = useMyL1s();
  const [subnet, setSubnet] = useState<SubnetSelection['subnet']>(null);
  const [subnetId, setSubnetId] = useState(selected.subnetId);
  const [blockchainId, setBlockchainId] = useState(selected.blockchainId);
  const [rpcUrl, setRpcUrl] = useState(selected.rpcUrl);
  const [chainName, setChainName] = useState(selected.chainName);
  const [isManagedHint, setIsManagedHint] = useState(selected.isManaged);
  const lastAppliedOptionIdRef = useRef('');
  const lastQueryKeyRef = useRef('');

  const querySelection = useMemo(() => {
    const subnetIdParam = searchParams.get('subnetId');
    const blockchainIdParam = searchParams.get('blockchainId');
    const rpcUrlParam = searchParams.get('rpcUrl');
    const chainNameParam = searchParams.get('chainName');
    const isManagedParam = searchParams.get('isManaged') === 'true';
    if (!subnetIdParam && !blockchainIdParam && !rpcUrlParam && !chainNameParam) return null;
    return {
      subnetId: subnetIdParam,
      blockchainId: blockchainIdParam,
      rpcUrl: rpcUrlParam,
      chainName: chainNameParam,
      isManaged: isManagedParam,
    };
  }, [searchParams]);

  useEffect(() => {
    if (!querySelection) return;
    const queryKey = JSON.stringify(querySelection);
    if (queryKey === lastQueryKeyRef.current) return;
    lastQueryKeyRef.current = queryKey;

    setSubnetId(querySelection.subnetId ?? '');
    setBlockchainId(querySelection.blockchainId ?? '');
    setRpcUrl(querySelection.rpcUrl ?? '');
    setChainName(querySelection.chainName ?? '');
    setIsManagedHint(querySelection.isManaged);
  }, [querySelection]);

  const walletL1s = l1List as L1ListItem[];

  const blockchainOptions = useMemo(() => {
    const byId = new Map<string, BlockchainOption>();
    const add = (option: BlockchainOption) => {
      const existing = byId.get(option.blockchainId);
      byId.set(option.blockchainId, {
        ...existing,
        ...option,
        rpcUrl: option.rpcUrl || existing?.rpcUrl || '',
        name: option.name || existing?.name || option.blockchainId.slice(0, 8),
      });
    };

    const subnetBlockchains = (subnet?.blockchains ?? []) as SubnetBlockchain[];
    for (const blockchain of subnetBlockchains) {
      if (!blockchain.blockchainId) continue;
      add({
        blockchainId: blockchain.blockchainId,
        name: blockchain.blockchainName || blockchain.blockchainId.slice(0, 8),
        rpcUrl: '',
        source: 'subnet',
      });
    }

    for (const l1 of walletL1s) {
      if (!l1.id || l1.subnetId !== subnetId) continue;
      add({ blockchainId: l1.id, name: l1.name, rpcUrl: l1.rpcUrl, source: 'wallet' });
    }

    for (const l1 of managedL1s) {
      if (!l1.blockchainId || l1.subnetId !== subnetId) continue;
      add({ blockchainId: l1.blockchainId, name: l1.chainName, rpcUrl: l1.rpcUrl, source: 'managed' });
    }

    if (createdSubnetId === subnetId && createdBlockchainId) {
      add({
        blockchainId: createdBlockchainId,
        name: createdChainName || createdBlockchainId.slice(0, 8),
        rpcUrl: '',
        source: 'created',
      });
    }

    return Array.from(byId.values());
  }, [createdBlockchainId, createdChainName, createdSubnetId, managedL1s, subnet, subnetId, walletL1s]);

  const selectedOption = blockchainOptions.find((option) => option.blockchainId === blockchainId);

  const managedMatch = managedL1s.find((l1: MyL1) => l1.subnetId === subnetId && l1.blockchainId === blockchainId);
  const managedNodeCount = managedMatch?.nodes.filter((node) => node.status === 'active').length ?? 0;
  const isManaged = managedNodeCount > 0 || (isManagedHint && Boolean(subnetId && blockchainId));

  const selectionErrors = useMemo(
    () => validateL1UpgradeSelection({ subnetId, blockchainId, rpcUrl, chainName }),
    [blockchainId, chainName, rpcUrl, subnetId],
  );
  const hasValidSelection = selectionErrors.length === 0;
  const subnetError = selectionErrors.find((error) => error.startsWith('Subnet ID')) ?? null;
  const blockchainError = selectionErrors.find((error) => error.startsWith('Blockchain ID')) ?? null;
  const rpcError = selectionErrors.find((error) => error.startsWith('RPC URL')) ?? null;
  const chainNameError = selectionErrors.find((error) => error.startsWith('Chain name')) ?? null;

  const handleSubnetChange = useCallback(
    (selection: SubnetSelection) => {
      const nextSubnetId = selection.subnetId;
      setSubnetId(nextSubnetId);
      setSubnet(selection.subnet);

      const subnetBlockchains = (selection.subnet?.blockchains ?? []) as SubnetBlockchain[];
      const walletMatch = walletL1s.find((l1) => l1.subnetId === nextSubnetId);
      const managedMatch = managedL1s.find((l1: MyL1) => l1.subnetId === nextSubnetId);
      const createdMatch =
        createdSubnetId === nextSubnetId && createdBlockchainId
          ? { blockchainId: createdBlockchainId, chainName: createdChainName }
          : null;
      const firstChain = subnetBlockchains[0];
      const nextBlockchainId =
        walletMatch?.id || managedMatch?.blockchainId || createdMatch?.blockchainId || firstChain?.blockchainId || '';

      setBlockchainId(nextBlockchainId);
      setRpcUrl(walletMatch?.rpcUrl || managedMatch?.rpcUrl || '');
      setChainName(
        walletMatch?.name || managedMatch?.chainName || createdMatch?.chainName || firstChain?.blockchainName || '',
      );
      setIsManagedHint(Boolean(managedMatch));
      lastAppliedOptionIdRef.current = nextBlockchainId;
    },
    [createdBlockchainId, createdChainName, createdSubnetId, managedL1s, walletL1s],
  );

  useEffect(() => {
    if (!subnetId || blockchainId || blockchainOptions.length === 0) return;
    const option = blockchainOptions[0];
    setBlockchainId(option.blockchainId);
    setRpcUrl(option.rpcUrl);
    setChainName(option.name);
    setIsManagedHint(option.source === 'managed');
    lastAppliedOptionIdRef.current = option.blockchainId;
  }, [blockchainId, blockchainOptions, subnetId]);

  useEffect(() => {
    if (!selectedOption) {
      lastAppliedOptionIdRef.current = '';
      return;
    }
    const optionSignature = `${selectedOption.blockchainId}|${selectedOption.rpcUrl}|${selectedOption.name}|${selectedOption.source}`;
    if (lastAppliedOptionIdRef.current === optionSignature) return;
    setRpcUrl(selectedOption.rpcUrl);
    setChainName(selectedOption.name);
    setIsManagedHint(selectedOption.source === 'managed');
    lastAppliedOptionIdRef.current = optionSignature;
  }, [selectedOption]);

  useEffect(() => {
    if (!hasValidSelection) {
      setSelection({
        subnetId: '',
        blockchainId: '',
        rpcUrl: '',
        chainName: '',
        isManaged: false,
        managedNodeCount: 0,
      });
      return;
    }
    setSelection({
      subnetId: subnetId.trim(),
      blockchainId: blockchainId.trim(),
      rpcUrl: rpcUrl.trim(),
      chainName: chainName.trim() || selectedOption?.name || blockchainId.trim().slice(0, 8),
      isManaged,
      managedNodeCount,
    });
  }, [
    blockchainId,
    chainName,
    hasValidSelection,
    isManaged,
    managedNodeCount,
    rpcUrl,
    selectedOption?.name,
    setSelection,
    subnetId,
  ]);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px] gap-5">
      <div className="space-y-5 min-w-0">
        <SelectSubnet
          value={subnetId}
          onChange={handleSubnetChange}
          error={subnetError || blockchainError}
          hidePrimaryNetwork
          hideDetails
        />

        {blockchainOptions.length > 1 && (
          <Select
            label="Blockchain"
            value={blockchainId}
            onChange={(value) => setBlockchainId(String(value))}
            options={blockchainOptions.map((option) => ({
              value: option.blockchainId,
              label: `${option.name} (${option.blockchainId.slice(0, 10)}…)`,
            }))}
            notesUnderInput="This subnet has multiple chains. Pick the one to upgrade."
          />
        )}

        <Input
          label="RPC URL"
          value={rpcUrl}
          onChange={setRpcUrl}
          placeholder="https://..."
          error={rpcError}
          helperText={
            rpcError
              ? undefined
              : "Used to read the L1's active precompile rules and latest block timestamp. You can replace the auto-filled RPC with your own node's RPC."
          }
        />
        <Input
          label="Chain Name"
          value={chainName}
          onChange={setChainName}
          placeholder="Optional display name"
          error={chainNameError}
        />
      </div>

      <aside className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4 h-fit">
        <div className="flex items-center gap-2 mb-4">
          <ShieldCheck className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Current Selection</h3>
        </div>
        {subnetId && blockchainId ? (
          <div className="space-y-2 text-xs">
            <InfoRow label="Subnet ID" value={subnetId} />
            <InfoRow label="Blockchain ID" value={blockchainId} />
            <InfoRow label="RPC URL" value={rpcUrl || 'Not set'} />
            <InfoRow
              label="Node type"
              value={isManaged ? `Managed (${managedNodeCount} active)` : 'Self-hosted/manual'}
            />
            {isLoadingManaged && <p className="text-xs text-muted-foreground">Checking managed node status...</p>}
            {!hasValidSelection && (
              <div className="rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 p-3 text-xs text-red-700 dark:text-red-300 space-y-1">
                {selectionErrors.map((error) => (
                  <p key={error}>{error}</p>
                ))}
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Select a Subnet before continuing.</p>
        )}
      </aside>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-muted-foreground">{label}</div>
      <div className="font-mono break-all text-zinc-900 dark:text-zinc-100">{value}</div>
    </div>
  );
}

function SelectL1ForUpgrade(_props: BaseConsoleToolProps) {
  // useSearchParams requires a Suspense boundary (same pattern as the
  // Create L1 entry page, which wraps its search-param consumer).
  return (
    <Suspense fallback={null}>
      <SelectL1ForUpgradeInner />
    </Suspense>
  );
}

export { SelectL1ForUpgrade };
export default withConsoleToolMetadata(SelectL1ForUpgrade, metadata);
