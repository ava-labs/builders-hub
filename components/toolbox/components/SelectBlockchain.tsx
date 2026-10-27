'use client';

import SelectBlockchainId from './SelectBlockchainId';
import { useState, useCallback } from 'react';
import { useWalletStore } from '../stores/walletStore';
import { networkIDs } from '@avalabs/avalanchejs';
import { getBlockchainInfoForNetwork } from '../coreViem/utils/statsApi';

// API response type of the Stats API blockchain route (the Glacier shape)
type BlockchainApiResponse = {
  createBlockTimestamp: number;
  createBlockNumber: string;
  blockchainId: string;
  vmId: string;
  subnetId: string;
  blockchainName: string;
  evmChainId: number;
};

// Extended type with additional metadata
export type BlockchainInfo = BlockchainApiResponse & {
  isTestnet: boolean;
};

export type BlockchainSelection = {
  blockchainId: string;
  blockchain: BlockchainInfo | null;
};

// Import the unified details display component
import BlockchainDetailsDisplay from './BlockchainDetailsDisplay';

export default function SelectBlockchain({
  value,
  onChange,
  error,
  label = 'Select Avalanche Blockchain ID',
}: {
  value: string;
  onChange: (selection: BlockchainSelection) => void;
  error?: string | null;
  label?: string;
}) {
  const { avalancheNetworkID } = useWalletStore();
  const [blockchainDetails, setBlockchainDetails] = useState<Record<string, BlockchainInfo>>({});
  const [isLoading, setIsLoading] = useState(false);

  // Network names for API calls
  const networkNames: Record<number, 'mainnet' | 'fuji'> = {
    [networkIDs.MainnetID]: 'mainnet',
    [networkIDs.FujiID]: 'fuji',
  };

  // Fetch blockchain details when needed
  const fetchBlockchainDetails = useCallback(
    async (blockchainId: string) => {
      if (!blockchainId || blockchainDetails[blockchainId]) return;

      try {
        const network = networkNames[Number(avalancheNetworkID)];
        if (!network) return;

        setIsLoading(true);

        const blockchain: BlockchainApiResponse = await getBlockchainInfoForNetwork(network, blockchainId);

        setBlockchainDetails((prev) => ({
          ...prev,
          [blockchainId]: {
            ...blockchain,
            isTestnet: network === 'fuji',
          },
        }));
      } catch (error) {
        console.error(`Error fetching blockchain details for ${blockchainId}:`, error);
      } finally {
        setIsLoading(false);
      }
    },
    [avalancheNetworkID, networkNames, blockchainDetails],
  );

  // Handle value change and fetch details if needed
  const handleValueChange = useCallback(
    (newValue: string) => {
      if (newValue && !blockchainDetails[newValue]) {
        fetchBlockchainDetails(newValue);
      }

      onChange({
        blockchainId: newValue,
        blockchain: blockchainDetails[newValue] || null,
      });
    },
    [fetchBlockchainDetails, blockchainDetails, onChange],
  );

  // Get current blockchain details for display
  const currentBlockchain = value ? blockchainDetails[value] || null : null;
  const isLoadingCurrent = value && !blockchainDetails[value] && isLoading;

  return (
    <div>
      <SelectBlockchainId value={value} onChange={handleValueChange} error={error} label={label} />

      {/* Display blockchain details when a blockchain is selected */}
      {value && <BlockchainDetailsDisplay blockchain={currentBlockchain} isLoading={!!isLoadingCurrent} />}
    </div>
  );
}
