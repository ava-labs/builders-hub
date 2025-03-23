"use client";

import { useState } from 'react';
import { useToolboxStore, useViemChainStore, useWalletStore } from "../../utils/store";
import { hexToBytes, decodeErrorResult, Abi } from 'viem';
import { packWarpIntoAccessList } from './packWarp';
import ValidatorManagerABI from "../../../../contracts/icm-contracts/compiled/ValidatorManager.json";
import { Button, Input } from "../../ui";
import { Success } from "../../ui/Success";
import { networkIDs, utils } from '@avalabs/avalanchejs';
import { RequireChainL1 } from '../../ui/RequireChain';
import { AvaCloudSDK } from "@avalabs/avacloud-sdk";
import { CodeHighlighter } from '../../ui/CodeHighlighter';

const cb58ToHex = (cb58: string) => utils.bufferToHex(utils.base58check.decode(cb58));
const add0x = (hex: string): `0x${string}` => hex.startsWith('0x') ? hex as `0x${string}` : `0x${hex}`;
export default function InitValidatorSet() {
    const {
        L1ID,
        setL1ID,
        setL1ConversionSignature,
        proxyAddress,
        evmChainRpcUrl } = useToolboxStore();
    const viemChain = useViemChainStore();
    const { coreWalletClient, publicClient } = useWalletStore();
    const [isInitializing, setIsInitializing] = useState(false);
    const [txHash, setTxHash] = useState<string | null>(null);
    const [simulationWentThrough, setSimulationWentThrough] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [collectedData, setCollectedData] = useState<Record<string, any>>({});
    const [showDebugData, setShowDebugData] = useState(false);

    const onInitialize = async (debug: boolean = false) => {
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

            const { validators, message, justification, signingSubnetId, networkId, chainId, managerAddress } = await coreWalletClient.extractWarpMessageFromPChainTx({ txId: L1ID });


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


            // Prepare transaction arguments
            const txArgs = [{
                subnetID: cb58ToHex(signingSubnetId),
                validatorManagerBlockchainID: cb58ToHex(chainId),
                validatorManagerAddress: managerAddress as `0x${string}`,
                initialValidators: validators
                    .map(({ nodeID, weight, signer }) => {
                        return {
                            nodeID: nodeID,
                            blsPublicKey: signer.publicKey,
                            weight: weight
                        };
                    })
            }, 0];


            setCollectedData({ ...txArgs[0] as any, signedMessage })


            // Convert signature to bytes and pack into access list
            const signatureBytes = hexToBytes(add0x(signedMessage));
            const accessList = packWarpIntoAccessList(signatureBytes);

            const sim = await publicClient.simulateContract({
                address: proxyAddress as `0x${string}`,
                abi: ValidatorManagerABI.abi,
                functionName: 'initializeValidatorSet',
                args: txArgs,
                accessList,
                gas: BigInt(1_000_000),
                // @ts-ignore TODO: after redefining simulateContract, should be gone
                chain: viemChain,
            });

            console.log("Simulated transaction:", sim);
            setSimulationWentThrough(true);

            // Send transaction
            const hash = await coreWalletClient.writeContract(sim.request);

            // Wait for transaction confirmation
            const receipt = await publicClient.waitForTransactionReceipt({ hash });

            if (receipt.status === 'success') {
                setTxHash(hash);
            } else {
                const decodedError = await debugTraceAndDecode(hash, evmChainRpcUrl);
                setError(`Transaction failed: ${decodedError}`);
            }

        } catch (error) {
            console.error('Transaction error:', error);
            setError(error instanceof Error ? error.message : 'An unknown error occurred');
        } finally {
            setIsInitializing(false);
        }
    };

    return (
        <RequireChainL1>
            <div className="space-y-4">
                <h2 className="text-lg font-semibold ">Initialize Validator Set</h2>

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
                        label="L1 ID"
                        value={L1ID}
                        onChange={setL1ID}
                        placeholder="Enter L1 ID (CB58 format)"
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
                    <Success
                        label="Transaction Successful"
                        value={txHash}
                    />
                )}

                <Button
                    type="primary"
                    onClick={() => onInitialize(false)}
                    loading={isInitializing}
                    disabled={!L1ID}
                >
                    Initialize Validator Set
                </Button>
            </div>
        </RequireChainL1>
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
            return `Unknown error selector: ${errorSelector}`;
        }
    }
    return 'No error selector found in trace';
};
