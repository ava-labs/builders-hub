import { useMemo, useCallback } from "react";
import { useWalletStore } from "../stores/walletStore";
import { Wallet, Coins, Network } from "lucide-react";
import { useWalletSwitch } from "./useWalletSwitch";

export enum WalletRequirementsConfigKey {
    HasCoreWallet = "hasCoreWallet",
    CoreWalletConnected = "coreWalletConnected",
    TestnetRequired = "testnetRequired",
    CChainBalance = "cChainBalance",
    PChainBalance = "pChainBalance",
    EVMChainBalance = "evmChainBalance"
}

type ActionType = 'redirect' | 'connect' | 'faucet' | 'network' | 'conditional';

interface BaseAction {
    type: ActionType;
    label: string;
    title: string;
    description: string;
}

interface RedirectAction extends BaseAction {
    type: 'redirect';
    link: string;
    target?: string;
}

interface ConnectAction extends BaseAction {
    type: 'connect';
}

interface NetworkAction extends BaseAction {
    type: 'network';
}

interface ConditionalAction extends BaseAction {
    type: 'conditional';
    conditions: {
        condition: (walletState: any) => boolean;
        action: RedirectAction | ConnectAction | NetworkAction;
    }[];
    fallback?: RedirectAction | ConnectAction | NetworkAction;
}

type WalletAction = RedirectAction | ConnectAction | NetworkAction | ConditionalAction;

// Reusable action constants
const ACTIONS = {
    DOWNLOAD_CORE_WALLET: {
        type: 'redirect' as const,
        label: 'Download',
        title: 'Download Core Wallet',
        description: 'Download the Core wallet to continue',
        link: 'https://core.app/download',
        target: '_blank'
    },
    CONNECT_WALLET: {
        type: 'connect' as const,
        label: 'Connect',
        title: 'Connect Wallet',
        description: 'Connect your Core wallet to continue'
    },
    SWITCH_TO_TESTNET: {
        type: 'network' as const,
        label: 'Switch',
        title: 'Switch to Testnet',
        description: 'Switch to testnet if currently on mainnet'
    },
    GET_TESTNET_TOKENS: {
        type: 'redirect' as const,
        label: 'Faucet',
        title: 'Get Testnet Tokens',
        description: 'Get free tokens from the testnet faucet',
        link: '/console/primary-network/faucet'
    },
    BUY_AVAX: {
        type: 'redirect' as const,
        label: 'Buy AVAX',
        title: 'Buy AVAX',
        description: 'Buy AVAX from a supported on-ramp or exchange',
        link: 'https://core.app/buy',
        target: '_blank'
    },
    TRANSFER_C_TO_P: {
        type: 'redirect' as const,
        label: 'Bridge',
        title: 'Bridge from C-Chain',
        description: 'Bridge AVAX from C-Chain to P-Chain',
        link: '/console/primary-network/c-p-bridge'
    }
} as const;

interface WalletState {
    coreWalletClient: any;
    isTestnet?: boolean;
    walletEVMAddress: string;
    walletChainId: number;
    pChainAddress: string;
    pChainBalance: number;
    cChainBalance: number;
    selectedL1Balance: number;
    bootstrapped: boolean;
    isLoading: {
        pChain: boolean;
        cChain: boolean;
        l1Chains: Record<string, boolean>;
    };
}

interface WalletRequirementConfig {
    id: string;
    title: string;
    description: string;
    icon: any;
    action: WalletAction;
    alternativeActions?: WalletAction[]; // Alternative ways to meet this requirement
    prerequisites?: WalletRequirementsConfigKey[]; // Prerequisites that must be met first
    getStatus: (walletState: WalletState) => { met: boolean; waiting: boolean };
}

interface WalletRequirement extends Omit<WalletRequirementConfig, 'action'> {
    met: boolean;
    waiting: boolean;
    prerequisiteNotMet?: WalletRequirementsConfigKey; // Which prerequisite is not met (if any)
    action: WalletAction | null; // Override to allow null when no action is available
}

