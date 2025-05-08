"use client";

import { useSelectedL1, useToolboxStore, useViemChainStore } from "../toolboxStore";
import { useWalletStore } from "../../lib/walletStore";
import { useErrorBoundary } from "react-error-boundary";
import { useState } from "react";
import { Button } from "../../components/Button";
import { Success } from "../../components/Success";
import TeleporterRegistryBytecode from '../../../contracts/icm-contracts-releases/v1.0.0/TeleporterRegistry_Bytecode_v1.0.0.txt.json';
import TeleporterMessengerAddress from '../../../contracts/icm-contracts-releases/v1.0.0/TeleporterMessenger_Contract_Address_v1.0.0.txt.json';
import TeleporterRegistryManualyCompiled from '../../../contracts/icm-contracts/compiled/TeleporterRegistry.json';
import { Container } from "../components/Container";


export default function TeleporterRegistry() {
    const { showBoundary } = useErrorBoundary();
    const { setTeleporterRegistryAddress, teleporterRegistryAddress } = useToolboxStore();
    const { coreWalletClient, publicClient } = useWalletStore();
    const [isDeploying, setIsDeploying] = useState(false);
    const viemChain = useViemChainStore();
    const selectedL1 = useSelectedL1()();

    async function handleDeploy() {
        setIsDeploying(true);
        setTeleporterRegistryAddress("");
        try {
            // Get messenger address
            const messengerAddress = TeleporterMessengerAddress.content.trim() as `0x${string}`;

            const hash = await coreWalletClient.deployContract({
                bytecode: TeleporterRegistryBytecode.content.trim() as `0x${string}`,
                abi: TeleporterRegistryManualyCompiled.abi,
                args: [
                    [{ version: 1n, protocolAddress: messengerAddress }]
                ],
                chain: viemChain,
            });

            const receipt = await publicClient.waitForTransactionReceipt({ hash });

            if (!receipt.contractAddress) {
                throw new Error('No contract address in receipt');
            }

            setTeleporterRegistryAddress(receipt.contractAddress);
        } catch (error) {
            showBoundary(error);
        } finally {
            setIsDeploying(false);
        }
    }

    return (
        <Container
            title="Deploy Teleporter Registry"
            description="Deploy the Teleporter Registry contract to your L1."
        >
            <div className="space-y-4">
                <div className="mb-4">
                    This will deploy the <code>TeleporterRegistry</code> contract to the EVM network #<code>{selectedL1?.evmChainId}</code>.
                    The contract will be initialized with the Teleporter Messenger address <code>{TeleporterMessengerAddress.content.trim()}</code>.
                </div>
                <Button
                    variant="primary"
                    onClick={handleDeploy}
                    loading={isDeploying}
                    disabled={isDeploying}
                >
                    {teleporterRegistryAddress ? "Redeploy" : "Deploy"} TeleporterRegistry
                </Button>
            </div>
            <Success
                label="TeleporterRegistry Address"
                value={teleporterRegistryAddress}
            />
        </Container>
    );
}
