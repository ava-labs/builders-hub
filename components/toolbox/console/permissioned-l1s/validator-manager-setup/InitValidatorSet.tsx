"use client";

import { useEffect, useState } from 'react';
import { Step, Steps } from "fumadocs-ui/components/steps";

import { useSelectedL1 } from "@/components/toolbox/stores/l1ListStore";
import { useViemChainStore } from "@/components/toolbox/stores/toolboxStore";
import { useWalletStore } from "@/components/toolbox/stores/walletStore";
import { hexToBytes, decodeErrorResult, Abi } from 'viem';
import { packWarpIntoAccessList } from '../ValidatorManager/packWarp';
import ValidatorManagerABI from "@/contracts/icm-contracts/compiled/ValidatorManager.json";

import { Button } from "@/components/toolbox/components/Button";
import { Input } from "@/components/toolbox/components/Input";
import { utils } from '@avalabs/avalanchejs';
import { DynamicCodeBlock } from 'fumadocs-ui/components/dynamic-codeblock';
import { getSubnetInfo } from '@/components/toolbox/coreViem/utils/glacier';
import { useAvaCloudSDK } from "@/components/toolbox/stores/useAvaCloudSDK";
import { WalletRequirementsConfigKey } from "@/components/toolbox/hooks/useWalletRequirements";
import { BaseConsoleToolProps, ConsoleToolMetadata, withConsoleToolMetadata } from "../../../components/WithConsoleToolMetadata";
import { useConnectedWallet } from "@/components/toolbox/contexts/ConnectedWalletContext";
import useConsoleNotifications from "@/hooks/useConsoleNotifications";
import { generateConsoleToolGitHubUrl } from "@/components/toolbox/utils/github-url";

const cb58ToHex = (cb58: string) => utils.bufferToHex(utils.base58check.decode(cb58));
const add0x = (hex: string): `0x${string}` => hex.startsWith('0x') ? hex as `0x${string}` : `0x${hex}`;

const metadata: ConsoleToolMetadata = {
    title: "Initialize Validator Set",
    description: "Initialize the ValidatorManager contract with the initial validator set",
    toolRequirements: [
        WalletRequirementsConfigKey.EVMChainBalance
    ],
    githubUrl: generateConsoleToolGitHubUrl(import.meta.url)
};

