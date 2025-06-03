"use client"

import SelectSubnetId from "./SelectSubnetId";
import { useState, useCallback } from "react";
import { AvaCloudSDK } from "@avalabs/avacloud-sdk";
import { useWalletStore } from "../stores/walletStore";
import { networkIDs } from "@avalabs/avalanchejs";
import { GlobalParamNetwork, Subnet } from "@avalabs/avacloud-sdk/models/components";
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
            <SelectSubnetId
                id="subnet-input"
                label="Subnet"
                value={value}
                onChange={handleValueChange}
                error={error}
                onlyNotConverted={onlyNotConverted}
                hidePrimaryNetwork={hidePrimaryNetwork}
                helperText={isLoading ? "Loading subnet details..." : undefined}
            />

            {/* Display subnet details when a subnet is selected */}
            {value && <SubnetDetailsDisplay subnet={currentSubnet} isLoading={!!isLoadingCurrent} />}
        </div>
    );
} 