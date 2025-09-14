"use client"

import { useWalletStore } from "@/components/toolbox/stores/walletStore"
import { useState, useEffect } from "react"
import { Calendar, Clock, Users, Coins, Info, Copy, Check, Search, ChevronDown } from "lucide-react"
import { Container } from "@/components/toolbox/components/Container"
import { Button } from "@/components/toolbox/components/Button"
import { networkIDs } from "@avalabs/avalanchejs"

import { GlobalParamNetwork } from "@avalabs/avacloud-sdk/models/components"
import { AvaCloudSDK } from "@avalabs/avacloud-sdk"
import SelectSubnetId from "@/components/toolbox/components/SelectSubnetId"
import BlockchainDetailsDisplay from "@/components/toolbox/components/BlockchainDetailsDisplay"
import { Tooltip } from "@/components/toolbox/components/Tooltip"
import { formatAvaxBalance } from "@/components/toolbox/coreViem/utils/format"
import { getSubnetInfo } from "@/components/toolbox/coreViem/utils/glacier"
import { cb58ToHex } from "@/components/toolbox/console/utilities/format-converter/FormatConverter"

// Updated interface to match the actual API response
interface ValidatorResponse {
  validationId: string;
  nodeId: string;
  subnetId: string;
  weight: number;
  remainingBalance: string;
  creationTimestamp: number;
  remainingBalanceOwner?: {
    addresses: string[];
    threshold: number;
  };
  deactivationOwner?: {
    addresses: string[];
    threshold: number;
  };
}

