import { useState, useEffect } from 'react';
import { hexToBytes, AbiEvent, Abi, decodeErrorResult } from 'viem';
import { useWalletStore } from '../../../lib/walletStore';
import { useL1LauncherStore, useViemChainStore } from '../../L1LauncherStore';
import { utils } from '@avalabs/avalanchejs';
import { packWarpIntoAccessList } from '../../../toolbox/ValidatorManager/packWarp';
import { Success } from '../../../components/Success';
import { Button } from '../../../components/Button';
import { useErrorBoundary } from 'react-error-boundary';
import ValidatorManagerABI from '../../../../contracts/icm-contracts/compiled/ValidatorManager.json';
import { PROXY_ADDRESS } from '../../../components/genesis/genGenesis';
import { ExtractWarpMessageFromTxResponse } from '../../../coreViem/methods/extractWarpMessageFromPChainTx';

export default function ContractInitializeValidatorSet() {
    const { coreWalletClient, publicClient } = useWalletStore();
    const chain = useViemChainStore();
    const { conversionId, convertL1SignedWarpMessage } = useL1LauncherStore();
    const [initialCheckHasRun, setInitialCheckHasRun] = useState(false);
    const [initializedTxID, setInitializedTxID] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const { showBoundary } = useErrorBoundary();
    const [simulationPassed, setSimulationPassed] = useState(false);

    useEffect(() => {
        if (initialCheckHasRun) return;
        setInitialCheckHasRun(true);

        const checkInitialization = async () => {
            try {
                const initialValidatorEvent = ValidatorManagerABI.abi.find(
                    (item: any) => item.type === 'event' && item.name === 'RegisteredInitialValidator'
                ) as AbiEvent;

                if (!initialValidatorEvent) {
                    throw new Error('System error: InitialValidatorCreated event not found in ABI');
                }

                const logs = await publicClient.getLogs({
                    address: PROXY_ADDRESS,
                    event: initialValidatorEvent,
                    fromBlock: 'earliest',
                    toBlock: 'latest'
                });

                if (logs && logs.length > 0) {
                    setInitializedTxID(logs[0].transactionHash);
                }
            } catch (err) {
                showBoundary(err);
            }
        };

        checkInitialization();
    }, []);

    const debugTraceAndDecode = async (txHash: string) => {
        if (!chain) {
            throw new Error('No chain found');
        }
        const traceResponse = await fetch(chain.rpcUrls.default.http[0], {
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
        if (trace.error?.message) {
            return "Trace error: " + trace.error.message + ". Make sure you have debug&trace enabled on your RPC node.";
        }
        const errorSelector = trace.result.output;

        if (errorSelector && errorSelector.startsWith('0x')) {
            try {
                const errorResult = decodeErrorResult({
                    abi: ValidatorManagerABI.abi as Abi,
                    data: errorSelector
                });
                return `${errorResult.errorName}${errorResult.args ? ': ' + errorResult.args.join(', ') : ''}`;
            } catch (e) {
                return `Unknown error selector: ${errorSelector}`;
            }
        }
        return 'No error selector found in trace';
    };

    if (!chain) {
        return <div>Loading...</div>
    }

    const onInitialize = async () => {
        setIsLoading(true);
        try {
            const convertDecoded: ExtractWarpMessageFromTxResponse = await coreWalletClient.extractWarpMessageFromPChainTx({ txId: conversionId });
            console.log("convertDecoded", convertDecoded);
            const { validators, signingSubnetId, chainId, managerAddress } = convertDecoded

            if (!signingSubnetId) throw new Error("Sign subnet id not found");
            if (!chainId) throw new Error("Chain id not found");
            if (!managerAddress) throw new Error("Manager address not found");

            const txArgs = [{
                subnetID: utils.bufferToHex(utils.base58check.decode(signingSubnetId)),
                validatorManagerBlockchainID: utils.bufferToHex(utils.base58check.decode(chainId)),
                validatorManagerAddress: managerAddress as `0x${string}`,
                initialValidators: validators
                    .map(({ nodeID, weight, signer }: { nodeID: string, weight: number, signer: { publicKey: string } }) => ({
                        nodeID: nodeID,
                        blsPublicKey: signer.publicKey,
                        weight: weight
                    }))
            }, 0];

            const add0x = (hex: string): `0x${string}` => hex.startsWith('0x') ? hex as `0x${string}` : `0x${hex}`;
            const signatureBytes = hexToBytes(add0x(convertL1SignedWarpMessage));
            const accessList = packWarpIntoAccessList(signatureBytes);

            const sim = await publicClient.simulateContract({
                address: PROXY_ADDRESS,
                abi: ValidatorManagerABI.abi,
                functionName: 'initializeValidatorSet',
                args: txArgs,
                accessList,
                gas: BigInt(1_000_000),
                chain: chain,
            });

            console.log("sim", JSON.stringify(sim, (_, v) => typeof v === 'bigint' ? v.toString() : v, 2));

            setSimulationPassed(true);

            console.log("sim", sim);

            const hash = await coreWalletClient.writeContract(sim.request);
            const receipt = await publicClient.waitForTransactionReceipt({ hash });

            if (receipt.status === 'success' && receipt.logs.length > 0) {
                setInitializedTxID(hash);
            } else {
                const revertReason = await debugTraceAndDecode(hash);
                throw new Error(`Transaction reverted: ${revertReason}`);
            }
        } catch (err) {
            showBoundary(err);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="pb-2 mb-4">
            <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium dark:text-white">Call initializeValidatorSet in PoA Validator Manager</h3>
            </div>

            {simulationPassed && !initializedTxID && (
                <span>Simulation passed</span>
            )}

            <Success label="Validator set initialized successfully" value={initializedTxID || ""} />

            {!initializedTxID && (
                <Button
                    onClick={onInitialize}
                    disabled={isLoading || !convertL1SignedWarpMessage}
                >
                    {isLoading ? 'Initializing...' : 'Initialize Validator Set'}
                </Button>
            )}
        </div>
    );
} 
