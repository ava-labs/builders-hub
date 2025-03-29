"use client";

import { useToolboxStore, useViemChainStore, useWalletStore } from "../../utils/store";
import { useErrorBoundary } from "react-error-boundary";
import { useState } from "react";
import { Button } from "../../ui";
import { Success } from "../../ui/Success";
import TeleporterRegistryBytecode from '../../../../contracts/icm-contracts-releases/v1.0.0/TeleporterRegistry_Bytecode_v1.0.0.txt.json';
import TeleporterMessengerAddress from '../../../../contracts/icm-contracts-releases/v1.0.0/TeleporterMessenger_Contract_Address_v1.0.0.txt.json';
import TeleporterRegistryManualyCompiled from '../../../../contracts/icm-contracts/compiled/TeleporterRegistry.json';
import { RequireChainL1 } from "../../ui/RequireChain";

export default function TeleporterRegistry() {
    const { showBoundary } = useErrorBoundary();
    const { setTeleporterRegistryAddress, teleporterRegistryAddress } = useToolboxStore();
    const { coreWalletClient, publicClient, walletChainId } = useWalletStore();
    const [isDeploying, setIsDeploying] = useState(false);
    const viemChain = useViemChainStore();

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
        <RequireChainL1>
            <div className="space-y-4">
                <h2 className="text-lg font-semibold">Deploy Teleporter Registry</h2>
                <div className="space-y-4">
                    <div className="mb-4">
                        This will deploy the <code>TeleporterRegistry</code> contract to the currently connected EVM network <code>{walletChainId}</code>.
                        The contract will be initialized with the Teleporter Messenger address <code>{TeleporterMessengerAddress.content.trim()}</code>.
                    </div>
                    <Button
                        type="primary"
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
            </div>
        </RequireChainL1>
    );
}
