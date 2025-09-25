"use client";

import { useState, useEffect } from "react";
import { networkIDs } from "@avalabs/avalanchejs";
import { getBlockchainInfo, getSubnetInfo } from "@/components/toolbox/coreViem/utils/glacier";
import InputSubnetId from "@/components/toolbox/components/InputSubnetId";
import BlockchainDetailsDisplay from "@/components/toolbox/components/BlockchainDetailsDisplay";
import { Button } from "@/components/toolbox/components/Button";

interface CreateNodeFormProps {
    onClose: () => void;
    onSubmit: (subnetId: string, blockchainId: string) => void;
    onError: (title: string, message: string, isLoginError?: boolean) => void;
    avalancheNetworkID: number;
    isRegistering: boolean;
}

export default function CreateNodeForm({ onClose, onSubmit, onError, avalancheNetworkID, isRegistering }: CreateNodeFormProps) {
    const [subnetId, setSubnetId] = useState("");
    const [subnet, setSubnet] = useState<any>(null);
    const [blockchainInfo, setBlockchainInfo] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [subnetIdError, setSubnetIdError] = useState<string | null>(null);
    const [selectedBlockchainId, setSelectedBlockchainId] = useState<string>("");

    useEffect(() => {
        setSubnetIdError(null);
        setSubnet(null);
        setBlockchainInfo(null);
        setSelectedBlockchainId("");
        if (!subnetId) return;

        const abortController = new AbortController();
        setIsLoading(true);

        const loadSubnetData = async () => {
            try {
                const subnetInfo = await getSubnetInfo(subnetId, abortController.signal);
                if (abortController.signal.aborted) return;

                setSubnet(subnetInfo);

                if (subnetInfo.blockchains && subnetInfo.blockchains.length > 0) {
                    const blockchainId = subnetInfo.blockchains[0].blockchainId;
                    setSelectedBlockchainId(blockchainId);

                    try {
                        const chainInfo = await getBlockchainInfo(blockchainId, abortController.signal);
                        if (abortController.signal.aborted) return;
                        setBlockchainInfo(chainInfo);
                    } catch (error) {
                        if (!abortController.signal.aborted) {
                            setSubnetIdError((error as Error).message);
                        }
                    }
                }
            } catch (error) {
                if (!abortController.signal.aborted) {
                    setSubnetIdError((error as Error).message);
                }
            } finally {
                if (!abortController.signal.aborted) {
                    setIsLoading(false);
                }
            }
        };

        loadSubnetData();
        return () => abortController.abort();
    }, [subnetId]);

    const handleCreateNode = () => {
        if (!subnetId) {
            onError("Missing Information", "Please enter a subnet ID first");
            return;
        }
        if (!selectedBlockchainId) {
            onError("Missing Information", "No blockchain found for this subnet");
            return;
        }
        onSubmit(subnetId, selectedBlockchainId);
    };

    return (
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-6 mb-6 not-prose">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold">Create New Node</h3>
                <Button
                    onClick={onClose}
                    variant="outline"
                    size="sm"
                    className="!w-auto"
                >
                    Cancel
                </Button>
            </div>
            <p className="mb-4">Enter the Subnet ID of the blockchain you want to create a node for.</p>

            <InputSubnetId
                value={subnetId}
                onChange={setSubnetId}
                error={subnetIdError}
            />

            {subnet && subnet.blockchains && subnet.blockchains.length > 0 && (
                <div className="space-y-4 mt-4">
                    {subnet.blockchains.map((blockchain: { blockchainId: string; blockchainName: string; createBlockTimestamp: number; createBlockNumber: string; vmId: string; subnetId: string; evmChainId: number }) => (
                        <BlockchainDetailsDisplay
                            key={blockchain.blockchainId}
                            blockchain={{
                                ...blockchain,
                                isTestnet: avalancheNetworkID === networkIDs.FujiID
                            }}
                            isLoading={isLoading}
                            customTitle={`${blockchain.blockchainName} Blockchain Details`}
                        />
                    ))}
                </div>
            )}

            {subnetId && blockchainInfo && (
                <Button
                    onClick={handleCreateNode}
                    loading={isRegistering}
                    className="mt-4 !w-auto"
                >
                    Create Node
                </Button>
            )}
        </div>
    );
}
