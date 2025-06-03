"use client"

import { Input, type Suggestion } from "./Input";
import { useMemo, useState, useCallback } from "react";
import { AvaCloudSDK } from "@avalabs/avacloud-sdk";
import { useWalletStore } from "../stores/walletStore";
import { networkIDs } from "@avalabs/avalanchejs";
import { GlobalParamNetwork, Subnet } from "@avalabs/avacloud-sdk/models/components";
import { useCreateChainStore } from "../stores/createChainStore";
import { useL1ListStore } from "../stores/l1ListStore";
import SubnetDetailsDisplay from "./SubnetDetailsDisplay";

export type SubnetSelection = {
    subnetId: string;
    subnet: Subnet | null;
}

export default function SelectSubnet({
    value,
    onChange,
    error,
    onlyNotConverted = false,
    hidePrimaryNetwork = false
}: {
    value: string,
    onChange: (selection: SubnetSelection) => void,
    error?: string | null,
    onlyNotConverted?: boolean,
    hidePrimaryNetwork?: boolean
}) {
    const { avalancheNetworkID } = useWalletStore();
    const createChainStoreSubnetId = useCreateChainStore()(state => state.subnetId);
    const l1List = useL1ListStore()(state => state.l1List);
    const [subnetDetails, setSubnetDetails] = useState<Record<string, Subnet>>({});
    const [isLoading, setIsLoading] = useState(false);

    // Network names for API calls
    const networkNames: Record<number, GlobalParamNetwork> = {
        [networkIDs.MainnetID]: "mainnet",
        [networkIDs.FujiID]: "fuji",
    };

    // Fetch subnet details when needed
    const fetchSubnetDetails = useCallback(async (subnetId: string) => {
        if (!subnetId || subnetDetails[subnetId]) return;

        try {
            const network = networkNames[Number(avalancheNetworkID)];
            if (!network) return;

            setIsLoading(true);
            const sdk = new AvaCloudSDK({
                serverURL: "https://api.avax.network",
                network: network,
            });

            const subnet = await sdk.data.primaryNetwork.getSubnetById({
                network: network,
                subnetId,
            });

            setSubnetDetails(prev => ({
                ...prev,
                [subnetId]: subnet
            }));
        } catch (error) {
            console.error(`Error fetching subnet details for ${subnetId}:`, error);
        } finally {
            setIsLoading(false);
        }
    }, [avalancheNetworkID, networkNames, subnetDetails]);

    // Generate suggestions from available subnets
    const subnetSuggestions: Suggestion[] = useMemo(() => {
        const result: Suggestion[] = [];
        const seen = new Set<string>();
        const PRIMARY_NETWORK_ID = "11111111111111111111111111111111LpoYY";

        // Add subnet from create chain store first
        if (createChainStoreSubnetId) {
            const subnet = subnetDetails[createChainStoreSubnetId];
            result.push({
                title: createChainStoreSubnetId,
                value: createChainStoreSubnetId,
                description: subnet ?
                    `${subnet.isL1 ? 'L1' : 'Subnet'} - Created in "Create Chain" tool` :
                    'The Subnet that you have just created in the "Create Chain" tool',
            });
            seen.add(createChainStoreSubnetId);
        }

        // Add subnets from L1 list
        for (const l1 of l1List) {
            const { subnetId, name, validatorManagerAddress } = l1;

            if (!subnetId || seen.has(subnetId)) continue;

            const isPrimary = subnetId === PRIMARY_NETWORK_ID;
            const isConverted = !!validatorManagerAddress;
            const subnet = subnetDetails[subnetId];

            if ((onlyNotConverted && (isPrimary || isConverted)) || (hidePrimaryNetwork && isPrimary)) {
                continue;
            }

            let description = l1.description || 'A chain that was added to your L1 list.';
            if (subnet) {
                const type = subnet.isL1 ? 'L1' : 'Subnet';
                const blockchainCount = subnet.blockchains?.length || 0;
                description = `${type} with ${blockchainCount} blockchain${blockchainCount !== 1 ? 's' : ''}`;
            }

            result.push({
                title: `${name} (${subnetId})`,
                value: subnetId,
                description,
            });

            seen.add(subnetId);
        }

        return result;
    }, [createChainStoreSubnetId, l1List, subnetDetails, onlyNotConverted, hidePrimaryNetwork]);

    // Handle value change and fetch details if needed
    const handleValueChange = useCallback((newValue: string) => {
        if (newValue && !subnetDetails[newValue]) {
            fetchSubnetDetails(newValue);
        }

        onChange({
            subnetId: newValue,
            subnet: subnetDetails[newValue] || null
        });
    }, [fetchSubnetDetails, subnetDetails, onChange]);

    // Get current subnet details for display
    const currentSubnet = value ? subnetDetails[value] || null : null;
    const isLoadingCurrent = value && !subnetDetails[value] && isLoading;

    return (
        <div>
            <Input
                id="subnet-input"
                label="Subnet"
                value={value}
                onChange={handleValueChange}
                suggestions={subnetSuggestions}
                error={error}
                placeholder={isLoading ? "Loading subnet details..." : "Enter subnet ID"}
            />

            {/* Display subnet details when a subnet is selected */}
            {value && <SubnetDetailsDisplay subnet={currentSubnet} isLoading={!!isLoadingCurrent} />}
        </div>
    );
} 