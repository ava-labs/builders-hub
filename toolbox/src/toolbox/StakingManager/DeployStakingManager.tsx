"use client";

import { useToolboxStore, useViemChainStore } from "../../stores/toolboxStore";
import { useWalletStore } from "../../stores/walletStore";
import { useErrorBoundary } from "react-error-boundary";
import { useState } from "react";
import { Button } from "../../components/Button";
import { ResultField } from "../../components/ResultField";
import NativeTokenStakingManagerABI from "../../../contracts/icm-contracts/compiled/NativeTokenStakingManager.json";
import { RequireChainL1 } from "../../components/RequireChain";
import { Container } from "../../components/Container";
import { keccak256 } from "viem";
function calculateLibraryHash(libraryPath: string) {
    const hash = keccak256(
        new TextEncoder().encode(libraryPath)
    ).slice(2);
    return hash.slice(0, 34);
}
export default function DeployStakingManager() {
    const { showBoundary } = useErrorBoundary();
    const { stakingManagerAddress, setStakingManagerAddress, validatorMessagesLibAddress } = useToolboxStore();
    const { coreWalletClient, publicClient } = useWalletStore();
    const [isDeploying, setIsDeploying] = useState(false);
    const viemChain = useViemChainStore();


    const getLinkedBytecode = () => {
        if (!validatorMessagesLibAddress) {
            throw new Error('ValidatorMessages library must be deployed first');
        }

        const libraryPath = `${Object.keys(NativeTokenStakingManagerABI.bytecode.linkReferences)[0]}:${Object.keys(Object.values(NativeTokenStakingManagerABI.bytecode.linkReferences)[0])[0]}`;
        const libraryHash = calculateLibraryHash(libraryPath);
        const libraryPlaceholder = `__$${libraryHash}$__`;

        const linkedBytecode = NativeTokenStakingManagerABI.bytecode.object
            .split(libraryPlaceholder)
            .join(validatorMessagesLibAddress.slice(2).padStart(40, '0'));

        if (linkedBytecode.includes("$__")) {
            throw new Error("Failed to replace library placeholder with actual address");
        }

        return linkedBytecode as `0x${string}`;
    };


    async function handleDeploy() {
        setIsDeploying(true);
        setStakingManagerAddress("");
        try {
            const hash = await coreWalletClient.deployContract({
                abi: NativeTokenStakingManagerABI.abi,
                bytecode: getLinkedBytecode(),
                args: [0],
                chain: viemChain,
            });

            const receipt = await publicClient.waitForTransactionReceipt({ hash });

            if (!receipt.contractAddress) {
                throw new Error('No contract address in receipt');
            }

            setStakingManagerAddress(receipt.contractAddress);
        } catch (error) {
            showBoundary(error);
        } finally {
            setIsDeploying(false);
        }
    }


    return (
        <RequireChainL1>
            <Container
                title="Deploy Native Token Staking Manager"
                description="This will deploy the `NativeTokenStakingManager` contract to the currently connected EVM network."
            >
                <div className="space-y-4">
                    <Button
                        variant="primary"
                        onClick={handleDeploy}
                        loading={isDeploying}
                        disabled={isDeploying}
                    >
                        Deploy Contract
                    </Button>
                </div>
                {stakingManagerAddress && (
                    <ResultField
                        label="Native TokenStaking Manager Address"
                        value={stakingManagerAddress}
                        showCheck={!!stakingManagerAddress}
                    />
                )}
            </Container>
        </RequireChainL1>
    );
};

