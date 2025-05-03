"use client";

import { useCreateChainStore } from "../toolboxStore";
import { useWalletStore } from "../../lib/walletStore";
import { useState } from "react";
import { Button } from "../../components/Button";
import { Input } from "../../components/Input";
import { type ConvertToL1Validator } from "../../components/ValidatorListInput";
import { useErrorBoundary } from "react-error-boundary";
import { Container } from "../components/Container";
import { ResultField } from "../components/ResultField";
import { ValidatorListInput } from "../../components/ValidatorListInput";
import SelectChainId from "../components/SelectChainId";
import SelectSubnetId from "../components/SelectSubnetId";

export default function ConvertToL1() {
    const {
        subnetId: storeSubnetId,
        chainID: storeChainID,
        managerAddress,
        setManagerAddress,
        convertToL1TxId,
        setConvertToL1TxId,
    } = useCreateChainStore()();

    const [subnetId, setSubnetId] = useState(storeSubnetId);
    const [chainID, setChainID] = useState(storeChainID);
    const [isConverting, setIsConverting] = useState(false);
    const [validators, setValidators] = useState<ConvertToL1Validator[]>([]);
    const { coreWalletClient, pChainAddress } = useWalletStore();
    const { showBoundary } = useErrorBoundary();

    async function handleConvertToL1() {
        setConvertToL1TxId("");
        setIsConverting(true);
        try {
            const txID = await coreWalletClient.convertToL1({
                managerAddress,
                subnetId: subnetId,
                chainId: chainID,
                subnetAuth: [0],
                validators
            });

            setConvertToL1TxId(txID);
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
                <SelectSubnetId
                    value={subnetId}
                    onChange={setSubnetId}
                    error={null}
                />
                <SelectChainId
                    value={chainID}
                    onChange={setChainID}
                    error={null}
                    label="Validator Manager Blockchain ID"
                />
                <Input
                    label="Validator Manager Contract Address (0x...)"
                    value={managerAddress}
                    onChange={setManagerAddress}
                    placeholder="0x..."
                    type="text"
                />
                
                <ValidatorListInput 
                    validators={validators}
                    onChange={setValidators}
                    defaultAddress={pChainAddress}
                    label="Initial Validators"
                    description="Add the validators that will form your L1 chain"
                />

                <Button
                    variant="primary"
                    onClick={handleConvertToL1}
                    disabled={!managerAddress || validators.length === 0}
                    loading={isConverting}
                >
                    Convert to L1
                </Button>
            </div>
            <ResultField
                label="Transaction ID"
                value={convertToL1TxId}
                showCheck={!!convertToL1TxId}
            />
        </Container>
    );
};
