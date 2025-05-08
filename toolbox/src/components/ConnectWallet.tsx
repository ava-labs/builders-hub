"use client"

import type React from "react"

import { useState, useEffect } from "react"
<<<<<<< HEAD
import { Button } from "./Button"
import { useErrorBoundary } from "react-error-boundary"
import { Copy } from "lucide-react"
import { createCoreWalletClient } from "../coreViem"
import { networkIDs } from "@avalabs/avalanchejs"
import { useWalletStore } from "../lib/walletStore"

export const ConnectWallet = ({ children, required }: { children: React.ReactNode; required: boolean }) => {
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

  const [hasWallet, setHasWallet] = useState<boolean>(false)
  const [isBrowser, setIsBrowser] = useState<boolean>(false)
  const { showBoundary } = useErrorBoundary()

  useEffect(() => {
    setIsBrowser(true)

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

    if (isBrowser) {
      init()
    }

    // Clean up event listeners
    return () => {
      if (isBrowser && window.avalanche?.removeListener) {
        try {
          window.avalanche.removeListener("accountsChanged", () => { })
          window.avalanche.removeListener("chainChanged", () => { })
        } catch (e) {
          console.warn("Failed to remove event listeners:", e)
        }
      }
    }
  }, [isBrowser])

  const onChainChanged = (chainId: string | number) => {
    if (typeof chainId === "string") {
      chainId = Number.parseInt(chainId, 16)
    }

    setWalletChainId(chainId)
    coreWalletClient.getPChainAddress().then(setPChainAddress).catch(showBoundary)

    coreWalletClient
      .isTestnet()
      .then((isTestnet: boolean) => {
        setAvalancheNetworkID(isTestnet ? networkIDs.FujiID : networkIDs.MainnetID)
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
    if (!isBrowser) return

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
    if (isBrowser) {
      navigator.clipboard.writeText(text)
    }
  }

  const truncateAddress = (address: string) => {
    return `${address.substring(0, 12)}...${address.substring(address.length - 4)}`
  }

  // Server-side rendering fallback
  if (!isBrowser) {
    return (
      <div className="space-y-4 transition-all duration-300">
        <div className="transition-all duration-300">{children}</div>
      </div>
    )
  }

  if (required && !hasWallet) {
    return (
      <div className="space-y-4 max-w-md mx-auto">
        <div className="bg-white dark:bg-zinc-900 p-8 rounded-2xl shadow-lg border border-zinc-200 dark:border-zinc-700 relative overflow-hidden">
          {/* Subtle gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-tr from-[#e5484d]/10 via-transparent to-[#e5484d]/5 dark:from-[#e5484d]/5 dark:via-transparent dark:to-[#e5484d]/2 pointer-events-none"></div>

          <div className="relative">
            <div className="flex items-center justify-center mb-6">
              <div className="relative">
                <div className="absolute -inset-1 bg-[#e5484d]/20 rounded-full blur-md"></div>
                <img src="/small-logo.png" alt="Avalanche Logo" className="h-16 w-auto relative" />
              </div>
            </div>
            <h3 className="text-2xl font-bold text-center text-zinc-800 dark:text-zinc-100 mb-4">
              Core Wallet Required
            </h3>
            <p className="text-zinc-600 dark:text-zinc-300 text-center mb-8 leading-relaxed">
              To interact with Avalanche Builders Hub, you'll need to install the Core wallet extension.
            </p>
            <a
              href="https://chromewebstore.google.com/detail/core-crypto-wallet-nft-ex/agoakfejjabomempkjlepdflaleeobhb"
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full"
            >
              <Button className="w-full bg-[#e5484d] hover:bg-[#d13438] text-black font-medium py-4 px-5 rounded-xl shadow-lg hover:shadow-xl hover:translate-y-[-2px] active:translate-y-[1px] transition-all duration-200 flex items-center justify-center">
                Download Core Wallet
              </Button>
            </a>
            <p className="text-xs text-center text-zinc-500 dark:text-zinc-400 mt-6">
              Core is a secure wallet for managing digital assets on Avalanche
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (required && !walletEVMAddress) {
    return (
      <div className="space-y-4 max-w-md mx-auto">
        <div className="bg-white dark:bg-zinc-900 p-8 rounded-2xl shadow-lg border border-zinc-200 dark:border-zinc-700 relative overflow-hidden">
          {/* Subtle gradient background */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#e5484d]/10 via-transparent to-transparent dark:from-[#e5484d]/5 dark:via-transparent pointer-events-none"></div>

          {/* Decorative elements */}
          {/* <div className="absolute top-0 right-0 w-32 h-32 bg-[#e5484d]/5 dark:bg-[#e5484d]/2 rounded-full -mr-16 -mt-16"></div> */}
          {/* <div className="absolute bottom-0 left-0 w-24 h-24 bg-[#e5484d]/5 dark:bg-[#e5484d]/2 rounded-full -ml-12 -mb-12"></div> */}

          <div className="relative">
            <div className="flex items-center justify-center mb-6">
              <div className="relative">
                {/* <div className="absolute -inset-2 bg-[#e5484d]/20 rounded-full blur-md animate-pulse"></div> */}
                <img src="/small-logo.png" alt="Avalanche Logo" className="h-20 w-auto relative" />
              </div>
            </div>

            <h3 className="text-2xl font-bold text-center text-zinc-800 dark:text-zinc-100 mb-4">
              Connect Your Wallet
            </h3>
            <p className="text-zinc-600 dark:text-zinc-300 text-center mb-8 leading-relaxed">
              Connect your Core wallet to access Avalanche Builder Hub and explore the ecosystem.
            </p>

            <Button
              onClick={connectWallet}
              className="w-full bg-[#e5484d] hover:bg-[#d13438] text-white font-medium py-4 px-5 rounded-xl shadow-lg hover:shadow-xl hover:translate-y-[-2px] active:translate-y-[1px] transition-all duration-200 flex items-center justify-center relative group"
            >
              <span className="absolute inset-0 w-full h-full bg-white/10 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></span>
              <span className="relative z-10 text-black dark:text-white">Connect Wallet</span>
            </Button>

            <div className="mt-8 flex items-center justify-center">
              <div className="w-full max-w-xs">
                <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
                  <div className="flex items-center">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1.5"></div>
                    <span>Secure connection</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1.5"></div>
                    <span>No data sharing</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 transition-all duration-300">
      {walletEVMAddress && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-md rounded-xl p-4 relative overflow-hidden">
          {/* Subtle gradient background */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#e5484d]/10 via-transparent to-transparent dark:from-[#e5484d]/5 dark:via-transparent pointer-events-none"></div>

          {/* Header with logo, wallet info, and badges */}
          <div className="flex items-center justify-between mb-4 relative">
            {/* Wider logo and title section with subtitle underneath */}
            <div className="flex items-start flex-1">
              <div className="bg-[#e5484d]/10 dark:bg-[#e5484d]/20 rounded-lg p-2.5 mr-3 h-[60px] w-[60px] flex items-center justify-center">
                <img src="/small-logo.png" alt="Avalanche Logo" className="h-8 w-auto" />
              </div>
              <div className="flex flex-col justify-center h-[60px]">
                <h3 className="text-base font-semibold text-zinc-800 dark:text-zinc-100">Avalanche Wallet</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">Connected to Core</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Chain indicator */}
              {walletChainId && (
                <div className="flex items-center gap-1.5 bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1 rounded-full text-xs">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
                  <span className="text-black dark:text-black font-medium">Chain {walletChainId}</span>
                </div>
              )}

              {/* Network badge */}
              {avalancheNetworkID && (
                <div
                  className={`px-2.5 py-1 rounded-full text-xs font-medium flex items-center ${avalancheNetworkID === networkIDs.FujiID
                    ? "bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200"
                    : "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200"
                    }`}
                >
                  <div
                    className={`w-1.5 h-1.5 rounded-full mr-1.5 ${avalancheNetworkID === networkIDs.FujiID ? "bg-orange-500" : "bg-green-500"
                      }`}
                  ></div>
                  {avalancheNetworkID === networkIDs.FujiID ? "Testnet" : "Mainnet"}
                </div>
              )}
            </div>
          </div>

          {/* Wallet addresses in a compact format */}
          <div className="space-y-2 relative">
            {/* EVM Address */}
            <div className="flex items-center justify-between bg-zinc-50 dark:bg-zinc-800/80 rounded-md p-2.5 border border-zinc-200 dark:border-zinc-700">
              <div className="flex items-center">
                <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mr-2">EVM:</span>
                <div className="font-mono text-xs text-zinc-800 dark:text-zinc-200 truncate">
                  {walletEVMAddress}
                </div>
              </div>
              <button
                onClick={() => copyToClipboard(walletEVMAddress)}
                className="p-1.5 rounded-md hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                title="Copy address"
              >
                <Copy className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
              </button>
            </div>

            {/* P-Chain Address */}
            {pChainAddress && (
              <div className="flex items-center justify-between bg-zinc-50 dark:bg-zinc-800/80 rounded-md p-2.5 border border-zinc-200 dark:border-zinc-700">
                <div className="flex items-center">
                  <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mr-2">P-Chain:</span>
                  <div className="font-mono text-xs text-zinc-800 dark:text-zinc-200 truncate">
                    {pChainAddress}
                  </div>
                </div>
                <button
                  onClick={() => copyToClipboard(pChainAddress)}
                  className="p-1.5 rounded-md hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                  title="Copy address"
                >
                  <Copy className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Children content */}
      <div className="transition-all duration-300">{children}</div>
    </div>
  )
}

=======
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
    const setEvmChainName = useWalletStore(state => state.setEvmChainName);
    const evmChainName = useWalletStore(state => state.evmChainName);
    const isTestnet = useWalletStore(state => state.isTestnet);
    const updateAllBalances = useWalletStore(state => state.updateAllBalances);
    const updatePChainBalance = useWalletStore(state => state.updatePChainBalance);
    const updateL1Balance = useWalletStore(state => state.updateL1Balance);


    const [hasWallet, setHasWallet] = useState<boolean>(false)
    const [isClient, setIsClient] = useState<boolean>(false)
    const pChainBalance = useWalletStore(state => state.pChainBalance);
    const l1Balance = useWalletStore(state => state.l1Balance);
    const faucetUrl = faucets[walletChainId as keyof typeof faucets];
    const { showBoundary } = useErrorBoundary()

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
                        ? 'md: grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]'
                        : 'md: grid-cols-2'
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
                            <div className="text-2xl font-semibold text-zinc-800 dark:text-zinc-100 mb-2 flex items-center">
                                {l1Balance.toFixed(2)} {walletChainId === avalanche.id || walletChainId === avalancheFuji.id ? "AVAX" : "Tokens"}
                                <button
                                    onClick={updateL1Balance}
                                    className="ml-2 p-1 rounded-md bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-600 transition-colors"
                                    title="Refresh balance"
                                >
                                    <RefreshCw className="w-4 h-4 text-zinc-600 dark:text-zinc-300" />
                                </button>
                                {faucetUrl && (
                                    <button
                                        onClick={() => window.open(faucetUrl, "_blank")}
                                        className={`ml-2 px-2 py-1 text-xs font-medium bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors ${l1Balance < LOW_BALANCE_THRESHOLD
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
                            <InterchainTransfer glow={pChainBalance < LOW_BALANCE_THRESHOLD && l1Balance > LOW_BALANCE_THRESHOLD} />
                        )}

                        {/* P-Chain */}
                        <div className="bg-zinc-50 dark:bg-zinc-800 rounded-xl p-4 border border-zinc-200 dark:border-zinc-700 h-full">
                            <div className="flex justify-between items-start mb-2">
                                <span className="text-zinc-600 dark:text-zinc-400 text-sm font-medium">P-Chain</span>
                                <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 text-xs rounded-full">Always Connected</span>
                            </div>
                            <div className="text-2xl font-semibold text-zinc-800 dark:text-zinc-100 mb-2 flex items-center">
                                {pChainBalance.toFixed(2)} AVAX
                                <button
                                    onClick={updatePChainBalance}
                                    className="ml-2 p-1 rounded-md bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-600 transition-colors"
                                    title="Refresh balance"
                                >
                                    <RefreshCw className="w-4 h-4 text-zinc-600 dark:text-zinc-300" />
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
>>>>>>> upstream/master
