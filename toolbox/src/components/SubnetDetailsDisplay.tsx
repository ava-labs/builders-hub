"use client"

import type { Subnet } from "@avalabs/avacloud-sdk/models/components"
import { Calendar, Users, Database, Key, Copy, AlertTriangle, FileText } from "lucide-react"
import { useState } from "react"

interface SubnetDetailsDisplayProps {
    subnet: Subnet | null
    isLoading?: boolean
}

export default function SubnetDetailsDisplay({ subnet, isLoading }: SubnetDetailsDisplayProps) {
    const [copiedText, setCopiedText] = useState<string | null>(null)

    // Standard EVM VM ID
    const STANDARD_EVM_VM_ID = "srEXiWaHuhNyGwPUi444Tu47ZEDwxTWrbQiuD7FmgSAQ6X7Dy"

    if (isLoading) {
        return (
            <div className="w-full mt-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md shadow-sm">
                <div className="p-3">
                    <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 dark:border-blue-400"></div>
                        <span className="ml-2 text-xs text-zinc-500 dark:text-zinc-400">Loading subnet details...</span>
                    </div>
                </div>
            </div>
        )
    }

    if (!subnet) {
        return null
    }

    const formatTimestamp = (timestamp: number) => {
        const date = new Date(timestamp * 1000)
        const now = new Date()

        if (date > now && date.getFullYear() > now.getFullYear() + 1) {
            return new Date(timestamp).toLocaleDateString("en-US", {
                year: "2-digit",
                month: "short",
                day: "numeric",
            })
        }

        return date.toLocaleDateString("en-US", {
            year: "2-digit",
            month: "short",
            day: "numeric",
        })
    }

    const copyToClipboard = (text: string | undefined | null) => {
        if (!text) return
        navigator.clipboard.writeText(text)
        setCopiedText(text)
        setTimeout(() => setCopiedText(null), 2000)
    }

    return (
        <div className="w-full mt-3 border border-zinc-200 dark:border-zinc-800 rounded-md shadow-sm overflow-hidden">
            {/* Lighter Gray Header */}
            <div className="px-3 py-1.5 bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-700">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-50 flex items-center">Subnet Details</h3>
                    <span
                        className={`px-2 py-1 text-xs font-medium rounded-full ${subnet.isL1
                            ? "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200"
                            : "bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200"
                            }`}
                    >
                        {subnet.isL1 ? "L1 Chain" : "Subnet"}
                    </span>
                </div>
            </div>

            {/* White Content Area */}
            <div className="p-3 bg-white dark:bg-zinc-900 space-y-3">
                {/* Basic Information */}
                <div className="flex justify-between text-xs">
                    {/* Left Column - Created & Chains */}
                    <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                            <Calendar className="h-3 w-3 text-zinc-500 dark:text-zinc-400" />
                            <span className="text-zinc-900 dark:text-zinc-50">Created:</span>
                            <span className="text-zinc-500 dark:text-zinc-400">{formatTimestamp(subnet.createBlockTimestamp)}</span>
                        </div>

                        <div className="flex items-center space-x-2">
                            <Database className="h-3 w-3 text-zinc-500 dark:text-zinc-400" />
                            <span className="text-zinc-900 dark:text-zinc-50">Chains:</span>
                            <span className="text-zinc-500 dark:text-zinc-400">{subnet.blockchains?.length || 0}</span>
                        </div>
                    </div>

                    {/* Right Column - Owner Address & Threshold */}
                    <div className="text-right">
                        {subnet.subnetOwnershipInfo.addresses && subnet.subnetOwnershipInfo.addresses.length > 0 && (
                            <div className="space-y-1">
                                <div className="flex items-center justify-end space-x-2">
                                    <Users className="h-3 w-3 text-zinc-500 dark:text-zinc-400" />
                                    <span className="text-zinc-900 dark:text-zinc-50">Owner Address:</span>
                                    <div className="flex items-center space-x-1">
                                        <span className="font-mono text-zinc-500 dark:text-zinc-400">
                                            {subnet.subnetOwnershipInfo.addresses[0]}
                                        </span>
                                        <button
                                            className="p-0.5 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded transition-colors"
                                            onClick={() => copyToClipboard(subnet.subnetOwnershipInfo.addresses[0])}
                                        >
                                            <Copy className="h-2.5 w-2.5 text-zinc-500 dark:text-zinc-400" />
                                        </button>
                                    </div>
                                </div>

                                <div className="text-zinc-500 dark:text-zinc-400">
                                    {subnet.subnetOwnershipInfo.threshold} of {subnet.subnetOwnershipInfo.addresses.length} signatures required
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Additional Owner Addresses if more than one */}
                {subnet.subnetOwnershipInfo.addresses && subnet.subnetOwnershipInfo.addresses.length > 1 && (
                    <div>
                        <span className="text-xs text-zinc-600 dark:text-zinc-300 block mb-1">Additional Owners:</span>
                        <div className="flex flex-wrap gap-1">
                            {subnet.subnetOwnershipInfo.addresses.slice(1, 3).map((address, index) => (
                                <div key={index} className="flex items-center bg-zinc-100 dark:bg-zinc-800 rounded px-1.5 py-0.5">
                                    <span className="font-mono text-zinc-800 dark:text-zinc-200 text-xs">
                                        {address}
                                    </span>
                                    <button
                                        className="ml-1 p-0.5 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded transition-colors"
                                        onClick={() => copyToClipboard(address)}
                                    >
                                        <Copy className="h-2.5 w-2.5 text-zinc-500 dark:text-zinc-400" />
                                    </button>
                                </div>
                            ))}
                            {subnet.subnetOwnershipInfo.addresses.length > 3 && (
                                <span className="px-1.5 py-0.5 text-xs bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded">
                                    +{subnet.subnetOwnershipInfo.addresses.length - 3} more
                                </span>
                            )}
                        </div>
                    </div>
                )}

                {/* Blockchain Information */}
                {subnet.blockchains && subnet.blockchains.length > 0 && (
                    <div>
                        <div className="flex items-center space-x-2">
                            <FileText className="h-3 w-3 text-zinc-500 dark:text-zinc-400" />
                            <span className="text-xs font-medium text-zinc-900 dark:text-zinc-50">Blockchain Details:</span>
                        </div>

                        <div className="space-y-2 mt-2">
                            {subnet.blockchains.map((blockchain, index) => {
                                const blockchainAny = blockchain as any
                                const isNonStandardVM = blockchainAny.vmId && blockchainAny.vmId !== STANDARD_EVM_VM_ID

                                return (
                                    <div key={index} className="bg-zinc-50 dark:bg-zinc-800/50 p-2 rounded text-xs">
                                        <div className="font-medium text-zinc-900 dark:text-zinc-50 mb-2">
                                            {blockchainAny.blockchainName || "Blockchain"}
                                        </div>

                                        <div className="space-y-1">
                                            {blockchainAny.evmChainId && (
                                                <div className="flex items-center justify-between">
                                                    <span className="text-zinc-600 dark:text-zinc-300">EVM Chain ID:</span>
                                                    <div className="flex items-center space-x-1">
                                                        <span className="font-mono text-zinc-800 dark:text-zinc-200">
                                                            {blockchainAny.evmChainId}
                                                        </span>
                                                        <button
                                                            className="p-0.5 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded transition-colors"
                                                            onClick={() => copyToClipboard(blockchainAny.evmChainId.toString())}
                                                        >
                                                            <Copy className="h-2.5 w-2.5 text-zinc-500 dark:text-zinc-400" />
                                                        </button>
                                                    </div>
                                                </div>
                                            )}

                                            <div className="flex items-center justify-between">
                                                <span className="text-zinc-600 dark:text-zinc-300">Blockchain ID:</span>
                                                <div className="flex items-center space-x-1">
                                                    <span className="font-mono text-zinc-800 dark:text-zinc-200">
                                                        {blockchainAny.blockchainId}
                                                    </span>
                                                    <button
                                                        className="p-0.5 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded transition-colors"
                                                        onClick={() => copyToClipboard(blockchainAny.blockchainId)}
                                                    >
                                                        <Copy className="h-2.5 w-2.5 text-zinc-500 dark:text-zinc-400" />
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-between">
                                                <span className="text-zinc-600 dark:text-zinc-300">VM ID:</span>
                                                <div className="flex items-center space-x-1">
                                                    <span className="font-mono text-zinc-800 dark:text-zinc-200">
                                                        {blockchainAny.vmId}
                                                    </span>
                                                    <button
                                                        className="p-0.5 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded transition-colors"
                                                        onClick={() => copyToClipboard(blockchainAny.vmId)}
                                                    >
                                                        <Copy className="h-2.5 w-2.5 text-zinc-500 dark:text-zinc-400" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Warning for non-standard VM */}
                                        {isNonStandardVM && (
                                            <div className="mt-2 flex items-center space-x-1 text-yellow-700 dark:text-yellow-300 bg-yellow-50 dark:bg-yellow-900/20 p-1.5 rounded">
                                                <AlertTriangle className="h-3 w-3 text-yellow-600 dark:text-yellow-400" />
                                                <span className="text-xs">Non-standard VM detected</span>
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}

                {/* L1 Conversion Information */}
                {subnet.isL1 && subnet.l1ValidatorManagerDetails && (
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-2">
                        <div className="flex items-center space-x-2">
                            <Key className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                            <span className="text-xs font-medium text-blue-900 dark:text-blue-100">L1 Conversion:</span>
                        </div>

                        <div className="space-y-2 text-xs mt-2">
                            {subnet.l1ConversionTransactionHash && (
                                <div className="flex items-center justify-between">
                                    <span className="text-blue-700 dark:text-blue-300">Conversion Tx:</span>
                                    <div className="flex items-center space-x-1">
                                        <span className="font-mono text-blue-900 dark:text-blue-100">
                                            {subnet.l1ConversionTransactionHash}
                                        </span>
                                        <button
                                            className="p-0.5 hover:bg-blue-200 dark:hover:bg-blue-800 rounded transition-colors"
                                            onClick={() => copyToClipboard(subnet.l1ConversionTransactionHash)}
                                        >
                                            <Copy className="h-2.5 w-2.5 text-blue-600 dark:text-blue-400" />
                                        </button>
                                    </div>
                                </div>
                            )}

                            <div className="flex items-center justify-between">
                                <span className="text-blue-700 dark:text-blue-300">Validator Manager:</span>
                                <div className="flex items-center space-x-1">
                                    <span className="font-mono text-blue-900 dark:text-blue-100">
                                        {(subnet.l1ValidatorManagerDetails as any).contractAddress}
                                    </span>
                                    <button
                                        className="p-0.5 hover:bg-blue-200 dark:hover:bg-blue-800 rounded transition-colors"
                                        onClick={() => copyToClipboard((subnet.l1ValidatorManagerDetails as any).contractAddress)}
                                    >
                                        <Copy className="h-2.5 w-2.5 text-blue-600 dark:text-blue-400" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Copy feedback */}
                {copiedText && (
                    <div className="fixed bottom-4 right-4 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-100 px-3 py-1.5 rounded-md shadow-md text-xs">
                        Copied to clipboard!
                    </div>
                )}
            </div>
        </div>
    )
}
