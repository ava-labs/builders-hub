import { RequireChain } from "../../../components/RequireChain";
import { useWarpMessenger } from '@avalabs/builderkit';
import { WagmiProvider, createConfig } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { avalancheFuji } from 'viem/chains';
import { http } from 'viem';
import { Container } from "../../../toolbox/components/Container";
import { Button } from "../../../components/Button";
import { Input } from "../../../components/Input";
import { useState } from "react";

// Warp Messenger precompile address
// const WARP_MESSENGER_ADDRESS = "0x0200000000000000000000000000000000000005";

// Create a component that doesn't include the providers
function WarpMessengerComponent() {
    const { 
        sendWarpMessage, 
        getVerifiedWarpMessage,
        getVerifiedWarpBlockHash,
        getBlockchainId 
    } = useWarpMessenger();

    const [isSendingMessage, setIsSendingMessage] = useState(false);
    const [messagePayload, setMessagePayload] = useState("");
    const [messageIndex, setMessageIndex] = useState("0");
    const [verifiedMessage, setVerifiedMessage] = useState<any>(null);
    const [verifiedBlockHash, setVerifiedBlockHash] = useState<any>(null);
    const [blockchainId, setBlockchainId] = useState<string | null>(null);

    const handleSendWarpMessage = async () => {
        if (!messagePayload) return;
        setIsSendingMessage(true);
        try {
            await sendWarpMessage(messagePayload);
        } catch (error) {
            console.error('Sending warp message failed:', error);
        } finally {
            setIsSendingMessage(false);
        }
    };

    const handleGetVerifiedMessage = async () => {
        try {
            const [message, valid] = await getVerifiedWarpMessage(43113, parseInt(messageIndex));
            if (valid) {
                setVerifiedMessage(message);
            }
        } catch (error) {
            console.error('Getting verified message failed:', error);
        }
    };

    const handleGetVerifiedBlockHash = async () => {
        try {
            const [blockHash, valid] = await getVerifiedWarpBlockHash(43113, parseInt(messageIndex));
            if (valid) {
                setVerifiedBlockHash(blockHash);
            }
        } catch (error) {
            console.error('Getting verified block hash failed:', error);
        }
    };

    const handleGetBlockchainId = async () => {
        try {
            const id = await getBlockchainId(43113);
            setBlockchainId(id);
        } catch (error) {
            console.error('Getting blockchain ID failed:', error);
        }
    };

    return (
        <RequireChain chain={avalancheFuji}>
            <div className="space-y-6">
                <Container
                    title="Send Warp Message"
                    description="Send a message to another L1 chain."
                >
                    <div className="space-y-4">
                        <Input
                            label="Message Payload"
                            value={messagePayload}
                            onChange={setMessagePayload}
                            placeholder="Enter message payload..."
                        />
                        <Button
                            onClick={handleSendWarpMessage}
                            loading={isSendingMessage}
                            variant="primary"
                        >
                            Send Warp Message
                        </Button>
                    </div>
                </Container>

                <Container
                    title="Verify Messages"
                    description="Verify and retrieve warp messages and block hashes."
                >
                    <div className="space-y-4">
                        <Input
                            label="Message Index"
                            value={messageIndex}
                            onChange={setMessageIndex}
                            type="number"
                            placeholder="Enter message index..."
                        />
                        <Button
                            onClick={handleGetVerifiedMessage}
                            variant="secondary"
                        >
                            Get Verified Message
                        </Button>
                        <Button
                            onClick={handleGetVerifiedBlockHash}
                            variant="secondary"
                        >
                            Get Verified Block Hash
                        </Button>
                        {verifiedMessage && (
                            <div className="mt-4 p-4 bg-gray-100 rounded">
                                <p>Verified Message:</p>
                                <pre>{JSON.stringify(verifiedMessage, null, 2)}</pre>
                            </div>
                        )}
                        {verifiedBlockHash && (
                            <div className="mt-4 p-4 bg-gray-100 rounded">
                                <p>Verified Block Hash:</p>
                                <pre>{JSON.stringify(verifiedBlockHash, null, 2)}</pre>
                            </div>
                        )}
                    </div>
                </Container>

                <Container
                    title="Blockchain Information"
                    description="Get the current blockchain ID."
                >
                    <div className="space-y-4">
                        <Button
                            onClick={handleGetBlockchainId}
                            variant="secondary"
                        >
                            Get Blockchain ID
                        </Button>
                        {blockchainId && (
                            <div className="mt-4">
                                <p>Blockchain ID: {blockchainId}</p>
                            </div>
                        )}
                    </div>
                </Container>
            </div>
        </RequireChain>
    );
}

// Create a wrapper component with the providers
export default function WarpMessenger() {
    // Create Wagmi config with type assertion to handle version mismatch
    const config = createConfig({
        chains: [avalancheFuji],
        transports: {
            [avalancheFuji.id]: http() as any,
        },
    } as any);

    // Create query client
    const queryClient = new QueryClient();

    return (
        <WagmiProvider config={config}>
            <QueryClientProvider client={queryClient}>
                <WarpMessengerComponent />
            </QueryClientProvider>
        </WagmiProvider>
    );
}
