// src/toolbox/ICTT/TestSend.ts
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
import { createPublicClient, http, formatUnits, parseUnits, Address, zeroAddress } from "viem";
import { Input, Suggestion } from "../../components/Input";
import { utils } from "@avalabs/avalanchejs";
import { FUJI_C_BLOCKCHAIN_ID } from "./DeployERC20TokenRemote";
import { Note } from "../../components/Note";

const DEFAULT_GAS_LIMIT = 250000n; // Default gas limit from example

export default function TestSend() {
    const { showBoundary } = useErrorBoundary();
    const { erc20TokenHomeAddress, nativeTokenRemoteAddress, erc20TokenRemoteAddress } = useToolboxStore();
    const { coreWalletClient, walletEVMAddress } = useWalletStore();
    const viemChain = useViemChainStore(); // This is L1 chain config

    // State for selecting which chain hosts the "Home" contract (source chain)
    const [homeChainSelection, setHomeChainSelection] = useState<DeployOn>("C-Chain");
    const [destinationContractAddress, setDestinationContractAddress] = useState<Address | "">("");
    const [recipientAddress, setRecipientAddress] = useState<Address | "">("");
    const [amount, setAmount] = useState("");
    const [requiredGasLimit, setRequiredGasLimit] = useState<string>(DEFAULT_GAS_LIMIT.toString());

    const [isProcessingApproval, setIsProcessingApproval] = useState(false);
    const [isProcessingSend, setIsProcessingSend] = useState(false);
    const [lastApprovalTxId, setLastApprovalTxId] = useState<string>();
    const [lastSendTxId, setLastSendTxId] = useState<string>();
    const [localError, setLocalError] = useState("");

    // Token info on the source chain
    const [sourceTokenAddress, setSourceTokenAddress] = useState<Address | null>(null);
    const [sourceTokenDecimals, setSourceTokenDecimals] = useState<number | null>(null);
    const [sourceTokenSymbol, setSourceTokenSymbol] = useState<string | null>(null);
    const [sourceTokenBalance, setSourceTokenBalance] = useState<bigint | null>(null);
    const [sourceTokenAllowance, setSourceTokenAllowance] = useState<bigint | null>(null);

    const [isFetchingSourceInfo, setIsFetchingSourceInfo] = useState(false);
    const selectedL1 = useSelectedL1()();

    if (!selectedL1) return null;

    const deployOnOptions = [
        { label: "Send from L1 (Home is L1)", value: "L1" },
        { label: "Send from C-Chain (Home is C-Chain)", value: "C-Chain" }
    ];

    // Determine source and destination chains based on selection
    const sourceChain = useMemo(() => (homeChainSelection === "L1" ? viemChain : avalancheFuji), [homeChainSelection, viemChain]);
    const destinationChain = useMemo(() => (homeChainSelection === "L1" ? avalancheFuji : viemChain), [homeChainSelection, viemChain]);
    const destinationDeployOn = useMemo(() => (homeChainSelection === "L1" ? "C-Chain" : "L1"), [homeChainSelection]);

    const homeContractAddress = erc20TokenHomeAddress?.[homeChainSelection];

    const destinationBlockchainIDHex = useMemo(() => {
        if (!destinationChain || !selectedL1) return null;
        const chainIDBase58 = homeChainSelection === "L1" ? FUJI_C_BLOCKCHAIN_ID : selectedL1?.id;
        try {
            return utils.bufferToHex(utils.base58check.decode(chainIDBase58));
        } catch (e) {
            console.error("Error decoding destination chain ID:", e);
            return null;
        }
    }, [homeChainSelection, destinationChain, selectedL1]);

    const destinationContractSuggestions: Suggestion[] = useMemo(() => {
        const suggestions: Suggestion[] = [];
        const nativeAddr = nativeTokenRemoteAddress?.[destinationDeployOn];
        const erc20Addr = erc20TokenRemoteAddress?.[destinationDeployOn];
        if (nativeAddr) {
            suggestions.push({ title: nativeAddr, value: nativeAddr, description: `Native Token Remote (${destinationDeployOn})` });
        }
        if (erc20Addr) {
            suggestions.push({ title: erc20Addr, value: erc20Addr, description: `ERC20 Token Remote (${destinationDeployOn})` });
        }
        return suggestions;
    }, [destinationDeployOn, nativeTokenRemoteAddress, erc20TokenRemoteAddress]);

    // Fetch source token info and allowance
    const fetchSourceInfo = useCallback(async () => {
        if (!homeContractAddress || !sourceChain || !walletEVMAddress) {
            setSourceTokenAddress(null);
            setSourceTokenDecimals(null);
            setSourceTokenSymbol(null);
            setSourceTokenBalance(null);
            setSourceTokenAllowance(null);
            return;
        }

        setIsFetchingSourceInfo(true);
        setLocalError("");
        try {
            const publicClient = createPublicClient({
                chain: sourceChain,
                transport: http(sourceChain.rpcUrls.default.http[0])
            });

            const fetchedTokenAddress = await publicClient.readContract({
                address: homeContractAddress as Address,
                abi: ERC20TokenHomeABI.abi,
                functionName: 'getTokenAddress',
            }) as Address;
            setSourceTokenAddress(fetchedTokenAddress);

            if (!fetchedTokenAddress) throw new Error("Token address not found on Home contract");

            const [fetchedDecimals, fetchedSymbol, fetchedBalance, fetchedAllowance] = await Promise.all([
                publicClient.readContract({ address: fetchedTokenAddress, abi: ExampleERC20ABI.abi, functionName: 'decimals' }),
                publicClient.readContract({ address: fetchedTokenAddress, abi: ExampleERC20ABI.abi, functionName: 'symbol' }),
                publicClient.readContract({ address: fetchedTokenAddress, abi: ExampleERC20ABI.abi, functionName: 'balanceOf', args: [walletEVMAddress] }),
                publicClient.readContract({ address: fetchedTokenAddress, abi: ExampleERC20ABI.abi, functionName: 'allowance', args: [walletEVMAddress, homeContractAddress as Address] })
            ]);

            setSourceTokenDecimals(Number(fetchedDecimals as bigint));
            setSourceTokenSymbol(fetchedSymbol as string);
            setSourceTokenBalance(fetchedBalance as bigint);
            setSourceTokenAllowance(fetchedAllowance as bigint);

        } catch (error: any) {
            console.error("Error fetching source info:", error);
            setLocalError(`Error fetching source info: ${error.shortMessage || error.message}`);
            setSourceTokenAddress(null);
            // Keep other states potentially partially filled
        } finally {
            setIsFetchingSourceInfo(false);
        }
    }, [homeContractAddress, sourceChain, walletEVMAddress]);

    useEffect(() => {
        fetchSourceInfo();
    }, [fetchSourceInfo]);

    // Effect to set initial recipient address from wallet
    useEffect(() => {
        if (walletEVMAddress && /^0x[a-fA-F0-9]{40}$/.test(walletEVMAddress)) {
            setRecipientAddress(walletEVMAddress as Address);
        } else {
            setRecipientAddress(""); // Ensure it's cleared if wallet disconnects or address is invalid
        }
    }, [walletEVMAddress]);

    const handleApprove = async () => {
        if (!sourceChain || !coreWalletClient?.account || !homeContractAddress || !sourceTokenAddress || sourceTokenDecimals === null || !amount) {
            setLocalError("Missing required information for approval.");
            return;
        }

        setLocalError("");
        setIsProcessingApproval(true);
        setLastApprovalTxId(undefined);

        try {
            const publicClient = createPublicClient({
                chain: sourceChain,
                transport: http(sourceChain.rpcUrls.default.http[0])
            });

            const amountParsed = parseUnits(amount, sourceTokenDecimals);

            const { request } = await publicClient.simulateContract({
                address: sourceTokenAddress,
                abi: ExampleERC20ABI.abi,
                functionName: 'approve',
                args: [homeContractAddress as Address, amountParsed],
                chain: sourceChain,
                account: coreWalletClient.account,
            });

            const hash = await coreWalletClient.writeContract(request);
            setLastApprovalTxId(hash);

            await publicClient.waitForTransactionReceipt({ hash });
            await fetchSourceInfo(); // Refresh allowance

        } catch (error: any) {
            console.error("Approval failed:", error);
            setLocalError(`Approval failed: ${error.shortMessage || error.message}`);
            showBoundary(error);
        } finally {
            setIsProcessingApproval(false);
        }
    };

    const handleSend = async () => {
        if (!sourceChain || !coreWalletClient?.account || !homeContractAddress || sourceTokenDecimals === null || !amount || !destinationContractAddress || !recipientAddress || !destinationBlockchainIDHex || !requiredGasLimit) {
            setLocalError("Missing required information to send tokens.");
            return;
        }

        setLocalError("");
        setIsProcessingSend(true);
        setLastSendTxId(undefined);

        try {
            const publicClient = createPublicClient({
                chain: sourceChain,
                transport: http(sourceChain.rpcUrls.default.http[0])
            });

            const amountParsed = parseUnits(amount, sourceTokenDecimals);
            const gasLimitParsed = BigInt(requiredGasLimit);

            if (sourceTokenAllowance === null || sourceTokenAllowance < amountParsed) {
                setLocalError(`Insufficient allowance. Please approve at least ${amount} ${sourceTokenSymbol || 'tokens'}.`);
                setIsProcessingSend(false);
                return;
            }
            if (sourceTokenBalance === null || sourceTokenBalance < amountParsed) {
                setLocalError(`Insufficient balance. You only have ${formatUnits(sourceTokenBalance ?? 0n, sourceTokenDecimals)} ${sourceTokenSymbol || 'tokens'}.`);
                setIsProcessingSend(false);
                return;
            }


            const sendInput = {
                destinationBlockchainID: destinationBlockchainIDHex as `0x${string}`,
                destinationTokenTransferrerAddress: destinationContractAddress as Address,
                recipient: recipientAddress as Address,
                primaryFeeTokenAddress: zeroAddress, // Example uses 0
                primaryFee: 0n,                     // Example uses 0
                secondaryFee: 0n,                   // Example uses 0
                requiredGasLimit: gasLimitParsed,
                multiHopFallback: zeroAddress,      // Example uses 0 address
            };

            console.log("Calling send with input:", sendInput, "Amount:", amountParsed);

            const { request } = await publicClient.simulateContract({
                address: homeContractAddress as Address,
                abi: ERC20TokenHomeABI.abi,
                functionName: 'send',
                args: [sendInput, amountParsed],
                chain: sourceChain,
                account: coreWalletClient.account,
            });

            const hash = await coreWalletClient.writeContract(request);
            setLastSendTxId(hash);

            await publicClient.waitForTransactionReceipt({ hash });
            await fetchSourceInfo(); // Refresh source balance
        } catch (error: any) {
            console.error("Send failed:", error);
            setLocalError(`Send failed: ${error.shortMessage || error.message}`);
            showBoundary(error);
        } finally {
            setIsProcessingSend(false);
        }
    };


    const amountParsed = useMemo(() => {
        if (!amount || sourceTokenDecimals === null) return 0n;
        try {
            return parseUnits(amount, sourceTokenDecimals);
        } catch { return 0n; }
    }, [amount, sourceTokenDecimals]);

    const hasSufficientAllowance = useMemo(() => {
        if (sourceTokenAllowance === null || amountParsed === 0n) return false;
        return sourceTokenAllowance >= amountParsed;
    }, [sourceTokenAllowance, amountParsed]);

    const hasSufficientBalance = useMemo(() => {
        if (sourceTokenBalance === null || amountParsed === 0n) return false;
        return sourceTokenBalance >= amountParsed;
    }, [sourceTokenBalance, amountParsed]);


    const isValidAmount = amountParsed > 0n;
    const isReadyToSend = isValidAmount && hasSufficientAllowance && hasSufficientBalance && destinationContractAddress && recipientAddress && destinationBlockchainIDHex && requiredGasLimit;

    return (
        <div className="space-y-4" >
            <h2 className="text-lg font-semibold" > Test Token Send(ERC20 Home) </h2>

            < div className="p-4 border rounded-md bg-gray-50 dark:bg-gray-900/50" >
                <p className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Select Source Chain (where ERC20 Home is deployed):</p>
                <RadioGroup
                    value={homeChainSelection}
                    onChange={(value) => setHomeChainSelection(value as DeployOn)
                    }
                    items={deployOnOptions}
                    idPrefix="send-home-on-"
                />
            </div>

            {!homeContractAddress && <Note variant="warning" > ERC20 Token Home address for {homeChainSelection} not found in store.Please deploy it first.</Note>}

            <div className="space-y-4" >
                <p>
                    Send ERC20 tokens from the Home contract on <strong>{homeChainSelection}</strong> to a recipient on <strong>{destinationDeployOn}</strong>.
                    This calls the `send` function on the `ERC20TokenHome` contract.
                </p>

                {isFetchingSourceInfo && <div className="text-gray-500" > Loading source token info...</div>}

                {
                    sourceTokenAddress && sourceTokenSymbol && sourceTokenDecimals !== null && (
                        <div className="p-3 border rounded-md text-sm space-y-1 bg-gray-100 dark:bg-gray-800" >
                            <div>Sending Token: <code className="font-mono">{sourceTokenSymbol}</code> (<code className="font-mono">{sourceTokenAddress}</code>)</div>
                            <div>Decimals: <code className="font-mono">{sourceTokenDecimals}</code></div>
                            {sourceTokenBalance !== null && (
                                <div>Your Balance({homeChainSelection}): <code className="font-mono">{formatUnits(sourceTokenBalance, sourceTokenDecimals)} {sourceTokenSymbol}</code></div>
                            )
                            }
                            {
                                sourceTokenAllowance !== null && (
                                    <div>Current Allowance for Home Contract: <code className="font-mono">{formatUnits(sourceTokenAllowance, sourceTokenDecimals)} {sourceTokenSymbol}</code></div>
                                )
                            }
                        </div>
                    )}

                <Input
                    label={`Destination Contract Address (Remote Contract on ${destinationDeployOn})`}
                    value={destinationContractAddress}
                    onChange={(value) => setDestinationContractAddress(value as Address)}
                    required
                    suggestions={destinationContractSuggestions}
                    placeholder="0x... (Native or ERC20 Remote)"
                    disabled={!homeContractAddress}
                />

                < Input
                    label={`Recipient Address (on ${destinationDeployOn})`}
                    value={recipientAddress}
                    onChange={(value) => setRecipientAddress(value as Address)}
                    required
                    button={< Button
                        onClick={() => setRecipientAddress(walletEVMAddress ? walletEVMAddress as Address : "")}
                        stickLeft
                        disabled={!walletEVMAddress}
                    >
                        Fill My Address
                    </Button>}
                    disabled={!homeContractAddress}
                />

                < Input
                    label={`Amount of ${sourceTokenSymbol || 'Tokens'} to Send`}
                    value={amount}
                    onChange={setAmount}
                    type="number"
                    min="0"
                    step={sourceTokenDecimals !== null ? `0.${'0'.repeat(sourceTokenDecimals - 1)}1` : 'any'}
                    required
                    disabled={!sourceTokenAddress || isFetchingSourceInfo}
                    error={!isValidAmount && amount ? "Invalid amount" : (amount && !hasSufficientBalance ? "Insufficient balance" : undefined)}
                />

                < Input
                    label="Required Gas Limit (for destination execution)"
                    value={requiredGasLimit}
                    onChange={setRequiredGasLimit}
                    type="number"
                    min="0"
                    required
                    disabled={!homeContractAddress}
                    helperText={`Default: ${DEFAULT_GAS_LIMIT}`}
                />


                {localError && <div className="text-red-500 mt-2 p-2 border border-red-300 rounded" > {localError} </div>}

                <div className="flex gap-2 pt-2 border-t mt-4 flex-wrap" >
                    <Button
                        onClick={handleApprove}
                        loading={isProcessingApproval}
                        disabled={isProcessingApproval || isProcessingSend || !isValidAmount || !sourceTokenAddress || hasSufficientAllowance || isFetchingSourceInfo}
                        variant={hasSufficientAllowance ? "secondary" : "primary"}
                    >
                        {hasSufficientAllowance ? `Approved (${formatUnits(sourceTokenAllowance ?? 0n, sourceTokenDecimals ?? 18)} ${sourceTokenSymbol})` : `1. Approve ${amount || 0} ${sourceTokenSymbol || ''}`}
                    </Button>
                    < Button
                        onClick={handleSend}
                        loading={isProcessingSend}
                        disabled={isProcessingApproval || isProcessingSend || !isReadyToSend || isFetchingSourceInfo}
                    >
                        2. Send Tokens
                    </Button>

                </div>

                {
                    lastApprovalTxId && (
                        <Success label="Approval Transaction ID" value={lastApprovalTxId} />
                    )
                }
                {
                    lastSendTxId && (
                        <Success label="Send Transaction ID" value={lastSendTxId} />
                    )
                }
            </div>
        </div>
    );
}
