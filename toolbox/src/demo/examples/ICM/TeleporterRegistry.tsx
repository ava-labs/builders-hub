"use client";

import { useExampleStore } from "../../utils/store";
import { useErrorBoundary } from "react-error-boundary";
import { useState } from "react";
import { Button } from "../../ui";
import { Success } from "../../ui/Success";
import { createWalletClient, custom, createPublicClient } from 'viem';
import TeleporterRegistryBytecode from '../../../../contracts/icm-contracts-releases/v1.0.0/TeleporterRegistry_Bytecode_v1.0.0.txt.json';
import TeleporterMessengerAddress from '../../../../contracts/icm-contracts-releases/v1.0.0/TeleporterMessenger_Contract_Address_v1.0.0.txt.json';
import TeleporterRegistryManualyCompiled from '../../../../contracts/icm-contracts/compiled/TeleporterRegistry.json';
import KnownChainIDWarning from "../../ui/KnownChainIDWarning";

export default function TeleporterRegistry() {
    const { showBoundary } = useErrorBoundary();
    const { walletChainId, setTeleporterRegistryAddress, teleporterRegistryAddress } = useExampleStore();
    const [isDeploying, setIsDeploying] = useState(false);

    async function handleDeploy() {
        setIsDeploying(true);
        setTeleporterRegistryAddress("");
        try {
            const publicClient = createPublicClient({
                transport: custom(window.avalanche!),
            });

            const walletClient = createWalletClient({
                transport: custom(window.avalanche!),
            });

            const [address] = await walletClient.requestAddresses();

            // Get messenger address
            const messengerAddress = TeleporterMessengerAddress.content.trim() as `0x${string}`;

            const hash = await walletClient.deployContract({
                account: address,
                bytecode: TeleporterRegistryBytecode.content.trim() as `0x${string}`,
                abi: TeleporterRegistryManualyCompiled.abi,
                args: [
                    [{ version: 1n, protocolAddress: messengerAddress }]
                ],
                chain: {
                    id: walletChainId,
                    name: "My L1",
                    rpcUrls: {
                        default: { http: [] },
                    },
                    nativeCurrency: {
                        name: "COIN",
                        symbol: "COIN",
                        decimals: 18,
                    },
                },
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
        <div className="space-y-4">
            <h2 className="text-lg font-semibold">Deploy Teleporter Registry</h2>
            <div className="space-y-4">
                <div className="mb-4">
                    This will deploy the <code>TeleporterRegistry</code> contract to the currently connected EVM network <code>{walletChainId}</code>.
                    The contract will be initialized with the Teleporter Messenger address <code>{TeleporterMessengerAddress.content.trim()}</code>.
                </div>
                <KnownChainIDWarning walletChainId={walletChainId} />
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
    );
}
