"use client";

import WrappedNativeToken from "../../../contracts/icm-contracts/compiled/WrappedNativeToken.json"
import { useToolboxStore, useViemChainStore } from "../../stores/toolboxStore";
import { useWalletStore } from "../../stores/walletStore";
import { useErrorBoundary } from "react-error-boundary";
import { useState } from "react";
import { Button } from "../../components/Button";
import { Success } from "../../components/Success";
import { http, createPublicClient } from "viem";
import { Container } from "../../components/Container";
import { useSelectedL1 } from "@/stores/l1ListStore";
import { WalletRequirementsConfigKey } from "@/hooks/useWalletRequirements";
import { CheckWalletRequirements } from "@/components/CheckWalletRequirements";

export default function DeployWrappedNative() {
    const { showBoundary } = useErrorBoundary();

    const { wrappedNativeTokenAddress: wrappedNativeTokenAddressStore, setWrappedNativeTokenAddress } = useToolboxStore();
    const selectedL1 = useSelectedL1()();
    const wrappedNativeTokenAddress = wrappedNativeTokenAddressStore || selectedL1?.wrappedTokenAddress;

    const { coreWalletClient } = useWalletStore();
    const viemChain = useViemChainStore();
    const [isDeploying, setIsDeploying] = useState(false);
    const { walletChainId } = useWalletStore();

    async function handleDeploy() {
        setIsDeploying(true);
        try {
            if (!viemChain) throw new Error("No chain selected");

            const publicClient = createPublicClient({
                transport: http(viemChain.rpcUrls.default.http[0] || "")
            });

            const hash = await coreWalletClient.deployContract({
                abi: WrappedNativeToken.abi,
                bytecode: WrappedNativeToken.bytecode.object as `0x${string}`,
                args: ["WNT"],
                chain: viemChain
            });

            const receipt = await publicClient.waitForTransactionReceipt({ hash });

            if (!receipt.contractAddress) {
                throw new Error('No contract address in receipt');
            }

            setWrappedNativeTokenAddress(receipt.contractAddress);
        } catch (error) {
            showBoundary(error);
        } finally {
            setIsDeploying(false);
        }
    }

    return (
        <CheckWalletRequirements configKey={[
            WalletRequirementsConfigKey.EVMChainBalance
        ]}>
            <Container title="Deploy Wrapped Native Token" description="Deploy a Wrapped Native token contract for testing. If a wrapped native token like WAVAX is already available on this chain, you can skip this step and reference that token directly in your configuration.">
                <div className="space-y-4">
                    <div className="">
                        This will deploy an Wrapped Native token contract to your connected network (Chain ID: <code>{walletChainId}</code>).
                        You can use this token for testing token transfers and other Native token interactions.
                        Wrapped Native Assets are required for interacting with most DeFi protocols, as many of them expect ERC-20 compliant tokens.
                        By wrapping your native token (e.g., AVAX), you ensure compatibility with these systems.
                    </div>

                    <Button
                        variant={wrappedNativeTokenAddress ? "secondary" : "primary"}
                        onClick={handleDeploy}
                        loading={isDeploying}
                        disabled={isDeploying}
                    >
                        {wrappedNativeTokenAddress ? "Re-Deploy Wrapped Native Token" : "Deploy Wrapped Native Token"}
                    </Button>

                    <Success
                        label="Wrapped Native Token Address"
                        value={wrappedNativeTokenAddress || ""}
                    />
                </div>
            </Container>
        </CheckWalletRequirements>
    );
}
