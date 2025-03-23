"use client";

import { initialState, useToolboxStore, useWalletStore } from "../../utils/store";
import { useErrorBoundary } from "react-error-boundary";
import { useEffect, useState } from "react";
import { Button, Input, Container, GenesisInput, ResultField } from "../../../components";
import { quickAndDirtyGenesisBuilder } from "./GenesisBuilder";

export default function CreateChain() {
    const { showBoundary } = useErrorBoundary();
    const {
        subnetID,
        evmChainName,
        vmId,
        setVmId,
        chainID,
        setChainID,
        setSubnetID,
        genesisData,
        setGenesisData,
        evmChainId,
        gasLimit,
        targetBlockRate,
        setEvmChainName,
    } = useToolboxStore();
    const [isCreating, setIsCreating] = useState(false);
    const { walletEVMAddress, coreWalletClient, pChainAddress } = useWalletStore();

    useEffect(() => {
        if (!genesisData) {
            setGenesisData(quickAndDirtyGenesisBuilder(walletEVMAddress, evmChainId, gasLimit, targetBlockRate));
        }
    }, [walletEVMAddress, evmChainId, gasLimit, targetBlockRate]);

    function handleCreateChain() {
        setChainID("");
        setIsCreating(true);

        coreWalletClient.createChain({
            chainName: evmChainName,
            subnetId: subnetID,
            vmId,
            fxIds: [],
            genesisData,
            subnetAuth: [0],
        }).then(txID => {
            setChainID(txID);
            setIsCreating(false);
        }).catch(showBoundary);
    }

    if (!genesisData) {
        return (
            <div className="space-y-4">
                <h2 className="text-lg font-semibold ">Create Chain</h2>
                <div className="flex items-center bg-amber-50 border border-amber-300 rounded-md p-3 text-amber-800">
                    <span className="mr-2">⚠️</span>
                    Please generate genesis data first using
                    <a href="#genesisBuilder" className="text-amber-800 hover:text-amber-900 underline ml-1">
                        the Genesis Builder tool
                    </a>.
                </div>
            </div>
        );
    }

    return (
        <Container
            title="Create Chain"
            description="Create a new blockchain on your subnet with custom parameters and genesis data."
        >
            <Input label="Your P-Chain Address" value={pChainAddress} disabled />

            <Input
                label="Chain Name"
                value={evmChainName}
                onChange={setEvmChainName}
                placeholder="Enter chain name"
            />

            <Input
                label="Subnet ID"
                value={subnetID}
                type="text"
                onChange={setSubnetID}
                placeholder="Create a subnet to generate a subnet ID"
            />

            <Input
                label="VM ID"
                value={vmId}
                onChange={setVmId}
                placeholder="Enter VM ID"
                helperText={`Default is ${initialState.vmId}`}
            />

            <GenesisInput label="Genesis Data (JSON)" value={genesisData} onChange={setGenesisData} />

            <div className="text-sm text-zinc-600 dark:text-zinc-400">
                Auto-generated for address 0xC8EA6E24567310104a5d3b5d9ab6Ca414987885
            </div>

            <div className="text-sm text-zinc-600 dark:text-zinc-400">
                Open the{" "}
                <a href="https://build.avax.network/tools/l1-toolbox#genesisBuilder" className="text-primary hover:text-primary/80 dark:text-primary/90 dark:hover:text-primary/70">
                    Genesis Builder tool
                </a>{" "}
                to generate custom genesis data.
            </div>

            <Button onClick={handleCreateChain}
                loading={isCreating} loadingText="Creating Chain...">
                Create Chain
            </Button>

            {chainID && <ResultField label="Chain ID:" value={chainID} showCheck />}
        </Container>
    );
};
