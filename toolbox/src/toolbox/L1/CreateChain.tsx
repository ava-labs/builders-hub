"use client";

import { useCreateChainStore, EVM_VM_ID } from "../toolboxStore";
import { useErrorBoundary } from "react-error-boundary";
import { useState } from "react";
import { Button } from "../../components/Button";
import { Input } from "../../components/Input";
import { Container } from "../components/Container";
import { ResultField } from "../components/ResultField";
import { useWalletStore } from "../../lib/walletStore";
import GenesisBuilder from "./GenesisBuilder";


export default function CreateChain() {
    const { showBoundary } = useErrorBoundary();
    const {
        subnetId,
        chainName,
        vmId,
        setVmId,
        chainID,
        setChainID,
        setSubnetID,
        genesisData,
        setChainName,
    } = useCreateChainStore()();
    const [localGenesisData, setLocalGenesisData] = useState<string>(genesisData);
    const [isCreating, setIsCreating] = useState(false);
    const { coreWalletClient } = useWalletStore();

    function handleCreateChain() {
        setChainID("");
        setIsCreating(true);

        coreWalletClient.createChain({
            chainName: chainName,
            subnetId: subnetId,
            vmId,
            fxIds: [],
            genesisData: localGenesisData,
            subnetAuth: [0],
        }).then((txID: string) => {
            setChainID(txID);
            setIsCreating(false);
        }).catch(showBoundary);
    }

    return (
        <Container
            title="Create Chain"
            description="Create a new blockchain on your subnet with custom parameters and genesis data."
        >
            <Input
                label="Chain Name"
                value={chainName}
                onChange={setChainName}
                placeholder="Enter chain name"
            />

            <Input
                label="Subnet ID"
                value={subnetId}
                type="text"
                onChange={setSubnetID}
                placeholder="Create a subnet to generate a subnet ID"
            />

            <Input
                label="VM ID"
                value={vmId}
                onChange={setVmId}
                placeholder="Enter VM ID"
                helperText={`For an L1 with an uncustomized EVM use ${EVM_VM_ID}`}
            />

            <GenesisBuilder genesisData={localGenesisData} setGenesisData={setLocalGenesisData} />

            <Button onClick={handleCreateChain}
                loading={isCreating} loadingText="Creating Chain...">
                Create Chain
            </Button>

            {chainID && <ResultField label="Chain ID:" value={chainID} showCheck />}
        </Container>
    );
};
