"use client"

import { useWalletStore } from "../../stores/walletStore"
import { useState, useEffect } from "react"
import { Calendar, Clock, Users, Coins, Info, Copy, Check, Search, ChevronDown } from "lucide-react"
import { Container } from "../../components/Container"
import { Button } from "../../components/Button"
import { networkIDs } from "@avalabs/avalanchejs"
import { GlobalParamNetwork, L1ValidatorDetailsFull } from "@avalabs/avacloud-sdk/models/components"
import { AvaCloudSDK } from "@avalabs/avacloud-sdk"
import SelectSubnetId from "../../components/SelectSubnetId"
import { Tooltip } from "../../components/Tooltip"
import { formatAvaxBalance } from "../../coreViem/utils/format"

export default function QueryL1ValidatorSet() {
  const { avalancheNetworkID } = useWalletStore()
  const [validators, setValidators] = useState<L1ValidatorDetailsFull[]>([])
  const [filteredValidators, setFilteredValidators] = useState<L1ValidatorDetailsFull[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedValidator, setSelectedValidator] = useState<L1ValidatorDetailsFull | null>(null)
  const [copiedNodeId, setCopiedNodeId] = useState<string | null>(null)
  const [subnetId, setSubnetId] = useState<string>("")
  const [searchTerm, setSearchTerm] = useState<string>("")

  // Network names for display
  const networkNames: Record<number, GlobalParamNetwork> = {
    [networkIDs.MainnetID]: "mainnet",
    [networkIDs.FujiID]: "fuji",
  }

  async function fetchValidators() {
    setIsLoading(true)
    setError(null)
    setSelectedValidator(null)

    try {
      const network = networkNames[Number(avalancheNetworkID)]
      if (!network) {
        throw new Error("Invalid network selected")
      }

      const result = await new AvaCloudSDK().data.primaryNetwork.listL1Validators({
        network: network,
        subnetId: subnetId || "",
      });

      // Handle pagination
      let validators: L1ValidatorDetailsFull[] = []

      for await (const page of result) {
        validators.push(...page.result.validators)
        setValidators(validators)
      }
    } catch (error: any) {
      setError(error.message || "Failed to fetch validators")
      setValidators([])
      console.error("Error fetching validators:", error)
    } finally {
      setIsLoading(false)
    }
  }

  function formatTimestamp(timestamp: number): string {
    return new Date(timestamp * 1000).toLocaleString()
  }

  function formatStake(stake: number): string {
    if (isNaN(stake)) return String(stake)

    // Format as just the number with commas, no conversion
    return stake.toLocaleString()
  }

  const handleViewDetails = (validator: L1ValidatorDetailsFull) => {
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

    if (!term.trim()) {
      setFilteredValidators(validators);
      return;
    }

    const filtered = validators.filter(validator =>
      validator.nodeId.toLowerCase().includes(term)
    );
    setFilteredValidators(filtered);
  };

  // Update filtered validators when validators change
  useEffect(() => {
    setFilteredValidators(validators);
  }, [validators]);

  return (
    <Container title="L1 Validators" description="Query the validators of an L1 from the P-Chain using the Avalanche API">
      <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-sm p-6 border border-zinc-200 dark:border-zinc-800 relative overflow-visible">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50/30 to-transparent dark:from-blue-900/10 dark:to-transparent pointer-events-none rounded-lg"></div>

        <div className="relative">
          <div className="mb-4">
            <SelectSubnetId value={subnetId} onChange={setSubnetId} hidePrimaryNetwork={true} />
            <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">
              Leave empty to query the Primary Network validators
            </p>
          </div>

          <Button
            onClick={() => fetchValidators()}
            disabled={isLoading}
            className={`w-full py-2.5 px-4 rounded-md text-sm font-medium flex items-center justify-center ${isLoading
              ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 cursor-not-allowed"
              : "bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-sm hover:shadow transition-all duration-200"
              }`}
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Fetching...
              </>
            ) : (
              "Fetch Validators"
            )}
          </Button>
        </div>
      </div>

      {/* Validators List Card */}
      {error ? (
        <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border border-red-200 dark:border-red-800 mt-6 animate-fadeIn">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-red-700 dark:text-red-400">{error}</p>
            </div>
          </div>
        </div>
      ) : null}

      {validators.length > 0 && (
        <div className="bg-white dark:bg-zinc-900 rounded-lg p-6 border border-zinc-200 dark:border-zinc-800 mt-6 shadow-sm">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-5 gap-4">
            <div className="flex items-center">
              <h3 className="text-lg font-semibold text-zinc-800 dark:text-white flex items-center">
                Validator List
                <span className="ml-2 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs font-medium px-2.5 py-0.5 rounded-full">
                  {validators.length}
                </span>
              </h3>
            </div>

            <div className="relative w-full sm:w-72">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-zinc-400" />
              </div>
              <input
                type="text"
                value={searchTerm}
                onChange={handleSearch}
                placeholder="Search by Node ID..."
                className="pl-10 w-full py-2 px-4 rounded-md text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-600 focus:border-transparent text-zinc-800 dark:text-zinc-200"
              />
            </div>
          </div>

          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500 mb-3"></div>
              <p className="text-zinc-500 dark:text-zinc-400 text-sm">Loading validators...</p>
            </div>
          ) : filteredValidators.length > 0 ? (
            <div className="rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-700">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-700">
                  <thead>
                    <tr className="bg-zinc-50 dark:bg-zinc-800/80">
                      <th className="px-4 py-3.5 text-left text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                        <div className="flex items-center">
                          Node ID
                          <ChevronDown className="h-3.5 w-3.5 ml-1 text-zinc-400" />
                        </div>
                      </th>
                      <th className="px-4 py-3.5 text-left text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                        <div className="flex items-center">
                          AVAX Balance
                          <ChevronDown className="h-3.5 w-3.5 ml-1 text-zinc-400" />
                        </div>
                      </th>
                      <th className="px-4 py-3.5 text-left text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                        <div className="flex items-center">
                          Weight
                          <ChevronDown className="h-3.5 w-3.5 ml-1 text-zinc-400" />
                        </div>
                      </th>
                      <th className="px-4 py-3.5 text-left text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                        <div className="flex items-center">
                          Created
                          <ChevronDown className="h-3.5 w-3.5 ml-1 text-zinc-400" />
                        </div>
                      </th>
                      <th className="px-4 py-3.5 text-left text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
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
                        <td className="px-4 py-4 text-sm font-mono truncate max-w-[200px] text-zinc-800 dark:text-zinc-200">
                          <div className="flex items-center">
                            <span title={validator.nodeId} className="truncate">{validator.nodeId.substring(0, 16)}...</span>
                            <button
                              onClick={() => copyToClipboard(validator.nodeId)}
                              className="ml-2 p-1 rounded-md hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                            >
                              <Tooltip content={copiedNodeId === validator.nodeId ? "Copied!" : "Copy Node ID"}>
                                {copiedNodeId === validator.nodeId ? (
                                  <Check size={14} className="text-green-500" />
                                ) : (
                                  <Copy size={14} className="text-zinc-500 dark:text-zinc-400" />
                                )}
                              </Tooltip>
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-zinc-800 dark:text-zinc-200">
                          <span className="font-medium text-blue-600 dark:text-blue-400">{formatAvaxBalance(validator.remainingBalance)}</span>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-zinc-800 dark:text-zinc-200">
                          <span className="font-medium">{formatStake(validator.weight)}</span>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-zinc-500 dark:text-zinc-400">
                          <div className="flex items-center">
                            <Calendar size={14} className="mr-1.5 text-zinc-400 dark:text-zinc-500" />
                            {formatTimestamp(validator.creationTimestamp)}
                          </div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <Button
                            variant="secondary"
                            onClick={() => handleViewDetails(validator)}
                            className="text-xs py-1.5 px-3 bg-white hover:bg-zinc-50 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 border border-zinc-300 dark:border-zinc-600 shadow-sm hover:shadow-md transition-all duration-200"
                          >
                            View Details
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : searchTerm ? (
            <div className="flex flex-col items-center justify-center py-12 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg">
              <Search className="h-8 w-8 text-zinc-400 mb-3" />
              <p className="text-zinc-600 dark:text-zinc-400 text-sm font-medium mb-1">No matching validators</p>
              <p className="text-zinc-500 dark:text-zinc-500 text-xs">Try a different search term</p>
            </div>
          ) : (
            <div className="text-center py-12 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg">
              <Users className="h-8 w-8 text-zinc-400 mx-auto mb-3" />
              <p className="text-zinc-600 dark:text-zinc-400 text-sm font-medium mb-1">No validators found</p>
              <p className="text-zinc-500 dark:text-zinc-500 text-xs">Try changing the subnet ID or check your network connection</p>
            </div>
          )}
        </div>
      )}

      {/* Validator Details Modal */}
      {selectedValidator && (
        <div className="bg-white dark:bg-zinc-900 rounded-lg p-6 border border-zinc-200 dark:border-zinc-800 mt-6 shadow-sm animate-fadeIn">
          <div className="flex items-center justify-between mb-5">
            <div className="flex flex-col">
              <h3 className="text-lg font-semibold text-zinc-800 dark:text-white">Validator Details</h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Detailed information about the selected validator</p>
            </div>
            <Button
              variant="secondary"
              onClick={() => setSelectedValidator(null)}
              className="text-xs py-1.5 px-3 bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 border border-zinc-300 dark:border-zinc-600 transition-colors"
            >
              Close
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Basic Information Card */}
            <div className="bg-zinc-50 dark:bg-zinc-800/70 p-5 rounded-lg border border-zinc-200 dark:border-zinc-700 shadow-sm hover:shadow-md transition-shadow duration-200">
              <h4 className="text-sm font-semibold mb-4 text-zinc-700 dark:text-zinc-300 flex items-center">
                <Users className="h-4 w-4 text-blue-500 dark:text-blue-400 mr-2" />
                Node Information
              </h4>
              <div className="space-y-4">
                <div className="p-3 bg-white dark:bg-zinc-900/80 rounded-md border border-zinc-200 dark:border-zinc-700">
                  <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Validation ID</p>
                  <div className="flex items-center">
                    <p
                      className="font-mono text-sm break-all text-zinc-800 dark:text-zinc-200"
                      title={selectedValidator.validationId}
                    >
                      {selectedValidator.validationId}
                    </p>
                    <button
                      onClick={() => copyToClipboard(selectedValidator.validationId)}
                      className="ml-1.5 p-1 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                      title="Copy Validation ID"
                    >
                      {copiedNodeId === selectedValidator.validationId ? (
                        <Check size={14} className="text-green-500" />
                      ) : (
                        <Copy size={14} className="text-zinc-500 dark:text-zinc-400" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="p-3 bg-white dark:bg-zinc-900/80 rounded-md border border-zinc-200 dark:border-zinc-700">
                  <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Node ID</p>
                  <div className="flex items-center">
                    <p
                      className="font-mono text-sm break-all text-zinc-800 dark:text-zinc-200"
                      title={selectedValidator.nodeId}
                    >
                      {selectedValidator.nodeId}
                    </p>
                    <button
                      onClick={() => copyToClipboard(selectedValidator.nodeId)}
                      className="ml-1.5 p-1 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                      title="Copy Node ID"
                    >
                      {copiedNodeId === selectedValidator.nodeId ? (
                        <Check size={14} className="text-green-500" />
                      ) : (
                        <Copy size={14} className="text-zinc-500 dark:text-zinc-400" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="p-3 bg-white dark:bg-zinc-900/80 rounded-md border border-zinc-200 dark:border-zinc-700">
                  <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Subnet ID</p>
                  <div className="flex items-center">
                    <p
                      className="font-mono text-sm break-all text-zinc-800 dark:text-zinc-200"
                      title={selectedValidator.subnetId}
                    >
                      {selectedValidator.subnetId}
                    </p>
                    <button
                      onClick={() => copyToClipboard(selectedValidator.subnetId)}
                      className="ml-1.5 p-1 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                      title="Copy Subnet ID"
                    >
                      {copiedNodeId === selectedValidator.subnetId ? (
                        <Check size={14} className="text-green-500" />
                      ) : (
                        <Copy size={14} className="text-zinc-500 dark:text-zinc-400" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Staking and Time Information */}
            <div className="space-y-5">
              {/* Staking Information */}
              <div className="bg-zinc-50 dark:bg-zinc-800/70 p-5 rounded-lg border border-zinc-200 dark:border-zinc-700 shadow-sm hover:shadow-md transition-shadow duration-200">
                <h4 className="text-sm font-semibold mb-4 text-zinc-700 dark:text-zinc-300 flex items-center">
                  <Coins className="h-4 w-4 text-blue-500 dark:text-blue-400 mr-2" />
                  Staking Information
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-3 bg-white dark:bg-zinc-900/80 rounded-md border border-zinc-200 dark:border-zinc-700 flex flex-col justify-between">
                    <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Weight</p>
                    <p className="font-mono text-base font-semibold text-zinc-800 dark:text-zinc-200">
                      {formatStake(selectedValidator.weight)}
                    </p>
                  </div>

                  <div className="p-3 bg-white dark:bg-zinc-900/80 rounded-md border border-zinc-200 dark:border-zinc-700 flex flex-col justify-between">
                    <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Balance</p>
                    <p className="font-mono text-base font-semibold text-blue-600 dark:text-blue-400">
                      {formatAvaxBalance(selectedValidator.remainingBalance)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Time Information */}
              <div className="bg-zinc-50 dark:bg-zinc-800/70 p-5 rounded-lg border border-zinc-200 dark:border-zinc-700 shadow-sm hover:shadow-md transition-shadow duration-200">
                <h4 className="text-sm font-semibold mb-4 text-zinc-700 dark:text-zinc-300 flex items-center">
                  <Clock className="h-4 w-4 text-blue-500 dark:text-blue-400 mr-2" />
                  Time Information
                </h4>
                <div className="p-3 bg-white dark:bg-zinc-900/80 rounded-md border border-zinc-200 dark:border-zinc-700">
                  <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Creation Time</p>
                  <div className="flex items-center">
                    <Calendar size={16} className="text-zinc-500 dark:text-zinc-400 mr-2" />
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
            <div className="bg-zinc-50 dark:bg-zinc-800/70 p-5 rounded-lg border border-zinc-200 dark:border-zinc-700 mt-5 shadow-sm hover:shadow-md transition-shadow duration-200">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 flex items-center">
                  <Users className="h-4 w-4 text-blue-500 dark:text-blue-400 mr-2" />
                  Remaining Balance Owner
                </h4>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300">
                  Threshold: {selectedValidator.remainingBalanceOwner.threshold}
                </span>
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Addresses</p>
                  <span className="bg-zinc-200 dark:bg-zinc-700 text-xs font-medium px-2.5 py-0.5 rounded-full text-zinc-700 dark:text-zinc-300">
                    {selectedValidator.remainingBalanceOwner.addresses.length}
                  </span>
                </div>
                <div className="max-h-48 overflow-y-auto border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900/80 divide-y divide-zinc-200 dark:divide-zinc-700">
                  {selectedValidator.remainingBalanceOwner.addresses.map((address, index) => (
                    <div key={index} className="flex items-center justify-between p-3">
                      <p className="font-mono text-sm break-all text-zinc-800 dark:text-zinc-200 pr-2">
                        {address}
                      </p>
                      <button
                        onClick={() => copyToClipboard(address)}
                        className="p-1 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors flex-shrink-0"
                        title="Copy Address"
                      >
                        {copiedNodeId === address ? (
                          <Check size={14} className="text-green-500" />
                        ) : (
                          <Copy size={14} className="text-zinc-500 dark:text-zinc-400" />
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
            <div className="bg-zinc-50 dark:bg-zinc-800/70 p-5 rounded-lg border border-zinc-200 dark:border-zinc-700 mt-5 shadow-sm hover:shadow-md transition-shadow duration-200">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 flex items-center">
                  <Users className="h-4 w-4 text-blue-500 dark:text-blue-400 mr-2" />
                  Deactivation Owner
                </h4>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300">
                  Threshold: {selectedValidator.deactivationOwner.threshold}
                </span>
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Addresses</p>
                  <span className="bg-zinc-200 dark:bg-zinc-700 text-xs font-medium px-2.5 py-0.5 rounded-full text-zinc-700 dark:text-zinc-300">
                    {selectedValidator.deactivationOwner.addresses.length}
                  </span>
                </div>
                <div className="max-h-48 overflow-y-auto border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900/80 divide-y divide-zinc-200 dark:divide-zinc-700">
                  {selectedValidator.deactivationOwner.addresses.map((address, index) => (
                    <div key={index} className="flex items-center justify-between p-3">
                      <p className="font-mono text-sm break-all text-zinc-800 dark:text-zinc-200 pr-2">
                        {address}
                      </p>
                      <button
                        onClick={() => copyToClipboard(address)}
                        className="p-1 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors flex-shrink-0"
                        title="Copy Address"
                      >
                        {copiedNodeId === address ? (
                          <Check size={14} className="text-green-500" />
                        ) : (
                          <Copy size={14} className="text-zinc-500 dark:text-zinc-400" />
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

      <div className="flex items-center justify-center text-xs text-zinc-500 dark:text-zinc-400 italic p-3 bg-zinc-100/50 dark:bg-zinc-800/50 rounded-md shadow-sm mt-6">
        <Info className="h-3.5 w-3.5 mr-1.5" />
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

