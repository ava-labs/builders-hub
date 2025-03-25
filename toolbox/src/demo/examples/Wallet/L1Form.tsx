"use client"

import { useToolboxStore, useViemChainStore, useWalletStore } from "../../utils/store"
import { useState, useEffect } from "react"
import { createPublicClient, http, webSocket } from "viem"
import { Button } from "../../../components/button"
import { Input } from "../../../components/input"
import { Container } from "../../../components/container"
import { AlertCircle, CheckCircle, Loader2 } from "lucide-react"

/*
//From chainlist.org
const knownEvmChainIds = [1, 43114, 43113]
*/

export default function L1Form() {
    const [isSwitching, setIsSwitching] = useState(false);
    const { coreWalletClient, /*walletChainId*/ } = useWalletStore();
    const {
        evmChainId,
        setEvmChainId,
        evmChainName,
        evmChainRpcUrl,
        evmChainCoinName,
        setEvmChainName,
        setEvmChainRpcUrl,
        setEvmChainCoinName,
        evmChainIsTestnet,
        setEvmChainIsTestnet,
    } = useToolboxStore();
    const [localError, setLocalError] = useState<string | null>(null);
    const [isCheckingRpc, setIsCheckingRpc] = useState(false);
    const [success, setSuccess] = useState(false);
    const viemChain = useViemChainStore();

    //TODO: restore after wallet_getEthereumChain is restored in Core
    // async function loadFromWallet() {
    //     try {
    //         setLocalError(null);

    //         const chain = await coreWalletClient.getEthereumChain()
    //         setEvmChainCoinName(chain.nativeCurrency.name)
    //         setEvmChainIsTestnet(chain.isTestnet)
    //         setEvmChainRpcUrl(chain.rpcUrls[0])
    //         refetchChainIdFromRpc()
    //     } catch (error) {
    //         setLocalError((error as Error)?.message || "Unknown error");
    //     } finally {
    //         setIsCheckingRpc(false);
    //     }
    // }


    async function refetchChainIdFromRpc() {
        setEvmChainId(0);

        if (!evmChainRpcUrl) {
            return;
        }

        if (!evmChainRpcUrl.startsWith("http") && !evmChainRpcUrl.startsWith("ws")) {
            setLocalError("Invalid RPC URL");
            return;
        }

        try {
            setLocalError(null);
            const publicClient = createPublicClient({
                transport: evmChainRpcUrl.startsWith("ws") ? webSocket(evmChainRpcUrl) : http(evmChainRpcUrl)
            });

            const chainId = await publicClient.getChainId();
            setEvmChainId(chainId);
        } catch (error) {
            setLocalError((error as Error)?.message || "Unknown error");
        } finally {
            setIsCheckingRpc(false);
        }
    }

    useEffect(() => {
        refetchChainIdFromRpc()
    }, [evmChainRpcUrl])

    async function handleSwitchChain() {
        try {
            setIsSwitching(true)
            setLocalError(null)
            setSuccess(false)

            if (!viemChain) throw new Error("Viem chain not found")

            await coreWalletClient.addChain({ chain: viemChain })
            await coreWalletClient.switchChain({ id: viemChain.id })
            setSuccess(true)
        } catch (error) {
            setLocalError((error as Error)?.message || "Unknown error")
        } finally {
            setIsSwitching(false)
        }
    }

    return (
        <Container title="Chain Configuration" description="Configure and switch to an EVM-compatible chain">
            {/* Background gradient effect */}
            {/* <div className="absolute inset-0 bg-gradient-to-br from-red-50/50 to-transparent dark:from-red-900/10 dark:to-transparent pointer-events-none"></div> */}

            <div className="relative">
                {localError && (
                    <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md text-red-700 dark:text-red-300 text-sm">
                        <div className="flex items-center">
                            <AlertCircle className="h-4 w-4 text-red-500 mr-2 flex-shrink-0" />
                            <span>{String(localError).slice(0, 100)}</span>
                        </div>
                    </div>
                )}

                {success && (
                    <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md text-green-800 dark:text-green-200 text-sm">
                        <div className="flex items-center">
                            <CheckCircle className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                            <span>Chain switched successfully</span>
                        </div>
                    </div>
                )}

                <div className="space-y-3">
                    {/* 
                        {evmChainId !== walletChainId && !knownEvmChainIds.includes(walletChainId) && <Button onClick={loadFromWallet}>Load from wallet</Button>}
                        */}

                    <div className="space-y-1">
                        <Input
                            label="Chain Name"
                            type="text"
                            value={evmChainName}
                            onChange={setEvmChainName}
                            placeholder="Enter chain name"
                            className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-md text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-red-500 dark:focus:ring-red-400"
                        />
                    </div>

                    <div className="space-y-1">
                        <Input
                            label="RPC URL"
                            type="text"
                            value={evmChainRpcUrl}
                            onChange={setEvmChainRpcUrl}
                            placeholder="Enter RPC URL"
                            className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-md text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-red-500 dark:focus:ring-red-400"
                        />
                    </div>

                    <div className="space-y-1">
                        <Input
                            label="Coin Name"
                            type="text"
                            value={evmChainCoinName}
                            onChange={setEvmChainCoinName}
                            placeholder="Enter coin name"
                            className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-md text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-red-500 dark:focus:ring-red-400"
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">Is Testnet</label>
                        <div className="flex space-x-2">
                            <Button 
                                variant="secondary"
                                onClick={() => setEvmChainIsTestnet(true)}
                                className={`px-3 py-2 text-sm rounded-md flex-1 transition-colors ${
                                    evmChainIsTestnet
                                        ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800"
                                        : "bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700"
                                }`}
                            >
                                Yes
                            </Button>
                            <Button
                                variant="secondary"
                                onClick={() => setEvmChainIsTestnet(false)}
                                className={`px-3 py-2 text-sm rounded-md flex-1 transition-colors ${
                                    !evmChainIsTestnet
                                        ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800"
                                        : "bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700"
                                }`}
                            >
                                No
                            </Button>
                        </div>
                    </div>

                    <div className="bg-zinc-50 dark:bg-zinc-800/70 rounded-md p-3 border border-zinc-200 dark:border-zinc-700">
                        <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Target Chain ID</div>
                        <div className="font-mono text-sm text-zinc-800 dark:text-zinc-200">
                            {evmChainId > 0 ? evmChainId.toString() : "Not detected"}
                        </div>
                    </div>

                    <div className="pt-2">
                        {evmChainId === 0 ? (
                            <Button
                                variant="secondary"
                                onClick={refetchChainIdFromRpc}
                                disabled={evmChainRpcUrl === "" || isCheckingRpc}
                                className={`w-full py-2 px-4 rounded-md text-sm font-medium flex items-center justify-center ${
                                    evmChainRpcUrl === "" || isCheckingRpc
                                        ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 cursor-not-allowed"
                                        : "bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-all duration-200"
                                }`}
                            >
                                {isCheckingRpc ? (
                                    <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        Checking RPC...
                                    </>
                                ) : (
                                    "Load Chain ID from RPC"
                                )}
                            </Button>
                        ) : (
                            <Button
                                variant="primary"
                                onClick={handleSwitchChain}
                                disabled={isSwitching}
                            >
                                {isSwitching ? (
                                    <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        Switching Chain...
                                    </>
                                ) : (
                                    <div className="flex items-center justify-center w-full relative">
                                        <span>Switch Chain</span>
                                    </div>
                                )}
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        </Container>
    )
}