// Constants for each requirement type
const WALLET_REQUIREMENTS: Record<WalletRequirementsConfigKey, WalletRequirementConfig> = {
    [WalletRequirementsConfigKey.HasCoreWallet]: {
        id: 'has-core-wallet',
        title: 'Core wallet that is installed',
        description: 'Download the Core wallet to continue',
        icon: Wallet,
        action: ACTIONS.DOWNLOAD_CORE_WALLET,
        getStatus: (walletState: WalletState) => ({
            met: walletState.bootstrapped,
            waiting: false // Core wallet detection is immediate
        })
    },
    [WalletRequirementsConfigKey.CoreWalletConnected]: {
        id: 'core-wallet-connected',
        title: 'Core wallet that is connected',
        description: 'Connect your Core wallet to continue',
        icon: Wallet,
        prerequisites: [WalletRequirementsConfigKey.HasCoreWallet],
        action: ACTIONS.CONNECT_WALLET,
        getStatus: (walletState: WalletState) => ({
            met: !!walletState.walletEVMAddress,
            waiting: !!walletState.coreWalletClient && !walletState.bootstrapped
        })
    },
    [WalletRequirementsConfigKey.TestnetRequired]: {
        id: 'testnet-required',
        title: 'Connect to Testnet',
        description: 'Switch to testnet if currently on mainnet',
        icon: Network,
        prerequisites: [WalletRequirementsConfigKey.CoreWalletConnected],
        action: ACTIONS.SWITCH_TO_TESTNET,
        getStatus: (walletState: WalletState) => ({
            met: !!walletState.isTestnet,
            waiting: walletState.isTestnet === undefined
        })
    },
    [WalletRequirementsConfigKey.CChainBalance]: {
        id: 'c-chain-balance',
        title: 'C-Chain balance',
        description: 'You need tokens to pay for transaction fees',
        icon: Coins,
        prerequisites: [WalletRequirementsConfigKey.CoreWalletConnected],
        action: {
            type: 'conditional',
            label: 'Get Tokens',
            title: 'Get C-Chain Tokens',
            description: 'Get tokens for C-Chain transactions',
            conditions: [
                {
                    condition: (walletState) => walletState.isTestnet,
                    action: ACTIONS.GET_TESTNET_TOKENS
                },
                {
                    condition: (walletState) => !walletState.isTestnet,
                    action: ACTIONS.BUY_AVAX
                }
            ]
        },
        alternativeActions: [ACTIONS.SWITCH_TO_TESTNET],
        getStatus: (walletState: WalletState) => ({
            met: walletState.cChainBalance > 0,
            waiting: walletState.isLoading.cChain
        })
    },
    [WalletRequirementsConfigKey.PChainBalance]: {
        id: 'p-chain-balance',
        title: 'P-Chain balance',
        description: 'You need tokens to pay for transaction fees',
        icon: Coins,
        prerequisites: [WalletRequirementsConfigKey.CoreWalletConnected],
        action: {
            type: 'conditional',
            label: 'Get Tokens',
            title: 'Get P-Chain Tokens',
            description: 'Get tokens for P-Chain transactions',
            conditions: [
                {
                    condition: (walletState) => walletState.isTestnet,
                    action: ACTIONS.GET_TESTNET_TOKENS
                },
                {
                    condition: (walletState) => !walletState.isTestnet && walletState.cChainBalance > 0,
                    action: ACTIONS.TRANSFER_C_TO_P
                }
            ]
        },
        alternativeActions: [ACTIONS.SWITCH_TO_TESTNET],
        getStatus: (walletState: WalletState) => ({
            met: walletState.pChainBalance > 0,
            waiting: walletState.isLoading.pChain
        })
    },
    [WalletRequirementsConfigKey.EVMChainBalance]: {
        id: 'evm-chain-balance',
        title: 'EVM Chain balance',
        description: 'You need tokens to pay for transaction fees',
        icon: Coins,
        prerequisites: [WalletRequirementsConfigKey.CoreWalletConnected],
        action: ACTIONS.SWITCH_TO_TESTNET,
        getStatus: (walletState: WalletState) => ({
            met: walletState.selectedL1Balance > 0,
            waiting: walletState.isLoading.l1Chains[walletState.walletChainId.toString()]
        })
    }
};

