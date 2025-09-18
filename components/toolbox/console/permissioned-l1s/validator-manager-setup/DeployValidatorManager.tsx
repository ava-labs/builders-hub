"use client";

import { useToolboxStore, useViemChainStore } from "@/components/toolbox/stores/toolboxStore";
import { useWalletStore } from "@/components/toolbox/stores/walletStore";
import { useState } from "react";
import { Button } from "@/components/toolbox/components/Button";
import { keccak256 } from 'viem';
import ValidatorManagerABI from "@/contracts/icm-contracts/compiled/ValidatorManager.json";
import ValidatorMessagesABI from "@/contracts/icm-contracts/compiled/ValidatorMessages.json";
import { Container } from "@/components/toolbox/components/Container";
import { Steps, Step } from "fumadocs-ui/components/steps";
import { Success } from "@/components/toolbox/components/Success";
import { CheckWalletRequirements } from "@/components/toolbox/components/CheckWalletRequirements";
import { WalletRequirementsConfigKey } from "@/components/toolbox/hooks/useWalletRequirements";
import versions from '@/scripts/versions.json';

const ICM_COMMIT = versions["ava-labs/icm-contracts"];
const VALIDATOR_MANAGER_SOURCE_URL = `https://github.com/ava-labs/icm-contracts/blob/${ICM_COMMIT}/contracts/validator-manager/ValidatorManager.sol`;
const VALIDATOR_MESSAGES_SOURCE_URL = `https://github.com/ava-labs/icm-contracts/blob/${ICM_COMMIT}/contracts/validator-manager/ValidatorMessages.sol`;

function calculateLibraryHash(libraryPath: string) {
    const hash = keccak256(
        new TextEncoder().encode(libraryPath)
    ).slice(2);
    return hash.slice(0, 34);
}

