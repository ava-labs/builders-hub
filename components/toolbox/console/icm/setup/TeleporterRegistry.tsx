"use client";

import { useSelectedL1 } from "@/components/toolbox/stores/l1ListStore";
import { useToolboxStore, useViemChainStore } from "@/components/toolbox/stores/toolboxStore";
import { useWalletStore } from "@/components/toolbox/stores/walletStore";
import { useState } from "react";
import { Button } from "@/components/toolbox/components/Button";
import { Success } from "@/components/toolbox/components/Success";
import TeleporterRegistryBytecode from '@/contracts/icm-contracts-releases/v1.0.0/TeleporterRegistry_Bytecode_v1.0.0.txt.json';
import TeleporterMessengerAddress from '@/contracts/icm-contracts-releases/v1.0.0/TeleporterMessenger_Contract_Address_v1.0.0.txt.json';
import TeleporterRegistryManualyCompiled from '@/contracts/icm-contracts/compiled/TeleporterRegistry.json';
import { WalletRequirementsConfigKey } from "@/components/toolbox/hooks/useWalletRequirements";
import { BaseConsoleToolProps, ConsoleToolMetadata, withConsoleToolMetadata } from "../../../components/WithConsoleToolMetadata";
import { useConnectedWallet } from "@/components/toolbox/contexts/ConnectedWalletContext";
import versions from '@/scripts/versions.json';
import useConsoleNotifications from "@/hooks/useConsoleNotifications";
import { generateConsoleToolGitHubUrl } from "@/components/toolbox/utils/github-url";

const ICM_COMMIT = versions["ava-labs/icm-contracts"];
const TELEPORTER_REGISTRY_SOURCE_URL = `https://github.com/ava-labs/icm-contracts/blob/${ICM_COMMIT}/contracts/teleporter/registry/TeleporterRegistry.sol`;

const metadata: ConsoleToolMetadata = {
    title: "Deploy ICM Registry",
    description: "Deploy the ICM Registry contract to your L1",
    walletRequirements: [
        WalletRequirementsConfigKey.EVMChainBalance
    ],
    githubUrl: generateConsoleToolGitHubUrl(import.meta.url)
};

function TeleporterRegistry({ onSuccess }: BaseConsoleToolProps) {
    const [criticalError, setCriticalError] = useState<Error | null>(null);
    const { setTeleporterRegistryAddress, teleporterRegistryAddress } = useToolboxStore();
    const { publicClient, walletEVMAddress } = useWalletStore();
    const { coreWalletClient } = useConnectedWallet();
    const [isDeploying, setIsDeploying] = useState(false);
    const viemChain = useViemChainStore();
    const selectedL1 = useSelectedL1()();
    const { notify } = useConsoleNotifications();
    // Throw critical errors during render
    if (criticalError) {
        throw criticalError;
    }

    async function handleDeploy() {
        setIsDeploying(true);
        setTeleporterRegistryAddress("");
        try {
            // Get messenger address
            const messengerAddress = TeleporterMessengerAddress.content.trim();

            const deployPromise = coreWalletClient.deployContract({
                bytecode: TeleporterRegistryBytecode.content.trim() as `0x${string}`,
                abi: TeleporterRegistryManualyCompiled.abi as any,
                args: [
                    [{ version: 1n, protocolAddress: messengerAddress }]
                ],
                account: walletEVMAddress as `0x${string}`,
                chain: viemChain,
            });
            notify({
                type: 'deploy',
                name: 'TeleporterRegistry'
            }, deployPromise, viemChain ?? undefined);

            const hash = await deployPromise;
            const receipt = await publicClient.waitForTransactionReceipt({ hash });

            if (!receipt.contractAddress) {
                throw new Error('No contract address in receipt');
            }

            setTeleporterRegistryAddress(receipt.contractAddress);
            onSuccess?.();
        } catch (error) {
            setCriticalError(error instanceof Error ? error : new Error(String(error)));
        } finally {
            setIsDeploying(false);
        }
    }

    return (
        <>
            <div className="space-y-4">
                <div className="mb-4">
                    This will deploy the <code>TeleporterRegistry</code> contract to the EVM network #<code>{selectedL1?.evmChainId}</code>.
                    The contract will be initialized with the Teleporter Messenger address <code>{TeleporterMessengerAddress.content.trim()}</code>.
                </div>
                <p className="text-sm text-gray-500">
                    Contract source: <a href={TELEPORTER_REGISTRY_SOURCE_URL} target="_blank" rel="noreferrer">TeleporterRegistry.sol</a> @ <code>{ICM_COMMIT.slice(0, 7)}</code>
                </p>
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
        </>
    );
}

export default withConsoleToolMetadata(TeleporterRegistry, metadata);
