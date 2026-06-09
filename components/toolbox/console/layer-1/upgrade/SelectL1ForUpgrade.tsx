'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Server, Search, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/toolbox/components/Button';
import { Input } from '@/components/toolbox/components/Input';
import InputSubnetId from '@/components/toolbox/components/InputSubnetId';
import InputChainId from '@/components/toolbox/components/InputChainId';
import { useL1UpgradeStore } from '@/components/toolbox/stores/l1UpgradeStore';
import { useL1ListStore, type L1ListItem } from '@/components/toolbox/stores/l1ListStore';
import { useCreateChainStore } from '@/components/toolbox/stores/createChainStore';
import { cn } from '@/lib/utils';

type ManagedL1 = {
  subnetId: string;
  blockchainId: string;
  chainName: string;
  rpcUrl: string;
  status: 'active' | 'expired';
  nodes: Array<{ id: string; status: string }>;
};

export default function SelectL1ForUpgrade() {
  const store = useL1UpgradeStore();
  const setSelection = store((state) => state.setSelection);
  const selected = store((state) => ({
    subnetId: state.subnetId,
    blockchainId: state.blockchainId,
    rpcUrl: state.rpcUrl,
    chainName: state.chainName,
    isManaged: state.isManaged,
  }));
  const searchParams = useSearchParams();
  const { l1List } = useL1ListStore()();
  const createChainStore = useCreateChainStore();
  const createdSubnetId = createChainStore((state) => state.subnetId);
  const createdBlockchainId = createChainStore((state) => state.chainID);
  const createdChainName = createChainStore((state) => state.chainName);

  const [managedL1s, setManagedL1s] = useState<ManagedL1[]>([]);
  const [isLoadingManaged, setIsLoadingManaged] = useState(false);
  const [manualSubnetId, setManualSubnetId] = useState(selected.subnetId);
  const [manualBlockchainId, setManualBlockchainId] = useState(selected.blockchainId);
  const [manualRpcUrl, setManualRpcUrl] = useState(selected.rpcUrl);
  const [manualChainName, setManualChainName] = useState(selected.chainName);

  const querySelection = useMemo(() => {
    const subnetId = searchParams.get('subnetId');
    const blockchainId = searchParams.get('blockchainId');
    const rpcUrl = searchParams.get('rpcUrl');
    const chainName = searchParams.get('chainName');
    const isManaged = searchParams.get('isManaged') === 'true';
    if (!subnetId && !blockchainId && !rpcUrl && !chainName) return null;
    return { subnetId, blockchainId, rpcUrl, chainName, isManaged };
  }, [searchParams]);

  useEffect(() => {
    if (!querySelection) return;
    const nextSelection = {
      subnetId: querySelection.subnetId ?? selected.subnetId,
      blockchainId: querySelection.blockchainId ?? selected.blockchainId,
      rpcUrl: querySelection.rpcUrl ?? selected.rpcUrl,
      chainName: querySelection.chainName ?? selected.chainName,
      isManaged: querySelection.isManaged,
    };
    if (
      selected.subnetId !== nextSelection.subnetId ||
      selected.blockchainId !== nextSelection.blockchainId ||
      selected.rpcUrl !== nextSelection.rpcUrl ||
      selected.chainName !== nextSelection.chainName ||
      selected.isManaged !== nextSelection.isManaged
    ) {
      setSelection({
        ...nextSelection,
      });
    }
    setManualSubnetId(nextSelection.subnetId);
    setManualBlockchainId(nextSelection.blockchainId);
    setManualRpcUrl(nextSelection.rpcUrl);
    setManualChainName(nextSelection.chainName);
  }, [querySelection, selected, setSelection]);

  useEffect(() => {
    let cancelled = false;
    async function loadManagedL1s() {
      setIsLoadingManaged(true);
      try {
        const response = await fetch('/api/console/my-l1s');
        if (!response.ok) return;
        const data = (await response.json()) as { l1s?: ManagedL1[] };
        if (!cancelled) setManagedL1s(data.l1s ?? []);
      } finally {
        if (!cancelled) setIsLoadingManaged(false);
      }
    }
    loadManagedL1s();
    return () => {
      cancelled = true;
    };
  }, []);

  const savedWalletL1s: Array<{ subnetId: string; blockchainId: string; chainName: string; rpcUrl: string }> = useMemo(
    () => {
      const walletL1List = l1List as L1ListItem[];
      return walletL1List
        .filter((l1) => l1.subnetId && l1.id)
        .map((l1) => ({
          subnetId: l1.subnetId,
          blockchainId: l1.id,
          chainName: l1.name,
          rpcUrl: l1.rpcUrl,
        }));
    },
    [l1List],
  );

  const canUseManual = manualSubnetId.trim() && manualBlockchainId.trim() && manualRpcUrl.trim();

  const applyManual = () => {
    setSelection({
      subnetId: manualSubnetId.trim(),
      blockchainId: manualBlockchainId.trim(),
      rpcUrl: manualRpcUrl.trim(),
      chainName: manualChainName.trim() || manualBlockchainId.trim().slice(0, 8),
      isManaged: false,
      managedNodeCount: 0,
    });
  };

  const selectManaged = (l1: ManagedL1) => {
    const activeNodes = l1.nodes.filter((node) => node.status === 'active').length;
    setSelection({
      subnetId: l1.subnetId,
      blockchainId: l1.blockchainId,
      rpcUrl: l1.rpcUrl,
      chainName: l1.chainName,
      isManaged: activeNodes > 0,
      managedNodeCount: activeNodes,
    });
    setManualSubnetId(l1.subnetId);
    setManualBlockchainId(l1.blockchainId);
    setManualRpcUrl(l1.rpcUrl);
    setManualChainName(l1.chainName);
  };

  const selectSaved = (l1: { subnetId: string; blockchainId: string; chainName: string; rpcUrl: string }) => {
    setSelection({ ...l1, isManaged: false, managedNodeCount: 0 });
    setManualSubnetId(l1.subnetId);
    setManualBlockchainId(l1.blockchainId);
    setManualRpcUrl(l1.rpcUrl);
    setManualChainName(l1.chainName);
  };

  const selectCreated = () => {
    setManualSubnetId(createdSubnetId);
    setManualBlockchainId(createdBlockchainId);
    setManualChainName(createdChainName);
    setSelection({
      subnetId: createdSubnetId,
      blockchainId: createdBlockchainId,
      chainName: createdChainName,
      isManaged: false,
      managedNodeCount: 0,
    });
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-5">
        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Select the L1 to upgrade</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Builder Hub uses the Subnet ID, Blockchain ID, and RPC URL to load the current config and prepare the upgrade file.
            </p>
          </div>

          <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Server className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold">Managed L1s</h3>
            </div>
            {isLoadingManaged ? (
              <p className="text-sm text-muted-foreground">Loading managed L1s...</p>
            ) : managedL1s.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {managedL1s.map((l1) => {
                  const isActive = selected.subnetId === l1.subnetId && selected.blockchainId === l1.blockchainId;
                  const activeNodes = l1.nodes.filter((node) => node.status === 'active').length;
                  return (
                    <button
                      key={`${l1.subnetId}-${l1.blockchainId}`}
                      type="button"
                      onClick={() => selectManaged(l1)}
                      className={cn(
                        'text-left rounded-lg border p-3 transition-colors',
                        isActive
                          ? 'border-primary bg-primary/5'
                          : 'border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900',
                      )}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">{l1.chainName}</div>
                          <div className="text-xs text-muted-foreground truncate">{l1.blockchainId}</div>
                        </div>
                        <span className="shrink-0 rounded-md border border-zinc-200 dark:border-zinc-800 px-2 py-1 text-[11px] text-muted-foreground">
                          {activeNodes} active
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No managed L1s found for this account.</p>
            )}
          </div>

          {createdSubnetId && createdBlockchainId && (
            <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold">Recently created chain</h3>
                  <p className="text-xs text-muted-foreground mt-1">{createdChainName || createdBlockchainId}</p>
                </div>
                <Button size="sm" variant="outline" stickLeft onClick={selectCreated}>
                  Use chain
                </Button>
              </div>
            </div>
          )}

          {savedWalletL1s.length > 0 && (
            <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Search className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold">Saved L1s</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {savedWalletL1s.map((l1) => (
                  <button
                    key={`${l1.subnetId}-${l1.blockchainId}`}
                    type="button"
                    onClick={() => selectSaved(l1)}
                    className="text-left rounded-lg border border-zinc-200 dark:border-zinc-800 p-3 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900"
                  >
                    <div className="text-sm font-medium truncate">{l1.chainName}</div>
                    <div className="text-xs text-muted-foreground truncate">{l1.rpcUrl}</div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>

        <aside className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4 h-fit">
          <div className="flex items-center gap-2 mb-4">
            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">Current Selection</h3>
          </div>
          {selected.subnetId && selected.blockchainId ? (
            <div className="space-y-2 text-xs">
              <InfoRow label="Subnet ID" value={selected.subnetId} />
              <InfoRow label="Blockchain ID" value={selected.blockchainId} />
              <InfoRow label="RPC URL" value={selected.rpcUrl || 'Not set'} />
              <InfoRow label="Node type" value={selected.isManaged ? 'Managed' : 'Self-hosted/manual'} />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Select or enter an L1 before continuing.</p>
          )}
        </aside>
      </div>

      <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4">
        <h3 className="text-sm font-semibold mb-4">Use a custom L1</h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-4">
          <InputSubnetId value={manualSubnetId} onChange={setManualSubnetId} hidePrimaryNetwork />
          <InputChainId
            value={manualBlockchainId}
            onChange={setManualBlockchainId}
            label="Blockchain ID"
            hidePrimaryNetwork
          />
          <Input label="RPC URL" value={manualRpcUrl} onChange={setManualRpcUrl} placeholder="https://..." />
          <Input label="Chain Name" value={manualChainName} onChange={setManualChainName} placeholder="Optional" />
        </div>
        <Button size="sm" variant="secondary" stickLeft disabled={!canUseManual} onClick={applyManual}>
          Use custom L1
        </Button>
      </div>
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
