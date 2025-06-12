import { AlertCircle, Copy, Home, Shield, Users, Weight, ChevronDown, ChevronRight, Pen, BookUser } from 'lucide-react';
import { useState, useEffect } from 'react';
import { getBlockchainInfo } from '../coreViem/utils/glacier';

interface ValidatorManagerDetailsProps {
  validatorManagerAddress: string | null;
  blockchainId: string | null;
  subnetId: string;
  isLoading: boolean;
  signingSubnetId?: string;
  contractTotalWeight?: bigint;
  l1WeightError?: string | null;
  isLoadingL1Weight?: boolean;
  contractOwner?: string | null;
  ownershipError?: string | null;
  isLoadingOwnership?: boolean;
  isOwnerContract?: boolean;
  ownerType?: 'PoAManager' | 'StakingManager' | 'EOA' | null;
  isDetectingOwnerType?: boolean;
  isExpanded?: boolean;
  onToggleExpanded?: () => void;
}

export function ValidatorManagerDetails({
  validatorManagerAddress,
  blockchainId,
  subnetId,
  isLoading,
  signingSubnetId,
  contractTotalWeight,
  l1WeightError,
  isLoadingL1Weight,
  contractOwner,
  ownershipError,
  isLoadingOwnership,
  ownerType,
  isDetectingOwnerType,
  isExpanded = true,
  onToggleExpanded
}: ValidatorManagerDetailsProps) {
  const [blockchainName, setBlockchainName] = useState<string | null>(null);
  const [isLoadingBlockchainName, setIsLoadingBlockchainName] = useState(false);
  const [internalIsExpanded, setInternalIsExpanded] = useState(true);

  // Use external state if provided, otherwise use internal state
  const currentIsExpanded = onToggleExpanded ? isExpanded : internalIsExpanded;
  const handleToggleExpanded = onToggleExpanded || (() => setInternalIsExpanded(!internalIsExpanded));

  // Fetch blockchain name when blockchainId changes
  useEffect(() => {
    const fetchBlockchainName = async () => {
      if (!blockchainId) {
        setBlockchainName(null);
        return;
      }

      setIsLoadingBlockchainName(true);
      try {
        const blockchainInfo = await getBlockchainInfo(blockchainId);
        setBlockchainName(blockchainInfo.blockchainName);
      } catch (error) {
        console.error('Failed to fetch blockchain name:', error);
        setBlockchainName(null);
      } finally {
        setIsLoadingBlockchainName(false);
      }
    };

    fetchBlockchainName();
  }, [blockchainId]);

  if (isLoading) {
    return <p className="text-xs text-blue-600 dark:text-blue-400 mt-1 animate-pulse">Loading L1 details...</p>;
  }

  if (!validatorManagerAddress) {
    return null;
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const formatWeight = (weight: bigint): string => {
    return weight.toString();
  };

  const getOwnerContractBadge = () => {
    if (!ownerType) return null;
    
    if (isDetectingOwnerType) {
      return (
        <span className="ml-2 text-xs bg-gray-100 dark:bg-gray-900/30 text-gray-700 dark:text-gray-300 px-2 py-1 rounded-md animate-pulse font-medium">
          Detecting...
        </span>
      );
    }

    if (ownerType === 'PoAManager') {
      return (
        <span className="ml-2 text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-2 py-1 rounded-md font-medium">
          PoAManager
        </span>
      );
    }

    if (ownerType === 'StakingManager') {
      return (
        <span className="ml-2 text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-2 py-1 rounded-md font-medium">
          StakingManager
        </span>
      );
    }

    if (ownerType === 'EOA') {
      return (
        <span className="ml-2 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-1 rounded-md font-medium">
          EOA
        </span>
      );
    }

    return (
      <span className="ml-2 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-1 rounded-md font-medium">
        Contract
      </span>
    );
  };

  return (
    <div className="mt-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
      {/* Header with toggle */}
      <button
        onClick={handleToggleExpanded}
        className="w-full p-4 flex items-center justify-between text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-all duration-200 rounded-t-xl group"
      >
        <div className="flex items-center">
          <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/20 mr-3 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/30 transition-colors">
            <Shield className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </div>
          <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
            Validator Manager Details
          </span>
        </div>
        {currentIsExpanded ? (
          <ChevronDown className="h-4 w-4 text-zinc-500 dark:text-zinc-400 transition-transform duration-200" />
        ) : (
          <ChevronRight className="h-4 w-4 text-zinc-500 dark:text-zinc-400 transition-transform duration-200" />
        )}
      </button>

      {/* Collapsible content */}
      {currentIsExpanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-zinc-100 dark:border-zinc-800">
          {/* Validator Manager Address */}
          <div className="bg-zinc-50/50 dark:bg-zinc-800/30 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium text-zinc-700 dark:text-zinc-300 flex items-center">
                <BookUser className="h-4 w-4 mr-2 text-zinc-500 dark:text-zinc-400" />
                Contract Address
              </div>
              <button 
                onClick={() => copyToClipboard(validatorManagerAddress)}
                className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 flex items-center px-2 py-1 rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
              >
                <Copy className="h-3 w-3 mr-1" />
                Copy
              </button>
            </div>
            <div className="font-mono text-xs bg-white dark:bg-zinc-900 p-3 rounded-md border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 overflow-auto break-all">{validatorManagerAddress}</div>
          </div>

          {/* Contract Owner */}
          <div className="bg-zinc-50/50 dark:bg-zinc-800/30 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium text-zinc-700 dark:text-zinc-300 flex items-center">
                <Users className="h-4 w-4 mr-2 text-zinc-500 dark:text-zinc-400" />
                Contract Owner
                {getOwnerContractBadge()}
              </div>
              <div className="flex items-center gap-2">
                {isLoadingOwnership && (
                  <span className="text-xs text-blue-600 dark:text-blue-400 animate-pulse">Loading...</span>
                )}
                {contractOwner && (
                  <button 
                    onClick={() => copyToClipboard(contractOwner)}
                    className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 flex items-center px-2 py-1 rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                  >
                    <Copy className="h-3 w-3 mr-1" />
                    Copy
                  </button>
                )}
              </div>
            </div>
            {ownershipError ? (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md text-red-700 dark:text-red-300 text-xs flex items-start">
                <AlertCircle className="h-3 w-3 mr-2 mt-0.5 flex-shrink-0" />
                <span>{ownershipError}</span>
              </div>
            ) : contractOwner ? (
              <div className="font-mono text-xs bg-white dark:bg-zinc-900 p-3 rounded-md border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 overflow-auto break-all">{contractOwner}</div>
            ) : (
              <div className="text-xs text-zinc-500 dark:text-zinc-400 italic p-2 bg-zinc-100/50 dark:bg-zinc-700/30 rounded-md">No owner information available</div>
            )}
          </div>

          {/* Validator Manager Home (beam) */}
          {blockchainId && (
            <div className="bg-zinc-50/50 dark:bg-zinc-800/30 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-medium text-zinc-700 dark:text-zinc-300 flex items-center">
                  <Home className="h-4 w-4 mr-2 text-zinc-500 dark:text-zinc-400" />
                  Home Chain
                </div>
                <div className="flex items-center gap-2">
                  {isLoadingBlockchainName && (
                    <span className="text-xs text-blue-600 dark:text-blue-400 animate-pulse">Loading name...</span>
                  )}
                  <button 
                    onClick={() => copyToClipboard(blockchainId)}
                    className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 flex items-center px-2 py-1 rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                  >
                    <Copy className="h-3 w-3 mr-1" />
                    Copy ID
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                {blockchainName && (
                  <div className="text-sm bg-white dark:bg-zinc-900 p-3 rounded-md border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 font-medium">
                    {blockchainName}
                  </div>
                )}
                <div className="font-mono text-xs bg-white dark:bg-zinc-900 p-3 rounded-md border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 overflow-auto break-all">{blockchainId}</div>
              </div>
            </div>
          )}

          {/* Signing Subnet ID */}
          {signingSubnetId && signingSubnetId !== subnetId && (
            <div className="bg-zinc-50/50 dark:bg-zinc-800/30 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-medium text-zinc-700 dark:text-zinc-300 flex items-center">
                  <Pen className="h-4 w-4 mr-2 text-zinc-500 dark:text-zinc-400" />
                  Signing Subnet ID
                </div>
                <button 
                  onClick={() => copyToClipboard(signingSubnetId)}
                  className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 flex items-center px-2 py-1 rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                >
                  <Copy className="h-3 w-3 mr-1" />
                  Copy
                </button>
              </div>
              <div className="font-mono text-xs bg-white dark:bg-zinc-900 p-3 rounded-md border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 overflow-auto break-all">{signingSubnetId}</div>
            </div>
          )}

          {/* Contract Total Weight */}
          <div className="bg-zinc-50/50 dark:bg-zinc-800/30 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium text-zinc-700 dark:text-zinc-300 flex items-center">
                <Weight className="h-4 w-4 mr-2 text-zinc-500 dark:text-zinc-400" />
                Total Validator Weight
              </div>
              {isLoadingL1Weight && (
                <span className="text-xs text-blue-600 dark:text-blue-400 animate-pulse">Loading...</span>
              )}
            </div>
            {l1WeightError ? (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md text-red-700 dark:text-red-300 text-xs flex items-start">
                <AlertCircle className="h-3 w-3 mr-2 mt-0.5 flex-shrink-0" />
                <span>{l1WeightError}</span>
              </div>
            ) : (
              <div className="font-mono text-sm bg-white dark:bg-zinc-900 p-3 rounded-md border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 font-medium">
                {contractTotalWeight !== undefined ? formatWeight(contractTotalWeight) : '0'}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
} 