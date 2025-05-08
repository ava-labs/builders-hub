"use client";

import { useEffect, useState } from 'react';
import { useSelectedL1, useViemChainStore } from "../toolboxStore";
import { useWalletStore } from "../../lib/walletStore";
import { hexToBytes, decodeErrorResult, Abi } from 'viem';
import { packWarpIntoAccessList } from './packWarp';
import ValidatorManagerABI from "../../../contracts/icm-contracts/compiled/ValidatorManager.json";

import { Button } from "../../components/Button";
import { Input } from "../../components/Input";
import { networkIDs, utils } from '@avalabs/avalanchejs';
import { CodeHighlighter } from '../../components/CodeHighlighter';
import { Container } from '../components/Container';
import { ResultField } from '../components/ResultField';
import { AvaCloudSDK } from "@avalabs/avacloud-sdk";
import { getSubnetInfo } from '../../coreViem/utils/glacier';

const cb58ToHex = (cb58: string) => utils.bufferToHex(utils.base58check.decode(cb58));
const add0x = (hex: string): `0x${string}` => hex.startsWith('0x') ? hex as `0x${string}` : `0x${hex}`;
export default function InitValidatorSet() {
    const [conversionTxID, setConversionTxID] = useState<string>("");
    const [L1ConversionSignature, setL1ConversionSignature] = useState<string>("");
    const viemChain = useViemChainStore();
    const { coreWalletClient, publicClient } = useWalletStore();
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

    async function aggSigs() {
        setL1ConversionSignatureError("");
        setIsAggregating(true);
        try {
            const { message, justification, signingSubnetId, networkId } = await coreWalletClient.extractWarpMessageFromPChainTx({ txId: conversionTxID });

            const { signedMessage } = await new AvaCloudSDK().data.signatureAggregator.aggregateSignatures({
                network: networkId === networkIDs.FujiID ? "fuji" : "mainnet",
                signatureAggregatorRequest: {
                    message: message,
                    justification: justification,
                    signingSubnetId: signingSubnetId,
                    quorumPercentage: 67, // Default threshold for subnet validation
                },
            });
            setL1ConversionSignature(signedMessage);
        } catch (error) {
            console.error('Error aggregating signatures:', error);
            setL1ConversionSignatureError((error as Error)?.message || "Unknown error");
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
        if (!window.avalanche) {
            setError('MetaMask (Avalanche wallet) is not installed');
            return;
        }

        setIsInitializing(true);
        setError(null);
        try {
            if (!coreWalletClient) throw new Error('Core wallet client not found');

            const { validators, subnetId, chainId, managerAddress } = await coreWalletClient.extractWarpMessageFromPChainTx({ txId: conversionTxID });
            // Prepare transaction arguments
            const txArgs = [
                {
                    subnetID: cb58ToHex(subnetId),
                    validatorManagerBlockchainID: cb58ToHex(chainId),
                    validatorManagerAddress: managerAddress as `0x${string}`,
                    initialValidators: validators
                        .map(({ nodeID, weight, signer }: { nodeID: string, weight: number, signer: { publicKey: string } }) => {
                            // Ensure nodeID and blsPublicKey are properly formatted
                            // If nodeID is in BinTools format, convert to hex
                            const nodeIDBytes = nodeID.startsWith('0x')
                                ? nodeID
                                : add0x(nodeID);

                            // If blsPublicKey is in BinTools format, convert to hex
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
                0 // messageIndex parameter
            ];


            setCollectedData({ ...txArgs[0] as any, L1ConversionSignature })

            // Convert signature to bytes and pack into access list
            const signatureBytes = hexToBytes(add0x(L1ConversionSignature));
            const accessList = packWarpIntoAccessList(signatureBytes);

            // FIXME: for whatever reason, viem simulation does not work consistently, so we just send the transaction
            const hash = await coreWalletClient.writeContract({
                address: managerAddress as `0x${string}`,
                abi: ValidatorManagerABI.abi,
                functionName: 'initializeValidatorSet',
                args: txArgs,
                accessList,
                gas: BigInt(1_000_000),
                chain: viemChain || undefined,
            });

            // console.log("Simulated transaction:", sim);
            // setSimulationWentThrough(true);

            // console.log("sim", JSON.stringify(sim, (_, v) => typeof v === 'bigint' ? v.toString() : v, 2));


            // Send transaction
            // const hash = await coreWalletClient.writeContract(sim.request);

            // Wait for transaction confirmation
            const receipt = await publicClient.waitForTransactionReceipt({ hash });

            if (receipt.status === 'success') {
                setTxHash(hash);
            } else {
                const decodedError = await debugTraceAndDecode(hash, evmChainRpcUrl!);
                setError(`Transaction failed: ${decodedError}`);
            }

        } catch (error) {
            console.error('Transaction error:', error);
            // More detailed error logging
            if (error instanceof Error) {
                console.error('Error details:', {
                    message: error.message,
                    stack: error.stack,
                    name: error.name
                });
                // Parse the error message to be more user-friendly
                let errorMessage = error.message;
                if (errorMessage.includes('Cannot read properties of undefined')) {
                    errorMessage = 'Contract function call failed. This may be due to an invalid argument format or missing required parameters.';
                }
                setError(errorMessage);
            } else {
                setError('An unknown error occurred');
            }
        } finally {
            setIsInitializing(false);
        }
    };

    return (

        <Container
            title="Initialize Validator Set"
            description="This will initialize the ValidatorManager contract."
        >
            <div className="space-y-4">

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

                <div className="space-y-4">
                    <Input
                        label="Conversion Tx ID"
                        value={conversionTxID}
                        onChange={setConversionTxID}
                        error={conversionTxIDError}
                    />
                    <Input
                        label="Aggregated Signature"
                        value={L1ConversionSignature}
                        onChange={setL1ConversionSignature}
                        type="textarea"
                        placeholder="0x...."
                        disabled={!conversionTxID}
                        button={<Button stickLeft disabled={!conversionTxID || !!L1ConversionSignature} onClick={() => aggSigs()} loading={isAggregating}>Aggregate</Button>}
                        error={L1ConversionSignatureError}
                    />
                </div>

                {
                    Object.keys(collectedData).length > 0 && (
                        <div className="space-y-2">
                            <span onClick={() => setShowDebugData(!showDebugData)} className="cursor-pointer text-blue-500  hover:underline">{showDebugData ? "Hide" : "Show"} debug data</span>
                            {showDebugData && (
                                <CodeHighlighter code={JSON.stringify(collectedData, null, 2)} lang="json" />
                            )}
                        </div>
                    )
                }

                {txHash && (
                    <ResultField
                        label="Transaction Successful"
                        value={txHash}
                        showCheck={true}
                    />
                )}

                <Button
                    variant="primary"
                    onClick={() => onInitialize(false)}
                    loading={isInitializing}
                    disabled={!conversionTxID || !L1ConversionSignature}
                >
                    Initialize Validator Set
                </Button>
            </div>
        </Container>

    );
}


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
