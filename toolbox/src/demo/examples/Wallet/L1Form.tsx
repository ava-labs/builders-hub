
"use client";

import { useToolboxStore, useViemChainStore, useWalletStore } from "../../utils/store";
import { useState, useEffect } from "react";
import { Button, Input, Select } from "../../ui";
import { createPublicClient, http } from 'viem';

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
                transport: http(evmChainRpcUrl)
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
        refetchChainIdFromRpc();
    }, [evmChainRpcUrl]);

    async function handleSwitchChain() {
        try {
            setIsSwitching(true);

            if (!viemChain) throw new Error("Viem chain not found");

            await coreWalletClient.addChain({ chain: viemChain });
            await coreWalletClient.switchChain({ id: viemChain.id });
        } catch (error) {
            setLocalError((error as Error)?.message || "Unknown error");
        } finally {
            setIsSwitching(false);
        }
    }

    return (
        <div className="space-y-4">
            {localError && <p className="text-red-500">{String(localError).slice(0, 100)}</p>}
            {/* {
                evmChainId !== walletChainId && !knownEvmChainIds.includes(walletChainId) && <Button onClick={loadFromWallet}>Load from wallet</Button>
            } */}
            <Input
                label="Chain Name"
                value={evmChainName}
                onChange={setEvmChainName}
                placeholder="Enter chain name"
            />
            <Input
                label="RPC URL"
                value={evmChainRpcUrl}
                onChange={setEvmChainRpcUrl}
                placeholder="Enter RPC URL"
            />
            <Input
                label="Coin Name"
                value={evmChainCoinName}
                onChange={setEvmChainCoinName}
                placeholder="Enter coin name"
            />
            <Select
                label="Is Testnet"
                value={evmChainIsTestnet.toString()}
                onChange={(value) => setEvmChainIsTestnet(value === "true")}
                options={[
                    { value: "true", label: "Yes" },
                    { value: "false", label: "No" }
                ]}
            />
            <Input
                label="Target Chain ID"
                value={evmChainId.toString()}
                disabled={true}
                type="text"
            />
            {evmChainId === 0 && (
                <Button
                    type="secondary"
                    onClick={refetchChainIdFromRpc}
                    loading={isCheckingRpc}
                    disabled={evmChainRpcUrl === ""}
                >
                    Load Chain ID from RPC
                </Button>
            )}
            {evmChainId > 0 && (
                <Button
                    type="primary"
                    onClick={handleSwitchChain}
                    loading={isSwitching}
                >
                    Switch Chain
                </Button>
            )}
        </div>
    )
}
