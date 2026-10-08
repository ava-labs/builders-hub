'use client';
import { useEffect, useState } from 'react';
import { ArrowUpRight, Loader2, Trash2, Wallet } from 'lucide-react';
import { NodeRegistration } from '@/components/toolbox/console/testnet-infra/managed-testnet-nodes/types';
import {
  calculateTimeRemaining,
  formatTimeRemaining,
  getStatusData,
} from '@/components/toolbox/console/testnet-infra/managed-testnet-nodes/useTimeRemaining';
import { useWallet } from '@/components/toolbox/hooks/useWallet';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { networkIDs } from '@avalabs/avalanchejs';
import { Board, HashChip, SpecPlate, SpecRow } from '@/components/explorer-v2/ui';
import { CopyBlock, DANGER_BTN, EYEBROW, SECONDARY_BTN, StatusLabel } from './ui';

interface NodeCardProps {
  node: NodeRegistration;
  onDeleteNode: (node: NodeRegistration) => void;
  isDeletingNode: boolean;
}

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

export default function NodeCard({ node, onDeleteNode, isDeletingNode }: NodeCardProps) {
  const { addChain } = useWallet();
  const {
    isTestnet: prevIsTestnet,
    avalancheNetworkID: prevNetworkID,
    setIsTestnet: setWalletIsTestnet,
    setAvalancheNetworkID,
    setWalletChainId,
    updateL1Balance,
  } = useWalletStore();
  const [secondsUntilWalletEnabled, setSecondsUntilWalletEnabled] = useState<number>(0);
  const [isConnecting, setIsConnecting] = useState(false);

  const handleConnectWallet = async () => {
    setIsConnecting(true);

    // Pre-set testnet mode so the console context switches correctly
    // (managed testnet nodes are always Fuji testnet)
    setWalletIsTestnet(true);
    setAvalancheNetworkID(networkIDs.FujiID);

    const result = await addChain({
      rpcUrl: node.rpc_url,
      allowLookup: false,
    });

    if (result.success && result.chainData?.evmChainId) {
      // Explicitly switch the console's active chain context
      setWalletChainId(result.chainData.evmChainId);
      setTimeout(() => updateL1Balance(result.chainData!.evmChainId.toString()), 800);
    } else if (!result.success) {
      // Restore previous network state on rejection/failure
      setWalletIsTestnet(prevIsTestnet ?? false);
      setAvalancheNetworkID(prevNetworkID);
    }

    setIsConnecting(false);
  };
  const timeRemaining = calculateTimeRemaining(node.expires_at);
  const statusData = getStatusData(timeRemaining);
  const nodeInfoJson = JSON.stringify(
    {
      jsonrpc: '2.0',
      result: {
        nodeID: node.node_id,
        nodePOP: {
          publicKey: node.public_key || '',
          proofOfPossession: node.proof_of_possession || '',
        },
      },
      id: 1,
    },
    null,
    2,
  );

  // Per-L1 firn block explorer: the slug is the lowercased first 8 chars of the blockchain ID (matches the structural
  // regex in firn-explorer's middleware), with the same 3-day TTL as the node. The managed-nodes API doesn't expose it.
  const explorerUrl = `https://${node.blockchain_id.toLowerCase().slice(0, 8)}.firn.gg`;
  const isAccountEntry = node.node_index === null || node.node_index === undefined;

  // Disable "Add to Wallet" for 10 seconds after node creation to allow bootstrapping
  useEffect(() => {
    const createdAtMs = new Date(node.created_at).getTime();
    const elapsedSeconds = Math.floor((Date.now() - createdAtMs) / 1000);
    const initialRemaining = Math.max(0, 10 - elapsedSeconds);
    setSecondsUntilWalletEnabled(initialRemaining);

    if (initialRemaining === 0) return;

    const intervalId = window.setInterval(() => {
      setSecondsUntilWalletEnabled((prev) => {
        if (prev <= 1) {
          window.clearInterval(intervalId);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [node.created_at]);

  return (
    <Board className="min-w-0 border-x border-t">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 bg-zinc-50/80 px-5 py-3 md:px-6 dark:bg-zinc-900/40">
        <div className="flex min-w-0 items-baseline gap-3">
          <h3 className="truncate text-[15px] font-semibold text-zinc-900 dark:text-zinc-50">
            {node.chain_name || 'Unnamed chain'}
          </h3>
          {node.node_index ? <span className={EYEBROW}>Node {node.node_index}</span> : null}
        </div>
        <div className="flex items-center gap-4">
          <StatusLabel status={statusData.iconType} label={statusData.label} />
          {!timeRemaining.expired && (
            <span className="font-mono text-[12px] tabular-nums text-zinc-900 dark:text-zinc-50">
              {formatTimeRemaining(timeRemaining)} <span className="text-zinc-400 dark:text-zinc-500">left</span>
            </span>
          )}
        </div>
      </div>

      <SpecPlate className="px-5 md:px-6">
        <SpecRow label="Node ID">
          <HashChip value={node.node_id} len={64} />
        </SpecRow>
        <SpecRow label="RPC URL">
          <HashChip value={node.rpc_url} len={200} />
        </SpecRow>
        <SpecRow label="Subnet ID">
          <HashChip value={node.subnet_id} len={64} />
        </SpecRow>
        <SpecRow label="Blockchain ID">
          <HashChip value={node.blockchain_id} len={64} />
        </SpecRow>
        <SpecRow label="Explorer">
          <span className="inline-flex min-w-0 max-w-full items-center gap-2">
            <HashChip value={explorerUrl} len={200} />
            <a
              href={explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Open explorer"
              title="Open explorer"
              className="-m-1.5 shrink-0 p-1.5 text-zinc-400 transition-colors hover:text-[#E6212F] dark:text-zinc-500"
            >
              <ArrowUpRight className="h-3.5 w-3.5" />
            </a>
          </span>
        </SpecRow>
        <SpecRow label="Lifetime">
          <span className="font-mono text-[12.5px] tabular-nums text-zinc-700 dark:text-zinc-300">
            {formatDate(node.created_at)} <span className="text-zinc-400 dark:text-zinc-500">→</span>{' '}
            {formatDate(node.expires_at)}
          </span>
        </SpecRow>
      </SpecPlate>

      <div className="flex flex-col gap-2 px-5 py-4 md:px-6">
        <p className={EYEBROW}>info.getNodeID response</p>
        <CopyBlock value={nodeInfoJson} label="Copy info.getNodeID response" />
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2 px-5 py-3 md:px-6">
        <button
          type="button"
          onClick={handleConnectWallet}
          disabled={secondsUntilWalletEnabled > 0 || isConnecting}
          className={SECONDARY_BTN}
        >
          {isConnecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wallet className="h-3.5 w-3.5" />}
          {secondsUntilWalletEnabled > 0 ? (
            <span className="tabular-nums">Add to wallet in {secondsUntilWalletEnabled}s</span>
          ) : (
            'Add to wallet'
          )}
        </button>
        <button type="button" onClick={() => onDeleteNode(node)} disabled={isDeletingNode} className={DANGER_BTN}>
          {isDeletingNode ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
          {isDeletingNode
            ? isAccountEntry
              ? 'Removing…'
              : 'Deleting…'
            : isAccountEntry
              ? 'Remove from account'
              : 'Delete node'}
        </button>
      </div>
    </Board>
  );
}
