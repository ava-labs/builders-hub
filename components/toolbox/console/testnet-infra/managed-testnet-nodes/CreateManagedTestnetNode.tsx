'use client';

import { useState, useEffect } from 'react';
import { useManagedTestnetNodes } from '@/hooks/useManagedTestnetNodes';
import { NodeRegistration, RegisterSubnetResponse } from './types';
import { useWallet } from '@/components/toolbox/hooks/useWallet';
import { ArrowUpRight, Loader2, Wallet, XCircle } from 'lucide-react';
import { Steps, Step } from '@/components/toolbox/components/Steps';
import Link from 'next/link';
import { HashChip } from '@/components/explorer-v2/ui';
import { EYEBROW, HoverArrow, PRIMARY_BTN, SECONDARY_BTN } from './ui';
import useConsoleNotifications from '@/hooks/useConsoleNotifications';
import SelectSubnet from '@/components/toolbox/components/SelectSubnet';
import { ConsoleToolMetadata, withConsoleToolMetadata } from '@/components/toolbox/components/WithConsoleToolMetadata';
import { generateConsoleToolGitHubUrl } from '@/components/toolbox/utils/githubUrl';
import { AccountRequirementsConfigKey } from '@/components/toolbox/hooks/useAccountRequirements';
import { useCreateChainStore } from '@/components/toolbox/stores/createChainStore';
import { SUBNET_EVM_VM_ID } from '@/constants/console';

const metadata: ConsoleToolMetadata = {
  title: 'Create Managed Testnet Node',
  description:
    'An L1 is a network of Avalanche nodes. To make it easy to play around with L1s, we created this tool to spin up a free testnet node. These nodes will shut down after 3 days. They are suitable for quick testing. For production settings or extended testing, see the self-hosted below. You need a Builder Hub Account to use this tool.',
  toolRequirements: [AccountRequirementsConfigKey.UserLoggedIn],
  githubUrl: generateConsoleToolGitHubUrl(import.meta.url),
};

