"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useErrorBoundary } from "react-error-boundary"
import { Copy, RefreshCw } from "lucide-react"
import { createCoreWalletClient } from "../coreViem"
import { networkIDs } from "@avalabs/avalanchejs"
import { useWalletStore } from "../lib/walletStore"
import { WalletRequiredPrompt } from "./WalletRequiredPrompt"
import { ConnectWalletPrompt } from "./ConnectWalletPrompt"
import { RemountOnWalletChange } from "./RemountOnWalletChange"
import { avalanche, avalancheFuji } from "viem/chains"
import InterchainTransfer from "./InterchainTransfer"

const faucets = {
    43113: "https://test.core.app/tools/testnet-faucet/?subnet=c&token=c",
    173750: "https://test.core.app/tools/testnet-faucet/?subnet=echo&token=echo",
    779672: "https://test.core.app/tools/testnet-faucet/?subnet=dispatch&token=dispatch"
}
const LOW_BALANCE_THRESHOLD = 0.5

export const ConnectWallet = ({
    children,
    required,
    extraElements,
    hidePChain = false,
    forceCChain = false
}: {
    children: React.ReactNode;
    required: boolean;
    extraElements?: React.ReactNode;
    hidePChain?: boolean;
    forceCChain?: boolean;
}) => {
    const setWalletChainId = useWalletStore(state => state.setWalletChainId);
    const walletEVMAddress = useWalletStore(state => state.walletEVMAddress);
    const setWalletEVMAddress = useWalletStore(state => state.setWalletEVMAddress);
    const setCoreWalletClient = useWalletStore(state => state.setCoreWalletClient);
    const coreWalletClient = useWalletStore(state => state.coreWalletClient);
    const setAvalancheNetworkID = useWalletStore(state => state.setAvalancheNetworkID);
    const setPChainAddress = useWalletStore(state => state.setPChainAddress);
    const setCoreEthAddress = useWalletStore(state => state.setCoreEthAddress);
    const pChainAddress = useWalletStore(state => state.pChainAddress);
    const walletChainId = useWalletStore(state => state.walletChainId);
    const setIsTestnet = useWalletStore(state => state.setIsTestnet);
    const setEvmChainName = useWalletStore(state => state.setEvmChainName);
    const evmChainName = useWalletStore(state => state.evmChainName);
    const isTestnet = useWalletStore(state => state.isTestnet);
    const updateAllBalances = useWalletStore(state => state.updateAllBalances);
    const updatePChainBalance = useWalletStore(state => state.updatePChainBalance);
    const updateL1Balance = useWalletStore(state => state.updateL1Balance);
    const updateCChainBalance = useWalletStore(state => state.updateCChainBalance);

    const isPChainBalanceLoading = useWalletStore(state => state.isPChainBalanceLoading);
    const isL1BalanceLoading = useWalletStore(state => state.isL1BalanceLoading);
    const isCChainBalanceLoading = useWalletStore(state => state.isCChainBalanceLoading);

    const [hasWallet, setHasWallet] = useState<boolean>(false)
    const [isClient, setIsClient] = useState<boolean>(false)
    const pChainBalance = useWalletStore(state => state.pChainBalance);
    const l1Balance = useWalletStore(state => state.l1Balance);
    const cChainBalance = useWalletStore(state => state.cChainBalance);
    const faucetUrl = faucets[walletChainId as keyof typeof faucets];
    const { showBoundary } = useErrorBoundary()
    const coreEthAddress = useWalletStore(state => state.coreEthAddress); // This is the C-Chain address

    // Set isClient to true once component mounts (client-side only)
    useEffect(() => {
        setIsClient(true)
    }, [])

    // Fetch initial EVM balance and set up polling
    useEffect(() => {
        if (walletEVMAddress && walletChainId && pChainAddress) {
            updateAllBalances();
        }
    }, [updateAllBalances, walletEVMAddress, walletChainId, pChainAddress]); // Depend on the memoized fetch function


    useEffect(() => {
        if (!isClient) return;

        async function init() {
            try {
                // Check if window.avalanche exists and is an object
                if (typeof window.avalanche !== 'undefined' && window.avalanche !== null) {
                    setHasWallet(true)
                } else {
                    setHasWallet(false)
                    return
                }

                // Safely add event listeners
                if (window.avalanche?.on) {
                    window.avalanche.on("accountsChanged", handleAccountsChanged)
                    window.avalanche.on("chainChanged", onChainChanged)
                }

                try {
                    // Check if request method exists before calling it
                    if (window.avalanche?.request) {
                        const accounts = await window.avalanche.request<string[]>({ method: "eth_accounts" })
                        if (accounts) {
                            handleAccountsChanged(accounts)
                        }
                    }
                } catch (error) {
                    // Ignore error, it's expected if the user has not connected their wallet yet
                    console.debug("No accounts found:", error)
                }
            } catch (error) {
                console.error("Error initializing wallet:", error)
                setHasWallet(false)
                showBoundary(error)
            }
        }

        init()

        // Clean up event listeners
        return () => {
            if (window.avalanche?.removeListener) {
                try {
                    window.avalanche.removeListener("accountsChanged", () => { })
                    window.avalanche.removeListener("chainChanged", () => { })
                } catch (e) {
                    console.warn("Failed to remove event listeners:", e)
                }
            }
        }
    }, [isClient])

    const onChainChanged = (chainId: string | number) => {
        if (typeof chainId === "string") {
            chainId = Number.parseInt(chainId, 16)
        }

        setWalletChainId(chainId)
        coreWalletClient.getPChainAddress().then(setPChainAddress).catch(showBoundary)
        coreWalletClient.getCorethAddress().then(setCoreEthAddress).catch(showBoundary)

        coreWalletClient
            .getEthereumChain()
            .then(({ isTestnet, chainName }: { isTestnet: boolean, chainName: string }) => {
                setAvalancheNetworkID(isTestnet ? networkIDs.FujiID : networkIDs.MainnetID)
                setIsTestnet(isTestnet)
                setEvmChainName(chainName)
            })
            .catch(showBoundary)
    }

    const handleAccountsChanged = (accounts: string[]) => {
        if (accounts.length === 0) {
            setWalletEVMAddress("")
            return
        } else if (accounts.length > 1) {
            showBoundary(new Error("Multiple accounts found, we don't support that yet"))
            return
        }

        //re-create wallet with new account
        const newWalletClient = createCoreWalletClient(accounts[0] as `0x${string}`)
        if (!newWalletClient) {
            setHasWallet(false)
            return
        }

        setCoreWalletClient(newWalletClient)
        setWalletEVMAddress(accounts[0] as `0x${string}`)

        coreWalletClient.getPChainAddress().then(setPChainAddress).catch(showBoundary)
        coreWalletClient.getCorethAddress().then(setCoreEthAddress).catch(showBoundary)

        if (walletChainId === 0) {
            coreWalletClient.getChainId().then(onChainChanged).catch(showBoundary)
        }
    }

    async function connectWallet() {
        if (!isClient) return

        console.log("Connecting wallet")
        try {
            if (!window.avalanche?.request) {
                setHasWallet(false)
                return
            }

            const accounts = await window.avalanche.request<string[]>({ method: "eth_requestAccounts" })

            if (!accounts) {
                throw new Error("No accounts returned from wallet")
            }

            // Use the same handler function as defined in useEffect
            if (accounts.length === 0) {
                setWalletEVMAddress("")
                return
            } else if (accounts.length > 1) {
                showBoundary(new Error("Multiple accounts found, we don't support that yet"))
                return
            }

            //re-create wallet with new account
            const newWalletClient = createCoreWalletClient(accounts[0] as `0x${string}`)
            if (!newWalletClient) {
                setHasWallet(false)
                return
            }

            setCoreWalletClient(newWalletClient)
            setWalletEVMAddress(accounts[0] as `0x${string}`)

            coreWalletClient.getPChainAddress().then(setPChainAddress).catch(showBoundary)
            coreWalletClient.getCorethAddress().then(setCoreEthAddress).catch(showBoundary)

            if (walletChainId === 0) {
                coreWalletClient.getChainId().then(onChainChanged).catch(showBoundary)
            }
        } catch (error) {
            console.error("Error connecting wallet:", error)
            showBoundary(error)
        }
    }

    const copyToClipboard = (text: string) => {
        if (isClient) {
            navigator.clipboard.writeText(text)
        }
    }

    // Server-side rendering placeholder
    if (!isClient) {
        return (
            <div className="space-y-4 transition-all duration-300">
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-md rounded-xl p-4 relative overflow-hidden animate-pulse">
                    <div className="h-10 bg-zinc-200 dark:bg-zinc-800 rounded mb-4 w-1/3"></div>
                    <div className="h-32 bg-zinc-100 dark:bg-zinc-800 rounded-xl mb-4"></div>
                </div>
                <div className="transition-all duration-300">{children}</div>
            </div>
        )
    }

    if (required && !hasWallet) {
        return <WalletRequiredPrompt />
    }

    if (required && !walletEVMAddress) {
        return <ConnectWalletPrompt onConnect={connectWallet} />
    }

    // Determine what to display based on props
    const isActuallyCChainSelected = walletChainId === avalanche.id || walletChainId === avalancheFuji.id;

    const displayedL1ChainName = forceCChain ? "C-Chain" : evmChainName;
    const displayedL1Balance = forceCChain ? cChainBalance : l1Balance;
    const displayedL1TokenSymbol = (forceCChain || isActuallyCChainSelected) ? "AVAX" : "Tokens";
    const displayedL1Address = forceCChain ? coreEthAddress : walletEVMAddress;
    const updateDisplayedL1Balance = forceCChain ? updateCChainBalance : updateL1Balance;
    const isDisplayedL1BalanceLoading = forceCChain ? isCChainBalanceLoading : isL1BalanceLoading;

    const cChainTestnetFaucetUrl = isTestnet ? faucets[avalancheFuji.id as keyof typeof faucets] : undefined;
    const displayedFaucetUrl = forceCChain
        ? cChainTestnetFaucetUrl
        : faucetUrl;

    const showL1SelectedBadge = forceCChain ? true : !!walletChainId; // If forcing C-Chain, it's "selected" for display purposes

    const showPChainCard = !hidePChain;
    const showInterchainArrows = showPChainCard && (isActuallyCChainSelected || forceCChain);

    let gridLayoutClass = "md:grid-cols-1";
    if (showPChainCard && showInterchainArrows) {
        gridLayoutClass = "md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]";
    } else if (showPChainCard) {
        gridLayoutClass = "md:grid-cols-2";
    }

    const glowConditionL1Balance = forceCChain ? cChainBalance : l1Balance;

    return (
        <div className="space-y-4 transition-all duration-300">
            {walletEVMAddress && (
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-md rounded-xl p-4 relative overflow-hidden">
                    {/* Core Wallet header */}
                    <div className="flex items-center justify-between mt-2 mb-6">
                        <div className="flex items-center space-x-2">
                            <img src="/core-logo.svg" alt="Core Logo" className="h-10 w-auto mt-1 mb-1 dark:hidden" />
                            <img src="/core-logo-dark.svg" alt="Core Logo" className="h-10 w-auto mt-1 mb-1 hidden dark:block" />
                        </div>


                        <div className="rounded-full overflow-hidden flex bg-zinc-100 dark:bg-zinc-800/70 p-0.5">
                            <button
                                onClick={() => coreWalletClient.switchChain({ id: avalancheFuji.id })}
                                className={`px-4 py-1 text-sm rounded-full transition-colors ${isTestnet
                                    ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300 font-bold'
                                    : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                                    }`}
                            >
                                Testnet
                            </button>
                            <button
                                onClick={() => coreWalletClient.switchChain({ id: avalanche.id })}
                                className={`px-4 py-1 text-sm rounded-full transition-colors ${!isTestnet
                                    ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 font-bold'
                                    : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                                    }`}
                            >
                                Mainnet
                            </button>
                        </div>
                    </div>

                    {/* Chain cards */}
                    <div className={`grid grid-cols-1 gap-4 items-center mb-4 ${gridLayoutClass}`}>
                        {/* L1 Chain Card */}
                        <div className="bg-zinc-50 dark:bg-zinc-800 rounded-xl p-4 border border-zinc-200 dark:border-zinc-700 h-full">
                            <div className="flex justify-between items-start mb-2">
                                <span className="text-zinc-600 dark:text-zinc-400 text-sm font-medium">
                                    {displayedL1ChainName}
                                </span>
                                {showL1SelectedBadge && (
                                    <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 text-xs rounded-full">Selected</span>
                                )}
                            </div>
                            <div className="text-2xl font-semibold text-zinc-800 dark:text-zinc-100 mb-2 flex items-center">
                                {displayedL1Balance.toFixed(2)} {displayedL1TokenSymbol}
                                <button
                                    onClick={updateDisplayedL1Balance}
                                    className="ml-2 p-1 rounded-md bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    title="Refresh balance"
                                    disabled={isDisplayedL1BalanceLoading}
                                >
                                    <RefreshCw className={`w-4 h-4 text-zinc-600 dark:text-zinc-300 ${isDisplayedL1BalanceLoading ? 'animate-spin' : ''}`} />
                                </button>
                                {displayedFaucetUrl && (
                                    <button
                                        onClick={() => window.open(displayedFaucetUrl, "_blank")}
                                        className={`ml-2 px-2 py-1 text-xs font-medium bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors ${displayedL1Balance < LOW_BALANCE_THRESHOLD
                                            ? "shimmer"
                                            : ""
                                            }`}
                                        title="Open faucet"
                                    >
                                        Free tokens
                                    </button>
                                )}
                            </div>
                            {/* EVM Address inside the card */}
                            <div className="flex items-center justify-between">
                                <div className="font-mono text-xs text-zinc-700 dark:text-black bg-zinc-100 dark:bg-zinc-300 px-3 py-1.5 rounded-md overflow-x-auto shadow-sm border border-zinc-200 dark:border-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-200 transition-colors flex-1 mr-2 truncate">
                                    {displayedL1Address ? displayedL1Address : "Loading..."}
                                </div>
                                {displayedL1Address && (
                                    <button
                                        onClick={() => copyToClipboard(displayedL1Address)}
                                        className="p-1.5 rounded-md bg-zinc-100 dark:bg-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-200 transition-colors border border-zinc-200 dark:border-zinc-600 shadow-sm"
                                        title="Copy address"
                                    >
                                        <Copy className="w-3.5 h-3.5 text-zinc-600 dark:text-black" />
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Arrows between cards */}
                        {showInterchainArrows && (
                            <InterchainTransfer glow={pChainBalance < LOW_BALANCE_THRESHOLD && glowConditionL1Balance > LOW_BALANCE_THRESHOLD} />
                        )}

                        {/* P-Chain */}
                        {showPChainCard && (
                            <div className="bg-zinc-50 dark:bg-zinc-800 rounded-xl p-4 border border-zinc-200 dark:border-zinc-700 h-full">
                                <div className="flex justify-between items-start mb-2">
                                    <span className="text-zinc-600 dark:text-zinc-400 text-sm font-medium">P-Chain</span>
                                    <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 text-xs rounded-full">Always Connected</span>
                                </div>
                                <div className="text-2xl font-semibold text-zinc-800 dark:text-zinc-100 mb-2 flex items-center">
                                    {pChainBalance.toFixed(2)} AVAX
                                    <button
                                        onClick={updatePChainBalance}
                                        className="ml-2 p-1 rounded-md bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                        title="Refresh balance"
                                        disabled={isPChainBalanceLoading}
                                    >
                                        <RefreshCw className={`w-4 h-4 text-zinc-600 dark:text-zinc-300 ${isPChainBalanceLoading ? 'animate-spin' : ''}`} />
                                    </button>
                                </div>
                                <div className="flex items-center justify-between">
                                    <div className="font-mono text-xs text-zinc-700 dark:text-black bg-zinc-100 dark:bg-zinc-300 px-3 py-1.5 rounded-md overflow-x-auto shadow-sm border border-zinc-200 dark:border-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-200 transition-colors flex-1 mr-2 truncate">
                                        {pChainAddress ? pChainAddress : "Loading..."}
                                    </div>
                                    {pChainAddress && (
                                        <button
                                            onClick={() => copyToClipboard(pChainAddress)}
                                            className="p-1.5 rounded-md bg-zinc-100 dark:bg-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-200 transition-colors border border-zinc-200 dark:border-zinc-600 shadow-sm"
                                            title="Copy address"
                                        >
                                            <Copy className="w-3.5 h-3.5 text-zinc-600 dark:text-black" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {extraElements && extraElements}
                </div>
            )}

            {/* Children content */}
            <RemountOnWalletChange>
                <div className="transition-all duration-300">{children}</div>
            </RemountOnWalletChange>
        </div>
    )
}
