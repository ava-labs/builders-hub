"use client";

import { useState, useEffect } from "react";
import { networkIDs } from "@avalabs/avalanchejs";
import { getBlockchainInfo, getSubnetInfo } from "@/components/toolbox/coreViem/utils/glacier";
import InputSubnetId from "@/components/toolbox/components/InputSubnetId";
import BlockchainDetailsDisplay from "@/components/toolbox/components/BlockchainDetailsDisplay";
import { Button } from "@/components/toolbox/components/Button";
import { RegisterSubnetResponse } from "@/components/toolbox/console/testnet-infra/ManagedTestnetNodes/types";

interface CreateNodeFormProps {
    onClose: () => void;
    onRegister: (response: RegisterSubnetResponse) => void;
    onError: (title: string, message: string, isLoginError?: boolean) => void;
    avalancheNetworkID: number;
}

export default function CreateNodeForm({ onClose, onRegister, onError, avalancheNetworkID }: CreateNodeFormProps) {
    const [subnetId, setSubnetId] = useState("");
    const [subnet, setSubnet] = useState<any>(null);
    const [blockchainInfo, setBlockchainInfo] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [subnetIdError, setSubnetIdError] = useState<string | null>(null);
    const [isRegistering, setIsRegistering] = useState(false);
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

    const handleRegisterSubnet = async () => {
        if (!subnetId) {
            onError("Missing Information", "Please select a subnet ID first");
            return;
        }

        setIsRegistering(true);

        try {
            const response = await fetch('/api/managed-testnet-nodes', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    subnetId: subnetId,
                    blockchainId: selectedBlockchainId
                })
            });

            const data = await response.json();

            if (!response.ok) {
                if (response.status === 429) {
                    throw new Error(data.message || data.error || "Rate limit exceeded. Please try again later.");
                }
                throw new Error(data.message || data.error || `Error ${response.status}: Failed to register subnet`);
            }

            if (data.error) {
                throw new Error(data.message || data.error || 'Registration failed');
            }

            if (data.builder_hub_response) {
                console.log('Builder Hub registration successful:', data.builder_hub_response);
                onRegister(data.builder_hub_response);
            } else {
                throw new Error('Unexpected response format');
            }
        } catch (error) {
            console.error("Builder Hub registration error:", error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

            // Check for authentication errors
            if (errorMessage.includes('Authentication required') || errorMessage.includes('401')) {
                onError("Authentication Required", "Please sign in to create Builder Hub nodes. Use the login button above to authenticate.", true);
            } else {
                onError("Registration Failed", errorMessage);
            }
        } finally {
            setIsRegistering(false);
        }
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
                    onClick={handleRegisterSubnet}
                    loading={isRegistering}
                    className="mt-4 !w-auto"
                >
                    Create Node
                </Button>
            )}
        </div>
    );
}
