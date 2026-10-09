'use client';

import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { Board, SectionHeader, StatCell, StatDash, StatFigure } from '@/components/explorer-v2/ui';

import { NodeRegistration } from './types';
import { calculateTimeRemaining, getStatusData } from './useTimeRemaining';
import { HoverArrow, PRIMARY_BTN } from './ui';
import CreateNodeForm from './CreateNodeForm';
import NodesList from './NodesList';
import useConsoleNotifications from '@/hooks/useConsoleNotifications';
import { useManagedTestnetNodes } from '@/hooks/useManagedTestnetNodes';
import { toast } from '@/hooks/use-toast';
import { ConsoleToolMetadata, withConsoleToolMetadata } from '@/components/toolbox/components/WithConsoleToolMetadata';
import { generateConsoleToolGitHubUrl } from '@/components/toolbox/utils/githubUrl';
import { AccountRequirementsConfigKey } from '@/components/toolbox/hooks/useAccountRequirements';

const metadata: ConsoleToolMetadata = {
  title: 'Managed Testnet Nodes',
  description: 'Manage your hosted testnet nodes.',
  toolRequirements: [AccountRequirementsConfigKey.UserLoggedIn],
  githubUrl: generateConsoleToolGitHubUrl(import.meta.url),
};

function ManagedTestnetNodesBase() {
  // Load nodes when component mounts
  useEffect(() => {
    fetchNodes();
  }, []);

  const { avalancheNetworkID } = useWalletStore();
  const { nodes, isLoadingNodes, nodesError, deletingNodes, fetchNodes, createNode, deleteNode } =
    useManagedTestnetNodes();
  const { notify } = useConsoleNotifications();

  // Create node state
  const [isRegistering, setIsRegistering] = useState(false);

  // Show create form state
  const [showCreateForm, setShowCreateForm] = useState(false);

  const handleRegistration = async (subnetId: string, blockchainId: string) => {
    setIsRegistering(true);
    try {
      const createPromise = createNode(subnetId, blockchainId);
      notify({ name: 'Managed Testnet Node Creation', type: 'local' }, createPromise);
      setShowCreateForm(false);
      fetchNodes();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      if (errorMessage.includes('Authentication required') || errorMessage.includes('401')) {
        toast({
          title: 'Authentication Required',
          description: 'Please sign in to create nodes.',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Registration Failed',
          description: errorMessage,
          variant: 'destructive',
        });
      }
    } finally {
      setIsRegistering(false);
    }
  };

  const handleDeleteNode = async (node: NodeRegistration) => {
    try {
      const deletePromise = deleteNode(node);
      notify({ name: 'Managed Testnet Node Deletion', type: 'local' }, deletePromise);
      await deletePromise;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete node';
      if (errorMessage.includes('Authentication required') || errorMessage.includes('401')) {
        toast({
          title: 'Authentication Required',
          description: 'Please sign in to delete nodes.',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Delete Failed',
          description: errorMessage,
          variant: 'destructive',
        });
      }
    }
  };

  const expiringSoon = nodes.filter(
    (node) => getStatusData(calculateTimeRemaining(node.expires_at)).iconType === 'warning',
  ).length;
  const l1sCovered = new Set(nodes.map((node) => node.subnet_id)).size;

  return (
    <div className="not-prose flex flex-col gap-8">
      <section className="flex flex-col gap-4">
        <SectionHeader
          label="Overview"
          action={
            <button
              type="button"
              onClick={() => setShowCreateForm(true)}
              aria-expanded={showCreateForm}
              className={PRIMARY_BTN}
            >
              <Plus className="h-3.5 w-3.5" />
              Add a node
              <HoverArrow />
            </button>
          }
        />
        <Board divide={false} className="border-x border-t">
          <div className="grid grid-cols-1 divide-y divide-zinc-200 sm:grid-cols-3 sm:divide-x sm:divide-y-0 dark:divide-zinc-800">
            <StatCell label="Active nodes" live={nodes.length > 0} sub="Free, 3 per account">
              {isLoadingNodes ? <StatDash /> : <StatFigure value={nodes.length} suffix="/ 3" />}
            </StatCell>
            <StatCell label="Expiring soon" sub="Within a day">
              {isLoadingNodes ? <StatDash /> : <StatFigure value={expiringSoon} />}
            </StatCell>
            <StatCell label="L1s covered" sub="Each node lasts 3 days">
              {isLoadingNodes ? <StatDash /> : <StatFigure value={l1sCovered} />}
            </StatCell>
          </div>
        </Board>
      </section>

      {showCreateForm && (
        <CreateNodeForm
          onClose={() => setShowCreateForm(false)}
          onSubmit={handleRegistration}
          onError={(title, message) => toast({ title, description: message, variant: 'destructive' })}
          avalancheNetworkID={avalancheNetworkID}
          isRegistering={isRegistering}
        />
      )}

      <NodesList
        nodes={nodes}
        isLoadingNodes={isLoadingNodes}
        nodesError={nodesError}
        onRefresh={fetchNodes}
        onShowCreateForm={() => setShowCreateForm(true)}
        onDeleteNode={handleDeleteNode}
        deletingNodes={deletingNodes}
      />
    </div>
  );
}

export default withConsoleToolMetadata(ManagedTestnetNodesBase, metadata);
