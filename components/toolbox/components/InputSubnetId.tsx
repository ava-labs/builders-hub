"use client"

import { Input, type Suggestion } from "./Input";
import { useL1ListStore } from "../stores/l1ListStore";
import { useCreateChainStore } from "../stores/createChainStore";
import { useMemo, useState, useCallback, useEffect } from "react";
import { utils } from "@avalabs/avalanchejs";
import { getSubnetInfo } from "../coreViem/utils/glacier";

// Primary network subnet ID
export const PRIMARY_NETWORK_SUBNET_ID = "11111111111111111111111111111111LpoYY";

export default function InputSubnetId({
    value,
    onChange,
    error,
    label = "Subnet ID",
    hidePrimaryNetwork = true,
    helperText,
    id,
    validationDelayMs = 500,
    readOnly = false,
    hideSuggestions = false,
    placeholder
}: {
    value: string,
    onChange: (value: string) => void,
    error?: string | null,
    label?: string,
    hidePrimaryNetwork?: boolean
    helperText?: string | null
    id?: string
    validationDelayMs?: number
    readOnly?: boolean
    hideSuggestions?: boolean
    placeholder?: string
}) {
    const createChainStoreSubnetId = useCreateChainStore()(state => state.subnetId);
    const { l1List } = useL1ListStore()();

    const [validationError, setValidationError] = useState<string | null>(null);

    // Base58 character set (excludes 0, O, I, l)
    const BASE58_CHARS = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

    // Validate subnet ID format and checksum using Base58Check with detailed errors
    const validateBase58Format = (subnetId: string): { valid: boolean; error?: string } => {
        // Check for invalid characters first
        const invalidChars: string[] = [];
        for (const char of subnetId) {
            if (!BASE58_CHARS.includes(char)) {
                invalidChars.push(char);
            }
        }

        if (invalidChars.length > 0) {
            const uniqueInvalid = [...new Set(invalidChars)].join(', ');
            // Provide specific guidance for common mistakes
            if (invalidChars.includes('0') || invalidChars.includes('O')) {
                return {
                    valid: false,
                    error: `Invalid characters: ${uniqueInvalid}. Note: Base58 uses "o" (lowercase) instead of "0" (zero) or "O" (capital O).`
                };
            }
            if (invalidChars.includes('I') || invalidChars.includes('l')) {
                return {
                    valid: false,
                    error: `Invalid characters: ${uniqueInvalid}. Note: Base58 uses "L" (capital) instead of "l" (lowercase L) or "I" (capital i).`
                };
            }
            return {
                valid: false,
                error: `Invalid characters in subnet ID: ${uniqueInvalid}. Subnet IDs use Base58 encoding.`
            };
        }

        // Check length
        if (subnetId.length < 40 || subnetId.length > 60) {
            return {
                valid: false,
                error: `Invalid length (${subnetId.length} chars). Subnet IDs are typically 43-50 characters.`
            };
        }

        // Validate checksum using avalanchejs
        try {
            utils.base58check.decode(subnetId);
            return { valid: true };
        } catch (error) {
            return {
                valid: false,
                error: "Invalid checksum. Please verify the subnet ID is correct and complete."
            };
        }
    };

    // Validate subnet ID using Glacier API (same as BlockchainDetailsDisplay)
    const validateSubnetId = useCallback(async (subnetId: string) => {
        if (!subnetId || subnetId.length < 10) {
            setValidationError(null);
            return;
        }

        // First validate Base58Check format and checksum with detailed errors
        const formatValidation = validateBase58Format(subnetId);
        if (!formatValidation.valid) {
            setValidationError(formatValidation.error || "Invalid subnet ID format");
            return;
        }

        try {
            setValidationError(null);

            await getSubnetInfo(subnetId);

            // If we get here, the subnet exists
            setValidationError(null);
        } catch (error) {
            // Show validation error for invalid subnet IDs
            setValidationError("Subnet ID not found on the network. Please verify it exists and try again.");
        }
    }, []);

    // Validate when value changes
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            if (value) {
                validateSubnetId(value);
            } else {
                setValidationError(null);
            }
        }, validationDelayMs); // Wait for subnet to be available before validation

        return () => clearTimeout(timeoutId);
    }, [value, validateSubnetId, validationDelayMs]);

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
            suggestions={readOnly || hideSuggestions ? [] : subnetIdSuggestions}
            error={combinedError}
            helperText={helperText}
            placeholder={
                readOnly
                    ? "Automatically filled from Blockchain ID"
                    : placeholder || "Enter subnet ID"
            }
            disabled={readOnly}
        />
    );
} 