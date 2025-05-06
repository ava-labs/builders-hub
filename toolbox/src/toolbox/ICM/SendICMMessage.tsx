"use client";

import { useToolboxStore, useViemChainStore, useSelectedL1, getToolboxStore, useL1ByChainId } from "../toolboxStore";
import { useWalletStore } from "../../lib/walletStore";
import { useErrorBoundary } from "react-error-boundary";
import { useState, useMemo } from "react";
import { Button } from "../../components/Button";
import { Success } from "../../components/Success";
import { createPublicClient, http } from 'viem';
import ICMDemoABI from "../../../contracts/example-contracts/compiled/ICMDemo.json";
import { utils } from "@avalabs/avalanchejs";
import { Input } from "../../components/Input";
import { Container } from "../components/Container";
import SelectChainID from "../components/SelectChainID";

export default function SendICMMessage() {
    const { showBoundary } = useErrorBoundary();
    const { icmReceiverAddress } = useToolboxStore();
    const { coreWalletClient } = useWalletStore();
    const selectedL1 = useSelectedL1()();
    const [message, setMessage] = useState(Math.floor(Math.random() * 10000));
    const [destinationChainId, setDestinationChainId] = useState<string>("");
    const [isSending, setIsSending] = useState(false);
    const [lastTxId, setLastTxId] = useState<string>();
    const viemChain = useViemChainStore();
    const [isQuerying, setIsQuerying] = useState(false);
    const [lastReceivedMessage, setLastReceivedMessage] = useState<number>();

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

    async function handleSendMessage() {
        if (!icmReceiverAddress || !targetToolboxStore.icmReceiverAddress || !destinationBlockchainIDHex || !viemChain || !coreWalletClient) {
            showBoundary(new Error('Missing required information to send message.'));
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
            });

            const hash = await coreWalletClient.writeContract({
                ...request,
                chain: viemChain,
            });

            console.log("Transaction hash:", hash);
            setLastTxId(hash);

        } catch (error) {
            console.error("ICM Send Error:", error);
            showBoundary(error);
        } finally {
            setIsSending(false);
        }
    }

    async function queryLastMessage() {
        if (!targetL1?.rpcUrl || !targetToolboxStore.icmReceiverAddress) {
            showBoundary(new Error('Missing required information to query message'));
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
            showBoundary(error);
        } finally {
            setIsQuerying(false);
        }
    }

    const isButtonDisabled = isSending ||
        !!sourceContractError ||
        !!targetContractError ||
        !!destinationChainError ||
        !message ||
        !coreWalletClient ||
        !destinationBlockchainIDHex;

    const isQueryButtonDisabled = isQuerying ||
        !targetToolboxStore.icmReceiverAddress ||
        !targetL1?.rpcUrl;

    return (
        <Container title="Send ICM Message">
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
                <SelectChainID
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
        </Container>
    );
}