function CreateManagedTestnetNodeBase() {
  const { createNode, fetchNodes, nodes } = useManagedTestnetNodes();
  const { addChain } = useWallet();
  const { notify } = useConsoleNotifications();
  // The create-l1 wizard parks the just-configured chain's metadata
  // (subnetId + genesis JSON) in this store. When the subnet the user
  // picks here matches what they're mid-creating, we pass the genesis
  // through so the resulting wallet entry can power Copy Genesis on the
  // dashboard without requiring a manual paste.
  const createChainSubnetId = useCreateChainStore()((s: { subnetId: string }) => s.subnetId);
  const createChainGenesisData = useCreateChainStore()((s: { genesisData: string }) => s.genesisData);

  const [subnetId, setSubnetId] = useState('');
  const [selectedBlockchainId, setSelectedBlockchainId] = useState('');
  const [selectedVmId, setSelectedVmId] = useState('');
  const [selectedChainName, setSelectedChainName] = useState('');

  const [createdResponse, setCreatedResponse] = useState<RegisterSubnetResponse | null>(null);
  const [createdNode, setCreatedNode] = useState<NodeRegistration | null>(null);
  const [isCreatingNode, setIsCreatingNode] = useState(false);

  const [secondsUntilWalletEnabled, setSecondsUntilWalletEnabled] = useState<number>(0);
  const [isConnectingWallet, setIsConnectingWallet] = useState(false);

  // Back-up matcher for the case where createNode couldn't return the DB
  // node directly (legacy responses) — prefer the synchronously-set
  // createdNode from handleCreate below.
  useEffect(() => {
    if (createdNode) return;
    if (createdResponse && nodes.length > 0) {
      const node = nodes.find((n) => n.node_id === createdResponse.nodeID && n.subnet_id === subnetId);
      if (node) {
        setCreatedNode(node);
      }
    }
  }, [nodes, createdResponse, subnetId, createdNode]);

  useEffect(() => {
    if (!createdNode) return;
    const createdAtMs = new Date(createdNode.created_at).getTime();
    const elapsedSeconds = Math.floor((Date.now() - createdAtMs) / 1000);
    const initialRemaining = Math.max(0, 10 - elapsedSeconds);
    setSecondsUntilWalletEnabled(initialRemaining);

    if (initialRemaining === 0) return;

    const intervalId = setInterval(() => {
      setSecondsUntilWalletEnabled((prev) => {
        if (prev <= 1) {
          clearInterval(intervalId);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(intervalId);
  }, [createdNode]);

  const handleCreate = async () => {
    setIsCreatingNode(true);
    const createNodePromise = createNode(subnetId, selectedBlockchainId);
    notify(
      {
        name: 'Managed Testnet Node Creation',
        type: 'local',
      },
      createNodePromise,
    );
    try {
      const response = await createNodePromise;
      setCreatedResponse(response);
      // The POST response carries the freshly-created DB node; apply it
      // synchronously so Step 3 unlocks without waiting for a re-fetch round-trip.
      if (response.node) {
        setCreatedNode(response.node);
      }
    } finally {
      setIsCreatingNode(false);
      await fetchNodes();
    }
  };

  const handleAddToWallet = async () => {
    if (!createdNode) return;
    setIsConnectingWallet(true);
    // Only pass genesis when the wizard's subnet matches what the user
    // selected in step 1 here. Without this guard a stale createChainStore
    // from a previous flow would seed the modal with mismatched genesis.
    const matchesWizard = createChainSubnetId.length > 0 && createChainSubnetId === subnetId;
    const genesisToPass = matchesWizard ? createChainGenesisData?.trim() || undefined : undefined;
    await addChain({
      rpcUrl: createdNode.rpc_url,
      allowLookup: false,
      genesisData: genesisToPass,
    });
    setIsConnectingWallet(false);
  };

  // Managed nodes only provision a Subnet-EVM binary, so the API rejects any
  // other VM with a raw "Unsupported VM" error. The selected blockchain already
  // carries its vmId, so block non-Subnet-EVM L1s (e.g. Dispatch, Echo, Dexalot)
  // up front with a clear message.
  const isUnsupportedVm = Boolean(selectedBlockchainId) && selectedVmId !== '' && selectedVmId !== SUBNET_EVM_VM_ID;

  return (
    <Steps>
      <Step>
        <h2>Select a Subnet</h2>
        <p>Enter the Subnet ID of the L1 you want a node for.</p>
        <SelectSubnet
          value={subnetId}
          onChange={(selection) => {
            const firstChain = selection.subnet?.blockchains?.[0];
            setSubnetId(selection.subnetId);
            setSelectedBlockchainId(firstChain?.blockchainId || '');
            setSelectedVmId(firstChain?.vmId || '');
            setSelectedChainName(firstChain?.blockchainName || '');
          }}
        />
      </Step>

      <Step>
        <h2>Create the node</h2>
        <p>Review the details, then create your managed testnet node.</p>
        {isUnsupportedVm && (
          <div
            role="alert"
            className="flex items-start gap-3 border border-red-200 bg-red-50 px-4 py-3 dark:border-red-900/60 dark:bg-red-950/30"
          >
            <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
            <p className="text-[13px] leading-relaxed text-red-800 dark:text-red-200">
              Managed testnet nodes support Subnet-EVM L1s only.{' '}
              {selectedChainName ? `"${selectedChainName}" uses` : 'This L1 uses'} a different virtual machine. Pick a
              Subnet-EVM L1, or run a self-hosted node instead.
            </p>
          </div>
        )}
        <div>
          <button
            type="button"
            onClick={handleCreate}
            disabled={!subnetId || !selectedBlockchainId || isCreatingNode || isUnsupportedVm}
            className={PRIMARY_BTN}
          >
            {isCreatingNode && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Create node
            <HoverArrow />
          </button>
        </div>
      </Step>

      <Step>
        <h2>Add to wallet</h2>
        <p>Add the new node&apos;s RPC to your wallet.</p>
        {createdNode && (
          <div className="flex min-w-0 flex-col gap-1.5">
            <p className={EYEBROW}>RPC URL</p>
            <HashChip value={createdNode.rpc_url} len={200} />
          </div>
        )}
        <div>
          <button
            type="button"
            onClick={handleAddToWallet}
            disabled={!createdNode || secondsUntilWalletEnabled > 0 || isConnectingWallet}
            className={SECONDARY_BTN}
          >
            {isConnectingWallet ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wallet className="h-3.5 w-3.5" />}
            {secondsUntilWalletEnabled > 0 ? (
              <span className="tabular-nums">Wait {secondsUntilWalletEnabled}s</span>
            ) : (
              'Add to wallet'
            )}
          </button>
        </div>
      </Step>
      <Step>
        <h2>Open the node manager</h2>
        <p>See this node and the others you created in the Testnet Node Manager.</p>
        <div>
          {createdNode ? (
            <Link href="/console/testnet-infra/nodes" target="_blank" className={SECONDARY_BTN}>
              Open node manager
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          ) : (
            <button type="button" disabled className={SECONDARY_BTN}>
              Open node manager
              <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </Step>
    </Steps>
  );
}

export default withConsoleToolMetadata(CreateManagedTestnetNodeBase, metadata);
