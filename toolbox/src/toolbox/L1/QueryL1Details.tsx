"use client";

import { useState, useEffect } from "react"
import {
  AlertCircle,
  Info,
  CheckCircle,
  Clock,
  Users,
  Database,
  ExternalLink,
} from "lucide-react"
import { Container } from "../../components/Container"
import SelectSubnet, { SubnetSelection } from "../../components/SelectSubnet"

export default function QueryL1Details() {
  const [selection, setSelection] = useState<SubnetSelection>({ subnetId: '', subnet: null })
  const [error, setError] = useState<string | null>(null)


  // Update error state when subnet details change
  useEffect(() => {
    if (selection.subnetId && !selection.subnet) {
      setError("Failed to fetch subnet details")
    } else {
      setError(null)
    }
  }, [selection])

  function formatTimestamp(timestamp: number): string {
    return new Date(timestamp * 1000).toLocaleString()
  }

  return (
    <Container title="Subnet Details" description="Query the data of the Subnet from the P-Chain using the Avalanche API">
      <div className="relative z-0">
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

          <div className="mb-4 relative z-10">
            <SelectSubnet
              value={selection.subnetId}
              onChange={setSelection}
              error={null}
            />
          </div>
        </div>

        {selection.subnet && (
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
                            {selection.subnet.subnetId}
                          </code>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div
                    className={`px-3 py-1 rounded-full text-xs font-medium flex items-center ${selection.subnet.isL1
                      ? "bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-100"
                      : "bg-purple-100 dark:bg-purple-900/50 text-purple-800 dark:text-purple-100"
                      }`}
                  >
                    <div
                      className={`w-1.5 h-1.5 rounded-full mr-1.5 ${selection.subnet.isL1 ? "bg-blue-500" : "bg-purple-500"
                        }`}
                    ></div>
                    {selection.subnet.isL1 ? "Sovereign L1" : "Subnet"}
                  </div>
                </div>

                {/* Compact Details Section */}
                <div className="space-y-2">
                  {/* Basic Info Section */}
                  <div
                    className="bg-zinc-50 dark:bg-zinc-800/70 rounded-md border border-zinc-200 dark:border-zinc-700 overflow-hidden cursor-pointer"
                  >
                    <div className="flex items-center justify-between p-2">
                      <div className="flex items-center">
                        <Clock className="h-4 w-4 text-blue-500 dark:text-blue-400 mr-2" />
                        <h4 className="text-sm font-medium text-zinc-700 dark:text-zinc-200">Basic Information</h4>
                      </div>
                    </div>
                    <div className="p-2 border-t border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900/80">
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-zinc-500 dark:text-zinc-400">Created:</span>
                          <p className="font-mono text-zinc-900 dark:text-zinc-100">
                            {formatTimestamp(selection.subnet.createBlockTimestamp)}
                          </p>
                        </div>
                        <div>
                          <span className="text-zinc-500 dark:text-zinc-400">Block Index:</span>
                          <p className="font-mono text-zinc-900 dark:text-zinc-100">
                            {selection.subnet.createBlockIndex}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* L1 Specific Information */}
                  {selection.subnet.isL1 && (
                    <div
                      className="bg-zinc-50 dark:bg-zinc-800/70 rounded-md border border-zinc-200 dark:border-zinc-700 overflow-hidden cursor-pointer"
                    >
                      <div className="flex items-center justify-between p-2">
                        <div className="flex items-center">
                          <Database className="h-4 w-4 text-blue-500 dark:text-blue-400 mr-2" />
                          <h4 className="text-sm font-medium text-zinc-700 dark:text-zinc-200">L1 Details</h4>
                        </div>

                      </div>
                      <div className="p-2 border-t border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900/80">
                        {selection.subnet.l1ValidatorManagerDetails && (
                          <div className="space-y-2">
                            <div>
                              <span className="text-zinc-500 dark:text-zinc-400 text-xs">Validator Manager Blockchain ID:</span>
                              <p className="font-mono text-xs text-zinc-900 dark:text-zinc-100 mt-1">
                                {selection.subnet.l1ValidatorManagerDetails.blockchainId}
                              </p>
                            </div>
                            <div>
                              <span className="text-zinc-500 dark:text-zinc-400 text-xs">Validator Manager Contract Address:</span>
                              <div className="flex items-center mt-1">
                                <p className="font-mono text-xs text-zinc-900 dark:text-zinc-100 truncate">
                                  {selection.subnet.l1ValidatorManagerDetails.contractAddress}
                                </p>
                                <a
                                  href={`https://subnets.avax.network/c-chain/address/${selection.subnet.l1ValidatorManagerDetails.contractAddress}`}
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

                        {selection.subnet.l1ConversionTransactionHash && (
                          <div className="mb-2">
                            <span className="text-zinc-500 dark:text-zinc-400 text-xs">L1 Conversion P-Chain Transaction ID:</span>
                            <div className="flex items-center mt-1">
                              <p className="font-mono text-xs text-zinc-900 dark:text-zinc-100 truncate">
                                {selection.subnet.l1ConversionTransactionHash}
                              </p>
                              <a
                                href={`https://subnets.avax.network/p-chain/tx/${selection.subnet.l1ConversionTransactionHash}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="ml-1 p-1 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                              >
                                <ExternalLink className="h-3 w-3 text-blue-500 dark:text-blue-400" />
                              </a>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Subnet Ownership */}
                  <div
                    className="bg-zinc-50 dark:bg-zinc-800/70 rounded-md border border-zinc-200 dark:border-zinc-700 overflow-hidden cursor-pointer"
                  >
                    <div className="flex items-center justify-between p-2">
                      <div className="flex items-center">
                        <Users className="h-4 w-4 text-blue-500 dark:text-blue-400 mr-2" />
                        <h4 className="text-sm font-medium text-zinc-700 dark:text-zinc-200">Subnet Ownership</h4>
                      </div>
                      <div className="flex items-center">
                        <span className="bg-zinc-200 dark:bg-zinc-700 text-xs font-medium px-2 py-0.5 rounded-full text-zinc-700 dark:text-zinc-200 mr-2">
                          {selection.subnet.subnetOwnershipInfo.addresses.length}
                        </span>

                      </div>
                    </div>

                    <div className="p-2 border-t border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900/80">
                      <div className="grid grid-cols-2 gap-2 text-xs mb-2">
                        <div>
                          <span className="text-zinc-500 dark:text-zinc-400">Threshold:</span>
                          <p className="font-mono text-zinc-900 dark:text-zinc-100">
                            {selection.subnet.subnetOwnershipInfo.threshold}
                          </p>
                        </div>
                        <div>
                          <span className="text-zinc-500 dark:text-zinc-400">Locktime:</span>
                          <p className="font-mono text-zinc-900 dark:text-zinc-100">
                            {selection.subnet.subnetOwnershipInfo.locktime}
                          </p>
                        </div>
                      </div>

                      <div className="mt-2">
                        <span className="text-zinc-500 dark:text-zinc-400 text-xs">Owner Addresses:</span>
                        <div className="max-h-32 overflow-y-auto mt-1 rounded border border-zinc-200 dark:border-zinc-700">
                          {selection.subnet.subnetOwnershipInfo.addresses.map((address, index) => (
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
                  </div>

                  {/* Blockchains */}
                  {selection.subnet.blockchains && selection.subnet.blockchains.length > 0 && (
                    <div
                      className="bg-zinc-50 dark:bg-zinc-800/70 rounded-md border border-zinc-200 dark:border-zinc-700 overflow-hidden cursor-pointer"
                    >
                      <div className="flex items-center justify-between p-2">
                        <div className="flex items-center">
                          <Database className="h-4 w-4 text-blue-500 dark:text-blue-400 mr-2" />
                          <h4 className="text-sm font-medium text-zinc-700 dark:text-zinc-200">Blockchains</h4>
                        </div>
                        <div className="flex items-center">
                          <span className="bg-zinc-200 dark:bg-zinc-700 text-xs font-medium px-2 py-0.5 rounded-full text-zinc-700 dark:text-zinc-200 mr-2">
                            {selection.subnet.blockchains.length}
                          </span>
                        </div>
                      </div>

                      <div className="p-2 border-t border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900/80">
                        <div className="space-y-1.5">
                          {selection.subnet.blockchains.map((blockchain, index) => (
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
                            </div>
                          ))}
                        </div>
                      </div>
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

