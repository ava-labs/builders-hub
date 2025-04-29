"use client";

import { useToolboxStore, useViemChainStore, useSelectedL1 } from "../toolboxStore";
import { useWalletStore } from "../../lib/walletStore";
import { useErrorBoundary } from "react-error-boundary";
import { useState, useMemo } from "react";
import { Button } from "../../components/Button";
import { Success } from "../../components/Success";
import { createPublicClient, http } from 'viem';
import ICMDemoABI from "../../../contracts/example-contracts/compiled/ICMDemo.json";
import { utils } from "@avalabs/avalanchejs";
import { Input } from "../../components/Input";
import { avalancheFuji } from "viem/chains";
import { SENDER_C_CHAIN_ADDRESS } from "./DeployICMDemo";
import { RadioGroup } from "../../components/RadioGroup";

type MessageDirection = "CtoL1" | "L1toC";

export default function SendICMMessage() {
    const { showBoundary } = useErrorBoundary();
    const { icmReceiverAddress } = useToolboxStore();
    const viemChain = useViemChainStore();
    const { coreWalletClient } = useWalletStore();
    const [message, setMessage] = useState(Math.floor(Math.random() * 10000));
    const [isSending, setIsSending] = useState(false);
    const [lastTxId, setLastTxId] = useState<string>();
    const [lastReceivedMessage, setLastReceivedMessage] = useState<number>();
    const [isQuerying, setIsQuerying] = useState(false);
    const [messageDirection, setMessageDirection] = useState<MessageDirection>("CtoL1");
    const selectedL1 = useSelectedL1();

    const directionOptions = [
        { value: "CtoL1", label: "C-Chain to Subnet (L1)" },
        { value: "L1toC", label: "Subnet (L1) to C-Chain" },
    ];

    const chainIDHex = useMemo(() =>
        utils.bufferToHex(utils.base58check.decode(selectedL1?.id || ""))
        , [selectedL1?.id]);

    // Get the appropriate chain for the current direction
    const requiredChain = messageDirection === "CtoL1" ? avalancheFuji : viemChain;

    // Get the destination and source addresses based on direction
    const sourceAddress = messageDirection === "CtoL1"
        ? SENDER_C_CHAIN_ADDRESS
        : icmReceiverAddress as `0x${string}`;

    const destinationAddress = messageDirection === "CtoL1"
        ? icmReceiverAddress
        : SENDER_C_CHAIN_ADDRESS;

    // Get the appropriate blockchain ID based on direction
    const destinationBlockchainID = messageDirection === "CtoL1"
        ? chainIDHex
        : utils.bufferToHex(utils.base58check.decode("yH8D7ThNJkxmtkuv2jgBa4P1Rn3Qpr4pPr7QYNfcdoS6k6HWp")); // Fuji BlockchainID

    async function handleSendMessage() {
        if (!destinationAddress) {
            throw new Error('Destination address not available');
        }

        setIsSending(true);
        try {
            if (!requiredChain) throw new Error('Invalid chain');

            const selectedPublicClient = createPublicClient({
                transport: http(requiredChain.rpcUrls.default.http[0]),
            });

            const { request } = await selectedPublicClient.simulateContract({
                address: sourceAddress,
                abi: ICMDemoABI.abi,
                functionName: 'sendMessage',
                args: [
                    destinationAddress as `0x${string}`,
                    message,
                    destinationBlockchainID as `0x${string}`
                ],
                chain: requiredChain,
            });

            const hash = await coreWalletClient.writeContract(request);
            console.log("hash", hash);
            await selectedPublicClient.waitForTransactionReceipt({ hash });
            setLastTxId(hash);
        } catch (error) {
            showBoundary(error);
        } finally {
            setIsSending(false);
        }
    }

    async function queryLastMessage() {
        setIsQuerying(true);
        try {
            if (!viemChain) throw new Error('Invalid chain');

            // For CtoL1, we need to query the subnet
            // For L1toC, we need to query the C-Chain
            const targetClient = messageDirection === "CtoL1"
                ? createPublicClient({
                    transport: http(selectedL1?.rpcUrl || ""),
                    chain: viemChain,
                })
                : createPublicClient({
                    transport: http(avalancheFuji.rpcUrls.default.http[0]),
                    chain: avalancheFuji,
                });

            const targetAddress = messageDirection === "CtoL1"
                ? icmReceiverAddress as `0x${string}`
                : SENDER_C_CHAIN_ADDRESS as `0x${string}`;

            const lastMessage = await targetClient.readContract({
                address: targetAddress,
                abi: ICMDemoABI.abi,
                functionName: 'lastMessage',
            });

            setLastReceivedMessage(lastMessage as number);
        } catch (error) {
            showBoundary(error);
        } finally {
            setIsQuerying(false);
        }
    }

    const sourceChainText = messageDirection === "CtoL1" ? "C-Chain" : "Subnet (L1)";
    const destinationChainText = messageDirection === "CtoL1" ? "Subnet (L1)" : "C-Chain";

    if (!requiredChain) {
        return <div>Invalid chain</div>;
    }

    return (
        <div className="space-y-4">
            <h2 className="text-lg font-semibold">Send ICM Message</h2>

            <div className="p-4 border rounded-md bg-gray-50 dark:bg-gray-900/50">
                <RadioGroup
                    items={directionOptions}
                    value={messageDirection}
                    onChange={(value) => setMessageDirection(value as MessageDirection)}
                    idPrefix="message-direction-"
                />
            </div>

            <div className="space-y-4">
                {messageDirection === "CtoL1" && (
                    <Input
                        label="ICM Receiver Address on Subnet"
                        value={icmReceiverAddress}
                        disabled
                    />
                )}

                {messageDirection === "L1toC" && (
                    <Input
                        label="C-Chain Receiver Address"
                        value={SENDER_C_CHAIN_ADDRESS}
                        disabled
                    />
                )}

                <Input
                    label="Destination Chain ID"
                    value={selectedL1?.id}
                    disabled
                />

                {messageDirection === "CtoL1" && (
                    <Input
                        label="Destination Chain ID in Hex"
                        value={chainIDHex}
                        disabled
                    />
                )}

                <Input
                    label="Message (Number)"
                    value={message.toString()}
                    onChange={(value) => setMessage(Number(value) || 0)}
                    required
                    type="number"
                />

                <Success
                    label={`Source Address (${sourceChainText})`}
                    value={sourceAddress}
                />

                <Success
                    label={`Destination Address (${destinationChainText})`}
                    value={destinationAddress || ""}
                />

                <div className="p-3 bg-blue-50 border border-blue-100 rounded-md text-blue-800 dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-300">
                    <p>Sending message from {sourceChainText} to {destinationChainText}</p>
                </div>

                <Button
                    variant="primary"
                    onClick={handleSendMessage}
                    loading={isSending}
                    disabled={isSending || !destinationAddress || !message}
                >
                    Send Message from {sourceChainText} to {destinationChainText}
                </Button>

                <div className="space-y-2">
                    <Success
                        label="Transaction ID"
                        value={lastTxId ?? ""}
                    />
                    {lastTxId && (
                        <a
                            href={`https://subnets-test.avax.network/${messageDirection === "CtoL1" ? "c-chain" : viemChain?.name?.toLowerCase()}/tx/${lastTxId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-blue-500 hover:underline"
                        >
                            View on Explorer
                        </a>
                    )}
                </div>

                <Button
                    variant="primary"
                    onClick={queryLastMessage}
                    loading={isQuerying}
                    disabled={isQuerying || (messageDirection === "CtoL1" && !icmReceiverAddress)}
                >
                    Query Last Message on {destinationChainText}
                </Button>

                <Success
                    label="Last Received Message"
                    value={lastReceivedMessage?.toString() ?? ""}
                />
            </div>
        </div>
    );
}