export default function QueryL1ValidatorSet() {
  const { avalancheNetworkID, isTestnet } = useWalletStore()
  const [validators, setValidators] = useState<ValidatorResponse[]>([])
  const [filteredValidators, setFilteredValidators] = useState<ValidatorResponse[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedValidator, setSelectedValidator] = useState<ValidatorResponse | null>(null)
  const [copiedNodeId, setCopiedNodeId] = useState<string | null>(null)
  const [subnetId, setSubnetId] = useState<string>("")
  const [subnet, setSubnet] = useState<any>(null)
  const [isLoadingSubnet, setIsLoadingSubnet] = useState(false)
  const [subnetError, setSubnetError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState<string>("")

  // Network names for display
  const networkNames: Record<number, GlobalParamNetwork> = {
    [networkIDs.MainnetID]: "mainnet",
    [networkIDs.FujiID]: "fuji",
  }

  // Fetch subnet details when subnet ID changes
  useEffect(() => {
    if (!subnetId) {
      setSubnet(null)
      setSubnetError(null)
      return
    }

    setIsLoadingSubnet(true)
    setSubnetError(null)
    getSubnetInfo(subnetId)
      .then((subnetInfo) => {
        setSubnet(subnetInfo)
        setSubnetError(null)
      })
      .catch((error) => {
        console.error('Error getting subnet info:', error)
        setSubnet(null)
        setSubnetError((error as Error).message)
      })
      .finally(() => {
        setIsLoadingSubnet(false)
      })
  }, [subnetId])

  const fetchValidators = async () => {
    if (!subnetId) return

    setIsLoading(true)
    setError(null)
    setSelectedValidator(null)
    try {
      if (!subnetId.trim()) {
        throw new Error("Subnet ID is required to query L1 validators")
      }

      const network = networkNames[Number(avalancheNetworkID)]
      if (!network) {
        throw new Error("Invalid network selected")
      }

      const sdk = new AvaCloudSDK({
        serverURL: isTestnet ? "https://api.avax-test.network" : "https://api.avax.network",
        network: networkNames[Number(avalancheNetworkID)],
      })

      const result = await sdk.data.primaryNetwork.listL1Validators({
        network: networkNames[Number(avalancheNetworkID)],
        subnetId,
      })

      // Get all pages of results
      const allValidators: ValidatorResponse[] = [];
      for await (const page of result) {
        // Check if the response has a 'result' property (new API structure)
        if ('result' in page && page.result && 'validators' in page.result) {
          allValidators.push(...(page.result.validators as unknown as ValidatorResponse[]));
        }
        // Also check for direct 'validators' property (old API structure)
        else if ('validators' in page) {
          allValidators.push(...(page.validators as unknown as ValidatorResponse[]));
        }
      }

      setValidators(allValidators)
      setFilteredValidators(allValidators)
    } catch (err) {
      console.error("Error fetching validators:", err)
      setError("Failed to fetch validators")
    } finally {
      setIsLoading(false)
    }
  }

  function formatTimestamp(timestamp: number): string {
    return new Date(timestamp * 1000).toLocaleString()
  }

  function formatStake(stake: string): string {
    const stakeNum = parseFloat(stake)
    if (isNaN(stakeNum)) return stake

    // Format as just the number with commas, no conversion
    return stakeNum.toLocaleString()
  }

  const handleViewDetails = (validator: ValidatorResponse) => {
    setSelectedValidator(validator)
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
      .then(() => {
        setCopiedNodeId(text)
        setTimeout(() => setCopiedNodeId(null), 2000) // Reset after 2 seconds
      })
      .catch(err => {
        console.error('Failed to copy text: ', err)
      })
  }

  // Add function to handle search and filtering
  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const term = e.target.value.toLowerCase();
    setSearchTerm(term);

    // Filter out validators with weight 0 and apply search term
    const validatorsWithWeight = validators.filter(validator => validator.weight > 0);

    if (!term.trim()) {
      setFilteredValidators(validatorsWithWeight);
      return;
    }

    const filtered = validatorsWithWeight.filter(validator =>
      validator.nodeId.toLowerCase().includes(term)
    );
    setFilteredValidators(filtered);
  };

  // Update filtered validators when validators change
  useEffect(() => {
    // Filter out validators with weight 0
    const validatorsWithWeight = validators.filter(validator => validator.weight > 0);
    setFilteredValidators(validatorsWithWeight);
  }, [validators]);

  return (
    <Container title="L1 Validators" description="Query the validators of an L1 from the P-Chain using the Avalanche API">
      <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-sm p-4 border border-zinc-200 dark:border-zinc-800 relative overflow-visible">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50/30 to-transparent dark:from-blue-900/10 dark:to-transparent pointer-events-none rounded-lg"></div>

        <div className="relative">
          <div className="mb-3">
            <SelectSubnetId value={subnetId} onChange={setSubnetId} hidePrimaryNetwork={true} />
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Subnet ID is required to query L1 validators
            </p>
          </div>

          {/* Show subnet details if available */}
          <BlockchainDetailsDisplay
            subnet={subnet}
            isLoading={isLoadingSubnet}
            error={subnetError}
          />

          <Button
            onClick={() => fetchValidators()}
            disabled={isLoading || !subnetId.trim() || !!subnetError || isLoadingSubnet}
            className={`w-full py-2 px-4 rounded-md text-sm font-medium flex items-center justify-center mt-4 ${isLoading || !subnetId.trim() || !!subnetError || isLoadingSubnet
              ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 cursor-not-allowed"
              : "bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-sm hover:shadow transition-all duration-200"
              }`}
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Fetching...
              </>
            ) : isLoadingSubnet ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Validating...
              </>
            ) : (
              "Fetch Validators"
            )}
          </Button>
        </div>
      </div>

      {/* Validators List Card */}
      {error ? (
        <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg border border-red-200 dark:border-red-800 mt-4 animate-fadeIn">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="h-4 w-4 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-2">
              <p className="text-sm font-medium text-red-700 dark:text-red-400">{error}</p>
            </div>
          </div>
        </div>
      ) : null}

      {validators.length > 0 && (
        <div className="bg-white dark:bg-zinc-900 rounded-lg p-4 border border-zinc-200 dark:border-zinc-800 mt-4 shadow-sm">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-3">
            <div className="flex items-center">
              <h3 className="text-base font-semibold text-zinc-800 dark:text-white flex items-center">
                Validator List
                <span className="ml-2 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs font-medium px-2 py-0.5 rounded-full">
                  {validators.length}
                </span>
              </h3>
            </div>

            <div className="relative w-full sm:w-64">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-zinc-400" />
              </div>
              <input
                type="text"
                value={searchTerm}
                onChange={handleSearch}
                placeholder="Search by Node ID..."
                className="pl-9 w-full py-1.5 px-3 rounded-md text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-600 focus:border-transparent text-zinc-800 dark:text-zinc-200"
              />
            </div>
          </div>

          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-2"></div>
              <p className="text-zinc-500 dark:text-zinc-400 text-sm">Loading validators...</p>
            </div>
          ) : filteredValidators.length > 0 ? (
            <div className="rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-700">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-700">
                  <thead>
                    <tr className="bg-zinc-50 dark:bg-zinc-800/80">
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                        <div className="flex items-center">
                          Node ID
                          <ChevronDown className="h-3 w-3 ml-1 text-zinc-400" />
                        </div>
                      </th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                        <div className="flex items-center">
                          AVAX Balance
                          <ChevronDown className="h-3 w-3 ml-1 text-zinc-400" />
                        </div>
                      </th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                        <div className="flex items-center">
                          Weight
                          <ChevronDown className="h-3 w-3 ml-1 text-zinc-400" />
                        </div>
                      </th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                        <div className="flex items-center">
                          Created
                          <ChevronDown className="h-3 w-3 ml-1 text-zinc-400" />
                        </div>
                      </th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-zinc-900 divide-y divide-zinc-200 dark:divide-zinc-700">
                    {filteredValidators.map((validator, index) => (
                      <tr
                        key={index}
                        className="hover:bg-zinc-50 dark:hover:bg-zinc-800/70 transition-colors duration-150"
                      >
                        <td className="px-3 py-3 text-sm font-mono truncate max-w-[180px] text-zinc-800 dark:text-zinc-200">
                          <div className="flex items-center">
                            <span title={validator.nodeId} className="truncate">{validator.nodeId.substring(0, 14)}...</span>
                            <button
                              onClick={() => copyToClipboard(validator.nodeId)}
                              className="ml-1.5 p-0.5 rounded-md hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                            >
                              <Tooltip content={copiedNodeId === validator.nodeId ? "Copied!" : "Copy Node ID"}>
                                {copiedNodeId === validator.nodeId ? (
                                  <Check size={12} className="text-green-500" />
                                ) : (
                                  <Copy size={12} className="text-zinc-500 dark:text-zinc-400" />
                                )}
                              </Tooltip>
                            </button>
                          </div>
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap text-sm text-zinc-800 dark:text-zinc-200">
                          <span className="font-medium text-blue-600 dark:text-blue-400">{formatAvaxBalance(parseFloat(validator.remainingBalance))}</span>
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap text-sm text-zinc-800 dark:text-zinc-200">
                          <span className="font-medium">{formatStake(validator.weight.toString())}</span>
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap text-sm text-zinc-500 dark:text-zinc-400">
                          <div className="flex items-center">
                            <Calendar size={12} className="mr-1 text-zinc-400 dark:text-zinc-500" />
                            <span className="text-xs">{formatTimestamp(validator.creationTimestamp)}</span>
                          </div>
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap">
                          <Button
                            variant="secondary"
                            onClick={() => handleViewDetails(validator)}
                            className="text-xs py-1 px-2 bg-white hover:bg-zinc-50 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 border border-zinc-300 dark:border-zinc-600 shadow-sm hover:shadow-md transition-all duration-200"
                          >
                            Details
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : searchTerm ? (
            <div className="flex flex-col items-center justify-center py-8 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg">
              <Search className="h-6 w-6 text-zinc-400 mb-2" />
              <p className="text-zinc-600 dark:text-zinc-400 text-sm font-medium mb-1">No matching validators</p>
              <p className="text-zinc-500 dark:text-zinc-500 text-xs">Try a different search term</p>
            </div>
          ) : (
            <div className="text-center py-8 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg">
              <Users className="h-6 w-6 text-zinc-400 mx-auto mb-2" />
              <p className="text-zinc-600 dark:text-zinc-400 text-sm font-medium mb-1">No validators found</p>
              <p className="text-zinc-500 dark:text-zinc-500 text-xs">Try changing the subnet ID or check your network connection</p>
            </div>
          )}
        </div>
      )}

      {/* Validator Details Modal */}
      {selectedValidator && (
        <div className="bg-white dark:bg-zinc-900 rounded-lg p-4 border border-zinc-200 dark:border-zinc-800 mt-4 shadow-sm animate-fadeIn">
          <div className="flex items-center justify-between mb-4">
            <div className="flex flex-col">
              <h3 className="text-base font-semibold text-zinc-800 dark:text-white">Validator Details</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">Detailed information about the selected validator</p>
            </div>
            <Button
              variant="secondary"
              onClick={() => setSelectedValidator(null)}
              className="text-xs py-1 px-2 bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 border border-zinc-300 dark:border-zinc-600 transition-colors"
            >
              Close
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Basic Information Card */}
            <div className="bg-zinc-50 dark:bg-zinc-800/70 p-4 rounded-lg border border-zinc-200 dark:border-zinc-700 shadow-sm hover:shadow-md transition-shadow duration-200">
              <h4 className="text-sm font-semibold mb-3 text-zinc-700 dark:text-zinc-300 flex items-center">
                <Users className="h-4 w-4 text-blue-500 dark:text-blue-400 mr-2" />
                Node Information
              </h4>
              <div className="space-y-3">
                <div className="p-2.5 bg-white dark:bg-zinc-900/80 rounded-md border border-zinc-200 dark:border-zinc-700">
                  <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Validation ID</p>
                  <div className="flex items-center">
                    <p
                      className="font-mono text-xs break-all text-zinc-800 dark:text-zinc-200"
                      title={selectedValidator.validationId}
                    >
                      {selectedValidator.validationId}
                    </p>
                    <button
                      onClick={() => copyToClipboard(selectedValidator.validationId)}
                      className="ml-1 p-0.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                      title="Copy Validation ID"
                    >
                      {copiedNodeId === selectedValidator.validationId ? (
                        <Check size={12} className="text-green-500" />
                      ) : (
                        <Copy size={12} className="text-zinc-500 dark:text-zinc-400" />
                      )}
                    </button>
                  </div>

                  {/* Display Hex Format */}
                  <div className="mt-2 pt-2 border-t border-zinc-200 dark:border-zinc-700">
                    <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Validation ID (Hex)</p>
                    <div className="flex items-center">
                      {(() => {
                        try {
                          const hexId = cb58ToHex(selectedValidator.validationId);
                          return (
                            <>
                              <p className="font-mono text-xs break-all text-zinc-800 dark:text-zinc-200" title={'0x' + hexId}>
                                {'0x' + hexId}
                              </p>
                              <button
                                onClick={() => copyToClipboard('0x' + hexId)}
                                className="ml-1 p-0.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                                title="Copy Hex ID"
                              >
                                {copiedNodeId === hexId ? (
                                  <Check size={12} className="text-green-500" />
                                ) : (
                                  <Copy size={12} className="text-zinc-500 dark:text-zinc-400" />
                                )}
                              </button>
                            </>
                          );
                        } catch (error) {
                          return (
                            <p className="font-mono text-xs text-red-500">Unable to convert to hex</p>
                          );
                        }
                      })()}
                    </div>
                  </div>
                </div>

                <div className="p-2.5 bg-white dark:bg-zinc-900/80 rounded-md border border-zinc-200 dark:border-zinc-700">
                  <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Node ID</p>
                  <div className="flex items-center">
                    <p
                      className="font-mono text-xs break-all text-zinc-800 dark:text-zinc-200"
                      title={selectedValidator.nodeId}
                    >
                      {selectedValidator.nodeId}
                    </p>
                    <button
                      onClick={() => copyToClipboard(selectedValidator.nodeId)}
                      className="ml-1 p-0.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                      title="Copy Node ID"
                    >
                      {copiedNodeId === selectedValidator.nodeId ? (
                        <Check size={12} className="text-green-500" />
                      ) : (
                        <Copy size={12} className="text-zinc-500 dark:text-zinc-400" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="p-2.5 bg-white dark:bg-zinc-900/80 rounded-md border border-zinc-200 dark:border-zinc-700">
                  <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Subnet ID</p>
                  <div className="flex items-center">
                    <p
                      className="font-mono text-xs break-all text-zinc-800 dark:text-zinc-200"
                      title={selectedValidator.subnetId}
                    >
                      {selectedValidator.subnetId}
                    </p>
                    <button
                      onClick={() => copyToClipboard(selectedValidator.subnetId)}
                      className="ml-1 p-0.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                      title="Copy Subnet ID"
                    >
                      {copiedNodeId === selectedValidator.subnetId ? (
                        <Check size={12} className="text-green-500" />
                      ) : (
                        <Copy size={12} className="text-zinc-500 dark:text-zinc-400" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Staking and Time Information */}
            <div className="space-y-4">
              {/* Staking Information */}
              <div className="bg-zinc-50 dark:bg-zinc-800/70 p-4 rounded-lg border border-zinc-200 dark:border-zinc-700 shadow-sm hover:shadow-md transition-shadow duration-200">
                <h4 className="text-sm font-semibold mb-3 text-zinc-700 dark:text-zinc-300 flex items-center">
                  <Coins className="h-4 w-4 text-blue-500 dark:text-blue-400 mr-2" />
                  Staking Information
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-2.5 bg-white dark:bg-zinc-900/80 rounded-md border border-zinc-200 dark:border-zinc-700 flex flex-col justify-between">
                    <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Amount Staked</p>
                    <p className="font-mono text-sm font-semibold text-blue-600 dark:text-blue-400">
                      {formatAvaxBalance(parseFloat(selectedValidator.remainingBalance))}
                    </p>
                  </div>

                  <div className="p-2.5 bg-white dark:bg-zinc-900/80 rounded-md border border-zinc-200 dark:border-zinc-700 flex flex-col justify-between">
                    <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Delegation Fee</p>
                    <p className="font-mono text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                      {formatStake(selectedValidator.weight.toString())}
                    </p>
                  </div>
                </div>
              </div>

              {/* Time Information */}
              <div className="bg-zinc-50 dark:bg-zinc-800/70 p-4 rounded-lg border border-zinc-200 dark:border-zinc-700 shadow-sm hover:shadow-md transition-shadow duration-200">
                <h4 className="text-sm font-semibold mb-3 text-zinc-700 dark:text-zinc-300 flex items-center">
                  <Clock className="h-4 w-4 text-blue-500 dark:text-blue-400 mr-2" />
                  Time Information
                </h4>
                <div className="p-2.5 bg-white dark:bg-zinc-900/80 rounded-md border border-zinc-200 dark:border-zinc-700">
                  <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Creation Time</p>
                  <div className="flex items-center">
                    <Calendar size={14} className="text-zinc-500 dark:text-zinc-400 mr-1.5" />
                    <p className="font-medium text-sm text-zinc-800 dark:text-zinc-200">
                      {formatTimestamp(selectedValidator.creationTimestamp)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Remaining Balance Owner Information */}
          {selectedValidator.remainingBalanceOwner && (
            <div className="bg-zinc-50 dark:bg-zinc-800/70 p-4 rounded-lg border border-zinc-200 dark:border-zinc-700 mt-4 shadow-sm hover:shadow-md transition-shadow duration-200">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 flex items-center">
                  <Users className="h-4 w-4 text-blue-500 dark:text-blue-400 mr-2" />
                  Remaining Balance Owner
                </h4>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300">
                  Threshold: {selectedValidator.remainingBalanceOwner.threshold}
                </span>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Addresses</p>
                  <span className="bg-zinc-200 dark:bg-zinc-700 text-xs font-medium px-2 py-0.5 rounded-full text-zinc-700 dark:text-zinc-300">
                    {selectedValidator.remainingBalanceOwner.addresses.length}
                  </span>
                </div>
                <div className="max-h-40 overflow-y-auto border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900/80 divide-y divide-zinc-200 dark:divide-zinc-700">
                  {selectedValidator.remainingBalanceOwner.addresses.map((address, index) => (
                    <div key={index} className="flex items-center justify-between p-2.5">
                      <p className="font-mono text-xs break-all text-zinc-800 dark:text-zinc-200 pr-2">
                        {address}
                      </p>
                      <button
                        onClick={() => copyToClipboard(address)}
                        className="p-0.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors flex-shrink-0"
                        title="Copy Address"
                      >
                        {copiedNodeId === address ? (
                          <Check size={12} className="text-green-500" />
                        ) : (
                          <Copy size={12} className="text-zinc-500 dark:text-zinc-400" />
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Deactivation Owner Information */}
          {selectedValidator.deactivationOwner && (
            <div className="bg-zinc-50 dark:bg-zinc-800/70 p-4 rounded-lg border border-zinc-200 dark:border-zinc-700 mt-4 shadow-sm hover:shadow-md transition-shadow duration-200">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 flex items-center">
                  <Users className="h-4 w-4 text-blue-500 dark:text-blue-400 mr-2" />
                  Deactivation Owner
                </h4>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300">
                  Threshold: {selectedValidator.deactivationOwner.threshold}
                </span>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Addresses</p>
                  <span className="bg-zinc-200 dark:bg-zinc-700 text-xs font-medium px-2 py-0.5 rounded-full text-zinc-700 dark:text-zinc-300">
                    {selectedValidator.deactivationOwner.addresses.length}
                  </span>
                </div>
                <div className="max-h-40 overflow-y-auto border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900/80 divide-y divide-zinc-200 dark:divide-zinc-700">
                  {selectedValidator.deactivationOwner.addresses.map((address, index) => (
                    <div key={index} className="flex items-center justify-between p-2.5">
                      <p className="font-mono text-xs break-all text-zinc-800 dark:text-zinc-200 pr-2">
                        {address}
                      </p>
                      <button
                        onClick={() => copyToClipboard(address)}
                        className="p-0.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors flex-shrink-0"
                        title="Copy Address"
                      >
                        {copiedNodeId === address ? (
                          <Check size={12} className="text-green-500" />
                        ) : (
                          <Copy size={12} className="text-zinc-500 dark:text-zinc-400" />
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-center text-xs text-zinc-500 dark:text-zinc-400 italic p-2 bg-zinc-100/50 dark:bg-zinc-800/50 rounded-md shadow-sm mt-4">
        <Info className="h-3 w-3 mr-1" />
        <a href="https://developers.avacloud.io/data-api/primary-network/list-validators" target="_blank" rel="noopener noreferrer" className="underline hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors">Data retrieved from Data API</a>
      </div>

      <style dangerouslySetInnerHTML={{
        __html: `
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out forwards;
        }
      `}} />
    </Container>
  )
}

