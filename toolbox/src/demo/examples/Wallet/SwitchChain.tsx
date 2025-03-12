"use client";

import { useExampleStore } from "../../utils/store";
import { useErrorBoundary } from "react-error-boundary";
import { useState, useEffect } from "react";
import { Button, Input, Select } from "../../ui";
import { createWalletClient, createPublicClient, custom, http, AddEthereumChainParameter } from 'viem';


export default function SwitchChain() {
    const { showBoundary } = useErrorBoundary();
    const [isSwitching, setIsSwitching] = useState(false);
    const [targetChainId, setTargetChainId] = useState<number>(0);
    const [isTestnet, setIsTestnet] = useState<boolean>(true);
    const {
        walletChainId,
        evmChainName,
        evmChainRpcUrl,
        evmChainCoinName,
        setEvmChainName,
        setEvmChainRpcUrl,
        setEvmChainCoinName,
    } = useExampleStore();
    const [isCheckingRpc, setIsCheckingRpc] = useState(false);


    async function handleSwitchChain() {
        setIsSwitching(true);
        try {
            const walletClient = createWalletClient({
                transport: custom(window.avalanche!),
            });

            const chain: AddEthereumChainParameter = {
                chainId: `0x${targetChainId.toString(16)}`,
                chainName: evmChainName,
                nativeCurrency: {
                    name: evmChainCoinName,
                    symbol: evmChainCoinName,
                    decimals: 18,
                },
                rpcUrls: [evmChainRpcUrl],
            }

            await walletClient.request({
                id: "1",
                method: "wallet_addEthereumChain",
                params: [{ ...chain, isTestnet } as unknown as AddEthereumChainParameter],//Core wallet supports a custom 
            });

            await walletClient.switchChain({
                id: targetChainId,
            });
        } catch (error) {
            showBoundary(error);
        } finally {
            setIsSwitching(false);
        }
    }

    async function checkRpc() {
        setIsCheckingRpc(true);
        try {
            const publicClient = createPublicClient({
                transport: http(evmChainRpcUrl)
            });

            const chainId = await publicClient.getChainId();
            setTargetChainId(chainId);
        } catch (error) {
            showBoundary(error);
            setTargetChainId(0);
        } finally {
            setIsCheckingRpc(false);
        }
    }

    useEffect(() => {
        setTargetChainId(0);
    }, [evmChainRpcUrl]);


    return (
        <div className="space-y-4">
            <h2 className="text-lg font-semibold">Switch Chain</h2>
            <div className="space-y-4">
                <div className="mb-4">
                    Current Chain ID: {walletChainId}
                </div>
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
                    value={isTestnet.toString()}
                    onChange={(value) => setIsTestnet(value === "true")}
                    options={[
                        { value: "true", label: "Yes" },
                        { value: "false", label: "No" }
                    ]}
                />
                <Input
                    label="Target Chain ID"
                    value={targetChainId.toString()}
                    disabled={true}
                    type="text"
                />
                {targetChainId === 0 && (
                    <Button
                        type="secondary"
                        onClick={checkRpc}
                        loading={isCheckingRpc}
                        disabled={evmChainRpcUrl === ""}
                    >
                        Load Chain ID from RPC
                    </Button>
                )}
                {targetChainId > 0 && (
                    <Button
                        type="primary"
                        onClick={handleSwitchChain}
                        loading={isSwitching}
                    >
                        Switch Chain
                    </Button>
                )}
            </div>
        </div>
    );
};
