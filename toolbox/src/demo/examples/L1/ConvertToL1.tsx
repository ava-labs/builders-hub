"use client";

import { useToolboxStore, useWalletStore } from "../../utils/store";
import { useState } from "react";
import { Button } from "../../../components/button";
import { Input } from "../../../components/input";
import { type ConvertToL1Validator } from "../../../coreViem";
import { useErrorBoundary } from "react-error-boundary";
import { Container } from "../../../components/container";
import { ResultField } from "../../../components/result-field";
import { InputArray } from "../../ui/InputArray";
import { CodeHighlighter } from "../../ui/CodeHighlighter";
export default function ConvertToL1() {
    const {
        subnetID,
        chainID,
        setSubnetID,
        setChainID,
        nodePopJsons,
        setNodePopJsons,
        managerAddress,
        setManagerAddress,
        L1ID,
        setL1ID,
        validatorWeights,
        setValidatorWeights,
    } = useToolboxStore(state => state);
    const [isConverting, setIsConverting] = useState(false);
    const [validatorBalances, setValidatorBalances] = useState(Array(100).fill(BigInt(1000000000)) as bigint[]);
    const { coreWalletClient, pChainAddress } = useWalletStore();
    const { showBoundary } = useErrorBoundary();

    async function handleConvertToL1() {
        setL1ID("");
        setIsConverting(true);
        try {
            const validators: ConvertToL1Validator[] = [];

            for (let i = 0; i < nodePopJsons.length; i++) {
                const { nodeID, nodePOP } = JSON.parse(nodePopJsons[i]).result as { nodeID: string, nodePOP: { publicKey: string, proofOfPossession: string } };

                validators.push({
                    nodeID,
                    nodePOP,
                    validatorWeight: BigInt(validatorWeights[i]),
                    validatorBalance: validatorBalances[i],
                    remainingBalanceOwner: { addresses: [pChainAddress], threshold: 1 },
                    deactivationOwner: { addresses: [pChainAddress], threshold: 1 }
                });
            }

            const txID = await coreWalletClient.convertToL1({
                managerAddress,
                subnetId: subnetID,
                chainId: chainID,
                subnetAuth: [0],
                validators
            });

            setL1ID(txID);
        } catch (error) {
            showBoundary(error);
        } finally {
            setIsConverting(false);
        }
    }

    return (
        <Container
            title="Convert Subnet to L1"
            description="This will convert your subnet to an L1 chain."
        >
            <div className="space-y-4">
                <Input
                    label="Your P-Chain Address"
                    value={pChainAddress}
                    disabled={true}
                    type="text"
                />
                <Input
                    label="Subnet ID"
                    value={subnetID}
                    onChange={setSubnetID}
                    type="text"
                />
                <Input
                    label="Chain ID"
                    value={chainID}
                    onChange={setChainID}
                    type="text"
                />
                <Input
                    label="Manager Address (0x...)"
                    value={managerAddress}
                    onChange={setManagerAddress}
                    placeholder="0x..."
                    type="text"
                />
                <InputArray
                    label="Proofs of possession of the initial validators"
                    values={nodePopJsons}
                    onChange={setNodePopJsons}
                    type="textarea"
                    placeholder={'{"result":{"nodeID":"NodeID-7Xhw2mDxuDS44j42TCB6U5579esbSt3Lg","nodePOP":{"publicKey":"0x...","proofOfPossession":"0x..."}}}'}
                />
                <div className="text-sm">
                    Fetch node credentials:
                </div>
                <CodeHighlighter 
                code={`curl -X POST --data '{"jsonrpc":"2.0","id":1,"method":"info.getNodeID"}' -H "content-type:application/json;" 127.0.0.1:9650/ext/info`} 
                lang="bash" 
                />
                <InputArray
                    label="Validator Weights (in the same order as the validators)"
                    values={validatorWeights.map(weight => weight.toString()).slice(0, nodePopJsons.length)}
                    onChange={(weightsStrings) => setValidatorWeights(weightsStrings.map(weight => parseInt(weight)))}
                    type="number"
                    disableAddRemove={true}
                />
                <InputArray
                    label="Validator Balances (in the same order as the validators)"
                    values={validatorBalances.map(balance => balance.toString()).slice(0, nodePopJsons.length)}
                    onChange={(balancesStrings) => setValidatorBalances(balancesStrings.map(balance => BigInt(balance)))}
                    type="number"
                    disableAddRemove={true}
                />
                <Button
                    variant="primary"
                    onClick={handleConvertToL1}
                    disabled={!managerAddress || nodePopJsons.length === 0}
                    loading={isConverting}
                >
                    Convert to L1
                </Button>
            </div>
                <ResultField
                    label="Transaction ID"
                    value={L1ID}
                    showCheck={!!L1ID}
                />
        </Container>
    );
};
