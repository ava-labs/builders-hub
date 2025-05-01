"use client"

import { useWalletStore } from "../../lib/walletStore"
import { useState } from "react"
import { Calendar, Clock, Users, Coins, Globe, Info, Copy, Check } from "lucide-react"
import { Container } from "../components/Container"
import { Button } from "../../components/Button"
import { networkIDs } from "@avalabs/avalanchejs"
import { GlobalParamNetwork, L1ValidatorDetailsFull } from "@avalabs/avacloud-sdk/models/components"
import { AvaCloudSDK } from "@avalabs/avacloud-sdk"
import SelectSubnetId from "../components/SelectSubnetId"

export default function QueryL1ValidatorSet() {
  const { avalancheNetworkID, setAvalancheNetworkID } = useWalletStore()
  const [validators, setValidators] = useState<L1ValidatorDetailsFull[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedValidator, setSelectedValidator] = useState<L1ValidatorDetailsFull | null>(null)
  const [copiedNodeId, setCopiedNodeId] = useState<string | null>(null)
  const [subnetId, setSubnetId] = useState<string>("")

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

  function formatAvaxBalance(balance: number): string {
    if (isNaN(balance)) return String(balance)

    // Format with commas and convert to AVAX (1 AVAX = 10^9 nAVAX)
    return (
      (balance / 1_000_000_000).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }) + " AVAX"
    )
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

  return (
    <Container title="L1 Validators" description="Query the validators of an L1 from the P-Chain using the Avalanche API">
      <div className="bg-white dark:bg-zinc-900 rounded-lg p-6 border border-zinc-200 dark:border-zinc-800 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50/30 to-transparent dark:from-blue-900/10 dark:to-transparent pointer-events-none"></div>

        <div className="relative">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
            <div className="space-y-1">
              <SelectSubnetId value={subnetId} onChange={setSubnetId} />
            </div>
            <div className="space-y-1">
              <label className="flex items-center text-xs font-medium text-blue-700 dark:text-blue-200">
                <Globe className="h-3.5 w-3.5 mr-1.5 text-blue-500 dark:text-blue-400" />
                Network ID
              </label>
              <div className="flex space-x-2">
                <Button
                  onClick={() => setAvalancheNetworkID(networkIDs.FujiID)}
                  className={`px-3 py-2 text-sm rounded-md flex-1 transition-colors ${avalancheNetworkID === networkIDs.FujiID
                    ? "bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-100 border border-blue-200 dark:border-blue-700"
                    : "bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700"
                    }`}
                >
                  Fuji
                </Button>
                <Button
                  onClick={() => setAvalancheNetworkID(networkIDs.MainnetID)}
                  className={`px-3 py-2 text-sm rounded-md flex-1 transition-colors ${avalancheNetworkID === networkIDs.MainnetID
                    ? "bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-100 border border-blue-200 dark:border-blue-700"
                    : "bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700"
                    }`}
                >
                  Mainnet
                </Button>
              </div>
            </div>
          </div>

          <Button
            onClick={() => fetchValidators()}
            disabled={isLoading}
            className={`w-full py-2 px-4 rounded-md text-sm font-medium flex items-center justify-center ${isLoading
              ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 cursor-not-allowed"
              : "bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-sm hover:shadow transition-all duration-200"
              }`}
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Fetching Validators...
              </>
            ) : (
              "Fetch Validators"
            )}
          </Button>
        </div>
      </div>

      {/* Validators List Card */}
      {error ? (
        <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border border-red-200 dark:border-red-800">
          <p className="text-red-700 dark:text-red-400">{error}</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-zinc-900 rounded-lg p-6 border border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <h3 className="text-lg font-semibold text-zinc-800 dark:text-white flex items-center">Validator List</h3>
            </div>
            <div className="flex items-center gap-2">
              <span className="bg-zinc-200 dark:bg-zinc-700 text-xs font-medium px-2 py-1 rounded-full text-zinc-700 dark:text-zinc-300">
                {validators.length} Validators
              </span>
            </div>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
          ) : <></>}
          {validators.length > 0 ? (
            <div className="space-y-4">
              <div className="bg-zinc-50 dark:bg-zinc-800 rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead>
                      <tr className="border-b border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800/80">
                        <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                          Node ID
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                          AVAX Balance
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                          Weight
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                          Created
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200 dark:divide-zinc-700">
                      {validators.map((validator, index) => (
                        <tr key={index} className="hover:bg-zinc-100 dark:hover:bg-zinc-800">
                          <td className="px-4 py-3 text-sm font-mono truncate max-w-[200px] text-zinc-800 dark:text-zinc-200">
                            <div className="flex items-center">
                              <span title={validator.nodeId} className="truncate">{validator.nodeId}</span>
                              <button
                                onClick={() => copyToClipboard(validator.nodeId)}
                                className="ml-2 p-1 rounded-md hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                                title="Copy Node ID"
                              >
                                {copiedNodeId === validator.nodeId ? (
                                  <Check size={14} className="text-green-500" />
                                ) : (
                                  <Copy size={14} className="text-zinc-500 dark:text-zinc-400" />
                                )}
                              </button>
                            </div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-zinc-800 dark:text-zinc-200">
                            {formatAvaxBalance(validator.remainingBalance)}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-zinc-800 dark:text-zinc-200">
                            {formatStake(validator.weight)}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-zinc-800 dark:text-zinc-200">
                            {formatTimestamp(validator.creationTimestamp)}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <Button
                              variant="secondary"
                              onClick={() => handleViewDetails(validator)}
                              className="text-xs py-1 px-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 border border-zinc-300 dark:border-zinc-700"
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
            </div>
          ) : (
            <div className="text-center py-8 text-zinc-500 dark:text-zinc-400">
              <p>No validators found</p>
            </div>
          )}
        </div>
      )}

      {/* Validator Details Modal */}
      {selectedValidator && (
        <div className="bg-white dark:bg-zinc-900 rounded-lg p-6 border border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-zinc-800 dark:text-white">Validator Details</h3>
            <Button
              variant="secondary"
              onClick={() => setSelectedValidator(null)}
              className="text-xs py-1 px-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 border border-zinc-300 dark:border-zinc-700"
            >
              Close
            </Button>
          </div>

          <div className="space-y-4">
            {/* Basic Information Card */}
            <div className="bg-zinc-50 dark:bg-zinc-800/70 p-4 rounded-lg border border-zinc-200 dark:border-zinc-700">
              <h4 className="text-sm font-semibold mb-3 text-zinc-700 dark:text-zinc-300 flex items-center">
                <Users className="h-4 w-4 text-blue-500 dark:text-blue-400 mr-2" />
                Node Information
              </h4>
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-1">Validation ID</p>
                  <p
                    className="font-mono text-sm break-all text-zinc-800 dark:text-zinc-200"
                    title={selectedValidator.validationId}
                  >
                    {selectedValidator.validationId}
                  </p>
                </div>

                <div>
                  <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-1">Node ID</p>
                  <div className="flex items-center space-x-2">
                    <p
                      className="font-mono text-sm break-all text-zinc-800 dark:text-zinc-200"
                      title={selectedValidator.nodeId}
                    >
                      {selectedValidator.nodeId}
                    </p>
                    <button
                      onClick={() => copyToClipboard(selectedValidator.nodeId)}
                      className="p-1 rounded-md hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                      title="Copy Node ID"
                    >
                      {copiedNodeId === selectedValidator.nodeId ? (
                        <Check size={16} className="text-green-500" />
                      ) : (
                        <Copy size={16} className="text-zinc-500 dark:text-zinc-400" />
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-1">Subnet ID</p>
                  <p
                    className="font-mono text-sm break-all text-zinc-800 dark:text-zinc-200"
                    title={selectedValidator.subnetId}
                  >
                    {selectedValidator.subnetId}
                  </p>
                </div>
              </div>
            </div>

            {/* Staking Information */}
            <div className="bg-zinc-50 dark:bg-zinc-800/70 p-4 rounded-lg border border-zinc-200 dark:border-zinc-700">
              <h4 className="text-sm font-semibold mb-3 text-zinc-700 dark:text-zinc-300 flex items-center">
                <Coins className="h-4 w-4 text-blue-500 dark:text-blue-400 mr-2" />
                Staking Information
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-1">Weight</p>
                  <p className="font-mono text-sm text-zinc-800 dark:text-zinc-200">
                    {formatStake(selectedValidator.weight)}
                  </p>
                </div>

                <div>
                  <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-1">Remaining Balance</p>
                  <p className="font-mono text-sm text-zinc-800 dark:text-zinc-200">
                    {formatAvaxBalance(selectedValidator.remainingBalance)}
                  </p>
                </div>
              </div>
            </div>

            {/* Time Information */}
            <div className="bg-zinc-50 dark:bg-zinc-800/70 p-4 rounded-lg border border-zinc-200 dark:border-zinc-700">
              <h4 className="text-sm font-semibold mb-3 text-zinc-700 dark:text-zinc-300 flex items-center">
                <Clock className="h-4 w-4 text-blue-500 dark:text-blue-400 mr-2" />
                Time Information
              </h4>
              <div>
                <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-1">Creation Time</p>
                <div className="flex items-center">
                  <Calendar size={14} className="text-zinc-500 dark:text-zinc-400 mr-2" />
                  <p className="font-mono text-sm text-zinc-800 dark:text-zinc-200">
                    {formatTimestamp(selectedValidator.creationTimestamp)}
                  </p>
                </div>
              </div>
            </div>

            {/* Remaining Balance Owner Information */}
            {selectedValidator.remainingBalanceOwner && (
              <div className="bg-zinc-50 dark:bg-zinc-800/70 p-4 rounded-lg border border-zinc-200 dark:border-zinc-700">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 flex items-center">
                    <Users className="h-4 w-4 text-blue-500 dark:text-blue-400 mr-2" />
                    Remaining Balance Owner
                  </h4>
                </div>

                <div className="mb-3">
                  <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-1">Threshold</p>
                  <p className="font-mono text-sm text-zinc-800 dark:text-zinc-200">
                    {selectedValidator.remainingBalanceOwner.threshold}
                  </p>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Addresses</p>
                    <span className="bg-zinc-200 dark:bg-zinc-700 text-xs font-medium px-2 py-1 rounded-full text-zinc-700 dark:text-zinc-300">
                      {selectedValidator.remainingBalanceOwner.addresses.length}
                    </span>
                  </div>
                  <div className="max-h-40 overflow-y-auto border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900/80">
                    {selectedValidator.remainingBalanceOwner.addresses.map((address, index) => (
                      <div
                        key={index}
                        className="p-2 font-mono text-sm break-all border-b border-zinc-200 dark:border-zinc-700 last:border-b-0 text-zinc-800 dark:text-zinc-200"
                      >
                        {address}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Deactivation Owner Information */}
            {selectedValidator.deactivationOwner && (
              <div className="bg-zinc-50 dark:bg-zinc-800/70 p-4 rounded-lg border border-zinc-200 dark:border-zinc-700">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 flex items-center">
                    <Users className="h-4 w-4 text-blue-500 dark:text-blue-400 mr-2" />
                    Deactivation Owner
                  </h4>
                </div>

                <div className="mb-3">
                  <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-1">Threshold</p>
                  <p className="font-mono text-sm text-zinc-800 dark:text-zinc-200">
                    {selectedValidator.deactivationOwner.threshold}
                  </p>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Addresses</p>
                    <span className="bg-zinc-200 dark:bg-zinc-700 text-xs font-medium px-2 py-1 rounded-full text-zinc-700 dark:text-zinc-300">
                      {selectedValidator.deactivationOwner.addresses.length}
                    </span>
                  </div>
                  <div className="max-h-40 overflow-y-auto border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900/80">
                    {selectedValidator.deactivationOwner.addresses.map((address, index) => (
                      <div
                        key={index}
                        className="p-2 font-mono text-sm break-all border-b border-zinc-200 dark:border-zinc-700 last:border-b-0 text-zinc-800 dark:text-zinc-200"
                      >
                        {address}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="flex items-center justify-center text-xs text-zinc-500 dark:text-zinc-400 italic p-2 bg-zinc-100/50 dark:bg-zinc-800/50 rounded-md shadow-sm">
        <Info className="h-3.5 w-3.5 mr-1.5" />
        <a href="https://developers.avacloud.io/data-api/primary-network/list-validators" target="_blank" rel="noopener noreferrer" className="underline hover:text-zinc-700 dark:hover:text-zinc-300">Data retrieved from Data API</a>
      </div>
    </Container>
  )
}

