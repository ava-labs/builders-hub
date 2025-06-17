"use client"

import { Input, type Suggestion } from "./Input";
import { useL1ListStore } from "../stores/l1ListStore";
import { useCreateChainStore } from "../stores/createChainStore";
import { useMemo, useState, useCallback, useEffect } from "react";
import { utils } from "@avalabs/avalanchejs";
import { useAvaCloudSDK } from "../stores/useAvaCloudSDK";

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
    const createChainStoreSubnetId = useCreateChainStore()(state => state.subnetId);
    const { l1List } = useL1ListStore()();
    const { getSubnetById } = useAvaCloudSDK();

    const [validationError, setValidationError] = useState<string | null>(null);

    // Validate subnet ID format and checksum using Base58Check
    const validateBase58Format = (subnetId: string): boolean => {
        try {
            // Validate Base58Check format and checksum (last 4 bytes)
            utils.base58check.decode(subnetId);
            return true;
        } catch (error) {
            return false;
        }
    };

    // Validate subnet ID using AvaCloud SDK
    const validateSubnetId = useCallback(async (subnetId: string) => {
        if (!subnetId || subnetId.length < 10) {
            setValidationError(null);
            return;
        }

        // First validate Base58Check format and checksum
        if (!validateBase58Format(subnetId)) {
            setValidationError("Invalid subnet ID format or checksum");
            return;
        }

        try {
            setValidationError(null);

            await getSubnetById({ subnetId });

            // If we get here, the subnet exists
            setValidationError(null);
        } catch (error) {
            // Show validation error for invalid subnet IDs
            setValidationError("Subnet ID not found or invalid");
        }
    }, [getSubnetById]);

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