"use client";

import { useWalletStore } from "@/components/toolbox/stores/walletStore";
import { useL1ListStore } from "@/components/toolbox/stores/l1ListStore";
import { useState, useEffect } from "react";
import { Button } from "@/components/toolbox/components/Button";
import { Plus } from "lucide-react";

import { Relayer, RelayerConfig } from "./types";
import CreateRelayerForm from "./CreateRelayerForm";
import RelayersList from "./RelayersList";
import useConsoleNotifications from "@/hooks/useConsoleNotifications";
import { useManagedTestnetRelayers } from "@/hooks/useManagedTestnetRelayers";
import { toast } from "@/hooks/use-toast";
import TestnetOnly from "../ManagedTestnetNodes/TestnetOnly";
import { ConsoleToolMetadata, withConsoleToolMetadata } from "../../../components/WithConsoleToolMetadata";
import { generateConsoleToolGitHubUrl } from "@/components/toolbox/utils/github-url";
import { WalletRequirementsConfigKey } from "@/components/toolbox/hooks/useWalletRequirements";

const metadata: ConsoleToolMetadata = {
    title: "Managed Testnet Relayers",
    description: "Manage your hosted testnet ICM relayers for cross-chain message delivery.",
    walletRequirements: [
        WalletRequirementsConfigKey.EVMChainBalance
    ],
    githubUrl: generateConsoleToolGitHubUrl(import.meta.url)
};

function ManagedTestnetRelayersBase() {
    const { isTestnet } = useWalletStore();
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
        restartRelayer
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
            notify({ name: "Managed Testnet Relayer Creation", type: "local" }, createPromise);
            await createPromise;
            setShowCreateForm(false);
            fetchRelayers();
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            if (errorMessage.includes('Authentication required') || errorMessage.includes('401')) {
                toast({
                    title: "Authentication Required",
                    description: "Please sign in to create relayers.",
                    variant: "destructive",
                });
            } else {
                toast({
                    title: "Creation Failed",
                    description: errorMessage,
                    variant: "destructive",
                });
            }
        } finally {
            setIsCreating(false);
        }
    };

    const handleDeleteRelayer = async (relayer: Relayer) => {
        try {
            const deletePromise = deleteRelayer(relayer);
            notify({ name: "Managed Testnet Relayer Deletion", type: "local" }, deletePromise);
            await deletePromise;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to delete relayer';
            if (errorMessage.includes('Authentication required') || errorMessage.includes('401')) {
                toast({
                    title: "Authentication Required",
                    description: "Please sign in to delete relayers.",
                    variant: "destructive",
                });
            } else {
                toast({
                    title: "Delete Failed",
                    description: errorMessage,
                    variant: "destructive",
                });
            }
        }
    };

    const handleRestartRelayer = async (relayer: Relayer) => {
        try {
            const restartPromise = restartRelayer(relayer);
            notify({ name: "Managed Testnet Relayer Restart", type: "local" }, restartPromise);
            await restartPromise;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to restart relayer';
            if (errorMessage.includes('Authentication required') || errorMessage.includes('401')) {
                toast({
                    title: "Authentication Required",
                    description: "Please sign in to restart relayers.",
                    variant: "destructive",
                });
            } else if (errorMessage.includes('Rate limit')) {
                toast({
                    title: "Rate Limit Exceeded",
                    description: "Please wait before restarting again.",
                    variant: "destructive",
                });
            } else {
                toast({
                    title: "Restart Failed",
                    description: errorMessage,
                    variant: "destructive",
                });
            }
        }
    };

    // If not on testnet, show disabled message
    if (!isTestnet) {
        return (
            <TestnetOnly />
        );
    }

    return (
        <>
            {/* Stats Section */}
            <div className="mb-8 not-prose">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400">
                            <span className="font-semibold">{relayers.length}</span> / 100 active relayers
                        </p>
                    </div>
                    <Button
                        onClick={() => setShowCreateForm(true)}
                        className="bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100 !w-auto"
                        size="sm"
                        disabled={relayers.length >= 100}
                    >
                        <Plus className="w-4 h-4 mr-2" />
                        Add a new relayer
                    </Button>
                </div>
            </div>

            {/* Create Relayer Form */}
            {showCreateForm && (
                <CreateRelayerForm
                    onClose={() => setShowCreateForm(false)}
                    onSubmit={handleCreateRelayer}
                    l1List={l1List}
                    isCreating={isCreating}
                />
            )}

            {/* Relayers List */}
            <div className="not-prose">
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
        </>
    );
}

export default withConsoleToolMetadata(ManagedTestnetRelayersBase, metadata);