function InitValidatorSet({ onSuccess }: BaseConsoleToolProps) {
    const [conversionTxID, setConversionTxID] = useState<string>("");
    const [L1ConversionSignature, setL1ConversionSignature] = useState<string>("");
    const viemChain = useViemChainStore();
    const { publicClient, walletEVMAddress } = useWalletStore();
    const { coreWalletClient } = useConnectedWallet();
    const { aggregateSignature } = useAvaCloudSDK();
    const [isInitializing, setIsInitializing] = useState(false);
    const [txHash, setTxHash] = useState<string | null>(null);
    const [simulationWentThrough, _] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [collectedData, setCollectedData] = useState<Record<string, any>>({});
    const [showDebugData, setShowDebugData] = useState(false);
    const selectedL1 = useSelectedL1()();
    const [conversionTxIDError, setConversionTxIDError] = useState<string>("");
    const [L1ConversionSignatureError, setL1ConversionSignatureError] = useState<string>("");
    const [isAggregating, setIsAggregating] = useState(false);

    const { sendCoreWalletNotSetNotification, notify } = useConsoleNotifications();

    async function aggSigs() {
        setL1ConversionSignatureError("");
        setIsAggregating(true);

        const aggPromise = (async () => {
            const { message, justification, signingSubnetId } = await coreWalletClient.extractWarpMessageFromPChainTx({ txId: conversionTxID });

            const { signedMessage } = await aggregateSignature({
                message: message,
                justification: justification,
                signingSubnetId: signingSubnetId,
                quorumPercentage: 67,
            });
            setL1ConversionSignature(signedMessage);
            return signedMessage;
        })();

        notify({
            type: 'local',
            name: 'Aggregate Signatures'
        }, aggPromise);

        try {
            await aggPromise;
        } finally {
            setIsAggregating(false);
        }
    }

    useEffect(() => {
        setConversionTxIDError("");
        const subnetId = selectedL1?.subnetId;
        if (!subnetId) return;
        getSubnetInfo(subnetId).then((subnetInfo) => {
            setConversionTxID(subnetInfo.l1ConversionTransactionHash);
        }).catch((error) => {
            console.error('Error getting subnet info:', error);
            setConversionTxIDError((error as Error)?.message || "Unknown error");
        });
    }, []);

    const onInitialize = async (debug: boolean = false) => {
        if (!conversionTxID) {
            setError("Conversion Tx ID is required");
            return;
        }
        const evmChainRpcUrl = selectedL1?.rpcUrl;
        if (!evmChainRpcUrl && debug) {
            setError('RPC endpoint is required for debug mode');
            return;
        }
        if (!coreWalletClient) {
            sendCoreWalletNotSetNotification();
            return;
        }

        setIsInitializing(true);
        setError(null);

        const initPromise = (async () => {
            const { validators, subnetId, chainId, managerAddress } = await coreWalletClient.extractWarpMessageFromPChainTx({ txId: conversionTxID });
            const txArgs = [
                {
                    subnetID: cb58ToHex(subnetId),
                    validatorManagerBlockchainID: cb58ToHex(chainId),
                    validatorManagerAddress: managerAddress as `0x${string}`,
                    initialValidators: validators
                        .map(({ nodeID, weight, signer }: { nodeID: string, weight: number, signer: { publicKey: string } }) => {
                            const nodeIDBytes = nodeID.startsWith('0x')
                                ? nodeID
                                : add0x(nodeID);
                            const blsPublicKeyBytes = signer.publicKey.startsWith('0x')
                                ? signer.publicKey
                                : add0x(signer.publicKey);
                            return {
                                nodeID: nodeIDBytes,
                                blsPublicKey: blsPublicKeyBytes,
                                weight: weight
                            };
                        })
                },
                0
            ];

            setCollectedData({ ...txArgs[0] as any, L1ConversionSignature });

            const signatureBytes = hexToBytes(add0x(L1ConversionSignature));
            const accessList = packWarpIntoAccessList(signatureBytes);

            const initPromise = coreWalletClient.writeContract({
                address: managerAddress as `0x${string}`,
                abi: ValidatorManagerABI.abi,
                functionName: 'initializeValidatorSet',
                args: txArgs,
                accessList,
                gas: BigInt(2_000_000),
                chain: viemChain || undefined,
                account: walletEVMAddress as `0x${string}`
            });

            notify({
                type: 'call',
                name: 'Initialize Validator Set'
            }, initPromise, viemChain ?? undefined);

            try {
                const hash = await initPromise;
                const receipt = await publicClient.waitForTransactionReceipt({ hash });

                if (receipt.status !== 'success') {
                    const decodedError = await debugTraceAndDecode(hash, evmChainRpcUrl!);
                    throw new Error(`Transaction failed: ${decodedError}`);
                }

                onSuccess?.();
                return hash;
            } catch (err) {
                setError((err as Error).message);
            } finally {
                setIsInitializing(false);
            }
        })();
    };

    return (
        <>
                <Steps>
                    <Step>
                        <h2 className="text-lg font-semibold">Step 1: Aggregate Signature of Conversion Data</h2>
                        <p>Enter the P-Chain Transaction ID of the ConvertSubnetToL1Tx of the L1 this Validator Manager it is for. It is needed to fetch the conversion data containing the initial validator set. This validator set will be set up in the validator manager contract so the consensus weight of these validators can be changed or they can be removed entirely if desired.</p>
                        <div className="space-y-4">
                            <Input
                                label="Conversion Tx ID"
                                value={conversionTxID}
                                onChange={setConversionTxID}
                                error={conversionTxIDError}
                            />
                            <Button disabled={!conversionTxID || !!L1ConversionSignature} onClick={() => aggSigs()} loading={isAggregating}>Aggregate</Button>
                        </div>
                    </Step>
                    <Step>
                        <h2 className="text-lg font-semibold">Step 2: Intialize the Validator Manager Contract State</h2>
                        With the aggregated signature, you can now initialize the Validator Manager contract state. This will set up the initial validator set and allow you to manage validators.
                        <Input
                            label="Aggregated Signature"
                            value={L1ConversionSignature}
                            onChange={setL1ConversionSignature}
                            type="textarea"
                            placeholder="0x...."
                            disabled={!conversionTxID}
                            error={L1ConversionSignatureError}
                        />
                        <Button
                            variant="primary"
                            onClick={() => onInitialize(false)}
                            loading={isInitializing}
                            disabled={!conversionTxID || !L1ConversionSignature}
                        >
                            Initialize Validator Set
                        </Button>
                    </Step>
                </Steps>

                {error && (
                    <div className="p-4 text-red-700 bg-red-100 rounded-md">
                        {error}
                    </div>
                )}

                {simulationWentThrough && !error && (
                    <div className="p-4 text-green-700 bg-green-100 rounded-md">
                        Transaction simulation successful
                    </div>
                )}

                {
                    Object.keys(collectedData).length > 0 && (
                        <div className="space-y-2">
                            <span onClick={() => setShowDebugData(!showDebugData)} className="cursor-pointer text-blue-500  hover:underline">{showDebugData ? "Hide" : "Show"} debug data</span>
                            {showDebugData && (
                                <DynamicCodeBlock lang="json" code={JSON.stringify(collectedData, null, 2)} />
                            )}
                        </div>
                    )
                }
        </>
    );
}

export default withConsoleToolMetadata(InitValidatorSet, metadata);


const debugTraceAndDecode = async (txHash: string, rpcEndpoint: string) => {
    const traceResponse = await fetch(rpcEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'debug_traceTransaction',
            params: [txHash, { tracer: 'callTracer' }],
            id: 1
        })
    });

    const trace = await traceResponse.json();

    // The error selector is in the output field
    const errorSelector = trace.result.output;
    if (errorSelector && errorSelector.startsWith('0x')) {
        try {
            // For this specific case, we got 0x6b2f19e9
            const errorResult = decodeErrorResult({
                abi: ValidatorManagerABI.abi as Abi,
                data: errorSelector
            });
            return `${errorResult.errorName}${errorResult.args ? ': ' + errorResult.args.join(', ') : ''}`;
        } catch (e: unknown) {
            console.error('Error decoding error result:', e);
            return 'Unknown error selector found in trace';
        }
    }
    return 'No error selector found in trace';
};
