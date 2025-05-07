"use client";

import { useSelectedL1, useToolboxStore, useViemChainStore, getToolboxStore, useL1ByChainId } from "../toolboxStore";
import { useWalletStore } from "../../lib/walletStore";
import { useErrorBoundary } from "react-error-boundary";
import { useState, useCallback, useEffect, useMemo } from "react";
import { Button } from "../../components/Button";
import { Success } from "../../components/Success";
import ERC20TokenHomeABI from "../../../contracts/icm-contracts/compiled/ERC20TokenHome.json";
import ExampleERC20ABI from "../../../contracts/icm-contracts/compiled/ExampleERC20.json";
import { createPublicClient, http, formatUnits, parseUnits, Address } from "viem";
import { Input, Suggestion } from "../../components/Input";
import { EVMAddressInput } from "../components/EVMAddressInput";
import { utils } from "@avalabs/avalanchejs";
import { Note } from "../../components/Note";
import SelectChainID from "../components/SelectChainID";

export default function AddColateral() {
    const { showBoundary } = useErrorBoundary();
    const { erc20TokenRemoteAddress, nativeTokenRemoteAddress } = useToolboxStore();
    const { coreWalletClient, walletEVMAddress } = useWalletStore();
    const viemChain = useViemChainStore();
    const selectedL1 = useSelectedL1()();
    const [sourceChainId, setSourceChainId] = useState<string>("");
    const [remoteContractAddress, setRemoteContractAddress] = useState<Address | "">("");
    const [amount, setAmount] = useState("");
    const [isProcessing, setIsProcessing] = useState(false);
    const [lastApprovalTxId, setLastApprovalTxId] = useState<string>();
    const [lastAddCollateralTxId, setLastAddCollateralTxId] = useState<string>();
    const [localError, setLocalError] = useState("");
    const [tokenAddress, setTokenAddress] = useState<Address | null>(null);
    const [tokenDecimals, setTokenDecimals] = useState<number | null>(null);
    const [tokenSymbol, setTokenSymbol] = useState<string | null>(null);
    const [allowance, setAllowance] = useState<bigint | null>(null);
    const [collateralInfo, setCollateralInfo] = useState<{ needed: bigint, remaining: bigint | null } | null>(null);
    const [isCheckingStatus, setIsCheckingStatus] = useState(false);
    const [isCollateralized, setIsCollateralized] = useState<boolean | null>(null);
    const [isAutoFilled, setIsAutoFilled] = useState(false);

    const sourceL1 = useL1ByChainId(sourceChainId)();
    const sourceToolboxStore = getToolboxStore(sourceChainId)();

    let sourceChainError: string | undefined = undefined;
    if (!sourceChainId) {
        sourceChainError = "Please select a source chain";
    } else if (selectedL1?.id === sourceChainId) {
        sourceChainError = "Source and destination chains must be different";
    }

    const remoteBlockchainIDHex = useMemo(() => {
        if (!selectedL1?.id) return null;
        try {
            return utils.bufferToHex(utils.base58check.decode(selectedL1.id));
        } catch (e) {
            console.error("Error decoding remote chain ID:", e);
            return null;
        }
    }, [selectedL1?.id]);

    const fetchStatus = useCallback(async () => {
        if (!sourceL1?.rpcUrl || !walletEVMAddress || !remoteContractAddress || !remoteBlockchainIDHex || !sourceToolboxStore.erc20TokenHomeAddress || !viemChain) {
            setTokenAddress(null);
            setTokenDecimals(null);
            setTokenSymbol(null);
            setAllowance(null);
            setCollateralInfo(null);
            setIsCollateralized(null);
            return;
        }

        setIsCheckingStatus(true);
        setLocalError("");
        setIsAutoFilled(false);
        try {
            const homePublicClient = createPublicClient({
                transport: http(sourceL1.rpcUrl)
            });

            const remotePublicClient = createPublicClient({
                chain: viemChain,
                transport: http(viemChain.rpcUrls.default.http[0])
            });

            // 1. Get Token Address from Home Contract
            const fetchedTokenAddress = await homePublicClient.readContract({
                address: sourceToolboxStore.erc20TokenHomeAddress as Address,
                abi: ERC20TokenHomeABI.abi,
                functionName: 'getTokenAddress',
            }) as Address;
            setTokenAddress(fetchedTokenAddress);

            // 2. Get Token Details and Allowance
            const [fetchedDecimals, fetchedSymbol, fetchedAllowance] = await Promise.all([
                homePublicClient.readContract({
                    address: fetchedTokenAddress,
                    abi: ExampleERC20ABI.abi,
                    functionName: 'decimals',
                }),
                homePublicClient.readContract({
                    address: fetchedTokenAddress,
                    abi: ExampleERC20ABI.abi,
                    functionName: 'symbol',
                }),
                homePublicClient.readContract({
                    address: fetchedTokenAddress,
                    abi: ExampleERC20ABI.abi,
                    functionName: 'allowance',
                    args: [walletEVMAddress as Address, sourceToolboxStore.erc20TokenHomeAddress as Address]
                })
            ]);
            setTokenDecimals(Number(fetchedDecimals as bigint));
            setTokenSymbol(fetchedSymbol as string);
            setAllowance(fetchedAllowance as bigint);

            // Check if the remote contract is collateralized
            try {
                // First try with getIsCollateralized which is in NativeTokenRemote
                const collateralized = await remotePublicClient.readContract({
                    address: remoteContractAddress as Address,
                    abi: [{
                        type: 'function',
                        name: 'getIsCollateralized',
                        inputs: [],
                        outputs: [{ type: 'bool', name: '' }],
                        stateMutability: 'view'
                    }],
                    functionName: 'getIsCollateralized'
                }).catch(async () => {
                    // If that fails, try with isCollateralized which might be in other contract types
                    return await remotePublicClient.readContract({
                        address: remoteContractAddress as Address,
                        abi: [{
                            type: 'function',
                            name: 'isCollateralized',
                            inputs: [],
                            outputs: [{ type: 'bool', name: '' }],
                            stateMutability: 'view'
                        }],
                        functionName: 'isCollateralized'
                    }).catch(() => null);
                });

                setIsCollateralized(collateralized as boolean);
            } catch (error) {
                console.error("Failed to check collateralization status:", error);
                setIsCollateralized(null);
            }

            // 3. Get Collateral Info
            const settings = await homePublicClient.readContract({
                address: sourceToolboxStore.erc20TokenHomeAddress as Address,
                abi: ERC20TokenHomeABI.abi,
                functionName: 'getRemoteTokenTransferrerSettings',
                args: [remoteBlockchainIDHex, remoteContractAddress]
            }) as { registered: boolean, collateralNeeded: bigint, tokenMultiplier: bigint, multiplyOnRemote: boolean };

            let remaining = null;
            if (settings.registered) {
                // For simplicity, we're just showing the needed amount
            }

            setCollateralInfo({ needed: settings.collateralNeeded, remaining });

        } catch (error: any) {
            console.error("Error fetching status:", error);
            setLocalError(`Error fetching status: ${error.shortMessage || error.message}`);
            setTokenAddress(null);
            setTokenDecimals(null);
            setTokenSymbol(null);
            setAllowance(null);
            setCollateralInfo(null);
            setIsCollateralized(null);
        } finally {
            setIsCheckingStatus(false);
        }
    }, [sourceL1?.rpcUrl, walletEVMAddress, remoteContractAddress, remoteBlockchainIDHex, sourceToolboxStore.erc20TokenHomeAddress, viemChain]);

    // Autofill amount when collateral info is loaded
    useEffect(() => {
        if (collateralInfo?.needed && collateralInfo.needed > 0n && tokenDecimals !== null && !isAutoFilled) {
            const neededAmountFormatted = formatUnits(collateralInfo.needed, tokenDecimals);
            setAmount(neededAmountFormatted);
            setIsAutoFilled(true);
        }
        else if ((!collateralInfo?.needed || collateralInfo.needed === 0n) && isAutoFilled) {
            setIsAutoFilled(false);
        }
    }, [collateralInfo?.needed, tokenDecimals, isAutoFilled]);

    useEffect(() => {
        fetchStatus();
    }, [fetchStatus]);

    const handleApprove = async () => {
        if (!sourceL1?.rpcUrl || !coreWalletClient?.account || !sourceToolboxStore.erc20TokenHomeAddress || !tokenAddress || tokenDecimals === null || !amount) {
            setLocalError("Missing required information for approval.");
            return;
        }

        setLocalError("");
        setIsProcessing(true);
        setLastApprovalTxId(undefined);

        try {
            const publicClient = createPublicClient({
                transport: http(sourceL1.rpcUrl)
            });

            const amountParsed = parseUnits(amount, tokenDecimals);

            const { request } = await publicClient.simulateContract({
                address: tokenAddress,
                abi: ExampleERC20ABI.abi,
                functionName: 'approve',
                args: [sourceToolboxStore.erc20TokenHomeAddress as Address, amountParsed],
                account: coreWalletClient.account,
            });

            const hash = await coreWalletClient.writeContract(request);
            setLastApprovalTxId(hash);

            await publicClient.waitForTransactionReceipt({ hash });
            await fetchStatus();

        } catch (error: any) {
            console.error("Approval failed:", error);
            setLocalError(`Approval failed: ${error.shortMessage || error.message}`);
            showBoundary(error);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleAddCollateral = async () => {
        if (!sourceL1?.rpcUrl || !coreWalletClient?.account || !sourceToolboxStore.erc20TokenHomeAddress || tokenDecimals === null || !amount || !remoteContractAddress || !remoteBlockchainIDHex) {
            setLocalError("Missing required information to add collateral.");
            return;
        }

        setLocalError("");
        setIsProcessing(true);
        setLastAddCollateralTxId(undefined);

        try {
            const publicClient = createPublicClient({
                transport: http(sourceL1.rpcUrl)
            });

            const amountParsed = parseUnits(amount, tokenDecimals);

            if (allowance === null || allowance < amountParsed) {
                setLocalError(`Insufficient allowance. Please approve at least ${amount} ${tokenSymbol || 'tokens'}.`);
                setIsProcessing(false);
                return;
            }

            const { request } = await publicClient.simulateContract({
                address: sourceToolboxStore.erc20TokenHomeAddress as Address,
                abi: ERC20TokenHomeABI.abi,
                functionName: 'addCollateral',
                args: [remoteBlockchainIDHex as `0x${string}`, remoteContractAddress as Address, amountParsed],
                account: coreWalletClient.account,
            });

            const hash = await coreWalletClient.writeContract(request);
            setLastAddCollateralTxId(hash);

            await publicClient.waitForTransactionReceipt({ hash });
            await fetchStatus();

        } catch (error: any) {
            console.error("Add Collateral failed:", error);
            setLocalError(`Add Collateral failed: ${error.shortMessage || error.message}`);
            showBoundary(error);
        } finally {
            setIsProcessing(false);
        }
    };

    const amountParsed = useMemo(() => {
        if (!amount || tokenDecimals === null) return 0n;
        try {
            return parseUnits(amount, tokenDecimals);
        } catch {
            return 0n;
        }
    }, [amount, tokenDecimals]);

    const hasSufficientAllowance = useMemo(() => {
        if (allowance === null || amountParsed === 0n) return false;
        return allowance >= amountParsed;
    }, [allowance, amountParsed]);

    const isValidAmount = amountParsed > 0n;

    const remoteContractSuggestions: Suggestion[] = useMemo(() => {
        const suggestions: Suggestion[] = [];
        if (erc20TokenRemoteAddress) {
            suggestions.push({
                title: erc20TokenRemoteAddress,
                value: erc20TokenRemoteAddress,
                description: `ERC20 Token Remote on ${selectedL1?.name}`
            });
        }
        if (nativeTokenRemoteAddress) {
            suggestions.push({
                title: nativeTokenRemoteAddress,
                value: nativeTokenRemoteAddress,
                description: `Native Token Remote on ${selectedL1?.name}`
            });
        }
        return suggestions;
    }, [erc20TokenRemoteAddress, nativeTokenRemoteAddress, selectedL1?.name]);

    return (
        <div className="space-y-4">
            <h2 className="text-lg font-semibold">Add Collateral to Home Bridge</h2>

            <div className="space-y-4">
                <p>
                    Approve and add collateral (ERC20 tokens) to the Token Home contract
                    on the source chain for a remote bridge contract on the current chain ({selectedL1?.name}).
                </p>

                <SelectChainID
                    label="Source Chain (where token home is deployed)"
                    value={sourceChainId}
                    onChange={(value) => setSourceChainId(value)}
                    error={sourceChainError}
                />

                {sourceChainId && !sourceToolboxStore.erc20TokenHomeAddress &&
                    <Note variant="warning">
                        ERC20 Token Home address for {sourceL1?.name} not found. Please deploy it first.
                    </Note>
                }

                <EVMAddressInput
                    label={`Remote Contract Address (on ${selectedL1?.name})`}
                    value={remoteContractAddress}
                    onChange={(value) => setRemoteContractAddress(value as Address)}
                    disabled={isProcessing}
                    
                    suggestions={remoteContractSuggestions}
                    placeholder="0x... (Native or ERC20 Remote)"
                />

                {isCheckingStatus && <div className="text-gray-500">Checking status...</div>}

                {tokenAddress && tokenSymbol && tokenDecimals !== null && (
                    <div className="p-3 border rounded-md text-sm space-y-1 bg-gray-100 dark:bg-gray-800">
                        <div>Collateral Token: <code className="font-mono">{tokenSymbol}</code></div>
                        <div>Token Address: <code className="font-mono">{tokenAddress}</code></div>
                        <div>Token Decimals: <code className="font-mono">{tokenDecimals}</code></div>
                        {allowance !== null && (
                            <div>Current Allowance for Home Contract: <code className="font-mono">{formatUnits(allowance, tokenDecimals)} {tokenSymbol}</code></div>
                        )}
                        {collateralInfo !== null && (
                            <div>Collateral Needed: <code className="font-mono">{formatUnits(collateralInfo.needed, tokenDecimals)} {tokenSymbol}</code></div>
                        )}
                        {isCollateralized !== null && (
                            <div className="mt-2 font-medium">
                                Collateralization Status: {' '}
                                {isCollateralized ? (
                                    <span className="text-green-600 dark:text-green-400">✅ Fully Collateralized</span>
                                ) : (
                                    <span className="text-red-600 dark:text-red-400">⚠️ Not Collateralized</span>
                                )}
                            </div>
                        )}
                    </div>
                )}

                <Input
                    label={`Amount of ${tokenSymbol || 'Tokens'} to Add as Collateral`}
                    value={amount}
                    onChange={(newAmount) => {
                        setAmount(newAmount);
                        if (isAutoFilled) {
                            const neededFormatted = tokenDecimals !== null && collateralInfo?.needed
                                ? formatUnits(collateralInfo.needed, tokenDecimals)
                                : '';
                            if (newAmount !== neededFormatted) {
                                setIsAutoFilled(false);
                            }
                        }
                    }}
                    type="number"
                    min="0"
                    step={tokenDecimals !== null ? `0.${'0'.repeat(tokenDecimals - 1)}1` : 'any'}
                    required
                    disabled={!tokenAddress || isCheckingStatus}
                    error={!isValidAmount && amount ? "Invalid amount" : undefined}
                    helperText={isAutoFilled ? "Autofilled with needed collateral" : ""}
                />

                {localError && <div className="text-red-500 mt-2 p-2 border border-red-300 rounded">{localError}</div>}

                <div className="flex gap-2 pt-2 border-t mt-4 flex-wrap">
                    <Button
                        onClick={handleApprove}
                        loading={isProcessing && !lastApprovalTxId}
                        disabled={isProcessing || !isValidAmount || !tokenAddress || hasSufficientAllowance || isCheckingStatus}
                        variant={hasSufficientAllowance ? "secondary" : "primary"}
                    >
                        {hasSufficientAllowance ? `Approved (${formatUnits(allowance ?? 0n, tokenDecimals ?? 18)} ${tokenSymbol})` : `1. Approve ${amount || 0} ${tokenSymbol || ''}`}
                    </Button>
                    <Button
                        onClick={handleAddCollateral}
                        loading={isProcessing && !lastAddCollateralTxId}
                        disabled={isProcessing || !isValidAmount || !tokenAddress || !hasSufficientAllowance || isCheckingStatus || collateralInfo === null}
                        variant={isCollateralized ? "secondary" : "primary"}
                    >
                        {isCollateralized ? "Add More Collateral" : "2. Add Collateral"}
                    </Button>
                    <Button
                        onClick={fetchStatus}
                        disabled={isCheckingStatus || !remoteContractAddress || !sourceChainId || !!sourceChainError}
                        variant="outline"
                        loading={isCheckingStatus}
                    >
                        Refresh Status
                    </Button>
                </div>

                {lastApprovalTxId && (
                    <Success label="Approval Transaction ID" value={lastApprovalTxId} />
                )}
                {lastAddCollateralTxId && (
                    <Success label="Add Collateral Transaction ID" value={lastAddCollateralTxId} />
                )}
            </div>
        </div>
    );
}
