"use client";

import { useState } from "react";
import { useWalletStore } from "@/components/toolbox/stores/walletStore";
import { useToolboxStore, useViemChainStore } from "@/components/toolbox/stores/toolboxStore";
import { Button } from "@/components/toolbox/components/Button";
import { Container } from "@/components/toolbox/components/Container";
import { Success } from "@/components/toolbox/components/Success";
import { CheckWalletRequirements } from "@/components/toolbox/components/CheckWalletRequirements";
import { WalletRequirementsConfigKey } from "@/components/toolbox/hooks/useWalletRequirements";
import ERC20TokenStakingManager from "@/contracts/icm-contracts/compiled/ERC20TokenStakingManager.json";
import versions from '@/scripts/versions.json';
import { keccak256 } from 'viem';

const ICM_COMMIT = versions["ava-labs/icm-contracts"];
const ERC20_TOKEN_STAKING_MANAGER_SOURCE_URL = `https://github.com/ava-labs/icm-contracts/blob/main/contracts/validator-manager/ERC20TokenStakingManager.sol`;

// this should be pulled into a shared utils file with other contract deployments
function calculateLibraryHash(libraryPath: string) {
    const hash = keccak256(
        new TextEncoder().encode(libraryPath)
    ).slice(2);
    return hash.slice(0, 34);
}

export default function DeployERC20StakingManager() {
    const [criticalError, setCriticalError] = useState<Error | null>(null);
    const [isDeploying, setIsDeploying] = useState(false);
    
    const { coreWalletClient, publicClient, walletEVMAddress } = useWalletStore();
    const viemChain = useViemChainStore();
    const { erc20StakingManagerAddress, setErc20StakingManagerAddress, validatorMessagesLibAddress } = useToolboxStore();

    // Throw critical errors during render
    if (criticalError) {
        throw criticalError;
    }

    const getLinkedBytecode = () => {
        if (!validatorMessagesLibAddress) {
            throw new Error('ValidatorMessages library must be deployed first. Please deploy it in the Validator Manager setup.');
        }

        const libraryPath = `${Object.keys(ERC20TokenStakingManager.bytecode.linkReferences)[0]}:${Object.keys(Object.values(ERC20TokenStakingManager.bytecode.linkReferences)[0])[0]}`;
        const libraryHash = calculateLibraryHash(libraryPath);
        const libraryPlaceholder = `__$${libraryHash}$__`;

        const linkedBytecode = ERC20TokenStakingManager.bytecode.object
            .split(libraryPlaceholder)
            .join(validatorMessagesLibAddress.slice(2).padStart(40, '0'));

        if (linkedBytecode.includes("$__")) {
            throw new Error("Failed to replace library placeholder with actual address");
        }

        return linkedBytecode as `0x${string}`;
    };

    async function deployERC20StakingManager() {
        setIsDeploying(true);
        setErc20StakingManagerAddress("");
        try {
            if (!viemChain) throw new Error("Viem chain not found");
            
            // Check for library first
            if (!validatorMessagesLibAddress) {
                throw new Error('ValidatorMessages library must be deployed first. Please go to Validator Manager Setup and deploy the library.');
            }
            
            // Follow exact pattern from ValidatorManager deployment
            await coreWalletClient.addChain({ chain: viemChain });
            await coreWalletClient.switchChain({ id: viemChain!.id });

            const hash = await coreWalletClient.deployContract({
                abi: ERC20TokenStakingManager.abi,
                bytecode: getLinkedBytecode(), // Use linked bytecode with library
                args: [0], // ICMInitializable.Allowed
                chain: viemChain,
            });

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
        <CheckWalletRequirements configKey={[
            WalletRequirementsConfigKey.EVMChainBalance,
        ]}>
            <Container
                title="Deploy ERC20 Token Staking Manager"
                description="Deploy the ERC20 Token Staking Manager contract to the EVM network."
            >
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
            </Container>
        </CheckWalletRequirements>
    );
}
