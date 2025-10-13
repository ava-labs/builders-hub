"use client";

import { useToolboxStore, useViemChainStore } from "@/components/toolbox/stores/toolboxStore";
import { useWalletStore } from "@/components/toolbox/stores/walletStore";
import { useState, useEffect } from "react";
import { Button } from "@/components/toolbox/components/Button";
import { Success } from "@/components/toolbox/components/Success";
import ICMDemoABI from "@/contracts/example-contracts/compiled/ICMDemo.json";
import TeleporterMessengerAddress from '@/contracts/icm-contracts-releases/v1.0.0/TeleporterMessenger_Contract_Address_v1.0.0.txt.json';
import { useSelectedL1 } from "@/components/toolbox/stores/l1ListStore";
import { WalletRequirementsConfigKey } from "@/components/toolbox/hooks/useWalletRequirements";
import useConsoleNotifications from "@/hooks/useConsoleNotifications";
import { BaseConsoleToolProps, ConsoleToolMetadata, withConsoleToolMetadata } from "../../../components/WithConsoleToolMetadata";
import { useConnectedWallet } from "@/components/toolbox/contexts/ConnectedWalletContext";
import { generateConsoleToolGitHubUrl } from "@/components/toolbox/utils/github-url";

const SENDER_C_CHAIN_ADDRESS = "0x05c474824e7d2cc67cf22b456f7cf60c0e3a1289";

const metadata: ConsoleToolMetadata = {
    title: "Deploy ICM Demo Contract",
    description: "Deploy a demo contract that can receive messages from the C-Chain using Avalanche's Inter-Chain Messaging (ICM) protocol",
    walletRequirements: [
        WalletRequirementsConfigKey.EVMChainBalance
    ],
    githubUrl: generateConsoleToolGitHubUrl(import.meta.url)
};

function DeployICMDemo({ onSuccess }: BaseConsoleToolProps) {
    const { setIcmReceiverAddress, icmReceiverAddress } = useToolboxStore();
    const { publicClient, walletEVMAddress } = useWalletStore();
    const { coreWalletClient } = useConnectedWallet();
    const viemChain = useViemChainStore();
    const [isDeploying, setIsDeploying] = useState(false);
    const [isTeleporterDeployed, setIsTeleporterDeployed] = useState(false);
    const [criticalError, setCriticalError] = useState<Error | null>(null);
    const selectedL1 = useSelectedL1()();
    const { notify } = useConsoleNotifications();
    // Throw critical errors during render
    if (criticalError) {
        throw criticalError;
    }

    useEffect(() => {
        async function checkTeleporterExists() {
            try {
                const code = await publicClient.getBytecode({
                    address: TeleporterMessengerAddress.content as `0x${string}`,
                });

                setIsTeleporterDeployed(!!code);
            } catch (error) {
                setIsTeleporterDeployed(false);
            }
        }

        checkTeleporterExists();
    }, [selectedL1?.evmChainId]);

    async function handleDeploy() {
        setIsDeploying(true);
        setIcmReceiverAddress("");
        try {
            const deployPromise = coreWalletClient.deployContract({
                abi: ICMDemoABI.abi as any,
                bytecode: ICMDemoABI.bytecode.object as `0x${string}`,
                account: walletEVMAddress as `0x${string}`,
                chain: viemChain
            });

            notify({
                type: 'deploy',
                name: 'ICMDemo'
            }, deployPromise, viemChain ?? undefined);

            const hash = await deployPromise;
            const receipt = await publicClient.waitForTransactionReceipt({ hash });

            if (!receipt.contractAddress) {
                throw new Error('No contract address in receipt');
            }

            setIcmReceiverAddress(receipt.contractAddress);
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
                <div className="">
                    This will deploy the <code>ICMDemo</code> contract to your connected network (Chain ID: <code>{selectedL1?.evmChainId}</code>). This contract can receive messages from the C-Chain using Avalanche's Inter-Chain Messaging (ICM) protocol. Once deployed, you can use the pre-deployed sender contract on the C-Chain at address <a href={`https://subnets-test.avax.network/c-chain/address/${SENDER_C_CHAIN_ADDRESS}`} target="_blank" className="text-blue-500 hover:underline">{SENDER_C_CHAIN_ADDRESS}</a> to send messages to this receiver.
                </div>
                <div className="">
                    Read more about the <a href="https://build.avax.network/academy/interchain-messaging/04-icm-basics/04-create-sender-contract" target="_blank" className="text-blue-500 hover:underline">Sender Contract</a> and <a href="https://build.avax.network/academy/interchain-messaging/04-icm-basics/06-create-receiver-contract" target="_blank" className="text-blue-500 hover:underline">Receiver Contract</a> in the Avalanche documentation.
                </div>
                {!isTeleporterDeployed && (
                    <div className="text-red-500">
                        TeleporterMessenger contract is not deployed on this network. Please <a href="#teleporterMessenger" className="text-blue-500 hover:underline">deploy the TeleporterMessenger contract first</a>.
                    </div>
                )}
                {isTeleporterDeployed && <div>
                    ✅  TeleporterMessenger contract is detected at address <code>{TeleporterMessengerAddress.content}</code>.
                </div>}
                <Button
                    variant={icmReceiverAddress ? "secondary" : "primary"}
                    onClick={handleDeploy}
                    loading={isDeploying}
                    disabled={isDeploying || !isTeleporterDeployed}
                >
                    {icmReceiverAddress ? "Re-Deploy ICMDemo" : "Deploy ICMDemo"}
                </Button>
                <Success
                    label="ICMDemo Address"
                    value={icmReceiverAddress}
                />
            </div>

        </>
    );
}

export default withConsoleToolMetadata(DeployICMDemo, metadata);
