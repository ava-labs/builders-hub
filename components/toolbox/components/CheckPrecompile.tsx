import { useState, useEffect } from "react";
import { useWalletStore } from "../stores/walletStore";
import { Alert } from "./Alert";

type PrecompileConfigKey =
    | "warpConfig"
    | "contractDeployerAllowListConfig"
    | "txAllowListConfig"
    | "feeManagerConfig"
    | "rewardManagerConfig"
    | "contractNativeMinterConfig";

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
    docsLinkText = "Learn how to activate this precompile"
}: CheckPrecompileProps) => {
    const { coreWalletClient, walletChainId } = useWalletStore();
    const [state, setState] = useState<PrecompileState>({
        isActive: false,
        isLoading: false,
        error: null
    });

    useEffect(() => {
        if (!coreWalletClient) return;

        const checkPrecompileStatus = async () => {
            setState(prev => ({ ...prev, isLoading: true, error: null }));

            try {
                const data = await coreWalletClient.getActiveRulesAt();
                const isActive = Boolean(data.precompiles?.[configKey]?.timestamp);
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

        checkPrecompileStatus();
    }, [coreWalletClient, configKey, walletChainId]);

    if (state.isLoading) {
        return (
            <div className="flex items-center justify-center p-8">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-white mx-auto" />
                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                        Checking {precompileName} availability...
                    </p>
                </div>
            </div>
        );
    }

    if (state.error) {
        return (
            <Alert variant="error">
                Error checking {precompileName}: {state.error}
            </Alert>
        );
    }

    if (!state.isActive) {
        return (
            <Alert variant="warning">
                {errorMessage || `${precompileName} is not available on this chain.`}
                {docsLink && (
                    <a
                        href={docsLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-block text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                    >
                        {docsLinkText} →
                    </a>
                )}
            </Alert>
        );
    }

    return <>{children}</>;
}; 
