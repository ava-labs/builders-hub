import { useState, useEffect } from "react";
import { useWalletStore } from "../stores/walletStore";
import { useViemChainStore } from "../stores/toolboxStore";
import { getActiveRulesAt } from "../coreViem";
import { createPublicClient, http } from "viem";
import { cn } from "../lib/utils";
import { AlertTriangle, ExternalLink, RefreshCw, Blocks, ArrowRightLeft } from "lucide-react";
import { Button } from "./Button";
import { useSwitchNetworkModal } from "../providers/modals/SwitchNetworkModal";

type PrecompileConfigKey =
    | "warpConfig"
    | "contractDeployerAllowListConfig"
    | "txAllowListConfig"
    | "feeManagerConfig"
    | "rewardManagerConfig"
    | "contractNativeMinterConfig";

// Precompile documentation links
const PRECOMPILE_DOCS: Record<PrecompileConfigKey, string> = {
    warpConfig: "/docs/avalanche-l1s/icm/icm-overview",
    contractDeployerAllowListConfig: "/docs/avalanche-l1s/security/deployer-allowlist",
    txAllowListConfig: "/docs/avalanche-l1s/security/transaction-allowlist",
    feeManagerConfig: "/docs/avalanche-l1s/customize/fee-config",
    rewardManagerConfig: "/docs/avalanche-l1s/customize/reward-manager",
    contractNativeMinterConfig: "/docs/avalanche-l1s/customize/native-minter",
};

// Friendly names for precompiles
const PRECOMPILE_NAMES: Record<PrecompileConfigKey, string> = {
    warpConfig: "Avalanche Warp Messaging",
    contractDeployerAllowListConfig: "Contract Deployer Allowlist",
    txAllowListConfig: "Transaction Allowlist",
    feeManagerConfig: "Fee Manager",
    rewardManagerConfig: "Reward Manager",
    contractNativeMinterConfig: "Native Minter",
};

interface CheckPrecompileProps {
    children: React.ReactNode;
    configKey: PrecompileConfigKey;
    precompileName: string;
    errorMessage?: string;
    docsLink?: string;
    docsLinkText?: string;
}

interface PrecompileState {
    isActive: boolean;
    isLoading: boolean;
    error: string | null;
}

