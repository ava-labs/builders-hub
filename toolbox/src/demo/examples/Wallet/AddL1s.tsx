"use client";

import { useEffect, useState } from "react";
import { useErrorBoundary } from "react-error-boundary";
import { AlertCircle, Search } from "lucide-react";
import { Button } from "../../../components/button";
import { Container } from "../../../components/container";
import { Select } from "../../ui/Select";
import { CoreWalletChain } from "../../../coreViem/overrides/addChain";
import { useWalletStore } from "../../utils/store";
import { AvaCloudSDK } from "@avalabs/avacloud-sdk";
import { ChainInfo } from "@avalabs/avacloud-sdk/models/components";

const sdk = new AvaCloudSDK();

export default function AddL1s() {
  const { showBoundary } = useErrorBoundary();
  const { 
    walletChainId, 
    setWalletChainId, 
    coreWalletClient, 
  } = useWalletStore();
  
  const [chains, setChains] = useState<ChainInfo[]>([]);
  const [filteredChains, setFilteredChains] = useState<ChainInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [networkType, setNetworkType] = useState<string>("mainnet");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [addingChainId, setAddingChainId] = useState<string | null>(null);
  const [selectedChain, setSelectedChain] = useState<ChainInfo | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  useEffect(() => {
    fetchChains();
  }, [networkType]);

  async function fetchChains() {
    setIsLoading(true);
    setError(null);
    try {
      // Use AvaCloudSDK to get chains
      const result = await sdk.data.evm.chains.supportedChains({
        network: networkType as "mainnet" | "testnet"
      });
      
      const chainsData = result.chains;
      
      if (chainsData && chainsData.length > 0) {
        setChains(chainsData);
      } else {
        setChains([]);
        setError("No chains found for this network type");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch chains");
      console.error("Error fetching chains:", err);
      setChains([]);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredChains(chains);
    } else {
      const term = searchTerm.toLowerCase();
      const filtered = chains.filter(chain => 
        chain.chainName.toLowerCase().includes(term) || 
        chain.networkToken.symbol.toLowerCase().includes(term)
      );
      setFilteredChains(filtered);
    }
  }, [chains, searchTerm]);

  // Copy to clipboard function
  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text).then(
      () => {
        setCopiedField(field);
        setTimeout(() => setCopiedField(null), 2000);
      },
      (err) => {
        console.error('Could not copy text: ', err);
      }
    );
  };

  async function switchToChain(chainId: string) {
    try {
      // Convert decimal chainId to hex for wallet_switchEthereumChain
      const chainIdHex = `0x${parseInt(chainId).toString(16)}`;
      const chainIdNum = parseInt(chainId);

      try {
        // Use the switchChain method if available, otherwise fall back to request
        if (coreWalletClient.switchChain) {
          await coreWalletClient.switchChain({ id: chainIdNum });
        } else {
          await coreWalletClient.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: chainIdHex }],
          });
        }

        // After switching, update the chain ID in our state
        const newChainId = await coreWalletClient.getChainId();
        setWalletChainId(Number(newChainId));
        
        return true;
      } catch (error: any) {
        // Check if the error is because the chain has not been added yet
        if (error.code === 4902) {
          return false;
        }
        throw error;
      }
    } catch (error) {
      showBoundary(error);
      return false;
    }
  }

  async function handleAddToWallet(chain: ChainInfo) {
    setAddingChainId(chain.chainId);
    try {
      // First try to just switch to the chain, in case it's already added
      const switched = await switchToChain(chain.chainId).catch(() => false);
      
      // If switching was successful, we're done
      if (switched) {
        // Close the modal if it was open
        setSelectedChain(null);
        return;
      }

      // Create a CoreWalletChain object
      const coreWalletChain: CoreWalletChain = {
        id: Number(chain.chainId),
        name: chain.chainName,
        nativeCurrency: {
          name: chain.networkToken.name,
          symbol: chain.networkToken.symbol,
          decimals: chain.networkToken.decimals,
        },
        rpcUrls: {
          default: {
            http: [chain.rpcUrl],
            webSocket: chain.wsUrl ? [chain.wsUrl] : undefined,
          },
        },
        blockExplorers: chain.explorerUrl ? {
          default: {
            name: `${chain.chainName} Explorer`,
            url: chain.explorerUrl,
          },
        } : undefined,
        isTestnet: chain.isTestnet
      };

      await coreWalletClient.addChain({ chain: coreWalletChain });

      // Then try to switch to the newly added chain
      await switchToChain(chain.chainId).catch((switchError) => {
        console.warn("Error switching chain, but chain was added successfully:", switchError);
      });
      
      // Close the modal if it was open
      setSelectedChain(null);
    } catch (error) {
      showBoundary(error);
    } finally {
      setAddingChainId(null);
    }
  }

  const handleNetworkTypeChange = (value: string | number) => {
    setNetworkType(value.toString());
  };

  // Function to show chain details modal
  const openChainDetails = (chain: ChainInfo) => {
    setSelectedChain(chain);
  };

  // Function to close the chain details modal
  const closeChainDetails = () => {
    setSelectedChain(null);
  };

  // Utility function to abbreviate long strings
  const abbreviateString = (str: string, startChars = 6, endChars = 4) => {
    if (!str || str.length <= startChars + endChars + 3) return str;
    return `${str.substring(0, startChars)}...${str.substring(str.length - endChars)}`;
  };

  // Updated utility function to truncate strings in the middle if needed
  const truncateMiddle = (str: string, maxLength = 40) => {
    if (!str || str.length <= maxLength) return str;
    
    // Calculate how many characters to show at the beginning and end
    // For very long strings, we want to show more at both ends
    const halfLength = Math.floor((maxLength - 3) / 2); // -3 for the ellipsis
    
    // For platform chain IDs and subnet IDs, we want to show more characters
    if (str.length > 50) {
      return `${str.substring(0, 25)}...${str.substring(str.length - 25)}`;
    }
    
    return `${str.substring(0, maxLength - halfLength - 3)}...${str.substring(str.length - halfLength)}`;
  };

  // Component for copyable field
  const CopyableField = ({ label, value, fieldId }: { label: string, value: string, fieldId: string }) => {
    if (!value) return null;
    
    // Determine if the field should use special display based on field type
    const isSpecialId = fieldId === 'platformChainId' || fieldId === 'subnetId';
    // URLs should be displayed in full
    const isUrl = fieldId === 'rpcUrl' || fieldId === 'wsUrl' || label.includes('URL');
    // Token names should be handled differently
    const isTokenName = fieldId === 'name' || label === 'Name';
    
    // Select appropriate display method based on field type
    let displayValue = value;
    if (isUrl) {
      // Display URLs in full without truncation
      displayValue = value;
    } else if (isSpecialId) {
      displayValue = truncateMiddle(value, 60);
    } else if (isTokenName && value.length > 20) {
      displayValue = value.substring(0, 20) + '...';
    } else if (value.length > 25) {
      displayValue = abbreviateString(value, 10, 6);
    }
    
    return (
      <div className="flex flex-col mb-3 gap-1">
        <div className="text-gray-500 font-medium">{label}:</div>
        <div className="w-full">
          <div 
            className="group flex items-stretch cursor-pointer rounded-md overflow-hidden border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-500 transition-colors duration-150 w-full"
            onClick={() => copyToClipboard(value, fieldId)}
            title={`Click to copy: ${value}`}
          >
            <div className="px-3 py-2 bg-white dark:bg-gray-800 flex-1 min-w-0">
              <span className="block text-sm break-all">{displayValue}</span>
            </div>
            <div className={`flex items-center justify-center px-3 bg-gray-50 dark:bg-gray-700 group-hover:bg-blue-50 dark:group-hover:bg-blue-900/30 transition-colors duration-150 border-l border-gray-200 dark:border-gray-700 ${copiedField === fieldId ? 'text-green-500' : 'text-gray-400 group-hover:text-blue-500 dark:text-gray-400 dark:group-hover:text-blue-400'}`}>
              {copiedField === fieldId ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Non-copyable field component for consistent styling
  const Field = ({ label, value }: { label: string, value: string | number | boolean }) => {
    if (value === undefined || value === null) return null;
    
    // Handle long text values
    const displayValue = typeof value === 'string' && value.length > 25 
      ? value.substring(0, 25) + '...' 
      : value.toString();
    
    return (
      <div className="flex flex-col mb-3 gap-1">
        <div className="text-gray-500 font-medium">{label}:</div>
        <div className="w-full">
          <div className="px-3 py-2 rounded-md bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 w-full overflow-hidden text-ellipsis text-sm" title={value.toString()}>
            {displayValue}
          </div>
        </div>
      </div>
    );
  };

  // URL field with link component
  const UrlField = ({ label, url }: { label: string, url: string }) => {
    if (!url) return null;
    
    // Show the full URL without abbreviation
    const displayUrl = url;
    
    return (
      <div className="flex flex-col mb-3 gap-1">
        <div className="text-gray-500 font-medium">{label}:</div>
        <div className="w-full">
          <a 
            href={url} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="flex items-center text-blue-500 hover:text-blue-600 dark:hover:text-blue-400 px-3 py-2 rounded-md border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-500 bg-white dark:bg-gray-800 transition-colors duration-150 w-full text-sm"
            title={url}
          >
            <span className="break-all flex-1">{displayUrl}</span>
            <svg className="w-4 h-4 ml-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        </div>
      </div>
    );
  };

  return (
    <Container title="Add L1 Chains">
      <div className="flex justify-between items-center gap-4 mb-6">
        <div className="relative flex-1">
          <div className="relative">
            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name or token"
              className="w-full pl-10 pr-3 py-2 text-sm bg-transparent border border-gray-200 dark:border-gray-700 rounded-md text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>
        
        <div className="w-[140px]">
          <Select
            label=""
            value={networkType}
            onChange={handleNetworkTypeChange}
            options={[
              { value: "mainnet", label: "Mainnet" },
              { value: "testnet", label: "Testnet" }
            ]}
          />
        </div>
      </div>

      {error && (
        <div className="flex items-center mb-4 p-3 border border-red-300 bg-red-50 text-red-800 rounded-md">
          <AlertCircle className="w-4 h-4 mr-2" />
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="py-4 text-center">Loading chains...</div>
      ) : (
        <div className="space-y-2">
          {filteredChains.length > 0 ? (
            filteredChains.map((chain) => (
              <div 
                key={chain.chainId} 
                className="flex justify-between items-center p-3 border rounded cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
                onClick={() => openChainDetails(chain)}
              >
                <div className="flex items-center space-x-3">
                  {chain.chainLogoUri && (
                    <img 
                      src={chain.chainLogoUri} 
                      alt={`${chain.chainName} logo`} 
                      className="w-8 h-8 rounded-full"
                      onError={(e) => {
                        // Handle image loading errors
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  )}
                  <div>
                    <div className="font-medium">{chain.chainName}</div>
                    <div className="text-sm text-gray-500">{chain.networkToken.symbol}</div>
                  </div>
                </div>
                <div 
                  onClick={(e) => {
                    e.stopPropagation(); // Prevent opening the modal
                    handleAddToWallet(chain);
                  }}
                >
                  <Button
                    variant={Number(chain.chainId) === walletChainId ? "secondary" : "primary"}
                    loading={addingChainId === chain.chainId}
                    onClick={() => handleAddToWallet(chain)}
                  >
                    {Number(chain.chainId) === walletChainId ? 'Connected' : 'Add to Wallet'}
                  </Button>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-4">
              {searchTerm ? 
                `No chains found matching "${searchTerm}"` : 
                "No chains found for this network type"
              }
            </div>
          )}
        </div>
      )}

      {/* Chain details modal */}
      {selectedChain && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg w-full max-w-xl flex flex-col max-h-[85vh]">
            {/* Modal header */}
            <div className="p-4 border-b flex justify-between items-center flex-shrink-0">
              <div className="flex items-center space-x-3">
                {selectedChain.chainLogoUri && (
                  <img 
                    src={selectedChain.chainLogoUri} 
                    alt={`${selectedChain.chainName} logo`} 
                    className="w-8 h-8 rounded-full"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                )}
                <h3 className="text-lg font-semibold">{selectedChain.chainName}</h3>
              </div>
              <button 
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                onClick={closeChainDetails}
              >
                ✕
              </button>
            </div>
            
            {/* Modal content - scrollable */}
            <div className="p-4 overflow-auto flex-grow">
              {/* Description section */}
              <div className="mb-4">
                <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-2">Description</h4>
                <div className="bg-gray-50 dark:bg-gray-900/30 p-3 rounded-md text-gray-600 dark:text-gray-400 text-sm max-h-[100px] overflow-auto">
                  {selectedChain.description || "No description available"}
                </div>
              </div>
              
              {/* Chain Details */}
              <div className="mb-4">
                <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-2">Chain Details</h4>
                <div className="bg-gray-50 dark:bg-gray-900/30 p-3 rounded-md">
                  <CopyableField label="Chain ID" value={selectedChain.chainId} fieldId="chainId" />
                  <Field label="Network" value={selectedChain.isTestnet ? "Testnet" : "Mainnet"} />
                  <Field label="Status" value={selectedChain.status} />
                  {selectedChain.platformChainId && (
                    <CopyableField 
                      label="Platform Chain ID" 
                      value={selectedChain.platformChainId} 
                      fieldId="platformChainId" 
                    />
                  )}
                  {selectedChain.subnetId && (
                    <CopyableField 
                      label="Subnet ID" 
                      value={selectedChain.subnetId} 
                      fieldId="subnetId" 
                    />
                  )}
                </div>
              </div>
              
              {/* Network Token */}
              <div className="mb-4">
                <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-2">Network Token</h4>
                <div className="bg-gray-50 dark:bg-gray-900/30 p-3 rounded-md">
                  <Field 
                    label="Name" 
                    value={selectedChain.networkToken.name} 
                  />
                  <Field label="Symbol" value={selectedChain.networkToken.symbol} />
                  <Field label="Decimals" value={selectedChain.networkToken.decimals} />
                </div>
              </div>
              
              {/* URLs */}
              <div className="mb-4">
                <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-2">URLs</h4>
                <div className="bg-gray-50 dark:bg-gray-900/30 p-3 rounded-md">
                  <CopyableField label="RPC URL" value={selectedChain.rpcUrl} fieldId="rpcUrl" />
                  {selectedChain.wsUrl && (
                    <CopyableField label="WebSocket URL" value={selectedChain.wsUrl} fieldId="wsUrl" />
                  )}
                  {selectedChain.explorerUrl && (
                    <UrlField label="Explorer URL" url={selectedChain.explorerUrl} />
                  )}
                </div>
              </div>
            </div>
            
            {/* Modal footer - sticky */}
            <div className="p-4 border-t flex justify-end flex-shrink-0 bg-white dark:bg-gray-800">
              <Button
                variant="primary"
                onClick={() => handleAddToWallet(selectedChain)}
                loading={addingChainId === selectedChain.chainId}
              >
                {Number(selectedChain.chainId) === walletChainId ? 'Connected' : 'Add to Wallet'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Container>
  );
} 