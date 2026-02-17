"use client";

import { useState } from "react";
import { useWalletStore } from "@/components/toolbox/stores/walletStore";
import { useToolboxStore, useViemChainStore } from "@/components/toolbox/stores/toolboxStore";
import { Button } from "@/components/toolbox/components/Button";
import { Success } from "@/components/toolbox/components/Success";
import { BaseConsoleToolProps, ConsoleToolMetadata, withConsoleToolMetadata } from '../../../components/WithConsoleToolMetadata';
import { generateConsoleToolGitHubUrl } from "@/components/toolbox/utils/github-url";
import { WalletRequirementsConfigKey } from "@/components/toolbox/hooks/useWalletRequirements";
import ERC20TokenStakingManager from "@/contracts/icm-contracts/compiled/ERC20TokenStakingManager.json";
import versions from '@/scripts/versions.json';
import { getLinkedBytecode } from "@/components/toolbox/utils/contract-deployment";
import { useCriticalError } from "@/components/toolbox/hooks/useCriticalError";
import { LibraryRequirementStatus } from "@/components/toolbox/components/LibraryRequirementStatus";
import { useContractDeployer } from "@/components/toolbox/hooks/contracts";

const ICM_COMMIT = versions["ava-labs/icm-contracts"];

const metadata: ConsoleToolMetadata = {
    title: "Deploy ERC20 Token Staking Manager",
    description: "Deploy an ERC20 Token Staking Manager contract to the EVM network.",
    toolRequirements: [
        WalletRequirementsConfigKey.EVMChainBalance,
    ],
    githubUrl: generateConsoleToolGitHubUrl(import.meta.url)
};

function DeployERC20StakingManager(_props: BaseConsoleToolProps) {
    const { setCriticalError } = useCriticalError();

    const { coreWalletClient, publicClient, walletEVMAddress } = useWalletStore();
    const viemChain = useViemChainStore();
    const {
        erc20StakingManagerAddress,
        setErc20StakingManagerAddress,
        validatorMessagesLibAddress
    } = useToolboxStore();
    const { deploy, isDeploying } = useContractDeployer();

    const sourceUrl = `https://github.com/ava-labs/icm-contracts/blob/${ICM_COMMIT}/contracts/validator-manager/ERC20TokenStakingManager.sol`;

    async function deployStakingManager() {
        setErc20StakingManagerAddress("");
        try {
            if (!viemChain) throw new Error("Viem chain not found");
            if (!coreWalletClient) throw new Error("Wallet not connected");
            if (!walletEVMAddress) throw new Error("Wallet address not available");

            // Check for library first
            if (!validatorMessagesLibAddress) {
                throw new Error('ValidatorMessages library must be deployed first. Please go to Validator Manager Setup and deploy the library.');
            }

            await coreWalletClient.addChain({ chain: viemChain });
            await coreWalletClient.switchChain({ id: viemChain!.id });

            const result = await deploy({
                abi: ERC20TokenStakingManager.abi as any,
                bytecode: getLinkedBytecode(ERC20TokenStakingManager.bytecode, validatorMessagesLibAddress),
                args: [0], // ICMInitializable.Allowed
                name: 'ERC20 Token Staking Manager'
            });

            setErc20StakingManagerAddress(result.contractAddress);
        } catch (error) {
            setCriticalError(error instanceof Error ? error : new Error(String(error)));
        }
    }

    return (
        <div className="space-y-4">
            <p className="text-sm text-gray-500">
                This will deploy the <code>ERC20TokenStakingManager</code> contract to the EVM network <code>{viemChain?.id}</code>.
                The ERC20 Token Staking Manager enables permissionless staking on your L1 using a custom ERC20 token.
            </p>
            <p className="text-sm text-gray-500">
                Contract source: <a href={sourceUrl} target="_blank" rel="noreferrer">ERC20TokenStakingManager.sol</a> @ <code>{ICM_COMMIT.slice(0, 7)}</code>
            </p>
            {walletEVMAddress && (
                <p className="text-sm text-gray-500">
                    Connected wallet: <code>{walletEVMAddress}</code>
                </p>
            )}

            <LibraryRequirementStatus libraryAddress={validatorMessagesLibAddress} />

            <Button
                variant="primary"
                onClick={deployStakingManager}
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
