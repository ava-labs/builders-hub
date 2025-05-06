"use client";

import { useToolboxStore, useViemChainStore } from "../toolboxStore";
import { useWalletStore } from "../../lib/walletStore";
import { useErrorBoundary } from "react-error-boundary";
import { useState } from "react";
import { Button } from "../../components/Button";
import { ResultField } from "../components/ResultField";
import { keccak256 } from 'viem';
import ValidatorManagerABI from "../../../contracts/icm-contracts/compiled/ValidatorManager.json";
import ValidatorMessagesABI from "../../../contracts/icm-contracts/compiled/ValidatorMessages.json";
import { Container } from "../components/Container";
import { Steps, Step } from "fumadocs-ui/components/steps";

function calculateLibraryHash(libraryPath: string) {
    const hash = keccak256(
        new TextEncoder().encode(libraryPath)
    ).slice(2);
    return hash.slice(0, 34);
}

export default function DeployValidatorContracts() {
    const { showBoundary } = useErrorBoundary();
    const { validatorMessagesLibAddress, setValidatorMessagesLibAddress, setValidatorManagerAddress, validatorManagerAddress } = useToolboxStore();
    const { coreWalletClient, publicClient } = useWalletStore();
    const [isDeployingMessages, setIsDeployingMessages] = useState(false);
    const [isDeployingManager, setIsDeployingManager] = useState(false);
    const viemChain = useViemChainStore();

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
        setIsDeployingMessages(true);
        setValidatorMessagesLibAddress("");
        try {
            await coreWalletClient.addChain({ chain: viemChain });
            await coreWalletClient.switchChain({ id: viemChain!.id });
            const hash = await coreWalletClient.deployContract({
                abi: ValidatorMessagesABI.abi,
                bytecode: ValidatorMessagesABI.bytecode.object as `0x${string}`,
                chain: viemChain,
            });

            const receipt = await publicClient.waitForTransactionReceipt({ hash });

            if (!receipt.contractAddress) {
                throw new Error('No contract address in receipt');
            }

            setValidatorMessagesLibAddress(receipt.contractAddress);
        } catch (error) {
            showBoundary(error);
        } finally {
            setIsDeployingMessages(false);
        }
    }

    async function deployValidatorManager() {
        setIsDeployingManager(true);
        setValidatorManagerAddress("");
        try {
            if (!viemChain) throw new Error("Viem chain not found");
            await coreWalletClient.addChain({ chain: viemChain });
            await coreWalletClient.switchChain({ id: viemChain!.id });

            const hash = await coreWalletClient.deployContract({
                abi: ValidatorManagerABI.abi,
                bytecode: getLinkedBytecode(),
                args: [0],
                chain: viemChain,
            });

            const receipt = await publicClient.waitForTransactionReceipt({ hash });

            if (!receipt.contractAddress) {
                throw new Error('No contract address in receipt');
            }

            setValidatorManagerAddress(receipt.contractAddress);
        } catch (error) {
            showBoundary(error);
        } finally {
            setIsDeployingManager(false);
        }
    }

    return (
        <Container
            title="Deploy Validator Contracts"
            description="Deploy the ValidatorMessages library and ValidatorManager contract to the EVM network."
        >
            <div className="space-y-8">
                <Steps>
                    <Step>
                        <div className="p-6 border rounded-lg">
                            <h3 className="text-xl font-bold mb-6">Deploy Validator Messages Library</h3>
                            <div className="mb-6">
                                This will deploy the <code>ValidatorMessages</code> contract to the EVM network <code>{viemChain?.id}</code>. <code>ValidatorMessages</code> is a library required by the <code>ValidatorManager</code> family of contracts.
                            </div>
                            <div className="mb-8">
                                <Button
                                    variant="primary"
                                    onClick={deployValidatorMessages}
                                    loading={isDeployingMessages}
                                    disabled={isDeployingMessages || !!validatorMessagesLibAddress}
                                    className="mt-4"
                                >
                                    Deploy Library
                                </Button>
                            </div>
                            
                            {validatorMessagesLibAddress && (
                                <div className="mt-10 pt-6 border-t">
                                    <ResultField
                                        label="ValidatorMessages Library Address"
                                        value={validatorMessagesLibAddress}
                                        showCheck={!!validatorMessagesLibAddress}
                                    />
                                </div>
                            )}
                        </div>
                    </Step>

                    <Step>
                        <div className="p-6 border rounded-lg mt-8">
                            <h3 className="text-xl font-bold mb-6">Deploy Validator Manager Contract</h3>
                            <div className="mb-6">
                                This will deploy the <code>ValidatorManager</code> contract to the EVM network <code>{viemChain?.id}</code>.
                            </div>
                            <div className="mb-6">
                                The contract requires the <code>ValidatorMessages</code> library at address: <code>{validatorMessagesLibAddress || "Not deployed"}</code>
                            </div>
                            <div className="mb-8">
                                <Button
                                    variant="primary"
                                    onClick={deployValidatorManager}
                                    loading={isDeployingManager}
                                    disabled={isDeployingManager || !validatorMessagesLibAddress || !!validatorManagerAddress}
                                    className="mt-4"
                                >
                                    Deploy Manager Contract
                                </Button>
                            </div>
                            
                            {validatorManagerAddress && (
                                <div className="mt-10 pt-6 border-t">
                                    <ResultField
                                        label="ValidatorManager Address"
                                        value={validatorManagerAddress}
                                        showCheck={!!validatorManagerAddress}
                                    />
                                </div>
                            )}
                        </div>
                    </Step>
                </Steps>
            </div>
        </Container>
    );
}
