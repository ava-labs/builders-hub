"use client"

import type React from "react"

import { useState, useEffect, useCallback } from "react"
import { useErrorBoundary } from "react-error-boundary"
import { Copy } from "lucide-react"
import { createCoreWalletClient } from "../coreViem"
import { networkIDs } from "@avalabs/avalanchejs"
import { useWalletStore } from "../lib/walletStore"
import { WalletRequiredPrompt } from "./WalletRequiredPrompt"
import { ConnectWalletPrompt } from "./ConnectWalletPrompt"
import { RefreshOnMainnetTestnetChange } from "./RefreshOnMainnetTestnetChange"
import { avalanche, avalancheFuji } from "viem/chains"
import InterchainTransfer from "./InterchainTransfer"

export const ConnectWallet = ({ children, required, extraElements }: { children: React.ReactNode; required: boolean; extraElements?: React.ReactNode }) => {
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
    const publicClient = useWalletStore(state => state.publicClient);
    const setEvmChainName = useWalletStore(state => state.setEvmChainName);
    const evmChainName = useWalletStore(state => state.evmChainName);
    const isTestnet = useWalletStore(state => state.isTestnet);

    const [hasWallet, setHasWallet] = useState<boolean>(false)
    const [isClient, setIsClient] = useState<boolean>(false)
    const [selectedL1Balance, setSelectedL1Balance] = useState<string>("0")
    const [pChainBalance, setPChainBalance] = useState<string>("0")
    const { showBoundary } = useErrorBoundary()

    // Set isClient to true once component mounts (client-side only)
    useEffect(() => {
        setIsClient(true)
    }, [])

    // Define balance fetching functions using useCallback
    const fetchEVMBalance = useCallback(async () => {
        if (!walletEVMAddress || !walletChainId || !publicClient) return;
        setSelectedL1Balance("...");
        try {
            const l1Balance = await publicClient.getBalance({
                address: walletEVMAddress as `0x${string}`,
            });
            setSelectedL1Balance((Number(l1Balance) / 1e18).toFixed(2));
        } catch (l1Error) {
            console.error(`Error fetching balance for ${walletChainId}:`, l1Error);
            setSelectedL1Balance("?"); // Indicate error fetching balance
        }
    }, [walletEVMAddress, walletChainId, publicClient]);

    const fetchPChainBalance = useCallback(async () => {
        if (!pChainAddress || !coreWalletClient) return;
        setPChainBalance("...");
        try {
            const pBalance = await coreWalletClient.getPChainBalance();
            setPChainBalance((Number(pBalance) / 1e9).toFixed(2));
        } catch (pChainError) {
            console.error("Error fetching P-Chain balance:", pChainError);
            setPChainBalance("?"); // Indicate error fetching balance
        }
    }, [pChainAddress, coreWalletClient]);

    // Combined function to refetch both balances
    const refetchBalances = useCallback(() => {
        fetchEVMBalance();
        fetchPChainBalance();
    }, [fetchEVMBalance, fetchPChainBalance]);

    // Fetch initial EVM balance and set up polling
    useEffect(() => {
        if (walletEVMAddress && walletChainId) {
            fetchEVMBalance();
            const interval = setInterval(fetchEVMBalance, 30000);
            return () => clearInterval(interval);
        }
    }, [fetchEVMBalance, walletEVMAddress, walletChainId]); // Depend on the memoized fetch function

    // Fetch initial P-Chain balance and set up polling
    useEffect(() => {
        if (pChainAddress && coreWalletClient) {
            fetchPChainBalance();
            const interval = setInterval(fetchPChainBalance, 30000);
            return () => clearInterval(interval);
        }
    }, [fetchPChainBalance, pChainAddress, coreWalletClient]); // Depend on the memoized fetch function


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
                    <div className={`grid grid-cols-1 gap-4 items-center mb-4 ${(walletChainId === avalanche.id || walletChainId === avalancheFuji.id)
                        ? 'md:grid-cols-[1fr_auto_1fr]'
                        : 'md:grid-cols-2'
                        }`}>
                        {/* L1 Chain Card */}
                        <div className="bg-zinc-50 dark:bg-zinc-800 rounded-xl p-4 border border-zinc-200 dark:border-zinc-700 h-full">
                            <div className="flex justify-between items-start mb-2">
                                <span className="text-zinc-600 dark:text-zinc-400 text-sm font-medium">
                                    {evmChainName}
                                </span>
                                {walletChainId && (
                                    <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 text-xs rounded-full">Selected</span>
                                )}
                            </div>
                            <div className="text-2xl font-semibold text-zinc-800 dark:text-zinc-100 mb-2">
                                {selectedL1Balance} {walletChainId ? "AVAX" : "--"}
                            </div>
                            {/* EVM Address inside the card */}
                            <div className="flex items-center justify-between">
                                <div className="font-mono text-xs text-zinc-700 dark:text-black bg-zinc-100 dark:bg-zinc-300 px-3 py-1.5 rounded-md overflow-x-auto shadow-sm border border-zinc-200 dark:border-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-200 transition-colors flex-1 mr-2 truncate">
                                    {walletEVMAddress}
                                </div>
                                <button
                                    onClick={() => copyToClipboard(walletEVMAddress)}
                                    className="p-1.5 rounded-md bg-zinc-100 dark:bg-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-200 transition-colors border border-zinc-200 dark:border-zinc-600 shadow-sm"
                                    title="Copy address"
                                >
                                    <Copy className="w-3.5 h-3.5 text-zinc-600 dark:text-black" />
                                </button>
                            </div>
                        </div>

                        {/* Arrows between cards */}
                        {(walletChainId === avalanche.id || walletChainId === avalancheFuji.id) && (
                            <InterchainTransfer onBalanceChanged={refetchBalances} />
                        )}

                        {/* P-Chain */}
                        <div className="bg-zinc-50 dark:bg-zinc-800 rounded-xl p-4 border border-zinc-200 dark:border-zinc-700 h-full">
                            <div className="flex justify-between items-start mb-2">
                                <span className="text-zinc-600 dark:text-zinc-400 text-sm font-medium">P-Chain</span>
                                <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 text-xs rounded-full">Always Connected</span>
                            </div>
                            <div className="text-2xl font-semibold text-zinc-800 dark:text-zinc-100 mb-2">{pChainBalance} AVAX</div>
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
                    </div>

                    {extraElements && extraElements}
                </div>
            )}

            {/* Children content */}
            <RefreshOnMainnetTestnetChange>
                <div className="transition-all duration-300">{children}</div>
            </RefreshOnMainnetTestnetChange>
        </div>
    )
}
