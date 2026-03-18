"use client";

import { useState } from "react";
import { useWalletStore } from "@/components/toolbox/stores/walletStore";
import { useToolboxStore, useViemChainStore } from "@/components/toolbox/stores/toolboxStore";
import { Button } from "@/components/toolbox/components/Button";
import { Success } from "@/components/toolbox/components/Success";
import { ConsoleToolMetadata, withConsoleToolMetadata } from '../../../../components/WithConsoleToolMetadata';
import { generateConsoleToolGitHubUrl } from "@/components/toolbox/utils/github-url"; import { WalletRequirementsConfigKey } from "@/components/toolbox/hooks/useWalletRequirements";
import NativeTokenStakingManager from "@/contracts/icm-contracts/compiled/NativeTokenStakingManager.json";
import versions from '@/scripts/versions.json';
import { keccak256 } from 'viem';
import useConsoleNotifications from '@/hooks/useConsoleNotifications';

const ICM_COMMIT = versions["ava-labs/icm-contracts"];
const NATIVE_TOKEN_STAKING_MANAGER_SOURCE_URL = `https://github.com/ava-labs/icm-contracts/blob/${ICM_COMMIT}/contracts/validator-manager/NativeTokenStakingManager.sol`;

// this should be pulled into a shared utils file with other contract deployments
function calculateLibraryHash(libraryPath: string) {
    const hash = keccak256(
        new TextEncoder().encode(libraryPath)
    ).slice(2);
    return hash.slice(0, 34);
}

const metadata: ConsoleToolMetadata = {
    title: "Deploy Native Token Staking Manager",
    description: "Deploy the Native Token Staking Manager contract to the EVM network.",
    toolRequirements: [
        WalletRequirementsConfigKey.EVMChainBalance,
    ],
    githubUrl: generateConsoleToolGitHubUrl(import.meta.url)
};

function DeployNativeStakingManager() {
    const [criticalError, setCriticalError] = useState<Error | null>(null);
    const [isDeploying, setIsDeploying] = useState(false);

    const { coreWalletClient, publicClient, walletEVMAddress } = useWalletStore();
    const viemChain = useViemChainStore();
    const { nativeStakingManagerAddress, setNativeStakingManagerAddress, validatorMessagesLibAddress } = useToolboxStore();
    const { notify } = useConsoleNotifications();

    // Throw critical errors during render
    if (criticalError) {
        throw criticalError;
    }

    const getLinkedBytecode = () => {
        if (!validatorMessagesLibAddress) {
            throw new Error('ValidatorMessages library must be deployed first. Please deploy it in the Validator Manager setup.');
        }

        const libraryPath = `${Object.keys(NativeTokenStakingManager.bytecode.linkReferences)[0]}:${Object.keys(Object.values(NativeTokenStakingManager.bytecode.linkReferences)[0])[0]}`;
        const libraryHash = calculateLibraryHash(libraryPath);
        const libraryPlaceholder = `__$${libraryHash}$__`;

        const linkedBytecode = NativeTokenStakingManager.bytecode.object
            .split(libraryPlaceholder)
            .join(validatorMessagesLibAddress.slice(2).padStart(40, '0'));

        if (linkedBytecode.includes("$__")) {
            throw new Error("Failed to replace library placeholder with actual address");
        }

        return linkedBytecode as `0x${string}`;
    };

    async function deployNativeTokenStakingManager() {
        setIsDeploying(true);
        setNativeStakingManagerAddress("");
        try {
            if (!viemChain) throw new Error("Viem chain not found");
            if (!coreWalletClient) throw new Error("Wallet not connected");
            if (!walletEVMAddress) throw new Error("Wallet address not available");

            // Check for library first
            if (!validatorMessagesLibAddress) {
                throw new Error('ValidatorMessages library must be deployed first. Please go to Validator Manager Setup and deploy the library.');
            }

            // Follow exact pattern from ValidatorManager deployment
            await coreWalletClient.addChain({ chain: viemChain });
            await coreWalletClient.switchChain({ id: viemChain!.id });

            const deployPromise = coreWalletClient.deployContract({
                abi: NativeTokenStakingManager.abi as any,
                bytecode: getLinkedBytecode(), // Use linked bytecode with library
                args: [0], // ICMInitializable.Allowed
                chain: viemChain,
                account: walletEVMAddress as `0x${string}`,
            });

            notify({
                type: 'deploy',
                name: 'Native Token Staking Manager'
            }, deployPromise, viemChain ?? undefined);

            const hash = await deployPromise;
            const receipt = await publicClient.waitForTransactionReceipt({ hash });

            if (!receipt.contractAddress) {
                throw new Error('No contract address in receipt');
            }

            setNativeStakingManagerAddress(receipt.contractAddress);
        } catch (error) {
            setCriticalError(error instanceof Error ? error : new Error(String(error)));
        } finally {
            setIsDeploying(false);
        }
    }

    return (
        <div className="space-y-4">
            <p className="text-sm text-gray-500">
                This will deploy the <code>NativeTokenStakingManager</code> contract to the EVM network <code>{viemChain?.id}</code>.
                The Native Token Staking Manager enables permissionless staking on your L1 using the native token.
            </p>
            <p className="text-sm text-gray-500">
                Contract source: <a href={NATIVE_TOKEN_STAKING_MANAGER_SOURCE_URL} target="_blank" rel="noreferrer">NativeTokenStakingManager.sol</a> @ <code>{ICM_COMMIT.slice(0, 7)}</code>
            </p>
            {walletEVMAddress && (
                <p className="text-sm text-gray-500">
                    Connected wallet: <code>{walletEVMAddress}</code>
                </p>
            )}

            {/* Library requirement notice */}
            {!validatorMessagesLibAddress ? (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-md">
                    <p className="text-sm text-red-800 dark:text-red-200">
                        <strong>Required:</strong> ValidatorMessages library must be deployed first.
                        Please go to the <strong>Validator Manager Setup</strong> section and deploy the ValidatorMessages library.
                    </p>
                </div>
            ) : (
                <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-md">
                    <p className="text-sm text-green-800 dark:text-green-200">
                        <strong>Ready:</strong> ValidatorMessages library found at: <code>{validatorMessagesLibAddress}</code>
                    </p>
                </div>
            )}

            <Button
                variant="primary"
                onClick={deployNativeTokenStakingManager}
                loading={isDeploying}
                disabled={isDeploying || !!nativeStakingManagerAddress || !validatorMessagesLibAddress}
            >
                {!validatorMessagesLibAddress
                    ? "Deploy ValidatorMessages Library First"
                    : "Deploy Native Token Staking Manager"}
            </Button>

            <p>Deployment Status: <code>{nativeStakingManagerAddress || "Not deployed"}</code></p>

            {nativeStakingManagerAddress && (
                <Success
                    label="Native Token Staking Manager Address"
                    value={nativeStakingManagerAddress}
                />
            )}
        </div>
    );
}

export default withConsoleToolMetadata(DeployNativeStakingManager, metadata);