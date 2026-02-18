"use client";

import { useSelectedL1 } from "@/components/toolbox/stores/l1ListStore";
import { useToolboxStore } from "@/components/toolbox/stores/toolboxStore";
import { useState } from "react";
import { Button } from "@/components/toolbox/components/Button";
import { Success } from "@/components/toolbox/components/Success";
import TeleporterRegistryBytecode from '@/contracts/icm-contracts-releases/v1.0.0/TeleporterRegistry_Bytecode_v1.0.0.txt.json';
import TeleporterMessengerAddress from '@/contracts/icm-contracts-releases/v1.0.0/TeleporterMessenger_Contract_Address_v1.0.0.txt.json';
import TeleporterRegistryManualyCompiled from '@/contracts/icm-contracts/compiled/TeleporterRegistry.json';
import { WalletRequirementsConfigKey } from "@/components/toolbox/hooks/useWalletRequirements";
import { BaseConsoleToolProps, ConsoleToolMetadata, withConsoleToolMetadata } from "../../../components/WithConsoleToolMetadata";
import versions from '@/scripts/versions.json';
import { generateConsoleToolGitHubUrl } from "@/components/toolbox/utils/github-url";
import { useContractDeployer } from "@/components/toolbox/hooks/contracts";

const ICM_COMMIT = versions["ava-labs/icm-contracts"];
const TELEPORTER_REGISTRY_SOURCE_URL = `https://github.com/ava-labs/icm-contracts/blob/${ICM_COMMIT}/contracts/teleporter/registry/TeleporterRegistry.sol`;

const metadata: ConsoleToolMetadata = {
    title: "Deploy ICM Registry",
    description: "Deploy the ICM Registry contract to your L1",
    toolRequirements: [
        WalletRequirementsConfigKey.EVMChainBalance
    ],
    githubUrl: generateConsoleToolGitHubUrl(import.meta.url)
};

function TeleporterRegistry({ onSuccess }: BaseConsoleToolProps) {
    const [criticalError, setCriticalError] = useState<Error | null>(null);
    const { setTeleporterRegistryAddress, teleporterRegistryAddress } = useToolboxStore();
    const selectedL1 = useSelectedL1()();
    const { deploy, isDeploying } = useContractDeployer();
    // Throw critical errors during render
    if (criticalError) {
        throw criticalError;
    }

    async function handleDeploy() {
        setTeleporterRegistryAddress("");
        try {
            // Get messenger address
            const messengerAddress = TeleporterMessengerAddress.content.trim();

            const result = await deploy({
                bytecode: TeleporterRegistryBytecode.content.trim(),
                abi: TeleporterRegistryManualyCompiled.abi as any,
                args: [
                    [{ version: 1n, protocolAddress: messengerAddress }]
                ],
                name: 'TeleporterRegistry'
            });

            setTeleporterRegistryAddress(result.contractAddress);
            onSuccess?.();
        } catch (error) {
            setCriticalError(error instanceof Error ? error : new Error(String(error)));
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
