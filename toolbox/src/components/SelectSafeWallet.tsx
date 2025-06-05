import { Input, type Suggestion } from "./Input";
import { useMemo, useState, useEffect } from "react";
import { useWalletStore } from "../stores/walletStore";
import { useViemChainStore } from "../stores/toolboxStore";
import SafeApiKit from '@safe-global/api-kit';

export type SafeSelection = {
  safeAddress: string;
  threshold: number;
  owners: string[];
}

interface ChainConfig {
  chainId: string;
  chainName: string;
  transactionService: string;
  [key: string]: any;
}

/**
 * SelectSafeWallet Component
 * 
 * A component for selecting an Ash Wallet (Safe) address with integrated suggestions.
 * Automatically fetches Ash Wallet accounts owned by the current wallet address.
 * 
 * @example
 * // Basic usage
 * const [selection, setSelection] = useState<SafeSelection>({ 
 *   safeAddress: '', 
 *   threshold: 0, 
 *   owners: [] 
 * });
 * 
 * <SelectSafeWallet 
 *   value={selection.safeAddress}
 *   onChange={setSelection}
 * />
 * 
 * @example
 * // With error handling
 * <SelectSafeWallet
 *   value={selection.safeAddress}
 *   onChange={setSelection}
 *   error={safeAddressError}
 * />
 * 
 * @param props
 * @param props.value - Current Ash Wallet address value
 * @param props.onChange - Callback function that receives an object with safeAddress, threshold, and owners
 * @param props.error - Optional error message to display
 */
export default function SelectSafeWallet({ 
  value, 
  onChange, 
  error
}: { 
  value: string, 
  onChange: (selection: SafeSelection) => void, 
  error?: string | null
}) {
  const { walletEVMAddress } = useWalletStore();
  const viemChain = useViemChainStore();
  const [safes, setSafes] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [safeDetails, setSafeDetails] = useState<Record<string, SafeSelection>>({});

  const getSupportedChain = async (chainId: string): Promise<string> => {
    try {
      const response = await fetch('/api/safe_chains');
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      const supportedChain = data.results.find((chain: ChainConfig) => chain.chainId === chainId);
      if (!supportedChain) {
        throw new Error(`Chain ${chainId} is not supported for Ash Wallet operations`);
      }
      
      // Append /api to the transaction service URL if it doesn't already have it
      let txServiceUrl = supportedChain.transactionService;
      if (!txServiceUrl.endsWith('/api') && !txServiceUrl.includes('/api/')) {
        txServiceUrl = txServiceUrl.endsWith('/') ? txServiceUrl + 'api' : txServiceUrl + '/api';
      }
      
      return txServiceUrl;
    } catch (error) {
      throw new Error(`Failed to fetch supported chains: ${(error as Error).message}`);
    }
  };

  // Fetch Ash Wallet accounts from the API
  useEffect(() => {
    const fetchSafes = async () => {
      if (!walletEVMAddress || !viemChain) return;
      
      setIsLoading(true);
      try {
        // Check if chain is supported and get transaction service URL
        const txServiceUrl = await getSupportedChain(viemChain.id.toString());

        // Initialize Safe API Kit with the transaction service URL
        const apiKitInstance = new SafeApiKit({ 
          chainId: BigInt(viemChain.id),
          txServiceUrl: txServiceUrl
        });

        // Get Ash Wallet accounts owned by the current address
        const safesByOwner = await apiKitInstance.getSafesByOwner(walletEVMAddress);
        setSafes(safesByOwner.safes || []);

        // Fetch details for each Ash Wallet
        const details: Record<string, SafeSelection> = {};
        for (const safeAddress of safesByOwner.safes || []) {
          try {
            const safeInfo = await apiKitInstance.getSafeInfo(safeAddress);
            details[safeAddress] = {
              safeAddress,
              threshold: safeInfo.threshold,
              owners: safeInfo.owners
            };
          } catch (error) {
            console.warn(`Failed to fetch details for Ash Wallet ${safeAddress}:`, error);
          }
        }
        setSafeDetails(details);

      } catch (error) {
        console.error("Error fetching Ash Wallet accounts:", error);
        setSafes([]);
        setSafeDetails({});
      } finally {
        setIsLoading(false);
      }
    };

    fetchSafes();
  }, [walletEVMAddress, viemChain?.id]);

  const safeSuggestions: Suggestion[] = useMemo(() => {
    const result: Suggestion[] = [];

    for (const safeAddress of safes) {
      const details = safeDetails[safeAddress];
      if (details) {
        const isSelected = safeAddress === value;
        const ownersCount = details.owners.length;
        const threshold = details.threshold;
        
        result.push({
          title: `${safeAddress}${isSelected ? " ✓" : ""}`,
          value: safeAddress,
          description: `${threshold}/${ownersCount} multisig${isSelected ? " (Selected)" : ""}`
        });
      } else {
        // Fallback if details aren't loaded yet
        result.push({
          title: safeAddress,
          value: safeAddress,
          description: "Loading details..."
        });
      }
    }

    return result;
  }, [safes, safeDetails, value]);

  // Handle value change
  const handleValueChange = (newValue: string) => {
    const details = safeDetails[newValue];
    if (details) {
      onChange(details);
    } else {
      // If details aren't available yet, provide basic structure
      onChange({
        safeAddress: newValue,
        threshold: 0,
        owners: []
      });
    }
  };

  return <Input
    label="Ash Wallet Address"
    value={value}
    onChange={handleValueChange}
    suggestions={safeSuggestions}
    error={error}
    placeholder={isLoading ? "Loading Ash Wallet accounts..." : "Enter Ash Wallet address or select from your accounts"}
  />
} 