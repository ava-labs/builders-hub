'use client';
import { useEffect, useState } from 'react';
import { Clock, Wallet, Trash2, XCircle, CheckCircle2, AlertTriangle } from 'lucide-react';
import { NodeRegistration } from '@/components/toolbox/console/testnet-infra/managed-testnet-nodes/types';
import {
  calculateTimeRemaining,
  formatTimeRemaining,
  getStatusData,
} from '@/components/toolbox/console/testnet-infra/managed-testnet-nodes/useTimeRemaining';
import { Button } from '@/components/toolbox/components/Button';
import { useWallet } from '@/components/toolbox/hooks/useWallet';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { networkIDs } from '@avalabs/avalanchejs';
import { CodeBlock, Pre } from 'fumadocs-ui/components/codeblock';

interface NodeCardProps {
  node: NodeRegistration;
  onDeleteNode: (node: NodeRegistration) => void;
  isDeletingNode: boolean;
}

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

  const getStatusIcon = (iconType: 'expired' | 'warning' | 'active') => {
    switch (iconType) {
      case 'expired':
        return <XCircle className="w-3 h-3" />;
      case 'warning':
        return <AlertTriangle className="w-3 h-3" />;
      case 'active':
        return <CheckCircle2 className="w-3 h-3" />;
      default:
        return <XCircle className="w-3 h-3" />;
    }
  };

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
    <div className="bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600 transition-colors min-w-0">
      {/* Node Header */}
      <div className="p-4 border-b border-zinc-100 dark:border-zinc-700">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div>
              <h3 className="font-medium text-zinc-900 dark:text-zinc-100 mb-1">
                {node.chain_name || 'Unnamed Chain'} {node.node_index ? `Node ${node.node_index}` : ''}
              </h3>
              <div className="flex items-center gap-3">
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border ${statusData.color}`}
                >
                  {getStatusIcon(statusData.iconType)}
                  {statusData.label}
                </span>
                <span className="text-sm text-zinc-600 dark:text-zinc-400 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatTimeRemaining(timeRemaining)} remaining
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="text-right text-xs text-zinc-500 dark:text-zinc-400 space-y-1">
              <div>
                Created:{' '}
                {new Date(node.created_at).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </div>
              <div>
                Expires:{' '}
                {new Date(node.expires_at).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Node Details (compact) */}
      <div className="p-4 space-y-2 min-w-0">
        <div className="grid grid-cols-1 gap-2 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-28 text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
              Subnet ID
            </span>
            <CodeBlock lang="json" allowCopy={true}>
              <Pre>{node.subnet_id}</Pre>
            </CodeBlock>
          </div>

          <div className="flex items-center gap-2 min-w-0">
            <span className="w-28 text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
              Blockchain ID
            </span>
            <CodeBlock lang="json" allowCopy={true}>
              <Pre>{node.blockchain_id}</Pre>
            </CodeBlock>
          </div>

          <div className="flex items-center gap-2 min-w-0">
            <span className="w-28 text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
              RPC URL
            </span>
            <CodeBlock lang="json" allowCopy={true}>
              <Pre>{node.rpc_url}</Pre>
            </CodeBlock>
          </div>

          {/* Per-L1 firn block explorer — the slug is the lowercased
              first 8 chars of blockchainID (matches the structural
              regex in firn-explorer's middleware). Same 3-day TTL as
              the node assignment. Computed client-side because the
              managed-nodes API doesn't expose it directly; deriving
              from blockchain_id keeps backend + frontend in lockstep
              without an extra round-trip. */}
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-28 text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
              Explorer
            </span>
            <CodeBlock lang="json" allowCopy={true}>
              <Pre>{`https://${node.blockchain_id.toLowerCase().slice(0, 8)}.firn.gg`}</Pre>
            </CodeBlock>
          </div>
        </div>

        {/* info.getNodeID API Response */}
        <div className="mt-2 w-full max-w-full">
          <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-2">info.getNodeID API Response</p>
          <CodeBlock lang="json" allowCopy={true}>
            <Pre>{nodeInfoJson}</Pre>
          </CodeBlock>
        </div>

        {/* Primary Actions */}
        <div className="mt-2 flex items-center justify-end gap-2 border-t border-zinc-200 dark:border-zinc-700 pt-3">
          <Button
            onClick={handleConnectWallet}
            variant="secondary"
            size="sm"
            stickLeft
            disabled={secondsUntilWalletEnabled > 0 || isConnecting}
            loading={isConnecting}
            icon={<Wallet className="w-4 h-4" />}
          >
            {secondsUntilWalletEnabled > 0 ? `Add L1 to your wallet in ${secondsUntilWalletEnabled}s` : 'Add to Wallet'}
          </Button>
          <Button
            onClick={() => onDeleteNode(node)}
            variant="danger"
            size="sm"
            loading={isDeletingNode}
            loadingText={node.node_index === null || node.node_index === undefined ? 'Removing...' : 'Deleting...'}
            className="!w-auto"
            icon={<Trash2 className="w-4 h-4" />}
          >
            {node.node_index === null || node.node_index === undefined ? 'Remove from Account' : 'Delete Node'}
          </Button>
        </div>
      </div>
    </div>
  );
}
