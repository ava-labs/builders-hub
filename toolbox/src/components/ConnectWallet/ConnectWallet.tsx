"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { useErrorBoundary } from "react-error-boundary"
import { Globe } from "lucide-react"
import { createCoreWalletClient } from "../../coreViem"
import { networkIDs } from "@avalabs/avalanchejs"
import { useWalletStore } from "../../stores/walletStore"
import { useL1ByChainId, useSelectedL1 } from "../../stores/l1ListStore"
import { WalletRequiredPrompt } from "../WalletRequiredPrompt"
import { ConnectWalletPrompt } from "./ConnectWalletPrompt"
import { RemountOnWalletChange } from "../RemountOnWalletChange"
import { avalanche, avalancheFuji } from "viem/chains"
import { L1ExplorerButton } from "./L1ExplorerButton"
import { PChainExplorerButton } from "./PChainExplorerButton"
import { ChainSelector } from "./ChainSelector"
import { PChainFaucetButton } from "./PChainFaucetButton"
import { PChainBridgeButton } from "./PChainBridgeButton"
import { L1DetailsModal } from "./L1DetailsModal"
import { L1FaucetButton } from "./L1FaucetButton"
import { TestnetMainnetSwitch } from "./TestnetMainnetSwitch"
import TokenBalance from "./TokenBalance"
import { AddressCopy } from "./AddressCopy"

export type WalletModeRequired = "l1" | "c-chain" | "testnet-mainnet"
export type WalletMode = "optional" | WalletModeRequired

export const OptionalConnectWallet = ({
    children,
    walletMode,
    enforceChainId
}: {
    children: React.ReactNode;
    walletMode: WalletMode;
    enforceChainId?: number;
}) => {
    if (walletMode === "optional") {
        return children
    }

    return <ConnectWallet walletMode={walletMode} enforceChainId={enforceChainId}>{children}</ConnectWallet>
}

