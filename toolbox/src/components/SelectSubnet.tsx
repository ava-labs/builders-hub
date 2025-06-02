"use client"

import { Input, type Suggestion } from "./Input";
import { useMemo, useState, useEffect } from "react";
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
    const [fetchedSubnets, setFetchedSubnets] = useState<Set<string>>(new Set());

    // Network names for API calls
    const networkNames: Record<number, GlobalParamNetwork> = {
        [networkIDs.MainnetID]: "mainnet",
        [networkIDs.FujiID]: "fuji",
    };

    // Fetch subnet details when needed
    const fetchSubnetDetails = async (subnetId: string) => {
        if (!subnetId || fetchedSubnets.has(subnetId)) return;

        try {
            const network = networkNames[Number(avalancheNetworkID)];
            if (!network) return;

            setIsLoading(true);
            const subnet = await new AvaCloudSDK().data.primaryNetwork.getSubnetById({
                network: network,
                subnetId,
            });

            console.log('Raw subnet data from SDK:', JSON.stringify(subnet, null, 2));

            setSubnetDetails(prev => ({
                ...prev,
                [subnetId]: subnet
            }));
            setFetchedSubnets(prev => new Set([...prev, subnetId]));
        } catch (error) {
            console.error(`Error fetching subnet details for ${subnetId}:`, error);
        } finally {
            setIsLoading(false);
        }
    };

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

    // Fetch details for suggested subnets when they become available
    useEffect(() => {
        const subnetIds = subnetSuggestions.map(s => s.value);
        subnetIds.forEach(id => {
            if (!fetchedSubnets.has(id)) {
                fetchSubnetDetails(id);
            }
        });
    }, [subnetSuggestions, fetchedSubnets, avalancheNetworkID]);

    // Handle value change and fetch details if needed
    const handleValueChange = (newValue: string) => {
        // Fetch details for the new value if we don't have them
        if (newValue && !fetchedSubnets.has(newValue)) {
            fetchSubnetDetails(newValue);
        }

        // Return both the subnet ID and the subnet details (if available)
        onChange({
            subnetId: newValue,
            subnet: subnetDetails[newValue] || null
        });
    };

    // Get current subnet details for display
    const currentSubnet = value ? subnetDetails[value] || null : null;
    const isLoadingCurrent = value && !fetchedSubnets.has(value) && isLoading;

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