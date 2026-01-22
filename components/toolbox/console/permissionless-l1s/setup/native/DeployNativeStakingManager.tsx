"use client";

import { useState } from "react";
import { useWalletStore } from "@/components/toolbox/stores/walletStore";
import { useToolboxStore, useViemChainStore } from "@/components/toolbox/stores/toolboxStore";
import { Button } from "@/components/toolbox/components/Button";
import { Success } from "@/components/toolbox/components/Success";
import { ConsoleToolMetadata, withConsoleToolMetadata } from '../../../../components/WithConsoleToolMetadata';
import { generateConsoleToolGitHubUrl } from "@/components/toolbox/utils/github-url";
import { WalletRequirementsConfigKey } from "@/components/toolbox/hooks/useWalletRequirements";
import NativeTokenStakingManager from "@/contracts/icm-contracts/compiled/NativeTokenStakingManager.json";
import versions from '@/scripts/versions.json';
import useConsoleNotifications from '@/hooks/useConsoleNotifications';
import { getLinkedBytecode } from "@/components/toolbox/utils/contract-deployment";
import { useCriticalError } from "@/components/toolbox/hooks/useCriticalError";
import { LibraryRequirementStatus } from "@/components/toolbox/components/LibraryRequirementStatus";

const ICM_COMMIT = versions["ava-labs/icm-contracts"];
const NATIVE_TOKEN_STAKING_MANAGER_SOURCE_URL = `https://github.com/ava-labs/icm-contracts/blob/${ICM_COMMIT}/contracts/validator-manager/NativeTokenStakingManager.sol`;

const metadata: ConsoleToolMetadata = {
    title: "Deploy Native Token Staking Manager",
    description: "Deploy the Native Token Staking Manager contract to the EVM network.",
    toolRequirements: [
        WalletRequirementsConfigKey.EVMChainBalance,
    ],
    githubUrl: generateConsoleToolGitHubUrl(import.meta.url)
};

function DeployNativeStakingManager() {
    const [isDeploying, setIsDeploying] = useState(false);
    const { setCriticalError } = useCriticalError();

    const { coreWalletClient, publicClient, walletEVMAddress } = useWalletStore();
    const viemChain = useViemChainStore();
    const { nativeStakingManagerAddress, setNativeStakingManagerAddress, validatorMessagesLibAddress } = useToolboxStore();
    const { notify } = useConsoleNotifications();

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
                bytecode: getLinkedBytecode(NativeTokenStakingManager.bytecode, validatorMessagesLibAddress), // Use linked bytecode with library
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

            <LibraryRequirementStatus libraryAddress={validatorMessagesLibAddress} />

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