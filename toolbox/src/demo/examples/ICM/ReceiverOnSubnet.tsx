"use client";

import { useToolboxStore, useViemChainStore, useWalletStore } from "../../utils/store";
import { useErrorBoundary } from "react-error-boundary";
import { useState, useEffect } from "react";
import { Button } from "../../ui";
import { Success } from "../../ui/Success";
import ReceiverOnSubnetABI from "../../../../contracts/example-contracts/compiled/ReceiverOnSubnet.json";
import { avalancheFuji } from "viem/chains";
import TeleporterMessengerAddress from '../../../../contracts/icm-contracts-releases/v1.0.0/TeleporterMessenger_Contract_Address_v1.0.0.txt.json';
import { RequireChainL1 } from "../../ui/RequireChain";

const SENDER_C_CHAIN_ADDRESS = "0x2419133a23EA13EAF3dC3ee2382F083067107386";

export default function DeployReceiver() {
    const { showBoundary } = useErrorBoundary();
    const { setIcmReceiverAddress, icmReceiverAddress } = useToolboxStore();
    const { coreWalletClient, publicClient, walletChainId } = useWalletStore();
    const viemChain = useViemChainStore();
    const [isDeploying, setIsDeploying] = useState(false);
    const [isTeleporterDeployed, setIsTeleporterDeployed] = useState(false);

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
    }, [walletChainId]);

    async function handleDeploy() {
        setIsDeploying(true);
        setIcmReceiverAddress("");
        try {
            const hash = await coreWalletClient.deployContract({
                abi: ReceiverOnSubnetABI.abi,
                bytecode: ReceiverOnSubnetABI.bytecode.object as `0x${string}`,
                chain: viemChain
            });

            const receipt = await publicClient.waitForTransactionReceipt({ hash });

            if (!receipt.contractAddress) {
                throw new Error('No contract address in receipt');
            }

            setIcmReceiverAddress(receipt.contractAddress);
        } catch (error) {
            showBoundary(error);
        } finally {
            setIsDeploying(false);
        }
    }

    return (
        <RequireChainL1>
            <div className="space-y-4">
                <h2 className="text-lg font-semibold">Deploy ReceiverOnSubnet</h2>
                <div className="space-y-4">
                    <div className="">
                        This will deploy the <code>ReceiverOnSubnet</code> contract to your connected network (Chain ID: <code>{walletChainId}</code>). This contract can receive messages from the C-Chain using Avalanche's Inter-Chain Messaging (ICM) protocol. Once deployed, you can use the pre-deployed sender contract on the C-Chain at address <a href={`https://subnets-test.avax.network/c-chain/address/${SENDER_C_CHAIN_ADDRESS}`} target="_blank" className="text-blue-500 hover:underline">{SENDER_C_CHAIN_ADDRESS}</a> to send messages to this receiver.
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
                        type={icmReceiverAddress ? "default" : "primary"}
                        onClick={handleDeploy}
                        loading={isDeploying}
                        disabled={isDeploying || avalancheFuji.id === walletChainId || !isTeleporterDeployed}
                    >
                        {icmReceiverAddress ? "Re-Deploy ReceiverOnSubnet" : "Deploy ReceiverOnSubnet"}
                    </Button>
                    <Success
                        label="ReceiverOnSubnet Address"
                        value={icmReceiverAddress}
                    />
                </div>

            </div>
        </RequireChainL1>
    );
}