export default function DeployValidatorContracts() {
    const [criticalError, setCriticalError] = useState<Error | null>(null);
    const { validatorMessagesLibAddress, setValidatorMessagesLibAddress, setValidatorManagerAddress, validatorManagerAddress } = useToolboxStore();
    const { coreWalletClient, publicClient, walletEVMAddress } = useWalletStore();
    const [isDeployingMessages, setIsDeployingMessages] = useState(false);
    const [isDeployingManager, setIsDeployingManager] = useState(false);
    const viemChain = useViemChainStore();

    // Throw critical errors during render
    if (criticalError) {
        throw criticalError;
    }

    const getLinkedBytecode = () => {
        if (!validatorMessagesLibAddress) {
            throw new Error('ValidatorMessages library must be deployed first');
        }

        const libraryPath = `${Object.keys(ValidatorManagerABI.bytecode.linkReferences)[0]}:${Object.keys(Object.values(ValidatorManagerABI.bytecode.linkReferences)[0])[0]}`;
        const libraryHash = calculateLibraryHash(libraryPath);
        const libraryPlaceholder = `__$${libraryHash}$__`;

        const linkedBytecode = ValidatorManagerABI.bytecode.object
            .split(libraryPlaceholder)
            .join(validatorMessagesLibAddress.slice(2).padStart(40, '0'));

        if (linkedBytecode.includes("$__")) {
            throw new Error("Failed to replace library placeholder with actual address");
        }

        return linkedBytecode as `0x${string}`;
    };

    async function deployValidatorMessages() {
        if (!coreWalletClient) {
            setCriticalError(new Error('Core wallet not found'));
            return;
        }

        setIsDeployingMessages(true);
        setValidatorMessagesLibAddress("");
        try {
            if (!viemChain) throw new Error("Viem chain not found");
            await coreWalletClient.addChain({ chain: viemChain });
            await coreWalletClient.switchChain({ id: viemChain.id });
            const hash = await coreWalletClient.deployContract({
                abi: ValidatorMessagesABI.abi as any,
                bytecode: ValidatorMessagesABI.bytecode.object as `0x${string}`,
                chain: viemChain,
                account: walletEVMAddress as `0x${string}`
            });

            const receipt = await publicClient.waitForTransactionReceipt({ hash });

            if (!receipt.contractAddress) {
                throw new Error('No contract address in receipt');
            }

            setValidatorMessagesLibAddress(receipt.contractAddress);
        } catch (error) {
            setCriticalError(error instanceof Error ? error : new Error(String(error)));
        } finally {
            setIsDeployingMessages(false);
        }
    }

    async function deployValidatorManager() {
        if (!coreWalletClient) {
            setCriticalError(new Error('Core wallet not found'));
            return;
        }

        setIsDeployingManager(true);
        setValidatorManagerAddress("");
        try {
            if (!viemChain) throw new Error("Viem chain not found");
            await coreWalletClient.addChain({ chain: viemChain });
            await coreWalletClient.switchChain({ id: viemChain!.id });

            const hash = await coreWalletClient.deployContract({
                abi: ValidatorManagerABI.abi as any,
                bytecode: getLinkedBytecode(),
                args: [0],
                chain: viemChain,
                account: walletEVMAddress as `0x${string}`
            });

            const receipt = await publicClient.waitForTransactionReceipt({ hash });

            if (!receipt.contractAddress) {
                throw new Error('No contract address in receipt');
            }

            setValidatorManagerAddress(receipt.contractAddress);
        } catch (error) {
            setCriticalError(error instanceof Error ? error : new Error(String(error)));
        } finally {
            setIsDeployingManager(false);
        }
    }

    return (
        <CheckWalletRequirements configKey={[
            WalletRequirementsConfigKey.EVMChainBalance,
        ]}>
            <Container
                title="Deploy Validator Contracts"
                description="Deploy the ValidatorMessages library and ValidatorManager contract to the EVM network."
            >
                <div className="space-y-4">
                    <Steps>
                        <Step>
                            <h2 className="text-lg font-semibold">Deploy Validator Messages Library</h2>
                            <p className="text-sm text-gray-500">
                                This will deploy the <code>ValidatorMessages</code> contract to the EVM network <code>{viemChain?.id}</code>. <code>ValidatorMessages</code> is a library required by the <code>ValidatorManager</code> family of contracts.
                            </p>
                            <p className="text-sm text-gray-500">
                                Library source: <a href={VALIDATOR_MESSAGES_SOURCE_URL} target="_blank" rel="noreferrer">ValidatorMessages.sol</a> @ <code>{ICM_COMMIT.slice(0, 7)}</code>
                            </p>

                            <Button
                                variant="primary"
                                onClick={deployValidatorMessages}
                                loading={isDeployingMessages}
                                disabled={isDeployingMessages || !!validatorMessagesLibAddress}
                            >
                                Deploy Library
                            </Button>

                            <p>Deployment Status: <code>{validatorMessagesLibAddress || "Not deployed"}</code></p>

                            {validatorMessagesLibAddress && (
                                <Success
                                    label="ValidatorMessages Library Deployed"
                                    value={validatorMessagesLibAddress}
                                />
                            )}
                        </Step>

                        <Step>
                            <h2 className="text-lg font-semibold">Deploy Validator Manager Contract</h2>
                            <p className="text-sm text-gray-500">
                                This will deploy the <code>ValidatorManager</code> contract to the EVM network <code>{viemChain?.id}</code>. It is the interface for managing the validators for it's L1. The contract emits the ICM messages to change the L1s validator set on the P-Chain.
                            </p>
                            <p className="text-sm text-gray-500">
                                Contract source: <a href={VALIDATOR_MANAGER_SOURCE_URL} target="_blank" rel="noreferrer">ValidatorManager.sol</a> @ <code>{ICM_COMMIT.slice(0, 7)}</code>
                            </p>

                            <Button
                                variant="primary"
                                onClick={deployValidatorManager}
                                loading={isDeployingManager}
                                disabled={isDeployingManager || !validatorMessagesLibAddress || !!validatorManagerAddress}
                                className="mt-1"
                            >
                                Deploy Manager Contract
                            </Button>

                            {validatorManagerAddress && (
                                <Success
                                    label="ValidatorManager Address"
                                    value={validatorManagerAddress}
                                />
                            )}

                        </Step>
                    </Steps>
                </div>
            </Container>
        </CheckWalletRequirements>
    );
}
