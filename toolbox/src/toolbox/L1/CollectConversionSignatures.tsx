"use client";

import { useWalletStore } from "../../lib/walletStore";
import { useEffect, useState } from "react";
import { networkIDs } from "@avalabs/avalanchejs";
import { Button } from "../../components/Button";
import { AvaCloudSDK } from "@avalabs/avacloud-sdk";
import { CodeHighlighter } from "../../components/CodeHighlighter";
import { Container } from "../components/Container";
import { Input } from "../../components/Input";
import InputChainId from "../components/SelectChainId";
import { getBlockchainInfo, getSubnetInfo } from "../../coreViem/utils/glacier";
import { ResultField } from "../components/ResultField";

export default function CollectConversionSignatures() {
    const { coreWalletClient } = useWalletStore();
    const [isConverting, setIsConverting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [chainID, setChainID] = useState("");
    const [L1ConversionSignature, setL1ConversionSignature] = useState("");
    const [conversionID, setConversionID] = useState("");
    const [subnetId, setSubnetId] = useState("");
    const [chainIdError, setChainIdError] = useState<string | null>(null);

    useEffect(() => {
        async function fetchInfo() {
            try {
                setChainIdError(null);
                if (!chainID) return
                const chainInfo = await getBlockchainInfo(chainID);
                setSubnetId(chainInfo.subnetId);
                const subnetInfo = await getSubnetInfo(chainInfo.subnetId);
                setConversionID(subnetInfo.l1ConversionTransactionHash);
            } catch (error) {
                setChainIdError((error as Error).message);
            }
        }
        fetchInfo();
    }, [chainID]);


    async function handleConvertSignatures() {
        setL1ConversionSignature("");
        setError(null);
        setIsConverting(true);

        try {
            const { message, justification, signingSubnetId, networkId } = await coreWalletClient.extractWarpMessageFromPChainTx({ txId: conversionID });

            const { signedMessage } = await new AvaCloudSDK().data.signatureAggregator.aggregateSignatures({
                network: networkId === networkIDs.FujiID ? "fuji" : "mainnet",
                signatureAggregatorRequest: {
                    message: message,
                    justification: justification,
                    // signingSubnetId: signingSubnetId,
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
        <Container
            title="Collect conversion signatures"
            description="This will collect signatures from the subnet validators to convert the subnet to an L1 chain."
        >
            <div className="space-y-4">
                <InputChainId
                    value={chainID}
                    onChange={setChainID}
                    error={chainIdError}
                />
                <Input
                    label="Subnet ID"
                    value={subnetId}
                    disabled={true}
                />
                <Input
                    label="Conversion ID"
                    value={conversionID}
                    disabled={true}
                    type="text"
                    placeholder="Enter conversion ID"
                    helperText={`Also called L1 ID. Transaction ID of the conversion transaction on the P-Chain.`}
                />
                <Button
                    variant="primary"
                    onClick={handleConvertSignatures}
                    disabled={!conversionID}
                    loading={isConverting}
                >
                    Collect Signatures
                </Button>
                <ResultField
                    label="Aggregated Signature"
                    value={L1ConversionSignature}
                    showCheck={true}
                />
                {error && (
                    <div className="space-y-4">
                        <div className="p-4 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-md text-red-700 dark:text-red-400">
                            <p className="font-medium mb-2">Failed to collect signatures. Please ensure:</p>
                            <ul className="list-disc pl-5">
                                <li>All validators for this subnet are up and running. The initial P-Chain sync takes around 10 minutes.</li>
                                <li>Every node has a static IP and port 9651 open to external traffic</li>
                            </ul>
                            <p className="mt-4">If you're running this on a device without a dedicated public IP (e.g., laptop), try:</p>
                            <CodeHighlighter
                                code={`docker run -it --net=host --rm containerman17/local_agg:latest ${conversionID}`}
                                lang="bash"
                            />
                            <p className="text-sm text-gray-600 dark:text-gray-400">Paste the last line of its output into the signature field above.</p>
                            <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{error}</p>
                        </div>

                    </div>
                )}
            </div>
        </Container>
    );
};
