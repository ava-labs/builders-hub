"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useErrorBoundary } from "react-error-boundary"
import { Copy, CheckCircle2 } from "lucide-react"
import { createCoreWalletClient } from "../coreViem"
import { networkIDs } from "@avalabs/avalanchejs"
import { useWalletStore } from "../lib/walletStore"
import { WalletRequiredPrompt } from "./WalletRequiredPrompt"
import { ConnectWalletPrompt } from "./ConnectWalletPrompt"
import { RefreshOnMainnetTestnetChange } from "./RefreshOnMainnetTestnetChange"

export const ConnectWallet = ({ children, required, extraElements }: { children: React.ReactNode; required: boolean; extraElements?: React.ReactNode }) => {
    const setWalletChainId = useWalletStore(state => state.setWalletChainId);
    const walletEVMAddress = useWalletStore(state => state.walletEVMAddress);
    const setWalletEVMAddress = useWalletStore(state => state.setWalletEVMAddress);
    const setCoreWalletClient = useWalletStore(state => state.setCoreWalletClient);
    const coreWalletClient = useWalletStore(state => state.coreWalletClient);
    const setAvalancheNetworkID = useWalletStore(state => state.setAvalancheNetworkID);
    const setPChainAddress = useWalletStore(state => state.setPChainAddress);
    const pChainAddress = useWalletStore(state => state.pChainAddress);
    const walletChainId = useWalletStore(state => state.walletChainId);
    const avalancheNetworkID = useWalletStore(state => state.avalancheNetworkID);
    const setIsTestnet = useWalletStore(state => state.setIsTestnet);
    const publicClient = useWalletStore(state => state.publicClient);
    const setEvmChainName = useWalletStore(state => state.setEvmChainName);
    const evmChainName = useWalletStore(state => state.evmChainName);

    const [hasWallet, setHasWallet] = useState<boolean>(false)
    const [isClient, setIsClient] = useState<boolean>(false)
    const [selectedL1Balance, setSelectedL1Balance] = useState<string>("0")
    const [pChainBalance, setPChainBalance] = useState<string>("0")
    const { showBoundary } = useErrorBoundary()

    // Set isClient to true once component mounts (client-side only)
    useEffect(() => {
        setIsClient(true)
    }, [])

    // Fetch EVM balance
    useEffect(() => {
        if (!walletEVMAddress || !walletChainId) return;

        setSelectedL1Balance("...");

        const fetchEVMBalance = async () => {
            try {
                const l1Balance = await publicClient.getBalance({
                    address: walletEVMAddress as `0x${string}`,
                });
                setSelectedL1Balance((Number(l1Balance) / 1e18).toFixed(2));
            } catch (l1Error) {
                console.error(`Error fetching balance for ${walletChainId}:`, l1Error);
                setSelectedL1Balance("?"); // Indicate error fetching balance
            }
        }

        fetchEVMBalance();
        // Set up polling for balance updates
        const interval = setInterval(fetchEVMBalance, 30000); // Update every 30 seconds
        return () => clearInterval(interval);
    }, [walletEVMAddress, walletChainId, publicClient]);

    // Fetch P-Chain balance
    useEffect(() => {
        if (!pChainAddress || !coreWalletClient) return;

        setPChainBalance("...");

        const fetchPChainBalance = async () => {

            try {
                const pBalance = await coreWalletClient.getPChainBalance();
                setPChainBalance((Number(pBalance) / 1e9).toFixed(2));
            } catch (pChainError) {
                console.error("Error fetching P-Chain balance:", pChainError);
                setPChainBalance("?"); // Indicate error fetching balance
            }
        }

        fetchPChainBalance();
        // Set up polling for balance updates
        const interval = setInterval(fetchPChainBalance, 30000); // Update every 30 seconds
        return () => clearInterval(interval);
    }, [pChainAddress, coreWalletClient]);

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

    // Get network badge based on network ID
    const renderNetworkBadge = () => {
        if (avalancheNetworkID === networkIDs.FujiID || walletChainId === 5) {
            return (
                <div className="inline-flex items-center">
                    <div className="px-1.5 py-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300 rounded-full inline-flex items-center text-xs tracking-tighter">
                        <span className="h-1.5 w-1.5 rounded-full bg-orange-400 mr-1 flex-shrink-0"></span>
                        <span className="flex-shrink-0">Testnet</span>
                    </div>
                </div>
            );
        } else if (avalancheNetworkID === networkIDs.MainnetID || walletChainId === 1) {
            return (
                <div className="inline-flex items-center">
                    <div className="px-1.5 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded-full inline-flex items-center text-xs tracking-tighter">
                        <CheckCircle2 className="h-2.5 w-2.5 mr-0.5 flex-shrink-0" />
                        <span className="flex-shrink-0">Mainnet</span>
                    </div>
                </div>
            );
        }
        return null;
    };

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
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center space-x-2">
                            <img src="/core.png" alt="Core Logo" className="h-10 w-10" />
                            <div>
                                <h3 className="text-lg font-semibold text-zinc-800 dark:text-zinc-100">Core Wallet</h3>
                                {renderNetworkBadge()}
                            </div>
                        </div>
                    </div>

                    {/* Chain cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        {/* L1 Chain Card */}
                        <div className="bg-zinc-50 dark:bg-zinc-800 rounded-xl p-4 border border-zinc-200 dark:border-zinc-700">
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
                                <div className="font-mono text-xs text-zinc-700 dark:text-black bg-zinc-100 dark:bg-zinc-300 px-3 py-1.5 rounded-md overflow-x-auto shadow-sm border border-zinc-200 dark:border-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-200 transition-colors flex-1 mr-2">
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

                        {/* P-Chain */}
                        <div className="bg-zinc-50 dark:bg-zinc-800 rounded-xl p-4 border border-zinc-200 dark:border-zinc-700">
                            <div className="flex justify-between items-start mb-2">
                                <span className="text-zinc-600 dark:text-zinc-400 text-sm font-medium">P-Chain</span>
                                <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 text-xs rounded-full">Always Connected</span>
                            </div>
                            <div className="text-2xl font-semibold text-zinc-800 dark:text-zinc-100 mb-2">{pChainBalance} AVAX</div>
                            <div className="flex items-center justify-between">
                                <div className="font-mono text-xs text-zinc-700 dark:text-black bg-zinc-100 dark:bg-zinc-300 px-3 py-1.5 rounded-md overflow-x-auto shadow-sm border border-zinc-200 dark:border-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-200 transition-colors flex-1 mr-2">
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