export function useWalletRequirements(configKey: WalletRequirementsConfigKey | WalletRequirementsConfigKey[]) {
    // Subscribe to each state individually to ensure reactivity
    const coreWalletClient = useWalletStore((s) => s.coreWalletClient);
    const isLoading = useWalletStore((s) => s.isLoading);
    const isTestnet = useWalletStore((s) => s.isTestnet);
    const walletEVMAddress = useWalletStore((s) => s.walletEVMAddress);
    const pChainAddress = useWalletStore((s) => s.pChainAddress);
    const cChainBalance = useWalletStore((s) => s.balances.cChain);
    const pChainBalance = useWalletStore((s) => s.balances.pChain);
    const walletChainId = useWalletStore((s) => s.walletChainId);
    const selectedL1Balance = useWalletStore((s) => s.balances.l1Chains[walletChainId.toString()]);
    const bootstrapped = useWalletStore((s) => s.getBootstrapped());

    const { safelySwitch } = useWalletSwitch();

    // Create wallet state object to pass to requirement status functions (memoized to prevent excessive re-renders)
    const walletState: WalletState = useMemo(() => ({
        coreWalletClient,
        isTestnet,
        walletEVMAddress,
        walletChainId,
        pChainAddress,
        pChainBalance,
        cChainBalance,
        selectedL1Balance,
        bootstrapped,
        isLoading,
    }), [coreWalletClient, isTestnet, walletEVMAddress, walletChainId, pChainAddress, pChainBalance, cChainBalance, selectedL1Balance, bootstrapped, isLoading]);

    // Action functions for each requirement
    const handleConnectWallet = async () => {
        if (typeof window === 'undefined') return;

        try {
            if (!window.avalanche?.request) {
                console.error('Core wallet not found');
                return;
            }

            const accounts = await window.avalanche.request<string[]>({
                method: 'eth_requestAccounts',
            });

            if (!accounts || accounts.length === 0) {
                throw new Error('No accounts returned from wallet');
            }

        } catch (error) {
            console.error('Error connecting wallet:', error);
        }
    };

    const handleSwitchToTestnet = async () => {
        await safelySwitch(43113, true); // Fuji testnet chain ID and testnet flag
    };

    // Resolve conditional actions based on current wallet state
    const resolveConditionalAction = useCallback((conditionalAction: ConditionalAction): RedirectAction | ConnectAction | NetworkAction | null => {
        // Check conditions in order
        for (const condition of conditionalAction.conditions) {
            if (condition.condition(walletState)) {
                return condition.action;
            }
        }

        // Return fallback if available, otherwise null
        return conditionalAction.fallback || null;
    }, [walletState]);

    // Action handler dispatcher
    const handleAction = (requirement: WalletRequirement) => {
        if (!requirement.action) {
            console.log('No action available for requirement:', requirement.id);
            return;
        }

        let actionToExecute = requirement.action;

        // Resolve conditional actions first
        if (requirement.action.type === 'conditional') {
            const resolved = resolveConditionalAction(requirement.action);
            if (!resolved) {
                console.log('No action available for requirement:', requirement.id);
                return;
            }
            actionToExecute = resolved;
        }

        switch (actionToExecute.type) {
            case 'redirect':
                if ('link' in actionToExecute) {
                    window.open(actionToExecute.link, actionToExecute.target || '_self');
                }
                break;
            case 'connect':
                handleConnectWallet();
                break;
            case 'network':
                handleSwitchToTestnet();
                break;
            default:
                console.log('Unknown action:', actionToExecute);
        }
    };

    // Function to recursively collect all prerequisites in dependency order (prerequisites first)
    const collectAllRequirements = useCallback((keys: WalletRequirementsConfigKey[]): WalletRequirementsConfigKey[] => {
        const result: WalletRequirementsConfigKey[] = [];
        const visited = new Set<WalletRequirementsConfigKey>();

        const collectRecursive = (key: WalletRequirementsConfigKey) => {
            if (visited.has(key)) return; // Prevent infinite loops
            visited.add(key);

            const requirement = WALLET_REQUIREMENTS[key];
            if (!requirement) return;

            // First, recursively add prerequisites (they come first)
            if (requirement.prerequisites) {
                for (const prereqKey of requirement.prerequisites) {
                    collectRecursive(prereqKey);
                }
            }

            // Then add current requirement (after its prerequisites)
            result.push(key);
        };

        // Collect all requirements starting from the requested keys
        for (const key of keys) {
            collectRecursive(key);
        }

        return result;
    }, []);

    // Build requirements array programmatically based on configKey
    const requirements = useMemo(() => {
        const requestedKeys = Array.isArray(configKey) ? configKey : [configKey];
        const allKeys = collectAllRequirements(requestedKeys);

        return allKeys.map(key => {
            const requirement = WALLET_REQUIREMENTS[key];

            // Check prerequisites first
            let prerequisiteNotMet: WalletRequirementsConfigKey | undefined;
            let met = false;
            let waiting = false;
            let resolvedAction: WalletAction | null = requirement.action;

            if (requirement.prerequisites) {
                // Check if any prerequisite is not met
                for (const prereqKey of requirement.prerequisites) {
                    const prereqRequirement = WALLET_REQUIREMENTS[prereqKey];
                    const prereqStatus = prereqRequirement.getStatus(walletState);

                    if (!prereqStatus.met || prereqStatus.waiting) {
                        prerequisiteNotMet = prereqKey;
                        met = false;
                        waiting = true; // Always waiting if prerequisite not met
                        break;
                    }
                }
            }

            // If all prerequisites are met, check the actual requirement
            if (!prerequisiteNotMet) {
                const status = requirement.getStatus(walletState);
                met = status.met;
                waiting = status.waiting;

                // Resolve conditional actions for display
                if (requirement.action.type === 'conditional') {
                    const resolved = resolveConditionalAction(requirement.action);
                    if (!resolved) {
                        // Show requirement but with no action available
                        resolvedAction = null;
                    } else {
                        resolvedAction = resolved;
                    }
                }
            }

            return {
                ...requirement,
                action: resolvedAction as WalletAction | null,
                met,
                waiting,
                prerequisiteNotMet
            };
        });
    }, [configKey, walletState, resolveConditionalAction, collectAllRequirements]);

    // Check if all requirements are met
    const allRequirementsMet = useMemo(() => {
        return requirements.every(req => req.met && !req.waiting);
    }, [requirements]);

    // Get unmet requirements
    const unmetRequirements = useMemo(() => {
        return requirements.filter(req => !req.met || req.waiting);
    }, [requirements]);

    return {
        requirements,
        allRequirementsMet,
        unmetRequirements,
        handleAction,
        // Individual action handlers for direct use
        handleConnectWallet,
        handleSwitchToTestnet,
    };
}
