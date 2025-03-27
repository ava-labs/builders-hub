"use client"

import { useToolboxStore, useWalletStore } from "../../utils/store"
import { useState, useEffect } from "react"
import {
  AlertCircle,
  Info,
  CheckCircle,
  Loader2,
  Globe,
  Clock,
  Users,
  Database,
  ExternalLink,
  ChevronRight,
} from "lucide-react"
import { networkIDs } from "@avalabs/avalanchejs"
import { Input } from "../../../components/input"
import { Button } from "../../../components/button"
import { Container } from "../../../components/container"
interface SubnetDetails {
  createBlockTimestamp: number
  createBlockIndex: string
  subnetId: string
  ownerAddresses: string[]
  threshold: number
  locktime: number
  subnetOwnershipInfo: {
    locktime: number
    threshold: number
    addresses: string[]
  }
  isL1: boolean
  l1ConversionTransactionHash?: string
  l1ValidatorManagerDetails?: {
    blockchainId: string
    contractAddress: string
  }
  blockchains: {
    blockchainId: string
  }[]
}

export default function SubnetDetails() {
  const { subnetID, setSubnetID } = useToolboxStore()
  const { avalancheNetworkID, setAvalancheNetworkID } = useWalletStore()
  const [subnetDetails, setSubnetDetails] = useState<SubnetDetails | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [expandedSection, setExpandedSection] = useState<string | null>(null)

  // Network names for display
  const networkNames: Record<number, string> = {
    [networkIDs.MainnetID]: "mainnet",
    [networkIDs.FujiID]: "fuji",
  }

  useEffect(() => {
    if (subnetID) {
      fetchSubnetDetails()
    }
  }, [subnetID, avalancheNetworkID])

  async function fetchSubnetDetails() {
    if (!subnetID) {
      setError("Please enter a subnet ID")
      return
    }

    setIsLoading(true)
    setError(null)
    setSuccess(false)

    try {
      const network = networkNames[Number(avalancheNetworkID)]
      if (!network) {
        throw new Error("Invalid network selected")
      }

      const response = await fetch(`https://glacier-api.avax.network/v1/networks/${network}/subnets/${subnetID}`)

      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`)
      }

      const data = await response.json()
      setSubnetDetails(data)
      setSuccess(true)
    } catch (error: any) {
      setError(error.message || "Failed to fetch subnet details")
      setSubnetDetails(null)
      console.error("Error fetching subnet details:", error)
    } finally {
      setIsLoading(false)
    }
  }

  function formatTimestamp(timestamp: number): string {
    return new Date(timestamp * 1000).toLocaleString()
  }

  function toggleSection(section: string) {
    if (expandedSection === section) {
      setExpandedSection(null)
    } else {
      setExpandedSection(section)
    }
  }

  return (
    <Container title="Subnet Details" description="View information about an Avalanche subnet" logoSrc="/images/avacloud.png" logoAlt="AvaCloud Logo" logoColorTheme="blue">
      <div className="relative">
        {/* Background gradient effect - blue for both light and dark mode */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50/30 to-transparent dark:from-blue-900/10 dark:to-cyan-900/5 pointer-events-none"></div>

        <div className="relative">
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md text-red-700 dark:text-red-300 text-sm">
              <div className="flex items-center">
                <AlertCircle className="h-4 w-4 text-red-500 mr-2 flex-shrink-0" />
                <span>{error}</span>
              </div>
            </div>
          )}

          {success && !subnetDetails && (
            <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md text-green-800 dark:text-green-200 text-sm">
              <div className="flex items-center">
                <CheckCircle className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                <span>Subnet details retrieved successfully</span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
            <div className="space-y-1">
            <label className="flex items-center text-xs font-medium text-blue-700 dark:text-blue-200">
                <Database className="h-3.5 w-3.5 mr-1.5 text-blue-500 dark:text-blue-400" /> Subnet ID
            </label>
              <Input
                label=""
                type="text"
                value={subnetID}
                onChange={(newValue: string) => setSubnetID(newValue)}
                placeholder="Enter subnet ID"
                className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-md text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400"
              />
            </div>

            <div className="space-y-1">
              <label className="flex items-center text-xs font-medium text-blue-700 dark:text-blue-200">
                <Globe className="h-3.5 w-3.5 mr-1.5 text-blue-500 dark:text-blue-400" /> Network ID
              </label>

              <div className="flex space-x-2">
                <Button
                  onClick={() => setAvalancheNetworkID(networkIDs.FujiID)}
                  className={`px-3 py-2 text-sm rounded-md flex-1 transition-colors ${
                    avalancheNetworkID === networkIDs.FujiID
                      ? "bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-100 border border-blue-200 dark:border-blue-700"
                      : "bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700"
                  }`}
                >
                  Fuji
                </Button>

                <Button
                  onClick={() => setAvalancheNetworkID(networkIDs.MainnetID)}
                  className={`px-3 py-2 text-sm rounded-md flex-1 transition-colors ${
                    avalancheNetworkID === networkIDs.MainnetID
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
            onClick={fetchSubnetDetails}
            disabled={!subnetID || isLoading}
            className={`w-full py-2 px-4 rounded-md text-sm font-medium flex items-center justify-center ${
              !subnetID || isLoading
                ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 cursor-not-allowed"
                : "bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-sm hover:shadow transition-all duration-200"
            }`}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Fetching Details...
              </>
            ) : (
              "Fetch Subnet Details"
            )}
          </Button>
        </div>

        {subnetDetails && (
          <div className="space-y-3 mt-4">
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-md rounded-xl p-4 relative overflow-hidden">
              {/* Background gradient effect - blue for both light and dark mode */}
              <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 to-transparent dark:from-blue-900/20 dark:to-cyan-900/5 pointer-events-none"></div>

              <div className="relative">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center">
                    <div className="bg-blue-100 dark:bg-blue-900/30 rounded-lg p-2 mr-3 shadow-sm">
                      <CheckCircle className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <div className="flex flex-col">
                        <h3 className="text-base font-semibold text-zinc-800 dark:text-white mb-1">Subnet Found</h3>
                        <div className="flex items-center">
                          <span className="text-xs text-zinc-500 dark:text-zinc-400 mr-2">Subnet ID:</span>
                          <code className="text-xs font-mono bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1 rounded-md text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
                            {subnetDetails.subnetId}
                          </code>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div
                    className={`px-3 py-1 rounded-full text-xs font-medium flex items-center ${
                      subnetDetails.isL1
                        ? "bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-100"
                        : "bg-purple-100 dark:bg-purple-900/50 text-purple-800 dark:text-purple-100"
                    }`}
                  >
                    <div
                      className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                        subnetDetails.isL1 ? "bg-blue-500" : "bg-purple-500"
                      }`}
                    ></div>
                    {subnetDetails.isL1 ? "Sovereign L1" : "Subnet"}
                  </div>
                </div>

                {/* Compact Details Section */}
                <div className="space-y-2">
                  {/* Basic Info Section */}
                  <div
                    className="bg-zinc-50 dark:bg-zinc-800/70 rounded-md border border-zinc-200 dark:border-zinc-700 overflow-hidden cursor-pointer"
                    onClick={() => toggleSection("basic")}
                  >
                    <div className="flex items-center justify-between p-2">
                      <div className="flex items-center">
                        <Clock className="h-4 w-4 text-blue-500 dark:text-blue-400 mr-2" />
                        <h4 className="text-sm font-medium text-zinc-700 dark:text-zinc-200">Basic Information</h4>
                      </div>
                      <ChevronRight
                        className={`h-4 w-4 text-zinc-500 dark:text-zinc-400 transition-transform ${expandedSection === "basic" ? "rotate-90" : ""}`}
                      />
                    </div>

                    {expandedSection === "basic" && (
                      <div className="p-2 border-t border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900/80">
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <span className="text-zinc-500 dark:text-zinc-400">Created:</span>
                            <p className="font-mono text-zinc-900 dark:text-zinc-100">
                              {formatTimestamp(subnetDetails.createBlockTimestamp)}
                            </p>
                          </div>
                          <div>
                            <span className="text-zinc-500 dark:text-zinc-400">Block Index:</span>
                            <p className="font-mono text-zinc-900 dark:text-zinc-100">
                              {subnetDetails.createBlockIndex}
                            </p>
                          </div>
                          <div>
                            <span className="text-zinc-500 dark:text-zinc-400">Threshold:</span>
                            <p className="font-mono text-zinc-900 dark:text-zinc-100">{subnetDetails.threshold}</p>
                          </div>
                          <div>
                            <span className="text-zinc-500 dark:text-zinc-400">Locktime:</span>
                            <p className="font-mono text-zinc-900 dark:text-zinc-100">{subnetDetails.locktime}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* L1 Specific Information */}
                  {subnetDetails.isL1 && (
                    <div
                      className="bg-zinc-50 dark:bg-zinc-800/70 rounded-md border border-zinc-200 dark:border-zinc-700 overflow-hidden cursor-pointer"
                      onClick={() => toggleSection("l1")}
                    >
                      <div className="flex items-center justify-between p-2">
                        <div className="flex items-center">
                          <Database className="h-4 w-4 text-blue-500 dark:text-blue-400 mr-2" />
                          <h4 className="text-sm font-medium text-zinc-700 dark:text-zinc-200">L1 Details</h4>
                        </div>
                        <ChevronRight
                          className={`h-4 w-4 text-zinc-500 dark:text-zinc-400 transition-transform ${expandedSection === "l1" ? "rotate-90" : ""}`}
                        />
                      </div>

                      {expandedSection === "l1" && (
                        <div className="p-2 border-t border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900/80">
                          {subnetDetails.l1ConversionTransactionHash && (
                            <div className="mb-2">
                              <span className="text-zinc-500 dark:text-zinc-400 text-xs">Transaction Hash:</span>
                              <div className="flex items-center mt-1">
                                <p className="font-mono text-xs text-zinc-900 dark:text-zinc-100 truncate">
                                  {subnetDetails.l1ConversionTransactionHash}
                                </p>
                                <a
                                  href={`https://subnets.avax.network/c-chain/tx/${subnetDetails.l1ConversionTransactionHash}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="ml-1 p-1 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                                >
                                  <ExternalLink className="h-3 w-3 text-blue-500 dark:text-blue-400" />
                                </a>
                              </div>
                            </div>
                          )}

                          {subnetDetails.l1ValidatorManagerDetails && (
                            <div className="space-y-2">
                              <div>
                                <span className="text-zinc-500 dark:text-zinc-400 text-xs">Blockchain ID:</span>
                                <p className="font-mono text-xs text-zinc-900 dark:text-zinc-100 mt-1">
                                  {subnetDetails.l1ValidatorManagerDetails.blockchainId}
                                </p>
                              </div>
                              <div>
                                <span className="text-zinc-500 dark:text-zinc-400 text-xs">Contract Address:</span>
                                <div className="flex items-center mt-1">
                                  <p className="font-mono text-xs text-zinc-900 dark:text-zinc-100 truncate">
                                    {subnetDetails.l1ValidatorManagerDetails.contractAddress}
                                  </p>
                                  <a
                                    href={`https://subnets.avax.network/c-chain/address/${subnetDetails.l1ValidatorManagerDetails.contractAddress}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="ml-1 p-1 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                                  >
                                    <ExternalLink className="h-3 w-3 text-blue-500 dark:text-blue-400" />
                                  </a>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Subnet Ownership */}
                  <div
                    className="bg-zinc-50 dark:bg-zinc-800/70 rounded-md border border-zinc-200 dark:border-zinc-700 overflow-hidden cursor-pointer"
                    onClick={() => toggleSection("ownership")}
                  >
                    <div className="flex items-center justify-between p-2">
                      <div className="flex items-center">
                        <Users className="h-4 w-4 text-blue-500 dark:text-blue-400 mr-2" />
                        <h4 className="text-sm font-medium text-zinc-700 dark:text-zinc-200">Subnet Ownership</h4>
                      </div>
                      <div className="flex items-center">
                        <span className="bg-zinc-200 dark:bg-zinc-700 text-xs font-medium px-2 py-0.5 rounded-full text-zinc-700 dark:text-zinc-200 mr-2">
                          {subnetDetails.subnetOwnershipInfo.addresses.length}
                        </span>
                        <ChevronRight
                          className={`h-4 w-4 text-zinc-500 dark:text-zinc-400 transition-transform ${expandedSection === "ownership" ? "rotate-90" : ""}`}
                        />
                      </div>
                    </div>

                    {expandedSection === "ownership" && (
                      <div className="p-2 border-t border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900/80">
                        <div className="grid grid-cols-2 gap-2 text-xs mb-2">
                          <div>
                            <span className="text-zinc-500 dark:text-zinc-400">Threshold:</span>
                            <p className="font-mono text-zinc-900 dark:text-zinc-100">
                              {subnetDetails.subnetOwnershipInfo.threshold}
                            </p>
                          </div>
                          <div>
                            <span className="text-zinc-500 dark:text-zinc-400">Locktime:</span>
                            <p className="font-mono text-zinc-900 dark:text-zinc-100">
                              {subnetDetails.subnetOwnershipInfo.locktime}
                            </p>
                          </div>
                        </div>

                        <div className="mt-2">
                          <span className="text-zinc-500 dark:text-zinc-400 text-xs">Owner Addresses:</span>
                          <div className="max-h-32 overflow-y-auto mt-1 rounded border border-zinc-200 dark:border-zinc-700">
                            {subnetDetails.subnetOwnershipInfo.addresses.map((address, index) => (
                              <div
                                key={index}
                                className="p-1.5 font-mono text-xs text-zinc-900 dark:text-zinc-100 break-all bg-white dark:bg-zinc-900/80 border-b border-zinc-200 dark:border-zinc-700 last:border-b-0"
                              >
                                {address}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Blockchains */}
                  {subnetDetails.blockchains && subnetDetails.blockchains.length > 0 && (
                    <div
                      className="bg-zinc-50 dark:bg-zinc-800/70 rounded-md border border-zinc-200 dark:border-zinc-700 overflow-hidden cursor-pointer"
                      onClick={() => toggleSection("blockchains")}
                    >
                      <div className="flex items-center justify-between p-2">
                        <div className="flex items-center">
                          <Database className="h-4 w-4 text-blue-500 dark:text-blue-400 mr-2" />
                          <h4 className="text-sm font-medium text-zinc-700 dark:text-zinc-200">Blockchains</h4>
                        </div>
                        <div className="flex items-center">
                          <span className="bg-zinc-200 dark:bg-zinc-700 text-xs font-medium px-2 py-0.5 rounded-full text-zinc-700 dark:text-zinc-200 mr-2">
                            {subnetDetails.blockchains.length}
                          </span>
                          <ChevronRight
                            className={`h-4 w-4 text-zinc-500 dark:text-zinc-400 transition-transform ${expandedSection === "blockchains" ? "rotate-90" : ""}`}
                          />
                        </div>
                      </div>

                      {expandedSection === "blockchains" && (
                        <div className="p-2 border-t border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900/80">
                          <div className="space-y-1.5">
                            {subnetDetails.blockchains.map((blockchain, index) => (
                              <div
                                key={index}
                                className="flex items-center p-1.5 bg-zinc-50 dark:bg-zinc-800/50 rounded-md border border-zinc-200 dark:border-zinc-700"
                              >
                                <div className="bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs font-semibold p-1 rounded-md mr-2 min-w-[20px] text-center">
                                  #{index + 1}
                                </div>
                                <div className="flex-1 overflow-hidden">
                                  <p className="font-mono text-xs text-zinc-900 dark:text-zinc-100 truncate">
                                    {blockchain.blockchainId}
                                  </p>
                                </div>
                                <a
                                  href={`https://subnets.avax.network/subnet/${subnetDetails.subnetId}/blockchain/${blockchain.blockchainId}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="ml-1 p-1 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                                >
                                  <ExternalLink className="h-3 w-3 text-blue-500 dark:text-blue-400" />
                                </a>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-center text-xs text-zinc-500 dark:text-zinc-400 italic p-2 bg-zinc-100/50 dark:bg-zinc-800/50 rounded-md shadow-sm">
              <Info className="h-3.5 w-3.5 mr-1.5" />
              <a href="https://developers.avacloud.io/data-api/primary-network/get-subnet-details-by-id" target="_blank" rel="noopener noreferrer" className="underline hover:text-zinc-700 dark:hover:text-zinc-300">Data retrieved from Data API</a>
            </div>
          </div>
        )}
      </div>
    </Container>
  )
}

