'use client';

import { useL1ListStore } from '@/components/toolbox/stores/l1ListStore';
import { useState, useEffect } from 'react';
import { Plus, RefreshCw } from 'lucide-react';
import { SectionHeader } from '@/components/explorer-v2/ui';
import { cn } from '@/lib/utils';
import { BTN_PRIMARY, BTN_SECONDARY, COUNT, HoverArrow } from './ui';

import { Relayer, RelayerConfig } from './types';
import CreateRelayerForm from './CreateRelayerForm';
import RelayersList from './RelayersList';
import useConsoleNotifications from '@/hooks/useConsoleNotifications';
import { useManagedTestnetRelayers } from '@/hooks/useManagedTestnetRelayers';
import { toast } from '@/hooks/use-toast';
import { ConsoleToolMetadata, withConsoleToolMetadata } from '@/components/toolbox/components/WithConsoleToolMetadata';
import { generateConsoleToolGitHubUrl } from '@/components/toolbox/utils/githubUrl';
import { WalletRequirementsConfigKey } from '@/components/toolbox/hooks/useWalletRequirements';

const metadata: ConsoleToolMetadata = {
  title: 'Managed Testnet Relayers',
  description:
    'Hosted ICM relayers that carry messages between your Fuji chains. Fund them, restart them, or delete them here.',
  toolRequirements: [WalletRequirementsConfigKey.TestnetRequired, WalletRequirementsConfigKey.EVMChainBalance],
  githubUrl: generateConsoleToolGitHubUrl(import.meta.url),
};

function ManagedTestnetRelayersBase() {
  const { l1List } = useL1ListStore()();
  const {
    relayers,
    isLoadingRelayers,
    relayersError,
    deletingRelayers,
    restartingRelayers,
    fetchRelayers,
    createRelayer,
    deleteRelayer,
    restartRelayer,
  } = useManagedTestnetRelayers();
  const { notify } = useConsoleNotifications();

  // Load relayers when component mounts
  useEffect(() => {
    fetchRelayers();
  }, [fetchRelayers]);

  // Create relayer state
  const [isCreating, setIsCreating] = useState(false);

  // Show create form state
  const [showCreateForm, setShowCreateForm] = useState(false);

  const handleCreateRelayer = async (configs: RelayerConfig[]) => {
    setIsCreating(true);
    try {
      const createPromise = createRelayer(configs);
      notify({ name: 'Managed Testnet Relayer Creation', type: 'local' }, createPromise);
      await createPromise;
      setShowCreateForm(false);
      fetchRelayers();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      if (errorMessage.includes('Authentication required') || errorMessage.includes('401')) {
        toast({
          title: 'Authentication Required',
          description: 'Please sign in to create relayers.',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Creation Failed',
          description: errorMessage,
          variant: 'destructive',
        });
      }
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteRelayer = async (relayer: Relayer) => {
    try {
      const deletePromise = deleteRelayer(relayer);
      notify({ name: 'Managed Testnet Relayer Deletion', type: 'local' }, deletePromise);
      await deletePromise;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete relayer';
      if (errorMessage.includes('Authentication required') || errorMessage.includes('401')) {
        toast({
          title: 'Authentication Required',
          description: 'Please sign in to delete relayers.',
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

  const handleRestartRelayer = async (relayer: Relayer) => {
    try {
      const restartPromise = restartRelayer(relayer);
      notify({ name: 'Managed Testnet Relayer Restart', type: 'local' }, restartPromise);
      await restartPromise;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to restart relayer';
      if (errorMessage.includes('Authentication required') || errorMessage.includes('401')) {
        toast({
          title: 'Authentication Required',
          description: 'Please sign in to restart relayers.',
          variant: 'destructive',
        });
      } else if (errorMessage.includes('Rate limit')) {
        toast({
          title: 'Rate Limit Exceeded',
          description: 'Please wait before restarting again.',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Restart Failed',
          description: errorMessage,
          variant: 'destructive',
        });
      }
    }
  };

  return (
    <div className="not-prose flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        <SectionHeader
          label="Your relayers"
          className="flex-1"
          action={
            <span className={COUNT}>
              {relayers.length} {relayers.length === 1 ? 'relayer' : 'relayers'}
            </span>
          }
        />
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchRelayers}
            disabled={isLoadingRelayers}
            className={BTN_SECONDARY}
            aria-label="Refresh relayers"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', isLoadingRelayers && 'animate-spin')} />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => setShowCreateForm(true)}
            disabled={relayers.length >= 100}
            className={BTN_PRIMARY}
          >
            <Plus className="h-3.5 w-3.5" />
            New relayer
            <HoverArrow />
          </button>
        </div>
      </div>

      {showCreateForm && (
        <CreateRelayerForm
          onClose={() => setShowCreateForm(false)}
          onSubmit={handleCreateRelayer}
          l1List={l1List}
          isCreating={isCreating}
        />
      )}

      <RelayersList
        relayers={relayers}
        isLoadingRelayers={isLoadingRelayers}
        relayersError={relayersError}
        onRefresh={fetchRelayers}
        onShowCreateForm={() => setShowCreateForm(true)}
        onDeleteRelayer={handleDeleteRelayer}
        onRestartRelayer={handleRestartRelayer}
        deletingRelayers={deletingRelayers}
        restartingRelayers={restartingRelayers}
      />
    </div>
  );
}

export default withConsoleToolMetadata(ManagedTestnetRelayersBase, metadata);