export const CheckPrecompile = ({
    children,
    configKey,
    precompileName,
    errorMessage,
    docsLink,
    docsLinkText = "Learn how to enable this precompile"
}: CheckPrecompileProps) => {
    const { walletChainId } = useWalletStore();
    const viemChain = useViemChainStore();
    const { openSwitchNetwork } = useSwitchNetworkModal();
    const [state, setState] = useState<PrecompileState>({
        isActive: false,
        isLoading: false,
        error: null
    });

    const checkPrecompileStatus = async () => {
        if (!viemChain?.rpcUrls?.default?.http?.[0]) return;

        setState(prev => ({ ...prev, isLoading: true, error: null }));

        try {
            // Create a dedicated publicClient using the chain's RPC URL
            // This is necessary because Core wallet provider doesn't support eth_getActiveRulesAt
            const rpcPublicClient = createPublicClient({
                transport: http(viemChain.rpcUrls.default.http[0]),
                chain: viemChain as any,
            });

            const data = await getActiveRulesAt(rpcPublicClient);
            // Treat presence of a timestamp (including 0) as active.
            // Some networks may report 0 when enabled at genesis.
            const isActive = (data.precompiles?.[configKey]?.timestamp !== undefined);
            setState({ isLoading: false, isActive, error: null });
        } catch (err) {
            console.error('Error checking precompile:', err);
            setState({
                isLoading: false,
                isActive: false,
                error: err instanceof Error ? err.message : 'An unknown error occurred'
            });
        }
    };

    useEffect(() => {
        if (!viemChain?.rpcUrls?.default?.http?.[0]) return;
        checkPrecompileStatus();
    }, [viemChain, configKey, walletChainId]);

    const resolvedDocsLink = docsLink || PRECOMPILE_DOCS[configKey];
    const chainName = viemChain?.name || "this chain";

    // Loading state - centered spinner
    if (state.isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px] p-8">
                <div className="text-center">
                    <div className="relative">
                        <div className="w-16 h-16 rounded-full border-4 border-zinc-200 dark:border-zinc-700" />
                        <div className="absolute inset-0 w-16 h-16 rounded-full border-4 border-t-blue-500 animate-spin" />
                    </div>
                    <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
                        Checking {precompileName} availability...
                    </p>
                </div>
            </div>
        );
    }

    // Error state - centered with retry option
    if (state.error) {
        return (
            <div className="flex items-center justify-center min-h-[400px] p-8">
                <div className="max-w-md w-full text-center">
                    <div className="mx-auto w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-4">
                        <AlertTriangle className="w-8 h-8 text-red-600 dark:text-red-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
                        Connection Error
                    </h3>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
                        Unable to check if {precompileName} is available on {chainName}.
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-500 mb-6 font-mono bg-zinc-100 dark:bg-zinc-800 p-2 rounded">
                        {state.error}
                    </p>
                    <Button
                        variant="primary"
                        onClick={checkPrecompileStatus}
                        className="inline-flex items-center gap-2"
                    >
                        <RefreshCw className="w-4 h-4" />
                        Try Again
                    </Button>
                </div>
            </div>
        );
    }

    // Precompile not active - centered with actions
    if (!state.isActive) {
        return (
            <div className="flex items-center justify-center min-h-[400px] p-8">
                <div className="max-w-lg w-full text-center">
                    {/* Icon */}
                    <div className="mx-auto w-20 h-20 rounded-2xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mb-6">
                        <Blocks className="w-10 h-10 text-amber-600 dark:text-amber-400" />
                    </div>

                    {/* Title */}
                    <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
                        {precompileName} Not Available
                    </h3>

                    {/* Description */}
                    <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6 max-w-md mx-auto">
                        {errorMessage || (
                            <>
                                The <span className="font-medium">{precompileName}</span> precompile is not enabled
                                on <span className="font-medium">{chainName}</span>. This feature requires the precompile
                                to be activated in the chain&apos;s genesis configuration.
                            </>
                        )}
                    </p>

                    {/* Info card */}
                    <div className="bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl p-4 mb-6 text-left">
                        <h4 className="text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-2">
                            What you can do:
                        </h4>
                        <ul className="text-sm text-zinc-600 dark:text-zinc-400 space-y-2">
                            <li className="flex items-start gap-2">
                                <span className="text-amber-500 mt-0.5">•</span>
                                <span>Switch to an L1 chain that has this precompile enabled</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-amber-500 mt-0.5">•</span>
                                <span>Deploy a new L1 with this precompile in the genesis configuration</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-amber-500 mt-0.5">•</span>
                                <span>Enable this precompile via an upgrade (if you have admin access)</span>
                            </li>
                        </ul>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                        <button
                            onClick={() => openSwitchNetwork()}
                            className={cn(
                                "inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg",
                                "bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm",
                                "transition-colors"
                            )}
                        >
                            <ArrowRightLeft className="w-4 h-4" />
                            Switch Network
                        </button>
                        {resolvedDocsLink && (
                            <a
                                href={resolvedDocsLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={cn(
                                    "inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg",
                                    "bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700",
                                    "text-zinc-700 dark:text-zinc-300 font-medium text-sm",
                                    "transition-colors"
                                )}
                            >
                                <ExternalLink className="w-4 h-4" />
                                {docsLinkText}
                            </a>
                        )}
                    </div>

                    {/* Current chain info */}
                    <div className="mt-6 pt-6 border-t border-zinc-200 dark:border-zinc-700">
                        <p className="text-xs text-zinc-500 dark:text-zinc-500">
                            Connected to: <span className="font-medium text-zinc-700 dark:text-zinc-300">{chainName}</span>
                            {walletChainId && (
                                <span className="ml-1 text-zinc-400 dark:text-zinc-600">(Chain ID: {walletChainId})</span>
                            )}
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return <>{children}</>;
};
