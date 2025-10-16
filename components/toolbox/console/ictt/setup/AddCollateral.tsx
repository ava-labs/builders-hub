"use client";

import { useWalletStore } from "@/components/toolbox/stores/walletStore";
import { useState, useCallback, useEffect, useMemo } from "react";
import { Button } from "@/components/toolbox/components/Button";
import { Success } from "@/components/toolbox/components/Success";
import ExampleERC20ABI from "@/contracts/icm-contracts/compiled/ExampleERC20.json";
import { createPublicClient, http, formatUnits, parseUnits, Address, Chain } from "viem";
import { Input, Suggestion } from "@/components/toolbox/components/Input";
import { EVMAddressInput } from "@/components/toolbox/components/EVMAddressInput";
import { AmountInput } from "@/components/toolbox/components/AmountInput";
import { utils } from "@avalabs/avalanchejs";
import SelectBlockchainId from "@/components/toolbox/components/SelectBlockchainId";
import ERC20TokenRemoteABI from "@/contracts/icm-contracts/compiled/ERC20TokenRemote.json";
import NativeTokenRemoteABI from "@/contracts/icm-contracts/compiled/NativeTokenRemote.json";
import ERC20TokenHomeABI from "@/contracts/icm-contracts/compiled/ERC20TokenHome.json";
import NativeTokenHomeABI from "@/contracts/icm-contracts/compiled/NativeTokenHome.json";
import { getToolboxStore, useViemChainStore } from "@/components/toolbox/stores/toolboxStore";
import { useToolboxStore } from "@/components/toolbox/stores/toolboxStore";
import { useL1ByChainId, useSelectedL1, useL1List } from "@/components/toolbox/stores/l1ListStore";
import useConsoleNotifications from "@/hooks/useConsoleNotifications";
import { RadioGroup } from "@/components/toolbox/components/RadioGroup";
import { ConsoleToolMetadata, withConsoleToolMetadata } from "@/components/toolbox/components/WithConsoleToolMetadata";
import { WalletRequirementsConfigKey } from "@/components/toolbox/hooks/useWalletRequirements";
import { generateConsoleToolGitHubUrl } from "@/components/toolbox/utils/github-url";

const metadata: ConsoleToolMetadata = {
    title: "Add Collateral",
    description: "Add collateral to the Token Home contract on the source chain for a Native Token Remote bridge contract.",
    toolRequirements: [
        WalletRequirementsConfigKey.EVMChainBalance
    ],
    githubUrl: generateConsoleToolGitHubUrl(import.meta.url)
};

