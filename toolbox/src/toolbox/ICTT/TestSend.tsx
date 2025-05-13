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
import ITeleporterMessenger from "../../../contracts/example-contracts/compiled/ITeleporterMessenger.json";
import { createPublicClient, http, formatUnits, parseUnits, Address, zeroAddress, decodeEventLog, AbiEvent } from "viem";
import { AmountInput } from "../../components/AmountInput";
import { Suggestion } from "../../components/TokenInput";
import { EVMAddressInput } from "../components/EVMAddressInput";
import { Token, TokenInput } from "../components/TokenInput";
import { utils } from "@avalabs/avalanchejs";
import SelectChainID from "../components/SelectChainID";
import { Container } from "../components/Container";
import { Toggle } from "../../components/Toggle";
import { Ellipsis } from "lucide-react";

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
    const [sourceToken, setSourceToken] = useState<any | null>(null);
    const [destinationContractAddress, setDestinationContractAddress] = useState<Address | "">("");
    const [destinationToken, setDestinationToken] = useState<any | null>(null);

    // Transaction parameters
    const [recipientAddress, setRecipientAddress] = useState<Address | "">("");
    const [amount, setAmount] = useState("");
    const [requiredGasLimit, setRequiredGasLimit] = useState<string>(DEFAULT_GAS_LIMIT.toString());

    // UI states
    const [isProcessingApproval, setIsProcessingApproval] = useState(false);
    const [isProcessingSend, setIsProcessingSend] = useState(false);
    const [lastApprovalTxId, setLastApprovalTxId] = useState<string>();
    const [lastSendTxId, setLastSendTxId] = useState<string>();
    const [messageID, setMessageID] = useState<string>();
    const [tryCount, setTryCount] = useState(0);
    const [lastSendTxDetails, setLastSendTxDetails] = useState<Partial<{
        source: Partial<{
            initiatedAt: number;
            confirmedAt: number;
        }>,
        destination: Partial<{
            confirmedAt: number;
        }>
    }> | null>(null);
    const [localError, setLocalError] = useState("");
    const [isFetchingSourceInfo, setIsFetchingSourceInfo] = useState(false);

    // Token info
    const [tokenAddress, setTokenAddress] = useState<Address | null>(null);
    const [tokenDecimals, setTokenDecimals] = useState<number | null>(null);
    const [tokenSymbol, setTokenSymbol] = useState<string | null>(null);
    const [tokenBalance, setTokenBalance] = useState<bigint | null>(null);
    const [tokenAllowance, setTokenAllowance] = useState<bigint | null>(null);

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
    const [sourceContractSuggestions, setSourceContractSuggestions] = useState<Suggestion[]>([]);

    useEffect(() => {
        if (!viemChain) return;
        const fetchSuggestions = async () => {
            const suggestions: Suggestion[] = [];
            if (erc20TokenHomeAddress) {
                suggestions.push({
                    title: erc20TokenHomeAddress,
                    value: erc20TokenHomeAddress,
                    description: `Token Bridge on ${selectedL1?.name}`,
                    token: await fetchTokenInfoFromBridgeContract(erc20TokenHomeAddress as Address, "source", false)
                });
            }
            setSourceContractSuggestions(suggestions);
        };

        fetchSuggestions();
    }, [erc20TokenHomeAddress, selectedL1?.name]);

    // Suggestions for destination contract address
    const [destinationContractSuggestions, setDestinationContractSuggestions] = useState<Suggestion[]>([]);

    useEffect(() => {
        const fetchSuggestions = async () => {
            const suggestions: Suggestion[] = [];
            if (destToolboxStore?.erc20TokenRemoteAddress) {
                suggestions.push({
                    title: destToolboxStore.erc20TokenRemoteAddress,
                    value: destToolboxStore.erc20TokenRemoteAddress,
                    description: `ERC20 Bridge Endpoint on ${destL1?.name}`,
                    token: await fetchTokenInfoFromBridgeContract(destToolboxStore.erc20TokenRemoteAddress as Address, "destination", false, destL1)
                });
            }
            if (destToolboxStore?.nativeTokenRemoteAddress) {
                suggestions.push({
                    title: destToolboxStore.nativeTokenRemoteAddress,
                    value: destToolboxStore.nativeTokenRemoteAddress,
                    description: `Native Bridge Endpoint on ${destL1?.name}`
                });
            }
            setDestinationContractSuggestions(suggestions);
        };

        if (!destL1) return;

        fetchSuggestions();
    }, [destToolboxStore?.erc20TokenRemoteAddress, destToolboxStore?.nativeTokenRemoteAddress, destL1?.id]);

    // Fetch token info from bridge contract on current chain
    const fetchTokenInfoFromBridgeContract = useCallback(async (address: Address, direction: "source" | "destination", updateState: boolean = true, _destL1?: any) => {
        const __destL1 = _destL1 || destL1;
        if (!address || (direction === "source" && !viemChain) || (direction === "destination" && !__destL1?.rpcUrl)) {
            return;
        }

        try {
            const publicClient = createPublicClient({
                transport: http(direction === "source" ? viemChain!.rpcUrls.default.http[0] : __destL1!.rpcUrl)
            });


            let tokenAddress = address;

            if (direction === "source") {
                // Try to get the token address from the bridge contract
                const fetchedTokenAddress = await publicClient.readContract({
                    address: address,
                    abi: ERC20TokenHomeABI.abi,
                    functionName: 'getTokenAddress',
                }).catch(() => null) as Address | null;

                if (!fetchedTokenAddress) {
                    throw new Error("Could not determine token address from bridge contract");
                }

                tokenAddress = fetchedTokenAddress;
            }

            const [fetchedDecimals, fetchedName, fetchedSymbol, fetchedBalance, fetchedAllowance] = await Promise.all([
                publicClient.readContract({
                    address: tokenAddress,
                    abi: ExampleERC20ABI.abi,
                    functionName: 'decimals'
                }),
                publicClient.readContract({
                    address: tokenAddress,
                    abi: ExampleERC20ABI.abi,
                    functionName: 'name'
                }),
                publicClient.readContract({
                    address: tokenAddress,
                    abi: ExampleERC20ABI.abi,
                    functionName: 'symbol'
                }),
                publicClient.readContract({
                    address: tokenAddress,
                    abi: ExampleERC20ABI.abi,
                    functionName: 'balanceOf',
                    args: [walletEVMAddress === "" ? zeroAddress : walletEVMAddress as Address]
                }),
                publicClient.readContract({
                    address: tokenAddress,
                    abi: ExampleERC20ABI.abi,
                    functionName: 'allowance',
                    args: [walletEVMAddress === "" ? zeroAddress : walletEVMAddress as Address, sourceContractAddress === "" ? zeroAddress : sourceContractAddress as Address]
                })
            ]);

            const token: Token = {
                address: tokenAddress,
                name: fetchedName as string,
                symbol: fetchedSymbol as string,
                decimals: Number(fetchedDecimals as bigint),
                balance: fetchedBalance as bigint,
                allowance: fetchedAllowance as bigint,
                chain: {
                    name: direction === "source" ? selectedL1!.name : __destL1!.name,
                    id: direction === "source" ? selectedL1!.id : __destL1!.id,
                    logoUrl: direction === "source" ? selectedL1!.logoUrl : __destL1!.logoUrl
                }
            }

            if (updateState) {
                if (direction === "source") {
                    setSourceToken(token);
                } else {
                    setDestinationToken(token);
                }
            }

            return token;

        } catch (error: any) {
            console.error("Error fetching token info:", error);
            return;
        }
    }, [viemChain?.id, walletEVMAddress, sourceContractAddress]);

    // Fetch token info from source contract on current chain 
    // todo: duplicate remove this
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
    }, [viemChain?.id, walletEVMAddress, sourceContractAddress]);

    useEffect(() => {
        fetchSourceInfo();
    }, [fetchSourceInfo]);

    // Set initial recipient address to connected wallet
    const [useMyAddress, setUseMyAddress] = useState(true);
    useEffect(() => {
        if (walletEVMAddress && /^0x[a-fA-F0-9]{40}$/.test(walletEVMAddress) && useMyAddress) {
            setRecipientAddress(walletEVMAddress as Address);
        }
    }, [walletEVMAddress, useMyAddress]);

    // Handle token approval
    const handleApprove = async () => {
        if (!viemChain || !coreWalletClient?.account || !sourceContractAddress || !tokenAddress || tokenDecimals === null || !amount) {
            setLocalError("Missing required information for approval.");
            return;
        }

        setLocalError("");
        setIsProcessingApproval(true);
        setLastApprovalTxId(undefined);
        setLastSendTxId(undefined);

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
        setLastApprovalTxId(undefined);
        setLastSendTxId(undefined);
        setLastSendTxDetails(null);

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
            setLastSendTxDetails({ source: { initiatedAt: Date.now() } });

            const receipt = await publicClient.waitForTransactionReceipt({ hash });
            if (receipt.status === "success") {
                let log = receipt.logs.find((l: any) => l.address.toLowerCase() === "0x253b2784c75e510dD0fF1da844684a1aC0aa5fcf".toLowerCase());
                const decoded_log: any = decodeEventLog({
                    abi: ITeleporterMessenger.abi,
                    data: log?.data,
                    topics: log?.topics as [signature: `0x${string}`, ...args: `0x${string}`[]]

                });
                const { args } = decoded_log;
                const { messageID } = args;
                setMessageID(messageID);
                setTryCount(0);
            }
            setLastSendTxDetails(prev => ({
                ...prev,
                source: { ...prev?.source, confirmedAt: Date.now() }
            }));
            await fetchSourceInfo(); // todo: duplicate remove this
            await fetchTokenInfoFromBridgeContract(sourceContractAddress as Address, "source");
        } catch (error: any) {
            console.error("Send failed:", error);
            setLocalError(`Send failed: ${error.shortMessage || error.message}`);
            showBoundary(error);
        } finally {
            setIsProcessingSend(false);
        }
    };

    const getReceiveTransaction = async () => {
        const publicClient = createPublicClient({
            transport: http(destL1?.rpcUrl)
        });
        const receiveEventABI = ITeleporterMessenger.abi.find((item: any) => item.type === 'event' && item.name === 'ReceiveCrossChainMessage') as AbiEvent;

        const logs = await publicClient.getLogs({
            event: receiveEventABI
        });
        if (logs.length === 0) {
            return;
        }
        return logs[0];
    }

    const isMessageReceived = async () => {
        const receiveTransaction = await getReceiveTransaction();
        if (receiveTransaction) {
            fetchTokenInfoFromBridgeContract(destinationContractAddress as Address, "destination");
            return true;
        }
        return false;
    }

    useEffect(() => {
        if (messageID === undefined) {
            return;
        }
        isMessageReceived().then(r => {
            if (r === true) {
                setLastSendTxDetails(prev => ({
                    ...prev,
                    destination: { ...prev?.destination, confirmedAt: Date.now() }
                }));
                return;
            }
            // try after 200 milliseconds
            setTimeout(() => {
                setTryCount((prev) => prev + 1);
            }, 200);
        });
    }, [messageID, tryCount]);

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

    const [isGasLimitEditing, setIsGasLimitEditing] = useState(false);

    return (
        <Container
            title="Cross-Chain Token Bridge"
            description={`Send tokens from the current chain (${selectedL1?.name}) to another chain.`}
        >

            <SelectChainID
                label="Destination Chain"
                value={destinationChainId}
                onChange={(value) => setDestinationChainId(value)}
                error={destChainError}
            />

            <TokenInput
                label={`Source Bridge Contract on ${selectedL1?.name}`}
                value={sourceContractAddress}
                tokenValue={sourceToken}
                onChange={(value) => setSourceContractAddress(value as Address)}
                verify={(value) => fetchTokenInfoFromBridgeContract(value as Address, "source")}
                disabled={isProcessingSend || isProcessingApproval}
                suggestions={sourceContractSuggestions}
                placeholder="0x... Bridge contract on current chain"
            />

            <TokenInput
                label={`Destination Bridge Contract on ${destL1?.name || 'destination chain'}`}
                value={destinationContractAddress}
                tokenValue={destinationToken}
                onChange={(value) => setDestinationContractAddress(value as Address)}
                verify={(value) => fetchTokenInfoFromBridgeContract(value as Address, "destination")}
                disabled={!destinationChainId || isProcessingSend || isProcessingApproval}
                suggestions={destinationContractSuggestions}
                placeholder="0x... Bridge contract on destination chain"
            />

            <AmountInput
                label={`Amount of ${tokenSymbol || 'Tokens'} to Send`}
                value={amount}
                onChange={setAmount}
                type="number"
                min="0"
                max={formatUnits(tokenBalance ?? 0n, tokenDecimals ?? 18)}
                step={tokenDecimals !== null ? `0.${'0'.repeat(tokenDecimals - 1)}1` : 'any'}
                required
                disabled={!tokenAddress || isFetchingSourceInfo}
                error={!isValidAmount && amount ? "Invalid amount" : (amount && !hasSufficientBalance ? "Insufficient balance" : undefined)}
                button={<Button
                    onClick={() => setAmount(formatUnits(tokenBalance ?? 0n, tokenDecimals ?? 18))}
                    stickLeft
                    disabled={!walletEVMAddress}
                >
                    MAX
                </Button>}
            />

            <hr />

            <div className="flex flex-col gap-2">

                {/* Recipient Address Row */}
                <div className="w-full">
                    <div className="flex items-center justify-between">
                        <div className="text-sm text-zinc-500">Recipient Address</div>
                        <div>
                            <Toggle
                                label="Use My Address"
                                checked={useMyAddress}
                                onChange={checked => setUseMyAddress(checked ? true : false)}
                            />
                        </div>
                    </div>
                    {!useMyAddress && (
                        <div className="mt-2">
                            <EVMAddressInput
                                label={""}
                                value={recipientAddress}
                                onChange={(value) => setRecipientAddress(value as Address)}
                                disabled={isProcessingSend || isProcessingApproval}
                            />
                        </div>
                    )}
                </div>

                {/* Gas Limit Row */}
                <div className="flex items-center justify-between">
                    <div className="text-sm text-zinc-500">Gas Limit</div>
                    <div className="flex items-center gap-2">
                        {isGasLimitEditing ? (
                            <>
                                <input
                                    type="number"
                                    value={requiredGasLimit}
                                    onChange={e => setRequiredGasLimit(e.target.value)}
                                    className="font-mono text-xs px-2 py-1 rounded border border-zinc-300 dark:border-zinc-700 bg-transparent min-w-0 w-auto focus:outline-none focus:ring-1 focus:ring-blue-400"
                                    min="0"
                                    style={{ width: 'fit-content' }}
                                />
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    className="text-zinc-500 px-0.5 py-0 text-xs h-6 min-h-0"
                                    onClick={() => setIsGasLimitEditing(false)}
                                >
                                    Done
                                </Button>
                            </>
                        ) : (
                            <>
                                <span className="font-mono text-xs text-zinc-700 dark:text-zinc-200">{requiredGasLimit}</span>
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    className="text-blue-500 px-1"
                                    onClick={() => setIsGasLimitEditing(true)}
                                >
                                    Modify
                                </Button>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {localError && <div className="text-red-500 mt-2 p-2 border border-red-300 rounded">{localError}</div>}

            <div className="flex gap-2 pt-2 mt-4 flex-wrap">
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
            {/* {lastSendTxId && (
                <Success label="Send Transaction ID" value={lastSendTxId} />
            )} */}
            {lastSendTxId && lastSendTxDetails && (
                <div className="w-full border rounded-md bg-gray-50 dark:bg-gray-800">
                    <div className="flex w-full items-center justify-evenly p-6">
                        <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
                            <span className="text-gray-500 text-sm">UI</span>
                            <span className="font-mono text-base">
                                {lastSendTxDetails.source?.initiatedAt
                                    ? new Date(lastSendTxDetails.source.initiatedAt).toLocaleTimeString()
                                    : <Ellipsis className="animate-pulse" size={32} />}
                            </span>
                        </div>
                        {selectedL1?.logoUrl && (
                            <img
                                src={selectedL1.logoUrl}
                                alt={selectedL1.name}
                                className="w-8 h-8 rounded-full mx-4"
                            />
                        )}
                        <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
                            <span className="text-gray-500 text-sm">{selectedL1!.name}</span>
                            <span className="font-mono text-base">
                                {lastSendTxDetails.source?.confirmedAt
                                    ? new Date(lastSendTxDetails.source.confirmedAt).toLocaleTimeString()
                                    : <Ellipsis className="animate-pulse" size={32} />}
                            </span>
                        </div>
                        {destL1?.logoUrl && (
                            <img
                                src={destL1.logoUrl}
                                alt={destL1.name}
                                className="w-8 h-8 rounded-full mx-4"
                            />
                        )}
                        <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
                            <span className="text-gray-500 text-sm">{destL1!.name}</span>
                            <span className="font-mono text-base">
                                {lastSendTxDetails.destination?.confirmedAt
                                    ? new Date(lastSendTxDetails.destination.confirmedAt).toLocaleTimeString()
                                    : <Ellipsis className="animate-pulse" size={32} />}
                            </span>
                        </div>
                    </div>
                </div>
            )}
        </Container>
    );
}
