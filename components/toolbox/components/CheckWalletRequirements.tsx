import { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { CheckCircle, XCircle, Wallet, Loader2, CircleMinus } from "lucide-react";
import { useWalletRequirements, type WalletRequirementsConfigKey } from "../hooks/useWalletRequirements";
import { useWalletStore } from "../stores/walletStore";

interface CheckWalletRequirementsProps {
    children: React.ReactNode;
    configKey: WalletRequirementsConfigKey | WalletRequirementsConfigKey[];
    errorMessage?: string;
}

interface PrecompileState {
    isActive: boolean;
    isLoading: boolean;
    error: string | null;
}

export const CheckWalletRequirements = ({
    children,
    configKey,
}: CheckWalletRequirementsProps) => {
    const { requirements, allRequirementsMet, handleAction } = useWalletRequirements(configKey);
    const { isTestnet } = useWalletStore();
    const [state, setState] = useState<PrecompileState>({
        isActive: false,
        isLoading: true, // Start with loading to prevent hydration mismatch
        error: null
    });
    const [isHydrated, setIsHydrated] = useState(false);

    // Handle hydration
    useEffect(() => {
        setIsHydrated(true);
    }, []);

    useEffect(() => {
        if (!isHydrated) return; // Wait for hydration before checking requirements

        const checkWalletRequirements = async () => {
            setState(prev => ({ ...prev, isLoading: true, error: null }));

            // Simulate a brief loading state
            setTimeout(() => {
                if (allRequirementsMet) {
                    setState({ isLoading: false, isActive: true, error: null });
                } else {
                    setState({ isLoading: false, isActive: false, error: null });
                }
            }, 100);
        };

        checkWalletRequirements();
    }, [allRequirementsMet, isHydrated]);

    if (state.isLoading) {
        return (
            <div className="flex items-center justify-center p-4 h-[100vh]">
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-8 max-w-md w-full">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-white mx-auto" />
                        <p className="mt-4 text-sm text-gray-600 dark:text-gray-300">
                            Checking wallet requirements...
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    if (state.error) {
        return (
            <div className="flex items-center justify-center p-4 h-[100vh]">
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-8 max-w-md w-full">
                    <div className="text-center">
                        <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                            Error
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                            Error checking wallet requirements: {state.error}
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    if (!state.isActive) {
        return (
            <div className="flex items-center justify-center p-4 h-[100vh] not-prose">
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-8 max-w-md w-full">
                    {/* Header */}
                    <div className="text-center mb-6">
                        <div className="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Wallet className="h-6 w-6 text-gray-600 dark:text-gray-300" />
                        </div>
                        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                            To use this tool you need:
                        </h2>
                    </div>

                    {/* Requirements List */}
                    <div className="space-y-4 mb-6">
                        {requirements.map((requirement) => (
                            <div key={requirement.id} className="flex items-center gap-3">
                                <div className="flex-shrink-0">
                                    {requirement.prerequisiteNotMet ? (
                                        <CircleMinus className="h-5 w-5 text-gray-300" />
                                    ) : requirement.waiting ? (
                                        <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
                                    ) : requirement.met ? (
                                        <CheckCircle className="h-5 w-5 text-green-500" />
                                    ) : (
                                        <XCircle className="h-5 w-5 text-gray-400" />
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                                        {requirement.title}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* How to meet requirements section */}
                    {(() => {
                        // Get actionable requirements (not met, not waiting, no prerequisite blocking, and has action)
                        const actionableRequirements = requirements.filter(req => !req.met && !req.waiting && !req.prerequisiteNotMet && req.action);
                        
                        // Don't show the section if no actionable requirements
                        if (actionableRequirements.length === 0) {
                            return null;
                        }

                        return (
                            <div className="mb-6">
                                <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-4">
                                    How to meet these requirements:
                                </h3>
                                <div className="space-y-3">
                                    {(() => {
                                
                                // Group by unique action (title + description + link if redirect)
                                const uniqueActions = new Map();
                                
                                actionableRequirements.forEach(requirement => {
                                    // Process main action (we already filtered for non-null actions)
                                    const action = requirement.action!;
                                    const actionKey = `${action.title}-${action.description}-${action.type === 'redirect' && 'link' in action ? action.link : ''}`;
                                    
                                    if (!uniqueActions.has(actionKey)) {
                                        uniqueActions.set(actionKey, {
                                            action,
                                            requirement, // Use first requirement for handling
                                            relatedRequirements: [requirement.title],
                                            isAlternative: false
                                        });
                                    } else {
                                        // Add to related requirements
                                        uniqueActions.get(actionKey).relatedRequirements.push(requirement.title);
                                    }

                                    // Process alternative actions (only show on mainnet when user might want to switch to testnet)
                                    if (requirement.alternativeActions && !isTestnet) {
                                        requirement.alternativeActions.forEach(altAction => {
                                            const altActionKey = `alt-${altAction.title}-${altAction.description}-${altAction.type === 'redirect' && 'link' in altAction ? altAction.link : ''}`;
                                            
                                            if (!uniqueActions.has(altActionKey)) {
                                                uniqueActions.set(altActionKey, {
                                                    action: altAction,
                                                    requirement: { ...requirement, action: altAction },
                                                    relatedRequirements: [requirement.title],
                                                    isAlternative: true
                                                });
                                            } else {
                                                uniqueActions.get(altActionKey).relatedRequirements.push(requirement.title);
                                            }
                                        });
                                    }
                                });
                                
                                // Separate main actions from alternative actions
                                const mainActions = Array.from(uniqueActions.values()).filter(actionGroup => !actionGroup.isAlternative);
                                const alternativeActions = Array.from(uniqueActions.values()).filter(actionGroup => actionGroup.isAlternative);
                                
                                return (
                                    <>
                                        {/* Main Actions */}
                                        {mainActions.map((actionGroup, index) => (
                                            <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-700">
                                                <div className="flex-1">
                                                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                                                        {actionGroup.action.title}
                                                    </p>
                                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                                        {actionGroup.action.description}
                                                    </p>
                                                    {actionGroup.relatedRequirements.length > 1 && (
                                                        <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                                                            For: {actionGroup.relatedRequirements.join(', ')}
                                                        </p>
                                                    )}
                                                </div>
                                                <Button
                                                    onClick={() => handleAction(actionGroup.requirement)}
                                                    size="sm"
                                                    variant="default"
                                                    className={`cursor-pointer ${
                                                        actionGroup.requirement.id === 'core-wallet-connected'
                                                            ? 'bg-black text-white hover:bg-gray-800' 
                                                            : ''
                                                    }`}
                                                >
                                                    {actionGroup.action.label}
                                                </Button>
                                            </div>
                                        ))}
                                        
                                        {/* OR Separator and Alternative Actions */}
                                        {alternativeActions.length > 0 && (
                                            <>
                                                {/* OR Separator */}
                                                <div className="relative my-6">
                                                    <div className="absolute inset-0 flex items-center">
                                                        <div className="w-full border-t border-gray-300 dark:border-gray-600" />
                                                    </div>
                                                    <div className="relative flex justify-center text-sm">
                                                        <span className="px-2 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                                                            OR
                                                        </span>
                                                    </div>
                                                </div>
                                                
                                                {/* Alternative Actions Section */}
                                                <div className="space-y-3">
                                                    <h4 className="text-sm font-medium">
                                                        Just Learning or Testing?
                                                    </h4>
                                                    {alternativeActions.map((actionGroup, index) => (
                                                        <div key={`alt-${index}`} className="flex items-center justify-between p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                                                            <div className="flex-1">
                                                                <p className="text-sm font-medium text-blue-700 dark:text-blue-300">
                                                                    {actionGroup.action.title}
                                                                </p>
                                                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                                                    {actionGroup.action.description}
                                                                </p>
                                                                {actionGroup.relatedRequirements.length > 1 && (
                                                                    <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                                                                        For: {actionGroup.relatedRequirements.join(', ')}
                                                                    </p>
                                                                )}
                                                            </div>
                                                            <Button
                                                                onClick={() => handleAction(actionGroup.requirement)}
                                                                size="sm"
                                                                variant="outline"
                                                                className="cursor-pointer"
                                                            >
                                                                {actionGroup.action.label}
                                                            </Button>
                                                        </div>
                                                    ))}
                                                </div>
                                            </>
                                        )}
                                    </>
                                );
                                    })()}
                                </div>
                            </div>
                        );
                    })()}
                </div>
            </div>
        );
    }

    return <>{children}</>;
}; 
