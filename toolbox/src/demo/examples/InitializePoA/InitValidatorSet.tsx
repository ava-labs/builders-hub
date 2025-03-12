"use client";

import { useState } from 'react';
import { useExampleStore } from "../../utils/store";
import { createWalletClient, custom, createPublicClient, hexToBytes, decodeErrorResult, Abi } from 'viem';
import { packWarpIntoAccessList } from './packWarp';
import ValidatorManagerABI from "../../../../contracts/icm-contracts/compiled/ValidatorManager.json";
import { Button, Input, InputArray } from "../../ui";
import { Success } from "../../ui/Success";
import { utils } from '@avalabs/avalanchejs';


const cb58ToHex = (cb58: string) => utils.bufferToHex(utils.base58check.decode(cb58));
const add0x = (hex: string): `0x${string}` => hex.startsWith('0x') ? hex as `0x${string}` : `0x${hex}`;
export default function InitValidatorSet() {
    const {
        subnetID,
        setSubnetID,
        chainID,
        setChainID,
        walletChainId,
        nodePopJsons,
        setNodePopJsons,
        L1ConversionSignature,
        setL1ConversionSignature,
        proxyAddress,
        setProxyAddress,
        evmChainRpcUrl,
        setEvmChainRpcUrl,
        walletEVMAddress,
        validatorWeights,
        setValidatorWeights
    } = useExampleStore();

    const [isInitializing, setIsInitializing] = useState(false);
    const [txHash, setTxHash] = useState<string | null>(null);
    const [simulationWentThrough, setSimulationWentThrough] = useState(false);
    const [error, setError] = useState<string | null>(null);

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
            // Prepare transaction arguments
            const txArgs = [{
                subnetID: cb58ToHex(subnetID),
                validatorManagerBlockchainID: cb58ToHex(chainID),
                validatorManagerAddress: proxyAddress as `0x${string}`,
                initialValidators: nodePopJsons
                    .map((json, index) => {
                        const node = JSON.parse(json).result;
                        return {
                            nodeID: cb58ToHex(node.nodeID.split('-')[1]),
                            blsPublicKey: node.nodePOP.publicKey,
                            weight: validatorWeights[index]
                        };
                    })
            }, 0];

            // Debug log the transaction arguments
            console.log('Transaction Arguments:', txArgs);

            // Convert signature to bytes and pack into access list
            const signatureBytes = hexToBytes(add0x(L1ConversionSignature));
            const accessList = packWarpIntoAccessList(signatureBytes);


            const walletClient = createWalletClient({
                transport: custom(window.avalanche)
            });
            const from = walletEVMAddress as `0x${string}`

            const publicClient = createPublicClient({
                transport: custom(window.avalanche)
            });

            const sim = await publicClient.simulateContract({
                address: proxyAddress as `0x${string}`,
                abi: ValidatorManagerABI.abi,
                functionName: 'initializeValidatorSet',
                args: txArgs,
                accessList,
                account: from,
                gas: BigInt(1_000_000),
                chain: {
                    id: walletChainId,
                    name: "My L1",
                    rpcUrls: {
                        default: { http: [] },
                    },
                    nativeCurrency: {
                        name: "COIN",
                        symbol: "COIN",
                        decimals: 18,
                    },
                },
            });

            console.log("Simulated transaction:", sim);
            setSimulationWentThrough(true);

            // Send transaction
            const hash = await walletClient.writeContract(sim.request);

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
                    label="Chain ID"
                    value={chainID}
                    onChange={setChainID}
                    placeholder="Enter chain ID (CB58 format)"
                />
                <Input
                    label="Subnet ID"
                    value={subnetID}
                    onChange={setSubnetID}
                    placeholder="Enter subnet ID (CB58 format)"
                />
                <Input
                    label="RPC Endpoint (optional for debugging)"
                    value={evmChainRpcUrl}
                    onChange={setEvmChainRpcUrl}
                    placeholder="Enter RPC endpoint"
                />

                <Input
                    label="Proxy Address"
                    value={proxyAddress}
                    onChange={setProxyAddress}
                    placeholder="0x..."
                />

                <InputArray
                    label="Info.getNodeID responses of the initial validators"
                    values={nodePopJsons}
                    onChange={setNodePopJsons}
                    type="textarea"
                    placeholder={'{"result":{"nodeID":"NodeID-7Xhw2mDxuDS44j42TCB6U5579esbSt3Lg","nodePOP":{"publicKey":"0x...","proofOfPossession":"0x..."}}}'}
                    rows={4}
                />
                <div className="text-sm ">
                    Type in terminal: <span className="font-mono block">{`curl -X POST --data '{"jsonrpc":"2.0","id":1,"method":"info.getNodeID"}' -H "content-type:application/json;" 127.0.0.1:9650/ext/info`}</span>
                </div>

                <InputArray
                    label="Validator Weights"
                    values={validatorWeights.map(weight => weight.toString()).slice(0, nodePopJsons.length)}
                    onChange={(weightsStrings) => setValidatorWeights(weightsStrings.map(weight => parseInt(weight)))}
                    type="number"
                    disableAddRemove={true}
                />

                <Input
                    label="L1 Conversion Signature"
                    value={L1ConversionSignature}
                    onChange={setL1ConversionSignature}
                    placeholder="Enter L1 conversion signature (hex)"
                    type="textarea"
                    rows={5}
                />
            </div>

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
                disabled={!L1ConversionSignature || isInitializing || !proxyAddress || !chainID}
            >
                Initialize Validator Set
            </Button>
        </div>
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
