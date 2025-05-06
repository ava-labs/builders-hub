"use client";

import { useSelectedL1, useToolboxStore, useViemChainStore } from "../toolboxStore";
import { useWalletStore } from "../../lib/walletStore";
import { useErrorBoundary } from "react-error-boundary";
import { useState, useEffect } from "react";
import { Button } from "../../components/Button";
import { Success } from "../../components/Success";
import { createPublicClient, http, Address } from "viem";
import { Input, Suggestion } from "../../components/Input";
import INativeMinterABI from "../../../contracts/icm-contracts/compiled/INativeMinter.json";

// Native Minter Precompile address - fixed across all Avalanche L1s
const NATIVE_MINTER_ADDRESS = "0x0200000000000000000000000000000000000001";

// Roles from IAllowList.sol
const ROLE_NONE = 0;
const ROLE_MANAGER = 1;
const ROLE_ENABLED = 2;
const ROLE_ADMIN = 3;

export default function TempNativeMinter() {
    const { showBoundary } = useErrorBoundary();
    const { nativeTokenRemoteAddress } = useToolboxStore();
    const { coreWalletClient } = useWalletStore();
    const viemChain = useViemChainStore();
    const [targetAddress, setTargetAddress] = useState<Address | "">("");
    const [isProcessing, setIsProcessing] = useState(false);
    const [lastTxId, setLastTxId] = useState<string>();
    const [localError, setLocalError] = useState("");
    const [currentRole, setCurrentRole] = useState<number | null>(null);
    const [isCheckingRole, setIsCheckingRole] = useState(false);
    const selectedL1 = useSelectedL1()();
    if (!selectedL1) return null;

    const addressSuggestions: Suggestion[] = nativeTokenRemoteAddress
        ? [{
            title: nativeTokenRemoteAddress,
            value: nativeTokenRemoteAddress,
            description: "Native Token Remote Address"
        }]
        : [];

    // Fetch current role when targetAddress changes
    useEffect(() => {
        const checkCurrentRole = async () => {
            if (!targetAddress || !viemChain || !isValidAddress(targetAddress)) {
                setCurrentRole(null);
                return;
            }

            setIsCheckingRole(true);
            setLocalError("");
            try {
                const publicClient = createPublicClient({
                    chain: viemChain,
                    transport: http(viemChain.rpcUrls.default.http[0])
                });

                const role = await publicClient.readContract({
                    address: NATIVE_MINTER_ADDRESS,
                    abi: INativeMinterABI.abi,
                    functionName: 'readAllowList',
                    args: [targetAddress]
                });

                setCurrentRole(Number(role as bigint));
            } catch (error: any) {
                console.error("Error checking current role:", error);
                setLocalError(`Error checking role: ${error.shortMessage || error.message}`);
                setCurrentRole(null);
            } finally {
                setIsCheckingRole(false);
            }
        };

        checkCurrentRole();
    }, [targetAddress, viemChain]);

    // Simple address validation
    const isValidAddress = (addr: string): addr is Address => /^0x[a-fA-F0-9]{40}$/.test(addr);

    // Generic handler for setting roles
    async function handleSetRole(functionName: 'setAdmin' | 'setEnabled' | 'setManager' | 'setNone', newRole: number) {
        if (!targetAddress || !viemChain || !coreWalletClient?.account || !isValidAddress(targetAddress)) {
            setLocalError("Valid target address and wallet connection required.");
            return;
        }

        setLocalError("");
        setIsProcessing(true);
        setLastTxId(undefined);

        try {
            const publicClient = createPublicClient({
                chain: viemChain,
                transport: http(viemChain.rpcUrls.default.http[0])
            });

            // Simulate the transaction
            const { request } = await publicClient.simulateContract({
                address: NATIVE_MINTER_ADDRESS,
                abi: INativeMinterABI.abi,
                functionName: functionName,
                args: [targetAddress],
                chain: viemChain,
                account: coreWalletClient.account, // Pass account for simulation
            });

            // Send the transaction
            const hash = await coreWalletClient.writeContract(request);
            setLastTxId(hash);

            // Wait for confirmation
            await publicClient.waitForTransactionReceipt({ hash });
            setLocalError(""); // Clear error on success
            setCurrentRole(newRole); // Update displayed role

        } catch (error: any) {
            console.error(`${functionName} failed:`, error);
            setLocalError(`Operation failed: ${error.shortMessage || error.message}`);
            showBoundary(error);
        } finally {
            setIsProcessing(false);
        }
    }

    // Get role name for display
    function getRoleName(role: number | null): string {
        if (role === null) return "-";
        switch (role) {
            case ROLE_NONE: return "None";
            case ROLE_MANAGER: return "Manager";
            case ROLE_ENABLED: return "Enabled";
            case ROLE_ADMIN: return "Admin";
            default: return "Unknown";
        }
    }

    const isAddressValid = isValidAddress(targetAddress);

    return (
        <div className="space-y-4">
            <h2 className="text-lg font-semibold">Manage Native Minter Permissions</h2>

            <div className="space-y-4">
                <p>
                    Enter an address to view its current role in the Native Minter precompile
                    and set a new role (Admin, Enabled, Manager, or None).
                </p>

                <Input
                    label="Target Address"
                    value={targetAddress}
                    onChange={(value) => setTargetAddress(value as Address)}
                    required
                    error={targetAddress && !isAddressValid ? "Invalid address format" : undefined}
                    suggestions={addressSuggestions}
                    placeholder="0x..."
                />

                {targetAddress && isAddressValid && (
                    <div className="mt-2">
                        Current Role: {" "}
                        {isCheckingRole ? (
                            <span className="text-gray-500">Checking...</span>
                        ) : (
                            <span className="font-medium">{getRoleName(currentRole)}</span>
                        )}
                    </div>
                )}

                {localError && <div className="text-red-500 mt-2">{localError}</div>}

                <div className="flex gap-2 pt-2 border-t mt-4">
                    <Button
                        onClick={() => handleSetRole('setAdmin', ROLE_ADMIN)}
                        loading={isProcessing && currentRole !== ROLE_ADMIN} // Show loading only if this button was clicked
                        disabled={isProcessing || !isAddressValid || currentRole === ROLE_ADMIN || isCheckingRole}
                    >
                        Set Admin
                    </Button>
                    <Button
                        onClick={() => handleSetRole('setEnabled', ROLE_ENABLED)}
                        loading={isProcessing && currentRole !== ROLE_ENABLED}
                        disabled={isProcessing || !isAddressValid || currentRole === ROLE_ENABLED || isCheckingRole}
                    >
                        Set Enabled
                    </Button>
                    <Button
                        onClick={() => handleSetRole('setManager', ROLE_MANAGER)}
                        loading={isProcessing && currentRole !== ROLE_MANAGER}
                        disabled={isProcessing || !isAddressValid || currentRole === ROLE_MANAGER || isCheckingRole}
                    >
                        Set Manager
                    </Button>
                    <Button
                        onClick={() => handleSetRole('setNone', ROLE_NONE)}
                        loading={isProcessing && currentRole !== ROLE_NONE}
                        disabled={isProcessing || !isAddressValid || currentRole === ROLE_NONE || isCheckingRole}
                    >
                        Set None
                    </Button>
                </div>

                {lastTxId && (
                    <div className="mt-4 space-y-2">
                        <Success
                            label="Last Transaction ID"
                            value={lastTxId}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}