export const ConnectWallet = ({
    walletMode,
    enforceChainId,
    children
}: {
    walletMode: WalletModeRequired;
    enforceChainId?: number;
    children: React.ReactNode;
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

    const [hasWallet, setHasWallet] = useState<boolean>(false)
    const [isClient, setIsClient] = useState<boolean>(false)
    const pChainBalance = useWalletStore(state => state.pChainBalance);
    const l1Balance = useWalletStore(state => state.l1Balance);
    const cChainBalance = useWalletStore(state => state.cChainBalance);
    const { showBoundary } = useErrorBoundary();
    const [rpcUrl, setRpcUrl] = useState<string>("");

    // Call toolboxStore hooks unconditionally.
    // 'isTestnet' is defined earlier via useWalletStore and is available here.
    const l1ByChainIdForCChainMode = useL1ByChainId(isTestnet ? "yH8D7ThNJkxmtkuv2jgBa4P1Rn3Qpr4pPr7QYNfcdoS6k6HWp" : "2q9e4r6Mu3U68nU1fYjgbR6JvwrRx36CohpAX5UQxse55x1Q5")();
    const selectedL1FromStore = useSelectedL1()();

    // Now, conditionally use the results of the unconditional hook calls.
    const selectedL1 = walletMode === "c-chain" ? l1ByChainIdForCChainMode : selectedL1FromStore;

    // Set isClient to true once component mounts (client-side only)
    useEffect(() => {
        setIsClient(true)
    }, [])


    useEffect(() => {
        if (!walletEVMAddress || !walletChainId || !pChainAddress) return;

        updateAllBalances();

        const intervalId = setInterval(() => {
            updateAllBalances();
        }, 30_000);

        return () => clearInterval(intervalId);
    }, [updateAllBalances, walletEVMAddress, walletChainId, pChainAddress]);

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
            .then((data: { isTestnet: boolean, chainName: string, rpcUrls: string[] }) => {
                const { isTestnet, chainName, rpcUrls } = data;
                setAvalancheNetworkID(isTestnet ? networkIDs.FujiID : networkIDs.MainnetID)
                setIsTestnet(isTestnet)
                setEvmChainName(chainName)
                setRpcUrl(rpcUrls[0]!)
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

    // Determine what to display based on props
    const isActuallyCChainSelected = walletChainId === avalanche.id || walletChainId === avalancheFuji.id;

    const displayedL1ChainName = walletMode === "c-chain" ? "C-Chain" : evmChainName;
    const displayedL1Balance = walletMode === "c-chain" ? cChainBalance : l1Balance;
    const displayedL1TokenSymbol = (walletMode === "c-chain" || isActuallyCChainSelected) ? "AVAX" : "Tokens";
    const displayedL1Address = walletEVMAddress;
    const updateDisplayedL1Balance = walletMode === "c-chain" ? updateCChainBalance : updateL1Balance;

    const showL1SelectedBadge = walletMode === "c-chain" ? true : !!walletChainId; // If forcing C-Chain, it's "selected" for display purposes

    const showPChainCard = walletMode === "c-chain";

    let gridLayoutClass = "md:grid-cols-1";
    if (showPChainCard) {
        gridLayoutClass = "md:grid-cols-2";
    }

    const displayedEvmChainId = walletMode === "c-chain" ? (isTestnet ? avalancheFuji.id : avalanche.id) : walletChainId;

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

    if (!hasWallet) {
        return <WalletRequiredPrompt />
    }

    if (!walletEVMAddress) {
        return <ConnectWalletPrompt onConnect={connectWallet} />
    }

    return (
        <div className="space-y-4 transition-all duration-300">
            {walletEVMAddress && (
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-md rounded-xl p-4 relative overflow-hidden">
                    {/* Core Wallet header */}
                    <div className="flex items-center justify-between mt-2 mb-2">
                        <CoreLogo />
                        <TestnetMainnetSwitch />
                    </div>

                    {/* Chain cards */}
                    {walletMode !== "testnet-mainnet" && (
                        <>
                            <div className={`grid grid-cols-1 gap-4 items-center mt-4 mb-4 ${gridLayoutClass}`}>

                                {/* L1 Chain Card */}
                                <div className="flex flex-col gap-2 bg-zinc-50 dark:bg-zinc-800 rounded-xl p-4 border border-zinc-200 dark:border-zinc-700 h-full">
                                    <div className="flex justify-between items-start">
                                        <div className="flex items-center gap-4">
                                            <div className="flex-shrink-0 w-10 h-10 rounded-md overflow-hidden flex items-center justify-center">
                                                {selectedL1?.logoUrl ? (
                                                    <img src={selectedL1.logoUrl} alt={`${selectedL1.name} logo`} className="w-full h-full object-cover" />
                                                ) : (
                                                    <Globe className="w-6 h-6 text-zinc-400 dark:text-zinc-500" />
                                                )}
                                            </div>
                                            <span className="text-zinc-600 dark:text-zinc-400 text-xl font-medium">
                                                {displayedL1ChainName}
                                            </span>

                                        </div>
                                        {showL1SelectedBadge && (
                                            <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 text-xs rounded-full">Selected</span>
                                        )}
                                    </div>

                                    <TokenBalance
                                        balance={displayedL1Balance}
                                        symbol={displayedL1TokenSymbol}
                                        onClick={updateDisplayedL1Balance}
                                    />

                                    <div className="flex gap-2">
                                        {selectedL1 && <L1FaucetButton blockchainId={selectedL1.id} displayedL1Balance={displayedL1Balance} />}
                                        {selectedL1 && <L1DetailsModal blockchainId={selectedL1.id} />}
                                        <L1ExplorerButton
                                            rpcUrl={rpcUrl}
                                            evmChainId={displayedEvmChainId}
                                        />
                                    </div>

                                    <AddressCopy address={displayedL1Address} />
                                </div>

                                {/* P-Chain */}
                                {showPChainCard && (
                                    <div className="flex flex-col gap-2 bg-zinc-50 dark:bg-zinc-800 rounded-xl p-4 border border-zinc-200 dark:border-zinc-700 h-full">
                                        <div className="flex justify-between items-start">
                                            <div className="flex items-center gap-3">
                                                <div className="flex-shrink-0 w-10 h-10 rounded-md overflow-hidden flex items-center justify-center">
                                                    <img src="https://images.ctfassets.net/gcj8jwzm6086/42aMwoCLblHOklt6Msi6tm/1e64aa637a8cead39b2db96fe3225c18/pchain-square.svg" alt="P-Chain Logo" className="w-full h-full object-cover" />
                                                </div>
                                                <span className="text-zinc-600 dark:text-zinc-400 text-xl font-medium">P-Chain</span>

                                            </div>
                                            <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 text-xs rounded-full">Always Connected</span>
                                        </div>

                                        <TokenBalance
                                            balance={pChainBalance}
                                            symbol="AVAX"
                                            onClick={updatePChainBalance}
                                        />

                                        <div className="flex gap-2">
                                            {pChainAddress && (<>
                                                <PChainFaucetButton
                                                    pChainAddress={pChainAddress}
                                                    pChainBalance={pChainBalance}
                                                    updatePChainBalance={updatePChainBalance}
                                                    isTestnet={isTestnet ?? false}
                                                />
                                                <PChainBridgeButton />
                                                <PChainExplorerButton />
                                            </>
                                            )}
                                        </div>

                                        <AddressCopy address={pChainAddress} />
                                    </div>
                                )}
                            </div>

                            {walletMode !== "c-chain" && <ChainSelector enforceChainId={enforceChainId} />}
                        </>
                    )}
                </div>
            )}

            {enforceChainId && walletChainId !== enforceChainId && (
                <div className="text-red-500 text-xs mb-2">Oops, you're not connected to the correct chain. Please switch to {enforceChainId} and try again.</div>
            ) || (
                    <RemountOnWalletChange>
                        <div className="transition-all duration-300">{children}</div>
                    </RemountOnWalletChange>
                )}
        </div>
    )
}

const CoreLogo = () => (
    <div className="flex items-center space-x-2">
        <img src="/core-logo.svg" alt="Core Logo" className="h-10 w-auto mt-1 mb-1 dark:hidden" />
        <img src="/core-logo-dark.svg" alt="Core Logo" className="h-10 w-auto mt-1 mb-1 hidden dark:block" />
    </div>
)