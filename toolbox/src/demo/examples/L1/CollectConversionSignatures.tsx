"use client";

import { useToolboxStore, useWalletStore } from "../../utils/store";
import { useState } from "react";
import { networkIDs } from "@avalabs/avalanchejs";
import { Button, Input } from "../../ui";
import { AvaCloudSDK } from "@avalabs/avacloud-sdk";
import { CodeHighlighter } from "../../ui/CodeHighlighter";

export default function CollectConversionSignatures() {
    const {
        L1ConversionSignature,
        setL1ConversionSignature,
        L1ID,
        setL1ID,
    } = useToolboxStore(state => state);
    const { coreWalletClient } = useWalletStore();
    const [isConverting, setIsConverting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function handleConvertSignatures() {
        setL1ConversionSignature("");
        setError(null);
        setIsConverting(true);

        try {
            const { message, justification, signingSubnetId, networkId } = await coreWalletClient.extractWarpMessageFromPChainTx({ txId: L1ID });

            const { signedMessage } = await new AvaCloudSDK().data.signatureAggregator.aggregateSignatures({
                network: networkId === networkIDs.FujiID ? "fuji" : "mainnet",
                signatureAggregatorRequest: {
                    message: message,
                    justification: justification,
                    signingSubnetId: signingSubnetId,
                    quorumPercentage: 67, // Default threshold for subnet validation
                },
            }, {
                retries: {
                    strategy: "backoff",
                    backoff: { initialInterval: 1000, maxInterval: 10000, exponent: 1.5, maxElapsedTime: 30 * 1000 },
                }
            });

            setL1ConversionSignature(signedMessage);
        } catch (error) {
            setError((error as Error)?.message || String(error));
        } finally {
            setIsConverting(false);
        }
    }

    return (
        <div className="space-y-4">
            <h2 className="text-lg font-semibold ">Collect conversion signatures</h2>
            <div className="space-y-4">
                <Input
                    label="Conversion ID"
                    value={L1ID}
                    onChange={setL1ID}
                    type="text"
                    placeholder="Enter conversion ID"
                    notes={`Also called L1 ID. Transaction ID of the conversion transaction on the P-Chain.`}
                />
                <Button
                    type="primary"
                    onClick={handleConvertSignatures}
                    disabled={!L1ID}
                    loading={isConverting}
                >
                    Collect Signatures
                </Button>
                <Input
                    label="Aggregated Signature"
                    value={L1ConversionSignature}
                    onChange={setL1ConversionSignature}
                    type="textarea"
                    placeholder="0x...."
                />
                {error && (
                    <div className="space-y-4">
                        <div className="p-4 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-md text-red-700 dark:text-red-400">
                            <p className="font-medium mb-2">Failed to collect signatures. Please ensure:</p>
                            <ul className="list-disc pl-5">
                                <li>All validators for this subnet are up and running</li>
                                <li>Every node has a static IP and port 9651 open to external traffic</li>
                            </ul>
                            <p className="mt-4">If you're running this on a device without a dedicated public IP (e.g., laptop), try:</p>
                            <CodeHighlighter
                                code={`docker run -it --net=host --rm containerman17/local_agg:latest ${L1ID}`}
                                lang="bash"
                            />
                            <p className="text-sm text-gray-600 dark:text-gray-400">Paste the last line of its output into the signature field above.</p>
                        </div>

                    </div>
                )}
            </div>
        </div>
    );
};
