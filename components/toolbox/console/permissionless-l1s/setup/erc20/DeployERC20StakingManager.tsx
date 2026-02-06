"use client";

import { useState } from "react";
import { useWalletStore } from "@/components/toolbox/stores/walletStore";
import { useToolboxStore, useViemChainStore } from "@/components/toolbox/stores/toolboxStore";
import { Button } from "@/components/toolbox/components/Button";
import { Success } from "@/components/toolbox/components/Success";
import { ConsoleToolMetadata, withConsoleToolMetadata } from '../../../../components/WithConsoleToolMetadata';
import { generateConsoleToolGitHubUrl } from "@/components/toolbox/utils/github-url";
import { WalletRequirementsConfigKey } from "@/components/toolbox/hooks/useWalletRequirements";
import ERC20TokenStakingManager from "@/contracts/icm-contracts/compiled/ERC20TokenStakingManager.json";
import versions from '@/scripts/versions.json';
import useConsoleNotifications from '@/hooks/useConsoleNotifications';
import { getLinkedBytecode } from "@/components/toolbox/utils/contract-deployment";
import { useCriticalError } from "@/components/toolbox/hooks/useCriticalError";
import { LibraryRequirementStatus } from "@/components/toolbox/components/LibraryRequirementStatus";

const ICM_COMMIT = versions["ava-labs/icm-contracts"];
const ERC20_TOKEN_STAKING_MANAGER_SOURCE_URL = `https://github.com/ava-labs/icm-contracts/blob/main/contracts/validator-manager/ERC20TokenStakingManager.sol`;

const metadata: ConsoleToolMetadata = {
    title: "Deploy ERC20 Token Staking Manager",
    description: "Deploy the ERC20 Token Staking Manager contract to the EVM network.",
    toolRequirements: [
        WalletRequirementsConfigKey.EVMChainBalance,
    ],
    githubUrl: generateConsoleToolGitHubUrl(import.meta.url)
};

function DeployERC20StakingManager() {
    const [isDeploying, setIsDeploying] = useState(false);
    const { setCriticalError } = useCriticalError();

    const { coreWalletClient, publicClient, walletEVMAddress } = useWalletStore();
    const viemChain = useViemChainStore();
    const { erc20StakingManagerAddress, setErc20StakingManagerAddress, validatorMessagesLibAddress } = useToolboxStore();
    const { notify } = useConsoleNotifications();

    async function deployERC20StakingManager() {
        setIsDeploying(true);
        setErc20StakingManagerAddress("");
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
                abi: ERC20TokenStakingManager.abi as any,
                bytecode: getLinkedBytecode(ERC20TokenStakingManager.bytecode, validatorMessagesLibAddress), // Use linked bytecode with library
                args: [0], // ICMInitializable.Allowed
                chain: viemChain,
                account: walletEVMAddress as `0x${string}`,
            });

            notify({
                type: 'deploy',
                name: 'ERC20 Token Staking Manager'
            }, deployPromise, viemChain ?? undefined);

            const hash = await deployPromise;
            const receipt = await publicClient.waitForTransactionReceipt({ hash });

            if (!receipt.contractAddress) {
                throw new Error('No contract address in receipt');
            }

            setErc20StakingManagerAddress(receipt.contractAddress);
        } catch (error) {
            setCriticalError(error instanceof Error ? error : new Error(String(error)));
        } finally {
            setIsDeploying(false);
        }
    }

    return (

        <div className="space-y-4">
            <p className="text-sm text-gray-500">
                This will deploy the <code>ERC20TokenStakingManager</code> contract to the EVM network <code>{viemChain?.id}</code>.
                The ERC20 Token Staking Manager enables permissionless staking on your L1 using a custom ERC20 token.
            </p>
            <p className="text-sm text-gray-500">
                Contract source: <a href={ERC20_TOKEN_STAKING_MANAGER_SOURCE_URL} target="_blank" rel="noreferrer">ERC20TokenStakingManager.sol</a> @ <code>{ICM_COMMIT.slice(0, 7)}</code>
            </p>
            {walletEVMAddress && (
                <p className="text-sm text-gray-500">
                    Connected wallet: <code>{walletEVMAddress}</code>
                </p>
            )}

            <LibraryRequirementStatus libraryAddress={validatorMessagesLibAddress} />

            <Button
                variant="primary"
                onClick={deployERC20StakingManager}
                loading={isDeploying}
                disabled={isDeploying || !!erc20StakingManagerAddress || !validatorMessagesLibAddress}
            >
                {!validatorMessagesLibAddress
                    ? "Deploy ValidatorMessages Library First"
                    : "Deploy ERC20 Token Staking Manager"}
            </Button>

            <p>Deployment Status: <code>{erc20StakingManagerAddress || "Not deployed"}</code></p>

            {erc20StakingManagerAddress && (
                <Success
                    label="ERC20 Token Staking Manager Address"
                    value={erc20StakingManagerAddress}
                />
            )}
        </div>
    );
}

export default withConsoleToolMetadata(DeployERC20StakingManager, metadata);