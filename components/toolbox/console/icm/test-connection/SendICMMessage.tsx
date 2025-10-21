"use client";

import { useToolboxStore, useViemChainStore, getToolboxStore } from "@/components/toolbox/stores/toolboxStore";
import { useState, useMemo } from "react";
import { Button } from "@/components/toolbox/components/Button";
import { Success } from "@/components/toolbox/components/Success";
import { createPublicClient, http } from 'viem';
import ICMDemoABI from "@/contracts/example-contracts/compiled/ICMDemo.json";
import { utils } from "@avalabs/avalanchejs";
import { Input } from "@/components/toolbox/components/Input";
import SelectBlockchainId from "@/components/toolbox/components/SelectBlockchainId";
import { useL1ByChainId, useSelectedL1 } from "@/components/toolbox/stores/l1ListStore";
import { useEffect } from "react";
import { WalletRequirementsConfigKey } from "@/components/toolbox/hooks/useWalletRequirements";
import { BaseConsoleToolProps, ConsoleToolMetadata, withConsoleToolMetadata } from "../../../components/WithConsoleToolMetadata";
import { useConnectedWallet } from "@/components/toolbox/contexts/ConnectedWalletContext";
import useConsoleNotifications from "@/hooks/useConsoleNotifications";
import { generateConsoleToolGitHubUrl } from "@/components/toolbox/utils/github-url";

const predeployedDemos: Record<string, string> = {
    //fuji
    "yH8D7ThNJkxmtkuv2jgBa4P1Rn3Qpr4pPr7QYNfcdoS6k6HWp": "0x05c474824e7d2cc67cf22b456f7cf60c0e3a1289"
}

const metadata: ConsoleToolMetadata = {
    title: "Send ICM Message",
    description: "Send a test message between L1s using Avalanche's Inter-Chain Messaging (ICM) protocol",
    toolRequirements: [
        WalletRequirementsConfigKey.EVMChainBalance
    ],
    githubUrl: generateConsoleToolGitHubUrl(import.meta.url)
};

