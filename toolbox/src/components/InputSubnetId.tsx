"use client"

import { Input, type Suggestion } from "./Input";
import { useL1ListStore } from "../stores/l1ListStore";
import { useCreateChainStore } from "../stores/createChainStore";
import { useWalletStore } from "../stores/walletStore";
import { useMemo, useState, useCallback, useEffect } from "react";
import { AvaCloudSDK } from "@avalabs/avacloud-sdk";
import { networkIDs } from "@avalabs/avalanchejs";
import { GlobalParamNetwork } from "@avalabs/avacloud-sdk/models/components";

// Primary network subnet ID
const PRIMARY_NETWORK_SUBNET_ID = "11111111111111111111111111111111LpoYY";

export default function InputSubnetId({
    value,
    onChange,
    error,
    label = "Subnet ID",
    hidePrimaryNetwork = false,
    helperText,
    id
}: {
    value: string,
    onChange: (value: string) => void,
    error?: string | null,
    label?: string,
    hidePrimaryNetwork?: boolean
    helperText?: string | null
    id?: string
}) {
    const { avalancheNetworkID } = useWalletStore();
    const createChainStoreSubnetId = useCreateChainStore()(state => state.subnetId);
    const { l1List } = useL1ListStore()();

    const [validationError, setValidationError] = useState<string | null>(null);

    // Network names for API calls
    const networkNames: Record<number, GlobalParamNetwork> = {
        [networkIDs.MainnetID]: "mainnet",
        [networkIDs.FujiID]: "fuji",
    };

    // Validate subnet ID using AvaCloud SDK
    const validateSubnetId = useCallback(async (subnetId: string) => {
        if (!subnetId || subnetId.length < 10) {
            setValidationError(null);
            return;
        }

        try {
            setValidationError(null);

            const network = networkNames[Number(avalancheNetworkID)];
            if (!network) {
                setValidationError(null);
                return;
            }

            const sdk = new AvaCloudSDK({
                serverURL: "https://api.avax.network",
                network: network,
            });

            await sdk.data.primaryNetwork.getSubnetById({
                network: network,
                subnetId,
            });

            // If we get here, the subnet exists
            setValidationError(null);
        } catch (error) {
            // Show validation error for invalid subnet IDs
            setValidationError("Subnet ID not found or invalid");
        }
    }, [avalancheNetworkID, networkNames]);

    // Validate when value changes
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            if (value) {
                validateSubnetId(value);
            } else {
                setValidationError(null);
            }
        }, 500); // Debounce validation

        return () => clearTimeout(timeoutId);
    }, [value, validateSubnetId]);

    const subnetIdSuggestions: Suggestion[] = useMemo(() => {
        const result: Suggestion[] = [];
        const seen = new Set<string>();

        // Add subnet from create chain store first
        if (createChainStoreSubnetId && !(hidePrimaryNetwork && createChainStoreSubnetId === PRIMARY_NETWORK_SUBNET_ID)) {
            result.push({
                title: createChainStoreSubnetId,
                value: createChainStoreSubnetId,
                description: "The Subnet that you have just created in the \"Create Chain\" tool"
            });
            seen.add(createChainStoreSubnetId);
        }

        // Add subnets from L1 list
        for (const l1 of l1List) {
            const { subnetId, name } = l1;

            if (!subnetId || seen.has(subnetId)) continue;

            if (hidePrimaryNetwork && subnetId === PRIMARY_NETWORK_SUBNET_ID) {
                continue;
            }

            result.push({
                title: `${name} (${subnetId})`,
                value: subnetId,
                description: l1.description || "A subnet that was added to your L1 list.",
            });

            seen.add(subnetId);
        }

        return result;
    }, [createChainStoreSubnetId, l1List, hidePrimaryNetwork]);

    // Combine validation error with passed error
    const combinedError = error || validationError;

    return (
        <Input
            id={id}
            label={label}
            value={value}
            onChange={onChange}
            suggestions={subnetIdSuggestions}
            error={combinedError}
            helperText={helperText}
            placeholder="Enter subnet ID"
        />
    );
} 