import { AlertCircle, Copy, Home, Shield, Users, Weight, ChevronDown, ChevronRight } from 'lucide-react';
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
  isDetectingOwnerType
}: ValidatorManagerDetailsProps) {
  const [blockchainName, setBlockchainName] = useState<string | null>(null);
  const [isLoadingBlockchainName, setIsLoadingBlockchainName] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

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
        <span className="ml-1 text-xs bg-gray-100 dark:bg-gray-900/30 text-gray-700 dark:text-gray-300 px-1 py-0.5 rounded animate-pulse">
          Detecting...
        </span>
      );
    }

    if (ownerType === 'PoAManager') {
      return (
        <span className="ml-1 text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-1 py-0.5 rounded">
          PoAManager
        </span>
      );
    }

    if (ownerType === 'StakingManager') {
      return (
        <span className="ml-1 text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-1 py-0.5 rounded">
          StakingManager
        </span>
      );
    }

    if (ownerType === 'EOA') {
      return (
        <span className="ml-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-1 py-0.5 rounded">
          EOA
        </span>
      );
    }

    return (
      <span className="ml-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-1 py-0.5 rounded">
        Contract
      </span>
    );
  };

  return (
    <div className="mt-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
      {/* Header with toggle */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-3 flex items-center justify-between text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors rounded-t-lg"
      >
        <div className="flex items-center">
          <Shield className="h-4 w-4 mr-2" />
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Validator Manager Details
          </span>
        </div>
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 text-zinc-500 dark:text-zinc-400" />
        ) : (
          <ChevronRight className="h-4 w-4 text-zinc-500 dark:text-zinc-400" />
        )}
      </button>

      {/* Collapsible content */}
      {isExpanded && (
        <div className="p-3 pt-0 space-y-3 border-t border-zinc-200 dark:border-zinc-800">
          {/* Validator Manager Address */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <div className="text-sm font-medium text-zinc-700 dark:text-zinc-300 flex items-center">
                <Shield className="h-4 w-4 mr-1" />
                Validator Manager Address
              </div>
              <button 
                onClick={() => copyToClipboard(validatorManagerAddress)}
                className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 flex items-center"
              >
                <Copy className="h-3 w-3 mr-1" />
                Copy
              </button>
            </div>
            <div className="font-mono text-xs bg-zinc-50 dark:bg-zinc-800 p-2 rounded border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 overflow-auto">{validatorManagerAddress}</div>
          </div>

          {/* Contract Owner */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <div className="text-sm font-medium text-zinc-700 dark:text-zinc-300 flex items-center">
                <Users className="h-4 w-4 mr-1" />
                Validator Manager Owner
                {getOwnerContractBadge()}
              </div>
              {isLoadingOwnership && (
                <span className="text-xs text-blue-600 dark:text-blue-400 animate-pulse">Loading...</span>
              )}
              {contractOwner && (
                <button 
                  onClick={() => copyToClipboard(contractOwner)}
                  className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 flex items-center"
                >
                  <Copy className="h-3 w-3 mr-1" />
                  Copy
                </button>
              )}
            </div>
            {ownershipError ? (
              <div className="p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-red-700 dark:text-red-300 text-xs flex items-start">
                <AlertCircle className="h-3 w-3 mr-1 mt-0.5 flex-shrink-0" />
                <span>{ownershipError}</span>
              </div>
            ) : contractOwner ? (
              <div className="font-mono text-xs bg-zinc-50 dark:bg-zinc-800 p-2 rounded border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 overflow-auto">{contractOwner}</div>
            ) : (
              <div className="text-xs text-zinc-500 dark:text-zinc-400 italic">No owner information available</div>
            )}
          </div>

          {/* Validator Manager Home (beam) */}
          {blockchainId && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <div className="text-sm font-medium text-zinc-700 dark:text-zinc-300 flex items-center">
                  <Home className="h-4 w-4 mr-1" />
                  Validator Manager Home
                </div>
                {isLoadingBlockchainName && (
                  <span className="text-xs text-blue-600 dark:text-blue-400 animate-pulse">Loading name...</span>
                )}
                <button 
                  onClick={() => copyToClipboard(blockchainId)}
                  className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 flex items-center"
                >
                  <Copy className="h-3 w-3 mr-1" />
                  Copy ID
                </button>
              </div>
              <div className="space-y-1">
                {blockchainName && (
                  <div className="text-sm bg-zinc-50 dark:bg-zinc-800 p-2 rounded border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200">
                    {blockchainName}
                  </div>
                )}
                <div className="font-mono text-xs bg-zinc-50 dark:bg-zinc-800 p-2 rounded border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 overflow-auto">{blockchainId}</div>
              </div>
            </div>
          )}

          {/* Signing Subnet ID */}
          {signingSubnetId && signingSubnetId !== subnetId && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <div className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Signing Subnet ID</div>
                <button 
                  onClick={() => copyToClipboard(signingSubnetId)}
                  className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 flex items-center"
                >
                  <Copy className="h-3 w-3 mr-1" />
                  Copy
                </button>
              </div>
              <div className="font-mono text-xs bg-zinc-50 dark:bg-zinc-800 p-2 rounded border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 overflow-auto">{signingSubnetId}</div>
            </div>
          )}

          {/* Contract Total Weight */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <div className="text-sm font-medium text-zinc-700 dark:text-zinc-300 flex items-center">
                <Weight className="h-4 w-4 mr-1" />
                Total Validator Weight
              </div>
              {isLoadingL1Weight && (
                <span className="text-xs text-blue-600 dark:text-blue-400 animate-pulse">Loading...</span>
              )}
            </div>
            {l1WeightError ? (
              <div className="p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-red-700 dark:text-red-300 text-xs flex items-start">
                <AlertCircle className="h-3 w-3 mr-1 mt-0.5 flex-shrink-0" />
                <span>{l1WeightError}</span>
              </div>
            ) : (
              <div className="font-mono text-xs bg-zinc-50 dark:bg-zinc-800 p-2 rounded border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200">
                {contractTotalWeight !== undefined ? formatWeight(contractTotalWeight) : '0'}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
} 