function SendICMMessage({ onSuccess }: BaseConsoleToolProps) {
    const [criticalError, setCriticalError] = useState<Error | null>(null);
    const { icmReceiverAddress, setIcmReceiverAddress } = useToolboxStore();
    const { coreWalletClient } = useConnectedWallet();
    const selectedL1 = useSelectedL1()();
    const [message, setMessage] = useState(Math.floor(Math.random() * 10000));
    const [destinationChainId, setDestinationChainId] = useState<string>("");
    const [isSending, setIsSending] = useState(false);
    const [lastTxId, setLastTxId] = useState<string>();
    const viemChain = useViemChainStore();
    const [isQuerying, setIsQuerying] = useState(false);
    const [lastReceivedMessage, setLastReceivedMessage] = useState<number>();
    const { notify } = useConsoleNotifications();
    // Throw critical errors during render
    if (criticalError) {
        throw criticalError;
    }

    const targetToolboxStore = getToolboxStore(destinationChainId)()
    const targetL1 = useL1ByChainId(destinationChainId)();

    const sourceContractError = icmReceiverAddress ? undefined : (
        <>Please <a href="#deployICMDemo">deploy the ICM Demo contract on {selectedL1?.name}</a> first</>
    );

    const targetContractError = targetToolboxStore.icmReceiverAddress ? undefined : (
        <>Please <a href="#deployICMDemo">deploy the ICM Demo contract on {targetL1?.name}</a> first</>
    );

    let destinationChainError: string | undefined = undefined;
    if (!destinationChainId) {
        destinationChainError = "Please select a destination chain";
    } else if (selectedL1?.id === destinationChainId) {
        destinationChainError = "Source and destination chains must be different";
    }

    const destinationBlockchainIDHex = useMemo(() => {
        if (!targetL1?.id) return undefined;
        try {
            return utils.bufferToHex(utils.base58check.decode(targetL1.id));
        } catch (e) {
            console.error("Error decoding destination chain ID:", e);
            return undefined;
        }
    }, [targetL1?.id]);

    useEffect(() => {
        if (predeployedDemos[destinationChainId] && !icmReceiverAddress) {
            setIcmReceiverAddress(predeployedDemos[destinationChainId]);
        }

        if (predeployedDemos[destinationChainId] && !targetToolboxStore.icmReceiverAddress) {
            targetToolboxStore.setIcmReceiverAddress(predeployedDemos[destinationChainId]);
        }
    }, [destinationChainId]);

    async function handleSendMessage() {
        if (!icmReceiverAddress || !targetToolboxStore.icmReceiverAddress || !destinationBlockchainIDHex || !viemChain) {
            setCriticalError(new Error('Missing required information to send message.'));
            return;
        }

        setIsSending(true);
        setLastTxId(undefined);
        try {
            const sourceAddress = icmReceiverAddress as `0x${string}`;
            const destinationAddress = targetToolboxStore.icmReceiverAddress as `0x${string}`;

            const publicClient = createPublicClient({
                chain: viemChain,
                transport: http(viemChain.rpcUrls.default.http[0]),
            });

            if (!coreWalletClient.account) {
                throw new Error('No wallet account connected');
            }

            const { request } = await publicClient.simulateContract({
                address: sourceAddress,
                abi: ICMDemoABI.abi,
                functionName: 'sendMessage',
                args: [
                    destinationAddress,
                    BigInt(message),
                    destinationBlockchainIDHex as `0x${string}`
                ],
                account: coreWalletClient.account,
                chain: viemChain,
            });

            const writePromise = coreWalletClient.writeContract(request);

            notify({
                type: 'call',
                name: 'Send ICM Message'
            }, writePromise, viemChain ?? undefined);

            const hash = await writePromise;
            console.log("Transaction hash:", hash);
            setLastTxId(hash);
            onSuccess?.();

        } catch (error) {
            console.error("ICM Send Error:", error);
            setCriticalError(error instanceof Error ? error : new Error(String(error)));
        } finally {
            setIsSending(false);
        }
    }

    async function queryLastMessage() {
        if (!targetL1?.rpcUrl || !targetToolboxStore.icmReceiverAddress) {
            setCriticalError(new Error('Missing required information to query message'));
            return;
        }

        setIsQuerying(true);
        try {
            const destinationClient = createPublicClient({
                transport: http(targetL1.rpcUrl),
            });

            const lastMessage = await destinationClient.readContract({
                address: targetToolboxStore.icmReceiverAddress as `0x${string}`,
                abi: ICMDemoABI.abi,
                functionName: 'lastMessage',
            });

            setLastReceivedMessage(Number(lastMessage));
        } catch (error) {
            console.error("ICM Query Error:", error);
            setCriticalError(error instanceof Error ? error : new Error(String(error)));
        } finally {
            setIsQuerying(false);
        }
    }

    const isButtonDisabled = isSending ||
        !!sourceContractError ||
        !!targetContractError ||
        !!destinationChainError ||
        !message ||
        !destinationBlockchainIDHex;

    const isQueryButtonDisabled = isQuerying ||
        !targetToolboxStore.icmReceiverAddress ||
        !targetL1?.rpcUrl;

    return (
        <>
                <div className="space-y-4">
                    <Input
                        value={icmReceiverAddress}
                        label={`ICM Demo Contract Address on ${selectedL1?.name}`}
                        disabled
                        error={sourceContractError}
                    />
                    <Input
                        label="Message to deliver (Number)"
                        value={message.toString()}
                        onChange={(value) => setMessage(Number(value) || 0)}
                        required
                        type="number"
                    />
                    <SelectBlockchainId
                        label="Destination Chain"
                        value={destinationChainId}
                        onChange={(value) => setDestinationChainId(value)}
                        error={destinationChainError}
                    />
                    <Input
                        value={targetToolboxStore.icmReceiverAddress}
                        label={`ICM Demo Contract Address on ${targetL1?.name}`}
                        disabled
                        error={targetContractError}
                    />

                    <Button
                        variant="primary"
                        onClick={handleSendMessage}
                        loading={isSending}
                        disabled={isButtonDisabled}
                    >
                        Send Message from {selectedL1?.name || 'Source'} to {targetL1?.name || 'Destination'}
                    </Button>

                    <div className="space-y-1">
                        <Success
                            label="Transaction ID (on Source Chain)"
                            value={lastTxId ?? ""}
                        />
                    </div>

                    <div className="pt-4 border-t border-gray-200 dark:border-gray-800">
                        <Button
                            variant="secondary"
                            onClick={queryLastMessage}
                            loading={isQuerying}
                            disabled={isQueryButtonDisabled}
                        >
                            Query Last Message on {targetL1?.name || 'Destination Chain'}
                        </Button>

                        <div className="mt-2">
                            <Success
                                label="Last Received Message on Destination Chain"
                                value={lastReceivedMessage !== undefined ? lastReceivedMessage.toString() : ""}
                            />
                        </div>
                    </div>
                </div>
        </>
    );
}

export default withConsoleToolMetadata(SendICMMessage, metadata);
