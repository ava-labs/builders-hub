"use client";

import { useCreateChainStore, EVM_VM_ID } from "../toolboxStore";
import { useErrorBoundary } from "react-error-boundary";
import { useEffect, useState } from "react";
import { Button } from "../../components/Button";
import { Input } from "../../components/Input";
import { Container } from "../components/Container";
import { GenesisInput } from "../components/GenesisInput";
import { ResultField } from "../components/ResultField";
import { quickAndDirtyGenesisBuilder } from "./GenesisBuilder";
import { useWalletStore } from "../../lib/walletStore";

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
        setGenesisData,
        evmChainId,
        gasLimit,
        targetBlockRate,
        setChainName,
    } = useCreateChainStore()();
    const [isCreating, setIsCreating] = useState(false);
    const { walletEVMAddress, coreWalletClient } = useWalletStore();

    useEffect(() => {
        if (!genesisData) {
            setGenesisData(quickAndDirtyGenesisBuilder(
                walletEVMAddress,
                evmChainId,
                gasLimit,
                targetBlockRate,
                "1000000", // Default owner balance
                {
                    contractDeployerAllowList: {
                        enabled: false,
                        adminAddresses: [],
                        enabledAddresses: []
                    },
                    contractNativeMinter: {
                        enabled: false,
                        adminAddresses: [],
                        enabledAddresses: []
                    },
                    txAllowList: {
                        enabled: false,
                        adminAddresses: [],
                        enabledAddresses: []
                    },
                    feeManager: {
                        enabled: false,
                        adminAddresses: []
                    },
                    rewardManager: {
                        enabled: false,
                        adminAddresses: []
                    },
                    warpMessenger: {
                        enabled: true,
                        quorumNumerator: 67,
                        requirePrimaryNetworkSigners: true
                    }
                }
            ));
        }
    }, [walletEVMAddress, evmChainId, gasLimit, targetBlockRate, genesisData, setGenesisData]);

    function handleCreateChain() {
        setChainID("");
        setIsCreating(true);

        coreWalletClient.createChain({
            chainName: chainName,
            subnetId: subnetId,
            vmId,
            fxIds: [],
            genesisData,
            subnetAuth: [0],
        }).then((txID: string) => {
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
                helperText={`Default is ${EVM_VM_ID}`}
            />

            <GenesisInput label="Genesis Data (JSON)" value={genesisData} onChange={setGenesisData} />

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
