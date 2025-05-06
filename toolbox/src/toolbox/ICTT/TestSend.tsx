// src/toolbox/ICTT/TestSend.ts
"use client";

import { useSelectedL1, useToolboxStore, useViemChainStore, getToolboxStore, useL1ByChainId } from "../toolboxStore";
import { useWalletStore } from "../../lib/walletStore";
import { useErrorBoundary } from "react-error-boundary";
import { useState, useCallback, useEffect, useMemo } from "react";
import { Button } from "../../components/Button";
import { Success } from "../../components/Success";
import ERC20TokenHomeABI from "../../../contracts/icm-contracts/compiled/ERC20TokenHome.json";
import ExampleERC20ABI from "../../../contracts/icm-contracts/compiled/ExampleERC20.json";
import { createPublicClient, http, formatUnits, parseUnits, Address, zeroAddress } from "viem";
import { Input, Suggestion } from "../../components/Input";
import { EVMAddressInput } from "../components/EVMAddressInput";
import { utils } from "@avalabs/avalanchejs";
import SelectChainID from "../components/SelectChainID";

const DEFAULT_GAS_LIMIT = 250000n;

export default function TokenBridge() {
    const { showBoundary } = useErrorBoundary();
    const { coreWalletClient, walletEVMAddress } = useWalletStore();
    const viemChain = useViemChainStore();
    const selectedL1 = useSelectedL1()();

    // Only need to select destination chain (source is current chain)
    const [destinationChainId, setDestinationChainId] = useState<string>("");

    // Contract addresses
    const [sourceContractAddress, setSourceContractAddress] = useState<Address | "">("");
    const [destinationContractAddress, setDestinationContractAddress] = useState<Address | "">("");

    // Transaction parameters
    const [recipientAddress, setRecipientAddress] = useState<Address | "">("");
    const [amount, setAmount] = useState("");
    const [requiredGasLimit, setRequiredGasLimit] = useState<string>(DEFAULT_GAS_LIMIT.toString());

    // UI states
    const [isProcessingApproval, setIsProcessingApproval] = useState(false);
    const [isProcessingSend, setIsProcessingSend] = useState(false);
    const [lastApprovalTxId, setLastApprovalTxId] = useState<string>();
    const [lastSendTxId, setLastSendTxId] = useState<string>();
    const [localError, setLocalError] = useState("");
    const [isFetchingSourceInfo, setIsFetchingSourceInfo] = useState(false);
    const [isFetchingDestInfo, setIsFetchingDestInfo] = useState(false);

    // Token info
    const [tokenAddress, setTokenAddress] = useState<Address | null>(null);
    const [tokenDecimals, setTokenDecimals] = useState<number | null>(null);
    const [tokenSymbol, setTokenSymbol] = useState<string | null>(null);
    const [tokenBalance, setTokenBalance] = useState<bigint | null>(null);
    const [tokenAllowance, setTokenAllowance] = useState<bigint | null>(null);

    // Destination token info
    const [destTokenBalance, setDestTokenBalance] = useState<bigint | null>(null);

    // Get chain info - source is current chain, destination is selected
    const destL1 = useL1ByChainId(destinationChainId)();
    const destToolboxStore = getToolboxStore(destinationChainId)();

    const { erc20TokenHomeAddress } = useToolboxStore();

    // Destination chain validation
    let destChainError: string | undefined = undefined;
    if (!destinationChainId) {
        destChainError = "Please select a destination chain";
    } else if (destinationChainId === selectedL1?.id) {
        destChainError = "Source and destination chains must be different";
    }

    // Generate hex blockchain ID for the destination chain
    const destinationBlockchainIDHex = useMemo(() => {
        if (!destL1?.id) return null;
        try {
            return utils.bufferToHex(utils.base58check.decode(destL1.id));
        } catch (e) {
            console.error("Error decoding destination chain ID:", e);
            return null;
        }
    }, [destL1?.id]);

    // Suggestions for source contract address on current chain
    const sourceContractSuggestions: Suggestion[] = useMemo(() => {
        const suggestions: Suggestion[] = [];
        if (erc20TokenHomeAddress) {
            suggestions.push({
                title: erc20TokenHomeAddress,
                value: erc20TokenHomeAddress,
                description: `Token Bridge on ${selectedL1?.name}`
            });
        }
        return suggestions;
    }, [erc20TokenHomeAddress, selectedL1?.name]);

    // Suggestions for destination contract address
    const destinationContractSuggestions: Suggestion[] = useMemo(() => {
        const suggestions: Suggestion[] = [];
        if (destToolboxStore?.erc20TokenRemoteAddress) {
            suggestions.push({
                title: destToolboxStore.erc20TokenRemoteAddress,
                value: destToolboxStore.erc20TokenRemoteAddress,
                description: `ERC20 Bridge Endpoint on ${destL1?.name}`
            });
        }
        if (destToolboxStore?.nativeTokenRemoteAddress) {
            suggestions.push({
                title: destToolboxStore.nativeTokenRemoteAddress,
                value: destToolboxStore.nativeTokenRemoteAddress,
                description: `Native Bridge Endpoint on ${destL1?.name}`
            });
        }
        return suggestions;
    }, [destToolboxStore?.erc20TokenRemoteAddress, destToolboxStore?.nativeTokenRemoteAddress, destL1?.name]);

    // Fetch token info from source contract on current chain
    const fetchSourceInfo = useCallback(async () => {
        if (!viemChain || !walletEVMAddress || !sourceContractAddress) {
            setTokenAddress(null);
            setTokenDecimals(null);
            setTokenSymbol(null);
            setTokenBalance(null);
            setTokenAllowance(null);
            return;
        }

        setIsFetchingSourceInfo(true);
        setLocalError("");
        try {
            const publicClient = createPublicClient({
                chain: viemChain,
                transport: http(viemChain.rpcUrls.default.http[0])
            });

            // Try to get the token address from the bridge contract
            const fetchedTokenAddress = await publicClient.readContract({
                address: sourceContractAddress as Address,
                abi: ERC20TokenHomeABI.abi,
                functionName: 'getTokenAddress',
            }).catch(() => null) as Address | null;

            if (!fetchedTokenAddress) {
                throw new Error("Could not determine token address from bridge contract");
            }

            setTokenAddress(fetchedTokenAddress);

            const [fetchedDecimals, fetchedSymbol, fetchedBalance, fetchedAllowance] = await Promise.all([
                publicClient.readContract({
                    address: fetchedTokenAddress,
                    abi: ExampleERC20ABI.abi,
                    functionName: 'decimals'
                }),
                publicClient.readContract({
                    address: fetchedTokenAddress,
                    abi: ExampleERC20ABI.abi,
                    functionName: 'symbol'
                }),
                publicClient.readContract({
                    address: fetchedTokenAddress,
                    abi: ExampleERC20ABI.abi,
                    functionName: 'balanceOf',
                    args: [walletEVMAddress as Address]
                }),
                publicClient.readContract({
                    address: fetchedTokenAddress,
                    abi: ExampleERC20ABI.abi,
                    functionName: 'allowance',
                    args: [walletEVMAddress, sourceContractAddress as Address]
                })
            ]);

            setTokenDecimals(Number(fetchedDecimals as bigint));
            setTokenSymbol(fetchedSymbol as string);
            setTokenBalance(fetchedBalance as bigint);
            setTokenAllowance(fetchedAllowance as bigint);

        } catch (error: any) {
            console.error("Error fetching token info:", error);
            setLocalError(`Error fetching token info: ${error.shortMessage || error.message}`);
            setTokenAddress(null);
        } finally {
            setIsFetchingSourceInfo(false);
        }
    }, [viemChain, walletEVMAddress, sourceContractAddress]);

    // Fetch destination token balance
    const fetchDestinationBalance = useCallback(async () => {
        if (!destL1?.rpcUrl || !walletEVMAddress || !destinationContractAddress || !recipientAddress) {
            setDestTokenBalance(null);
            return;
        }

        setIsFetchingDestInfo(true);
        try {
            const publicClient = createPublicClient({
                transport: http(destL1.rpcUrl)
            });

            // Try to get balance directly from the remote contract (it's ERC20-compatible)
            const destBalance = await publicClient.readContract({
                address: destinationContractAddress as Address,
                abi: ExampleERC20ABI.abi,
                functionName: 'balanceOf',
                args: [recipientAddress as Address]
            }).catch(() => null) as bigint | null;

            if (destBalance !== null) {
                setDestTokenBalance(destBalance);
            } else {
                setDestTokenBalance(null);
            }
        } catch (error) {
            console.error("Error fetching destination balance:", error);
            setDestTokenBalance(null);
        } finally {
            setIsFetchingDestInfo(false);
        }
    }, [destL1?.rpcUrl, walletEVMAddress, destinationContractAddress, recipientAddress]);

    useEffect(() => {
        fetchSourceInfo();
    }, [fetchSourceInfo]);

    useEffect(() => {
        fetchDestinationBalance();
    }, [fetchDestinationBalance, lastSendTxId]);

    // Set initial recipient address to connected wallet
    useEffect(() => {
        if (walletEVMAddress && /^0x[a-fA-F0-9]{40}$/.test(walletEVMAddress)) {
            setRecipientAddress(walletEVMAddress as Address);
        } else {
            setRecipientAddress("");
        }
    }, [walletEVMAddress]);

    // Handle token approval
    const handleApprove = async () => {
        if (!viemChain || !coreWalletClient?.account || !sourceContractAddress || !tokenAddress || tokenDecimals === null || !amount) {
            setLocalError("Missing required information for approval.");
            return;
        }

        setLocalError("");
        setIsProcessingApproval(true);
        setLastApprovalTxId(undefined);

        try {
            const publicClient = createPublicClient({
                chain: viemChain,
                transport: http(viemChain.rpcUrls.default.http[0])
            });

            const amountParsed = parseUnits(amount, tokenDecimals);

            const { request } = await publicClient.simulateContract({
                address: tokenAddress,
                abi: ExampleERC20ABI.abi,
                functionName: 'approve',
                args: [sourceContractAddress as Address, amountParsed],
                account: coreWalletClient.account,
                chain: viemChain,
            });

            const hash = await coreWalletClient.writeContract(request);
            setLastApprovalTxId(hash);

            await publicClient.waitForTransactionReceipt({ hash });
            await fetchSourceInfo();

        } catch (error: any) {
            console.error("Approval failed:", error);
            setLocalError(`Approval failed: ${error.shortMessage || error.message}`);
            showBoundary(error);
        } finally {
            setIsProcessingApproval(false);
        }
    };

    // Handle token sending
    const handleSend = async () => {
        if (!viemChain || !coreWalletClient?.account || !sourceContractAddress || tokenDecimals === null
            || !amount || !destinationContractAddress || !recipientAddress || !destinationBlockchainIDHex || !requiredGasLimit) {
            setLocalError("Missing required information to send tokens.");
            return;
        }

        setLocalError("");
        setIsProcessingSend(true);
        setLastSendTxId(undefined);

        try {
            const publicClient = createPublicClient({
                chain: viemChain,
                transport: http(viemChain.rpcUrls.default.http[0])
            });

            const amountParsed = parseUnits(amount, tokenDecimals);
            const gasLimitParsed = BigInt(requiredGasLimit);

            if (tokenAllowance === null || tokenAllowance < amountParsed) {
                setLocalError(`Insufficient allowance. Please approve at least ${amount} ${tokenSymbol || 'tokens'}.`);
                setIsProcessingSend(false);
                return;
            }
            if (tokenBalance === null || tokenBalance < amountParsed) {
                setLocalError(`Insufficient balance. You only have ${formatUnits(tokenBalance ?? 0n, tokenDecimals)} ${tokenSymbol || 'tokens'}.`);
                setIsProcessingSend(false);
                return;
            }

            const sendInput = {
                destinationBlockchainID: destinationBlockchainIDHex as `0x${string}`,
                destinationTokenTransferrerAddress: destinationContractAddress as Address,
                recipient: recipientAddress as Address,
                primaryFeeTokenAddress: zeroAddress,
                primaryFee: 0n,
                secondaryFee: 0n,
                requiredGasLimit: gasLimitParsed,
                multiHopFallback: zeroAddress,
            };

            console.log("Calling send with input:", sendInput, "Amount:", amountParsed);

            const { request } = await publicClient.simulateContract({
                address: sourceContractAddress as Address,
                abi: ERC20TokenHomeABI.abi,
                functionName: 'send',
                args: [sendInput, amountParsed],
                account: coreWalletClient.account,
                chain: viemChain,
            });

            const hash = await coreWalletClient.writeContract(request);
            setLastSendTxId(hash);

            await publicClient.waitForTransactionReceipt({ hash });
            await fetchSourceInfo();

            // Wait a moment before checking destination balance to allow for cross-chain message
            setTimeout(() => {
                fetchDestinationBalance();
            }, 3000);
        } catch (error: any) {
            console.error("Send failed:", error);
            setLocalError(`Send failed: ${error.shortMessage || error.message}`);
            showBoundary(error);
        } finally {
            setIsProcessingSend(false);
        }
    };

    const amountParsed = useMemo(() => {
        if (!amount || tokenDecimals === null) return 0n;
        try {
            return parseUnits(amount, tokenDecimals);
        } catch { return 0n; }
    }, [amount, tokenDecimals]);

    const hasSufficientAllowance = useMemo(() => {
        if (tokenAllowance === null || amountParsed === 0n) return false;
        return tokenAllowance >= amountParsed;
    }, [tokenAllowance, amountParsed]);

    const hasSufficientBalance = useMemo(() => {
        if (tokenBalance === null || amountParsed === 0n) return false;
        return tokenBalance >= amountParsed;
    }, [tokenBalance, amountParsed]);

    const isValidAmount = amountParsed > 0n;
    const isReadyToSend = isValidAmount && hasSufficientAllowance && hasSufficientBalance &&
        destinationContractAddress && recipientAddress && destinationBlockchainIDHex && requiredGasLimit;

    return (
        <div className="space-y-4">
            <h2 className="text-lg font-semibold">Cross-Chain Token Bridge</h2>

            <div className="space-y-4">
                <p>
                    Send tokens from the current chain ({selectedL1?.name}) to another chain.
                </p>

                <SelectChainID
                    label="Destination Chain"
                    value={destinationChainId}
                    onChange={(value) => setDestinationChainId(value)}
                    error={destChainError}
                />

                <EVMAddressInput
                    label={`Source Bridge Contract on ${selectedL1?.name}`}
                    value={sourceContractAddress}
                    onChange={(value) => setSourceContractAddress(value as Address)}
                    disabled={isProcessingSend || isProcessingApproval}
                    showError={true}
                    suggestions={sourceContractSuggestions}
                    placeholder="0x... Bridge contract on current chain"
                />

                <EVMAddressInput
                    label={`Destination Bridge Contract on ${destL1?.name || 'destination chain'}`}
                    value={destinationContractAddress}
                    onChange={(value) => setDestinationContractAddress(value as Address)}
                    disabled={!destinationChainId || isProcessingSend || isProcessingApproval}
                    showError={true}
                    suggestions={destinationContractSuggestions}
                    placeholder="0x... Bridge contract on destination chain"
                />

                {isFetchingSourceInfo && <div className="text-gray-500">Loading token info...</div>}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {tokenAddress && tokenSymbol && tokenDecimals !== null && (
                        <div className="p-3 border rounded-md text-sm space-y-1 bg-gray-100 dark:bg-gray-800">
                            <h4 className="font-medium text-sm mb-1">Source Chain Balance</h4>
                            <div>Token: <code className="font-mono">{tokenSymbol}</code></div>
                            <div>Address: <code className="font-mono">{tokenAddress}</code></div>
                            {tokenBalance !== null && (
                                <div>Your Balance: <code className="font-mono">{formatUnits(tokenBalance, tokenDecimals)} {tokenSymbol}</code></div>
                            )}
                            {tokenAllowance !== null && (
                                <div>Current Allowance: <code className="font-mono">{formatUnits(tokenAllowance, tokenDecimals)} {tokenSymbol}</code></div>
                            )}
                        </div>
                    )}

                    {destinationContractAddress && tokenDecimals !== null && (
                        <div className="p-3 border rounded-md text-sm space-y-1 bg-gray-100 dark:bg-gray-800">
                            <h4 className="font-medium text-sm mb-1">Destination Chain Balance</h4>
                            <div>Token: <code className="font-mono">{tokenSymbol || "Token"}</code></div>
                            <div>Address: <code className="font-mono">{destinationContractAddress}</code></div>
                            {isFetchingDestInfo ? (
                                <div>Loading balance...</div>
                            ) : destTokenBalance !== null ? (
                                <div>Recipient Balance: <code className="font-mono">{formatUnits(destTokenBalance, tokenDecimals)} {tokenSymbol}</code></div>
                            ) : (
                                <div>No balance information available</div>
                            )}
                            <div className="text-xs text-gray-500 mt-1">
                                <button onClick={fetchDestinationBalance} className="text-blue-500 underline" disabled={isFetchingDestInfo}>
                                    Refresh
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                <EVMAddressInput
                    label={`Recipient Address on ${destL1?.name || 'destination chain'}`}
                    value={recipientAddress}
                    onChange={(value) => setRecipientAddress(value as Address)}
                    disabled={isProcessingSend || isProcessingApproval}
                    showError={true}
                    button={<Button
                        onClick={() => setRecipientAddress(walletEVMAddress ? walletEVMAddress as Address : "")}
                        stickLeft
                        disabled={!walletEVMAddress}
                    >
                        Use My Address
                    </Button>}
                />

                <Input
                    label={`Amount of ${tokenSymbol || 'Tokens'} to Send`}
                    value={amount}
                    onChange={setAmount}
                    type="number"
                    min="0"
                    step={tokenDecimals !== null ? `0.${'0'.repeat(tokenDecimals - 1)}1` : 'any'}
                    required
                    disabled={!tokenAddress || isFetchingSourceInfo}
                    error={!isValidAmount && amount ? "Invalid amount" : (amount && !hasSufficientBalance ? "Insufficient balance" : undefined)}
                />

                <Input
                    label="Required Gas Limit"
                    value={requiredGasLimit}
                    onChange={setRequiredGasLimit}
                    type="number"
                    min="0"
                    required
                    helperText={`Default: ${DEFAULT_GAS_LIMIT}`}
                />

                {localError && <div className="text-red-500 mt-2 p-2 border border-red-300 rounded">{localError}</div>}

                <div className="flex gap-2 pt-2 border-t mt-4 flex-wrap">
                    <Button
                        onClick={handleApprove}
                        loading={isProcessingApproval}
                        disabled={isProcessingApproval || isProcessingSend || !isValidAmount || !tokenAddress || hasSufficientAllowance || isFetchingSourceInfo}
                        variant={hasSufficientAllowance ? "secondary" : "primary"}
                    >
                        {hasSufficientAllowance ? `Approved (${formatUnits(tokenAllowance ?? 0n, tokenDecimals ?? 18)} ${tokenSymbol})` : `1. Approve ${amount || 0} ${tokenSymbol || ''}`}
                    </Button>
                    <Button
                        onClick={handleSend}
                        loading={isProcessingSend}
                        disabled={isProcessingApproval || isProcessingSend || !isReadyToSend || isFetchingSourceInfo}
                    >
                        2. Send Tokens to {destL1?.name || 'Destination'}
                    </Button>
                </div>

                {lastApprovalTxId && (
                    <Success label="Approval Transaction ID" value={lastApprovalTxId} />
                )}
                {lastSendTxId && (
                    <Success label="Send Transaction ID" value={lastSendTxId} />
                )}
            </div>
        </div>
    );
}
