"use client";

import { useToolboxStore, useViemChainStore, useWalletStore } from "../../utils/store";
import { useErrorBoundary } from "react-error-boundary";
import { useState, useMemo } from "react";
import { Button } from "../../ui";
import { AlertTriangle } from "lucide-react";
import { Success } from "../../ui/Success";
import { createPublicClient, http } from 'viem';
import ReceiverOnSubnetABI from "../../../../contracts/example-contracts/compiled/ReceiverOnSubnet.json";
import SenderOnCChainABI from "../../../../contracts/example-contracts/compiled/SenderOnCChain.json";
import { utils } from "@avalabs/avalanchejs";
import { Input } from "../../ui";
import { avalancheFuji } from "viem/chains";
import { RequireChainFuji } from "../../ui/RequireChain";

const SENDER_C_CHAIN_ADDRESS = "0x2419133a23EA13EAF3dC3ee2382F083067107386";

export default function DeployReceiver() {
    const { showBoundary } = useErrorBoundary();
    const { icmReceiverAddress, chainID, setChainID, evmChainRpcUrl, setEvmChainRpcUrl } = useToolboxStore();
    const viemChain = useViemChainStore();
    const { coreWalletClient, publicClient } = useWalletStore();
    const [message, setMessage] = useState(`It is around ${new Date().toISOString().slice(11, 16)} o'clock in England`);
    const [isSending, setIsSending] = useState(false);
    const [lastTxId, setLastTxId] = useState<string>();
    const [lastReceivedMessage, setLastReceivedMessage] = useState<string>();
    const [isQuerying, setIsQuerying] = useState(false);

    const chainIDHex = useMemo(() =>
        utils.bufferToHex(utils.base58check.decode(chainID))
        , [chainID]);

    async function handleSendMessage() {
        if (!icmReceiverAddress) {
            throw new Error('Receiver contract not deployed');
        }

        setIsSending(true);
        try {
            const { request } = await publicClient.simulateContract({
                address: SENDER_C_CHAIN_ADDRESS,
                abi: SenderOnCChainABI.abi,
                functionName: 'sendMessage',
                args: [icmReceiverAddress, message, chainIDHex],
                chain: avalancheFuji,
            });

            const hash = await coreWalletClient.writeContract(request);
            await publicClient.waitForTransactionReceipt({ hash });
            setLastTxId(hash);
        } catch (error) {
            showBoundary(error);
        } finally {
            setIsSending(false);
        }
    }

    async function queryLastMessage() {
        if (!icmReceiverAddress) {
            throw new Error('Receiver contract not deployed');
        }

        setIsQuerying(true);
        try {
            if (!icmReceiverAddress) {
                throw new Error('Receiver contract not deployed');
            }


            //has to create a custom client since the receiver is on the L1, while this page is on the Fuji network
            const lastMessage = await createPublicClient({
                transport: http(evmChainRpcUrl),
                //@ts-ignore TODO: fix this after core supports sending transactions with chainId parameter
                chain: viemChain,
            }).readContract({
                address: icmReceiverAddress as `0x${string}`,
                abi: ReceiverOnSubnetABI.abi,
                functionName: 'lastMessage',
            });

            setLastReceivedMessage(lastMessage as string);
        } catch (error) {
            showBoundary(error);
        } finally {
            setIsQuerying(false);
        }
    }

    return (
        <RequireChainFuji>
            <div className="space-y-4">
                <h2 className="text-lg font-semibold">Send ICM Message</h2>

                <div className="flex items-start p-4 mb-4 text-sm border rounded-md bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-900/30 dark:border-amber-700/50 dark:text-amber-200">
                    <AlertTriangle className="w-5 h-5 mr-3 flex-shrink-0" />
                    <p>
                        🚧 Heads up! This tool is currently under construction and may not work as expected.
                        We're actively improving it as we ship fast and iterate. Thanks for your patience as we build better tools! 🚧
                    </p>
                </div>
                <div className="opacity-50 pointer-events-none">

                    <Success
                        label="ICM Receiver Address"
                        value={icmReceiverAddress}
                    />
                    <Input
                        label="Receiver Chain ID"
                        value={chainID}
                        onChange={setChainID}
                        validator={chainID => utils.base58check.decode(chainID).length === 32 ? undefined : "Invalid chain ID length: " + utils.base58check.decode(chainID).length}
                    />
                    <Input
                        label="Receiver Chain ID in Hex"
                        value={chainIDHex}
                        disabled
                    />
                    <Input
                        label="Message"
                        value={message}
                        onChange={setMessage}
                        validator={message => message.length > 0 ? undefined : "Message is required"}
                    />
                    <Input
                        label="C-Chain Sender Address"
                        value={SENDER_C_CHAIN_ADDRESS}
                        disabled
                    />
                    <Input
                        label={`L1 Receiver Address on chain #${viemChain?.id}`}
                        value={icmReceiverAddress || ""}
                        disabled
                    />
                    <Input
                        label="EVM Chain RPC URL"
                        value={evmChainRpcUrl}
                        onChange={setEvmChainRpcUrl}
                    />
                    {!icmReceiverAddress && <div className="text-sm">
                        You must <a href="#receiverOnSubnet" className="text-blue-500 hover:underline">deploy the ReceiverOnSubnet contract first</a>.
                    </div>}
                    <Button
                        type="primary"
                        onClick={handleSendMessage}
                        loading={isSending}
                        disabled={isSending || !icmReceiverAddress || !message}
                    >
                        Send Message from C-Chain to Subnet
                    </Button>
                    <div className="space-y-2">
                        <Success
                            label="Transaction ID"
                            value={lastTxId ?? ""}
                        />
                        {lastTxId && (
                            <a
                                href={`https://subnets-test.avax.network/c-chain/tx/${lastTxId}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-blue-500 hover:underline"
                            >
                                View on Explorer
                            </a>
                        )}
                    </div>
                    <Button
                        type="primary"
                        onClick={queryLastMessage}
                        loading={isQuerying}
                        disabled={isQuerying || !icmReceiverAddress}
                    >
                        Query Last Message
                    </Button>
                    <Success
                        label="Last Received Message"
                        value={lastReceivedMessage ?? ""}
                    />
                </div>
            </div>
        </RequireChainFuji>
    );
}
