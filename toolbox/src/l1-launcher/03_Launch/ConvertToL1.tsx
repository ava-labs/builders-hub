import { useEffect, useState } from 'react';
import { useL1LauncherStore } from '../L1LauncherStore';
import { useWalletStore } from '../../lib/walletStore';
import NextPrev from "../components/NextPrev";
import { CodeHighlighter } from '../../components/CodeHighlighter';
import { Textarea } from "../../components/TextArea";
import { PROXY_ADDRESS } from '../../components/genesis/genGenesis';
import { useErrorBoundary } from 'react-error-boundary';
import { ConvertToL1Params, ConvertToL1Validator } from '../../coreViem/methods/convertToL1';
import { Success } from '../../components/Success';
import { Button } from '../../components/Button';

export const INITIAL_VALIDATOR_WEIGHT = 100n;
const INITIAL_VALIDATOR_BALANCE = 10n ** 9n; // 1 AVAX on P chain

const popRequest = `curl -X POST --data '{ 
    "jsonrpc":"2.0", 
    "id"     :1, 
    "method" :"info.getNodeID" 
}' -H 'content-type:application/json;' 127.0.0.1:9650/ext/info`;

const validateNodePop = (json: string): boolean => {
    try {
        const parsed = JSON.parse(json);
        if (!parsed.result?.nodeID || !parsed.result?.nodePOP?.publicKey || !parsed.result?.nodePOP?.proofOfPossession) {
            return false;
        }

        // Validate nodeID is base58
        const base58Regex = /^NodeID-[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]+$/;
        if (!base58Regex.test(parsed.result.nodeID)) {
            return false;
        }

        // Validate publicKey and proofOfPossession are hex strings
        const hexRegex = /^0x[0-9a-fA-F]+$/;
        if (!hexRegex.test(parsed.result.nodePOP.publicKey) || !hexRegex.test(parsed.result.nodePOP.proofOfPossession)) {
            return false;
        }

        return true;
    } catch {
        return false;
    }
};

export default function ConvertToL1() {
    const {
        subnetId,
        chainId,
        nodesCount,
        setConversionId,
        conversionId,
        nodePopJsons,
        setNodePopJsons
    } = useL1LauncherStore();
    const { coreWalletClient, pChainAddress } = useWalletStore();

    const [isConverting, setIsConverting] = useState(false);
    const [errors, setErrors] = useState<string[]>(Array(nodesCount).fill(''));
    const { showBoundary } = useErrorBoundary()

    useEffect(() => {
        if (nodePopJsons.length > nodesCount) {
            setNodePopJsons(nodePopJsons.slice(0, nodesCount));
        } else if (nodePopJsons.length < nodesCount) {
            setNodePopJsons([...nodePopJsons, ...Array(nodesCount - nodePopJsons.length).fill('')]);
        }
    }, [nodesCount]);

    useEffect(() => {
        const newErrors = nodePopJsons.map(json => {
            if (!json) return '';
            return validateNodePop(json) ? '' : 'Invalid JSON format. Must contain nodeID and nodePOP fields';
        });
        setErrors(newErrors);
    }, [nodePopJsons]);


    const handleConvertToL1 = async () => {
        setIsConverting(true);
        setConversionId('');

        try {
            const validators: ConvertToL1Validator[] = [];

            // Parse node credentials from JSON responses
            for (let i = 0; i < nodesCount; i++) {
                if (!nodePopJsons[i]) {
                    throw new Error(`Node credentials for node ${i + 1} are missing`);
                }

                const { nodeID, nodePOP } = JSON.parse(nodePopJsons[i]).result;
                validators.push({
                    nodeID,
                    validatorWeight: INITIAL_VALIDATOR_WEIGHT,
                    validatorBalance: INITIAL_VALIDATOR_BALANCE,
                    remainingBalanceOwner: {
                        addresses: [pChainAddress],
                        threshold: 1
                    },
                    deactivationOwner: {
                        addresses: [pChainAddress],
                        threshold: 1
                    },
                    nodePOP: {
                        publicKey: nodePOP.publicKey,
                        proofOfPossession: nodePOP.proofOfPossession
                    }
                });
            }

            const params: ConvertToL1Params = {
                subnetId: subnetId,
                chainId: chainId,
                validators,
                managerAddress: PROXY_ADDRESS,
                subnetAuth: [0]
            }

            // Use the core wallet client to convert to L1
            const txID = await coreWalletClient.convertToL1(params);

            // Wait for transaction to be processed
            await new Promise(resolve => setTimeout(resolve, 5 * 1000));
            setConversionId(txID || '');

        } catch (error: any) {
            console.error('Failed to convert to L1', error);
            showBoundary(error);
        } finally {
            setIsConverting(false);
        }
    };

    const isFormValid = () => {
        return Array.isArray(nodePopJsons) &&
            nodePopJsons.slice(0, nodesCount).every(json => json && validateNodePop(json));
    };

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-2xl font-medium mb-4">Convert to L1</h1>
                <p>
                    The final step is to convert your subnet to an L1. This requires collecting node credentials and setting up the initial validators.
                </p>
            </div>

            <div className="space-y-4">
                <h2 className="text-xl font-medium">Node Credentials</h2>
                <p>
                    For each validator node, run this command to get the node credentials:
                </p>
                <CodeHighlighter lang="bash" code={popRequest} />

                <div className="space-y-6">
                    {Array.from({ length: nodesCount }).map((_, index) => (
                        <div key={index} className="space-y-2">
                            <Textarea
                                label={`Node ${index + 1} Credentials`}
                                error={errors[index]}
                                rows={4}
                                value={nodePopJsons[index] || ''}
                                onChange={(val: string) => {
                                    const newJsons = [...nodePopJsons];
                                    newJsons[index] = val;
                                    setNodePopJsons(newJsons);
                                }}
                                placeholder={`{"jsonrpc":"2.0","result":{"nodeID":"NodeID-....","nodePOP":{"publicKey":"0x...","proofOfPossession":"0x..."}},"id":1}`}
                            />
                        </div>
                    ))}
                </div>
            </div>

            <div className="space-y-4">
                <h2 className="text-xl font-medium">Convert to L1</h2>

                {!conversionId && (
                    <>
                        <p>
                            Convert your subnet to an L1 with the specified validators. All validators will have a weight of {INITIAL_VALIDATOR_WEIGHT}. The manager address will be set to {PROXY_ADDRESS}. Validators will have 1 month worth of AVAX in their balance.
                        </p>

                        <Button
                            onClick={handleConvertToL1}
                            disabled={isConverting || !isFormValid()}
                        >
                            {isConverting ? (
                                <span className="flex items-center gap-2">
                                    <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Converting to L1...
                                </span>
                            ) : 'Convert to L1'}
                        </Button>
                    </>
                )}

                <Success label="Conversion ID" value={conversionId} />
            </div>

            <NextPrev
                nextEnabled={!!conversionId}
            />
        </div >
    );
}
