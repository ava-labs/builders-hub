"use client";

import { useSelectedL1, useToolboxStore, useViemChainStore, type DeployOn } from "../toolboxStore";
import { useWalletStore } from "../../lib/walletStore";
import { useErrorBoundary } from "react-error-boundary";
import { useState, useCallback, useEffect, useMemo } from "react";
import { Button } from "../../components/Button";
import { Success } from "../../components/Success";
import { RadioGroup } from "../../components/RadioGroup";
import { avalancheFuji } from "viem/chains";
import ERC20TokenHomeABI from "../../../contracts/icm-contracts/compiled/ERC20TokenHome.json";
import ExampleERC20ABI from "../../../contracts/icm-contracts/compiled/ExampleERC20.json";
import { createPublicClient, http, formatUnits, parseUnits, Address } from "viem";
import { Input, Suggestion } from "../../components/Input";
import { utils } from "@avalabs/avalanchejs";
import { FUJI_C_BLOCKCHAIN_ID } from "./DeployERC20TokenRemote";
import { Note } from "../../components/Note";

export default function AddColateral() {
    const { showBoundary } = useErrorBoundary();
    const { erc20TokenHomeAddress, nativeTokenRemoteAddress, erc20TokenRemoteAddress } = useToolboxStore();
    const { coreWalletClient, walletEVMAddress } = useWalletStore();
    const viemChain = useViemChainStore();
    const [deployOn, setDeployOn] = useState<DeployOn>("C-Chain"); // Where the Home contract is
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
    const selectedL1 = useSelectedL1()();
    const [isAutoFilled, setIsAutoFilled] = useState(false); // Track if autofill happened

    if (!selectedL1) return null;

    const deployOnOptions = [
        { label: "Home on L1", value: "L1" },
        { label: "Home on C-Chain", value: "C-Chain" }
    ];

    const remoteDeployOn = useMemo(() => (deployOn === "L1" ? "C-Chain" : "L1"), [deployOn]);
    const homeContractAddress = erc20TokenHomeAddress?.[deployOn];
    const requiredChain = deployOn === "L1" ? viemChain : avalancheFuji;
    const remoteChain = deployOn === "L1" ? avalancheFuji : viemChain;

    const remoteBlockchainIDHex = useMemo(() => {
        if (!remoteChain || !selectedL1) return null;
        const chainIDBase58 = deployOn === "L1" ? FUJI_C_BLOCKCHAIN_ID : selectedL1.id;
        try {
            return utils.bufferToHex(utils.base58check.decode(chainIDBase58));
        } catch (e) {
            console.error("Error decoding remote chain ID:", e);
            return null;
        }
    }, [deployOn, remoteChain, selectedL1]);

    const remoteContractSuggestions: Suggestion[] = useMemo(() => {
        const suggestions: Suggestion[] = [];
        const nativeAddr = nativeTokenRemoteAddress?.[remoteDeployOn];
        const erc20Addr = erc20TokenRemoteAddress?.[remoteDeployOn];
        if (nativeAddr) {
            suggestions.push({ title: nativeAddr, value: nativeAddr, description: `Native Token Remote (${remoteDeployOn})` });
        }
        if (erc20Addr) {
            suggestions.push({ title: erc20Addr, value: erc20Addr, description: `ERC20 Token Remote (${remoteDeployOn})` });
        }
        return suggestions;
    }, [remoteDeployOn, nativeTokenRemoteAddress, erc20TokenRemoteAddress]);

    const fetchStatus = useCallback(async () => {
        if (!homeContractAddress || !requiredChain || !walletEVMAddress || !remoteContractAddress || !remoteBlockchainIDHex) {
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
        setIsAutoFilled(false); // Reset autofill flag on new fetch
        try {
            const publicClient = createPublicClient({
                transport: http(requiredChain.rpcUrls.default.http[0])
            });

            if (!remoteChain) throw new Error("Remote chain not found");

            const remotePublicClient = createPublicClient({
                transport: http(remoteChain.rpcUrls.default.http[0])
            });

            // 1. Get Token Address from Home Contract
            const fetchedTokenAddress = await publicClient.readContract({
                address: homeContractAddress as Address,
                abi: ERC20TokenHomeABI.abi,
                functionName: 'getTokenAddress',
            }) as Address;
            setTokenAddress(fetchedTokenAddress);

            // 2. Get Token Details (Decimals, Symbol) & Allowance
            const [fetchedDecimals, fetchedSymbol, fetchedAllowance] = await Promise.all([
                publicClient.readContract({
                    address: fetchedTokenAddress,
                    abi: ExampleERC20ABI.abi,
                    functionName: 'decimals',
                }),
                publicClient.readContract({
                    address: fetchedTokenAddress,
                    abi: ExampleERC20ABI.abi,
                    functionName: 'symbol',
                }),
                publicClient.readContract({
                    address: fetchedTokenAddress,
                    abi: ExampleERC20ABI.abi,
                    functionName: 'allowance',
                    args: [walletEVMAddress as Address, homeContractAddress as Address]
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
                    }).catch(() => null); // Return null if both fail
                });

                setIsCollateralized(collateralized as boolean);
            } catch (error) {
                console.error("Failed to check collateralization status:", error);
                setIsCollateralized(null);
            }

            // 3. Get Collateral Info
            const settings = await publicClient.readContract({
                address: homeContractAddress as Address,
                abi: ERC20TokenHomeABI.abi,
                functionName: 'getRemoteTokenTransferrerSettings',
                args: [remoteBlockchainIDHex, remoteContractAddress]
            }) as { registered: boolean, collateralNeeded: bigint, tokenMultiplier: bigint, multiplyOnRemote: boolean };

            let remaining = null;
            if (settings.registered && tokenDecimals !== null) {
                // Calculate remaining based on current balance and transferred balance (if needed)
                // For simplicity, we'll just show the needed amount for now
                // remaining = settings.collateralNeeded - fetchedAllowance; // Example calculation
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
    }, [homeContractAddress, requiredChain, remoteChain, walletEVMAddress, remoteContractAddress, remoteBlockchainIDHex]);

    // Autofill amount when collateral info is loaded
    useEffect(() => {
        if (collateralInfo?.needed && collateralInfo.needed > 0n && tokenDecimals !== null && !isAutoFilled) {
            const neededAmountFormatted = formatUnits(collateralInfo.needed, tokenDecimals);
            setAmount(neededAmountFormatted);
            setIsAutoFilled(true); // Mark as autofilled for this fetch cycle
        }
        // Reset autofill if needed amount becomes 0 or unavailable, allowing manual input
        else if ((!collateralInfo?.needed || collateralInfo.needed === 0n) && isAutoFilled) {
            setIsAutoFilled(false);
            // Optionally clear the amount if needed is 0:
            // if (amount === formatUnits(collateralInfo?.needed ?? 0n, tokenDecimals ?? 18)) {
            //     setAmount("");
            // }
        }
    }, [collateralInfo?.needed, tokenDecimals, isAutoFilled]);

    useEffect(() => {
        fetchStatus();
    }, [fetchStatus]);

    const handleApprove = async () => {
        if (!requiredChain || !coreWalletClient?.account || !homeContractAddress || !tokenAddress || tokenDecimals === null || !amount) {
            setLocalError("Missing required information for approval.");
            return;
        }

        setLocalError("");
        setIsProcessing(true);
        setLastApprovalTxId(undefined);

        try {
            const publicClient = createPublicClient({
                chain: requiredChain,
                transport: http(requiredChain.rpcUrls.default.http[0])
            });

            const amountParsed = parseUnits(amount, tokenDecimals);

            const { request } = await publicClient.simulateContract({
                address: tokenAddress,
                abi: ExampleERC20ABI.abi,
                functionName: 'approve',
                args: [homeContractAddress as Address, amountParsed],
                chain: requiredChain,
                account: coreWalletClient.account,
            });

            const hash = await coreWalletClient.writeContract(request);
            setLastApprovalTxId(hash);

            await publicClient.waitForTransactionReceipt({ hash });
            await fetchStatus(); // Refresh allowance

        } catch (error: any) {
            console.error("Approval failed:", error);
            setLocalError(`Approval failed: ${error.shortMessage || error.message}`);
            showBoundary(error);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleAddCollateral = async () => {
        if (!requiredChain || !coreWalletClient?.account || !homeContractAddress || tokenDecimals === null || !amount || !remoteContractAddress || !remoteBlockchainIDHex) {
            setLocalError("Missing required information to add collateral.");
            return;
        }

        setLocalError("");
        setIsProcessing(true);
        setLastAddCollateralTxId(undefined);

        try {
            const publicClient = createPublicClient({
                chain: requiredChain,
                transport: http(requiredChain.rpcUrls.default.http[0])
            });

            const amountParsed = parseUnits(amount, tokenDecimals);

            if (allowance === null || allowance < amountParsed) {
                setLocalError(`Insufficient allowance. Please approve at least ${amount} ${tokenSymbol || 'tokens'}.`);
                setIsProcessing(false);
                return;
            }

            const { request } = await publicClient.simulateContract({
                address: homeContractAddress as Address,
                abi: ERC20TokenHomeABI.abi,
                functionName: 'addCollateral',
                args: [remoteBlockchainIDHex as `0x${string}`, remoteContractAddress as Address, amountParsed],
                chain: requiredChain,
                account: coreWalletClient.account,
            });

            const hash = await coreWalletClient.writeContract(request);
            setLastAddCollateralTxId(hash);

            await publicClient.waitForTransactionReceipt({ hash });
            await fetchStatus(); // Refresh collateral status and collateralization

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
            return 0n; // Handle invalid input gracefully
        }
    }, [amount, tokenDecimals]);

    const hasSufficientAllowance = useMemo(() => {
        if (allowance === null || amountParsed === 0n) return false;
        return allowance >= amountParsed;
    }, [allowance, amountParsed]);

    const isValidAmount = amountParsed > 0n;

    return (
        <div className="space-y-4">
            <h2 className="text-lg font-semibold">Add Collateral to Home Bridge</h2>

            <div className="p-4 border rounded-md bg-gray-50 dark:bg-gray-900/50">
                <RadioGroup
                    value={deployOn}
                    onChange={(value) => setDeployOn(value as DeployOn)}
                    items={deployOnOptions}
                    idPrefix="add-collateral-home-on-"
                />
            </div>

            {!homeContractAddress && <Note variant="warning">ERC20 Token Home address for {deployOn} not found. Please deploy it first.</Note>}

            <div className="space-y-4">
                <p>
                    Approve and add collateral (ERC20 tokens) to the deployed ERC20 Token Home contract
                    on {deployOn} for a specific remote bridge contract ({remoteDeployOn}).
                </p>

                <Input
                    label={`Remote Contract Address (on ${remoteDeployOn})`}
                    value={remoteContractAddress}
                    onChange={(value) => setRemoteContractAddress(value as Address)}
                    required
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
                            <div>Collateral Needed for Remote: <code className="font-mono">{formatUnits(collateralInfo.needed, tokenDecimals)} {tokenSymbol}</code></div>
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
                        // If user manually changes the amount after autofill, disable autofill for this cycle
                        if (isAutoFilled) {
                            const neededFormatted = tokenDecimals !== null && collateralInfo?.needed ? formatUnits(collateralInfo.needed, tokenDecimals) : '';
                            if (newAmount !== neededFormatted) {
                                setIsAutoFilled(false); // Allow manual override
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
                        disabled={isCheckingStatus || !remoteContractAddress}
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
