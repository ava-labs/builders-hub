"use client"

import SelectBlockchainId from "./SelectBlockchainId";
import { useState, useCallback } from "react";
import { getBlockchainInfo } from "../coreViem/utils/glacier";

export type BlockchainInfo = {
    createBlockTimestamp: number;
    createBlockNumber: string;
    blockchainId: string;
    vmId: string;
    subnetId: string;
    blockchainName: string;
    evmChainId: number;
    isTestnet: boolean;
}

export type BlockchainSelection = {
    blockchainId: string;
    blockchain: BlockchainInfo | null;
}

// Lazy import to avoid circular dependency
const BlockchainDetailsDisplay = ({ blockchain, isLoading }: { blockchain: BlockchainInfo | null, isLoading: boolean }) => {
    const Component = require("./BlockchainDetailsDisplay").default;
    return <Component blockchain={blockchain} isLoading={isLoading} />;
};

export default function SelectBlockchain({
    value,
    onChange,
    error,
    label = "Select Avalanche Blockchain ID"
}: {
    value: string,
    onChange: (selection: BlockchainSelection) => void,
    error?: string | null,
    label?: string
}) {
    const [blockchainDetails, setBlockchainDetails] = useState<Record<string, BlockchainInfo>>({});
    const [isLoading, setIsLoading] = useState(false);

    // Fetch blockchain details when needed
    const fetchBlockchainDetails = useCallback(async (blockchainId: string) => {
        if (!blockchainId || blockchainDetails[blockchainId]) return;

        try {
            setIsLoading(true);
            const blockchain = await getBlockchainInfo(blockchainId);

            setBlockchainDetails(prev => ({
                ...prev,
                [blockchainId]: blockchain
            }));
        } catch (error) {
            console.error(`Error fetching blockchain details for ${blockchainId}:`, error);
        } finally {
            setIsLoading(false);
        }
    }, [blockchainDetails]);

    // Handle value change and fetch details if needed
    const handleValueChange = useCallback((newValue: string) => {
        if (newValue && !blockchainDetails[newValue]) {
            fetchBlockchainDetails(newValue);
        }

        onChange({
            blockchainId: newValue,
            blockchain: blockchainDetails[newValue] || null
        });
    }, [fetchBlockchainDetails, blockchainDetails, onChange]);

    // Get current blockchain details for display
    const currentBlockchain = value ? blockchainDetails[value] || null : null;
    const isLoadingCurrent = value && !blockchainDetails[value] && isLoading;

    return (
        <div>
            <SelectBlockchainId
                value={value}
                onChange={handleValueChange}
                error={error}
                label={label}
            />

            {/* Display blockchain details when a blockchain is selected */}
            {value && <BlockchainDetailsDisplay blockchain={currentBlockchain} isLoading={!!isLoadingCurrent} />}
        </div>
    );
} 