function AddCollateral() {
    const [criticalError, setCriticalError] = useState<Error | null>(null);
    const { nativeTokenRemoteAddress } = useToolboxStore();
    const { coreWalletClient, walletEVMAddress } = useWalletStore();
    const { notify } = useConsoleNotifications();
    const viemChain = useViemChainStore();
    const selectedL1 = useSelectedL1()();
    const l1List = useL1List();
    
    const [remoteContractAddress, setRemoteContractAddress] = useState<Address | "">("");
    const [amount, setAmount] = useState("");
    const [isProcessing, setIsProcessing] = useState(false);
    const [lastApprovalTxId, setLastApprovalTxId] = useState<string>();
    const [lastAddCollateralTxId, setLastAddCollateralTxId] = useState<string>();
    const [localError, setLocalError] = useState("");
    
    // Info fetched from NativeTokenRemote contract
    const [tokenHomeAddress, setTokenHomeAddress] = useState<Address | null>(null);
    const [tokenHomeBlockchainIDHex, setTokenHomeBlockchainIDHex] = useState<string | null>(null);
    const [sourceChainId, setSourceChainId] = useState<string | null>(null);
    const [tokenType, setTokenType] = useState<"erc20" | "native" | null>(null);
    
    // Token info
    const [tokenAddress, setTokenAddress] = useState<Address | null>(null);
    const [tokenDecimals, setTokenDecimals] = useState<number | null>(null);
    const [tokenSymbol, setTokenSymbol] = useState<string | null>(null);
    const [tokenBalance, setTokenBalance] = useState<bigint | null>(null);
    const [allowance, setAllowance] = useState<bigint | null>(null);
    const [collateralInfo, setCollateralInfo] = useState<{ needed: bigint, remaining: bigint | null } | null>(null);
    const [isCheckingStatus, setIsCheckingStatus] = useState(false);
    const [isCollateralized, setIsCollateralized] = useState<boolean | null>(null);
    const [isAutoFilled, setIsAutoFilled] = useState(false);
    const [isFetchingTokenHome, setIsFetchingTokenHome] = useState(false);
    
    // Throw critical errors during render
    if (criticalError) {
        throw criticalError;
    }

    const sourceL1 = useL1ByChainId(sourceChainId || "")();
    const sourceToolboxStore = getToolboxStore(sourceChainId || "")();

    const sourceL1ViemChain: Chain | null = useMemo(() => {
        if (!sourceL1) return null;

        return {
            id: sourceL1.evmChainId,
            name: sourceL1.name,
            rpcUrls: {
                default: { http: [sourceL1.rpcUrl] },
            },
            nativeCurrency: {
                name: sourceL1.coinName,
                symbol: sourceL1.coinName,
                decimals: 18,
            },
            isTestnet: sourceL1.isTestnet,
        };
    }, [sourceL1]);

    // Fetch token home info from NativeTokenRemote contract
    const fetchTokenHomeInfo = useCallback(async () => {
        if (!remoteContractAddress || !viemChain) {
            setTokenHomeAddress(null);
            setTokenHomeBlockchainIDHex(null);
            setSourceChainId(null);
            setIsFetchingTokenHome(false);
            return;
        }

        setLocalError("");
        setIsFetchingTokenHome(true);
        try {
            const remotePublicClient = createPublicClient({
                chain: viemChain,
                transport: http(viemChain.rpcUrls.default.http[0])
            });

            // Fetch tokenHomeAddress and tokenHomeBlockchainID from NativeTokenRemote
            const [fetchedTokenHomeAddress, fetchedTokenHomeBlockchainID] = await Promise.all([
                remotePublicClient.readContract({
                    address: remoteContractAddress as Address,
                    abi: NativeTokenRemoteABI.abi,
                    functionName: 'getTokenHomeAddress',
                }) as Promise<Address>,
                remotePublicClient.readContract({
                    address: remoteContractAddress as Address,
                    abi: NativeTokenRemoteABI.abi,
                    functionName: 'getTokenHomeBlockchainID',
                }) as Promise<`0x${string}`>
            ]);

            setTokenHomeAddress(fetchedTokenHomeAddress);
            setTokenHomeBlockchainIDHex(fetchedTokenHomeBlockchainID);

            // Find source chain from blockchain ID
            const blockchainIdBase58 = utils.base58check.encode(Buffer.from(fetchedTokenHomeBlockchainID.slice(2), 'hex'));
            const matchingChain = l1List.find((chain: any) => chain.id === blockchainIdBase58);
            
            if (matchingChain) {
                setSourceChainId(matchingChain.id);
                
                // Detect token type by checking storage locations on the TokenHome contract
                const homePublicClient = createPublicClient({
                    transport: http(matchingChain.rpcUrl)
                });

                try {
                    // Try to read NATIVE_TOKEN_HOME_STORAGE_LOCATION
                    await homePublicClient.readContract({
                        address: fetchedTokenHomeAddress,
                        abi: NativeTokenHomeABI.abi,
                        functionName: 'NATIVE_TOKEN_HOME_STORAGE_LOCATION',
                    });
                    setTokenType('native');
                } catch {
                    try {
                        // Try to read ERC20_TOKEN_HOME_STORAGE_LOCATION
                        await homePublicClient.readContract({
                            address: fetchedTokenHomeAddress,
                            abi: ERC20TokenHomeABI.abi,
                            functionName: 'ERC20_TOKEN_HOME_STORAGE_LOCATION',
                        });
                        setTokenType('erc20');
                    } catch {
                        console.warn('Could not detect token type');
                        setTokenType(null);
                    }
                }
            } else {
                setLocalError("Could not find source chain for token home");
            }

        } catch (error: any) {
            console.error("Error fetching token home info:", error);
            setLocalError(`Error fetching token home info: ${error.shortMessage || error.message}`);
            setTokenHomeAddress(null);
            setTokenHomeBlockchainIDHex(null);
            setSourceChainId(null);
        } finally {
            setIsFetchingTokenHome(false);
        }
    }, [remoteContractAddress, viemChain, l1List]);

    const fetchStatus = useCallback(async () => {
        if (!sourceL1?.rpcUrl || !walletEVMAddress || !remoteContractAddress || !tokenHomeBlockchainIDHex || !tokenHomeAddress || !viemChain || !tokenType) {
            setTokenAddress(null);
            setTokenDecimals(null);
            setTokenSymbol(null);
            setTokenBalance(null);
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
                address: tokenHomeAddress as Address,
                abi: ERC20TokenHomeABI.abi,
                functionName: 'getTokenAddress',
            }) as Address;
            setTokenAddress(fetchedTokenAddress);

            // 2. Get Token Details, Allowance, and Balance
            const promises = [
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
                    args: [walletEVMAddress as Address, tokenHomeAddress as Address]
                })
            ];

            // Add balance fetching based on token type
            if (tokenType === 'erc20') {
                promises.push(
                    homePublicClient.readContract({
                        address: fetchedTokenAddress,
                        abi: ExampleERC20ABI.abi,
                        functionName: 'balanceOf',
                        args: [walletEVMAddress as Address]
                    })
                );
            } else if (tokenType === 'native') {
                promises.push(
                    homePublicClient.getBalance({
                        address: walletEVMAddress as Address
                    })
                );
            }

            const results = await Promise.all(promises);
            setTokenDecimals(Number(results[0] as bigint));
            setTokenSymbol(results[1] as string);
            setAllowance(results[2] as bigint);
            if (results[3] !== undefined) {
                setTokenBalance(results[3] as bigint);
            }

            // Check if the remote contract is collateralized
            try {
                // First try with getIsCollateralized which is in NativeTokenRemote
                const collateralized = await remotePublicClient.readContract({
                    address: remoteContractAddress as Address,
                    abi: ERC20TokenRemoteABI.abi,
                    functionName: 'getIsCollateralized'
                })

                setIsCollateralized(collateralized as boolean);
            } catch (error) {
                console.error("Failed to check collateralization status:", error);
                setIsCollateralized(null);
                setLocalError("Failed to check collateralization status: " + (error as Error)?.message);
            }

            // 3. Get Collateral Info - get remote blockchain ID hex from current chain
            const remoteBlockchainIDHex = utils.bufferToHex(utils.base58check.decode(selectedL1.id));
            const settings = await homePublicClient.readContract({
                address: tokenHomeAddress as Address,
                abi: ERC20TokenHomeABI.abi,
                functionName: 'getRemoteTokenTransferrerSettings',
                args: [remoteBlockchainIDHex as `0x${string}`, remoteContractAddress]
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
            setTokenBalance(null);
            setAllowance(null);
            setCollateralInfo(null);
            setIsCollateralized(null);
        } finally {
            setIsCheckingStatus(false);
        }
    }, [sourceL1?.rpcUrl, walletEVMAddress, remoteContractAddress, tokenHomeBlockchainIDHex, tokenHomeAddress, viemChain, selectedL1, tokenType]);

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

    // Fetch token home info when remote contract address changes
    useEffect(() => {
        fetchTokenHomeInfo();
    }, [fetchTokenHomeInfo]);

    // Fetch status when we have all info
    useEffect(() => {
        fetchStatus();
    }, [fetchStatus]);

    const handleApprove = async () => {
        if (!sourceL1?.rpcUrl || !coreWalletClient?.account || !tokenHomeAddress || !tokenAddress || tokenDecimals === null || !amount || !sourceL1ViemChain) {
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
                args: [tokenHomeAddress as Address, amountParsed],
                account: coreWalletClient.account,
                chain: sourceL1ViemChain,
            });

            const writePromise = coreWalletClient.writeContract(request);
            notify({
                type: 'call',
                name: 'Approve Tokens'
            }, writePromise, sourceL1ViemChain ?? undefined);
            const hash = await writePromise;
            setLastApprovalTxId(hash);

            await publicClient.waitForTransactionReceipt({ hash });
            await fetchStatus();

        } catch (error: any) {
            console.error("Approval failed:", error);
            setLocalError(`Approval failed: ${error.shortMessage || error.message}`);
            setCriticalError(error instanceof Error ? error : new Error(String(error)));
        } finally {
            setIsProcessing(false);
        }
    };

    const handleAddCollateral = async () => {
        if (!sourceL1?.rpcUrl || !coreWalletClient?.account || !tokenHomeAddress || tokenDecimals === null || !amount || !remoteContractAddress || !selectedL1 || !sourceL1ViemChain || !tokenType) {
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

            // Only check allowance for ERC20 tokens
            if (tokenType === 'erc20' && (allowance === null || allowance < amountParsed)) {
                setLocalError(`Insufficient allowance. Please approve at least ${amount} ${tokenSymbol || 'tokens'}.`);
                setIsProcessing(false);
                return;
            }

            const remoteBlockchainIDHex = utils.bufferToHex(utils.base58check.decode(selectedL1.id));
            
            // Use appropriate ABI and parameters based on token type
            const tokenHomeABI = tokenType === 'native' ? NativeTokenHomeABI.abi : ERC20TokenHomeABI.abi;
            
            const simulateParams: any = {
                address: tokenHomeAddress as Address,
                abi: tokenHomeABI,
                functionName: 'addCollateral',
                chain: sourceL1ViemChain,
                account: walletEVMAddress as `0x${string}`,
            };
            
            // For native tokens, amount is sent as value; for ERC20, as an argument
            if (tokenType === 'native') {
                simulateParams.args = [remoteBlockchainIDHex as `0x${string}`, remoteContractAddress as Address];
                simulateParams.value = amountParsed;
            } else {
                simulateParams.args = [remoteBlockchainIDHex as `0x${string}`, remoteContractAddress as Address, amountParsed];
            }
            
            const { request } = await publicClient.simulateContract(simulateParams);

            const writePromise = coreWalletClient.writeContract({
                ...request,
                account: walletEVMAddress,
            });
            notify({
                type: 'call',
                name: 'Add Collateral'
            }, writePromise, sourceL1ViemChain ?? undefined);
            const hash = await writePromise;
            setLastAddCollateralTxId(hash);

            await publicClient.waitForTransactionReceipt({ hash });
            await fetchStatus();

        } catch (error: any) {
            console.error("Add Collateral failed:", error);
            setLocalError(`Add Collateral failed: ${error.shortMessage || error.message}`);
            setCriticalError(error instanceof Error ? error : new Error(String(error)));
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

    const hasSufficientBalance = useMemo(() => {
        if (tokenBalance === null || amountParsed === 0n) return false;
        return tokenBalance >= amountParsed;
    }, [tokenBalance, amountParsed]);

    const isValidAmount = amountParsed > 0n;

    const remoteContractSuggestions: Suggestion[] = useMemo(() => {
        const suggestions: Suggestion[] = [];
        if (nativeTokenRemoteAddress) {
            suggestions.push({
                title: nativeTokenRemoteAddress,
                value: nativeTokenRemoteAddress,
                description: `Native Token Remote on ${selectedL1?.name}`
            });
        }
        return suggestions;
    }, [nativeTokenRemoteAddress, selectedL1?.name]);

    return (
        <div className="mt-8 space-y-4">

            <EVMAddressInput
                label={`Native Token Remote Contract Address (on ${selectedL1?.name})`}
                value={remoteContractAddress}
                onChange={(value) => setRemoteContractAddress(value as Address)}
                disabled={isProcessing}
                suggestions={remoteContractSuggestions}
                placeholder="0x... (Native Token Remote)"
            />

            {isFetchingTokenHome && (
                <div className="relative overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-700 bg-gradient-to-br from-zinc-50 to-zinc-100 dark:from-zinc-800 dark:to-zinc-900 p-6">
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <div className="animate-spin rounded-full h-5 w-5 border-2 border-zinc-300 dark:border-zinc-600 border-t-zinc-600 dark:border-t-zinc-300"></div>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Loading Token Home Details</span>
                            <span className="text-xs text-zinc-500 dark:text-zinc-400">Fetching source chain and token home address...</span>
                        </div>
                    </div>
                    <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-zinc-200/20 to-transparent dark:from-zinc-700/20 rounded-full -mr-16 -mt-16"></div>
                </div>
            )}

            {!isFetchingTokenHome && tokenHomeAddress && tokenHomeBlockchainIDHex && sourceL1 && (
                <div className="space-y-3">
                    {/* Source Chain */}
                    <SelectBlockchainId
                        label="Source Chain"
                        value={sourceL1.id}
                        onChange={() => {}}
                        disabled
                    />

                    {/* Token Home Address */}
                    <Input
                        label="Token Home Address"
                        value={tokenHomeAddress}
                        onChange={() => {}}
                        disabled
                        helperText="Fetched from Native Token Remote contract"
                    />

                    {/* Token Type */}
                    {tokenType && (
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                                Transferrer Type
                            </label>
                            <RadioGroup
                                items={[
                                    { value: "erc20", label: "ERC20", isDisabled: true },
                                    { value: "native", label: "Native Token", isDisabled: true },
                                ]}
                                value={tokenType}
                                onChange={() => {}}
                                idPrefix="token-type-"
                            />
                        </div>
                    )}

                    {/* Blockchain ID */}
                    <Input
                        label="Token Home Blockchain ID"
                        value={tokenHomeBlockchainIDHex}
                        onChange={() => {}}
                        disabled
                        helperText="Source chain blockchain identifier"
                    />
                </div>
            )}

            {tokenAddress && tokenSymbol && tokenDecimals !== null && (
                <div className="p-3 border rounded-md text-sm space-y-1 bg-gray-100 dark:bg-gray-800">
                    <div>Collateral Token: <code className="font-mono">{tokenSymbol}</code></div>
                    <div>Token Address: <code className="font-mono">{tokenAddress}</code></div>
                    <div>Token Decimals: <code className="font-mono">{tokenDecimals}</code></div>
                    {tokenBalance !== null && (
                        <div>Your Balance: <code className="font-mono">{formatUnits(tokenBalance, tokenDecimals)} {tokenSymbol}</code></div>
                    )}
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

            <AmountInput
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
                max={tokenBalance !== null && tokenDecimals !== null ? formatUnits(tokenBalance, tokenDecimals) : "0"}
                step={tokenDecimals !== null ? `0.${'0'.repeat(tokenDecimals - 1)}1` : 'any'}
                required
                disabled={!tokenAddress || isCheckingStatus}
                error={!isValidAmount && amount ? "Invalid amount" : (amount && !hasSufficientBalance ? "Insufficient balance" : undefined)}
                helperText={isAutoFilled ? "Autofilled with needed collateral" : ""}
                button={
                    tokenBalance !== null && tokenDecimals !== null ? (
                        <Button
                            onClick={() => setAmount(formatUnits(tokenBalance, tokenDecimals))}
                            stickLeft
                            disabled={!tokenAddress || isCheckingStatus}
                        >
                            MAX
                        </Button>
                    ) : undefined
                }
            />

            {localError && <div className="text-red-500 mt-2 p-2 border border-red-300 rounded">{localError}</div>}

            <div className="flex gap-2 pt-2 border-t mt-4 flex-wrap">
                {tokenType === 'erc20' && (
                    <Button
                        onClick={handleApprove}
                        loading={isProcessing && !lastApprovalTxId}
                        disabled={isProcessing || !isValidAmount || !tokenAddress || !hasSufficientBalance || hasSufficientAllowance || isCheckingStatus}
                        variant={hasSufficientAllowance ? "secondary" : "primary"}
                    >
                        {hasSufficientAllowance ? `Approved (${formatUnits(allowance ?? 0n, tokenDecimals ?? 18)} ${tokenSymbol})` : `Approve ${amount || 0} ${tokenSymbol || ''}`}
                    </Button>
                )}
                <Button
                    onClick={handleAddCollateral}
                    loading={isProcessing && !lastAddCollateralTxId && (tokenType === 'native' || !!lastApprovalTxId)}
                    disabled={isProcessing || !isValidAmount || !tokenAddress || !hasSufficientBalance || (tokenType === 'erc20' && !hasSufficientAllowance) || isCheckingStatus || collateralInfo === null}
                    variant={isCollateralized ? "secondary" : "primary"}
                >
                    {isCollateralized ? "Add More Collateral" : "Add Collateral"}
                </Button>
            <Button
                onClick={fetchStatus}
                disabled={isCheckingStatus || !remoteContractAddress || !sourceChainId}
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
    );
}

export default withConsoleToolMetadata(AddCollateral, metadata);