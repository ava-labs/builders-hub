"use client"

import SelectSubnetId from "./SelectSubnetId";
import { useState, useCallback, useEffect } from "react";
import { Subnet } from "@avalabs/avacloud-sdk/models/components";
import BlockchainDetailsDisplay from "./BlockchainDetailsDisplay";
import { useAvalancheSDKChainkit } from "../stores/useAvalancheSDKChainkit";

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
    const { getSubnetById } = useAvalancheSDKChainkit();
    const [subnetDetails, setSubnetDetails] = useState<Record<string, Subnet>>({});
    const [isLoading, setIsLoading] = useState(false);

    // Fetch subnet details when needed
    const fetchSubnetDetails = useCallback(async (subnetId: string) => {
        if (!subnetId || subnetDetails[subnetId]) return;

        try {
            setIsLoading(true);
            const subnet = await getSubnetById({ subnetId });

            setSubnetDetails(prev => ({
                ...prev,
                [subnetId]: subnet
            }));

            // Automatically update the selection with the fetched subnet details
            onChange({
                subnetId,
                subnet
            });
        } catch (error) {
            console.error(`Error fetching subnet details for ${subnetId}:`, error);
        } finally {
            setIsLoading(false);
        }
    }, [getSubnetById, subnetDetails, onChange]);

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

    // Auto-fetch subnet details when component receives a pre-filled value
    useEffect(() => {
        if (value && !subnetDetails[value]) {
            fetchSubnetDetails(value);
        }
    }, [value, subnetDetails, fetchSubnetDetails]);

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
            {value && <BlockchainDetailsDisplay subnet={currentSubnet} isLoading={!!isLoadingCurrent} />}
        </div>
    );
} 