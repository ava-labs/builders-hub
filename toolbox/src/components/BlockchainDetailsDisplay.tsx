"use client"

import { Calendar, Users, Database, Key, Copy, AlertTriangle, FileText, Globe } from "lucide-react"
import { useState } from "react"
import { Subnet } from "@avalabs/avacloud-sdk/models/components";
import type { BlockchainInfo } from "./SelectBlockchain";
import { SUBNET_EVM_VM_ID } from "../toolbox/Nodes/AvalanchegoDocker";

interface BlockchainDetailsDisplayProps {
    type: 'blockchain' | 'subnet'
    data: BlockchainInfo | Subnet | null
    isLoading?: boolean
}

export default function BlockchainDetailsDisplay({ type, data, isLoading }: BlockchainDetailsDisplayProps) {
    const [copiedText, setCopiedText] = useState<string | null>(null)

    if (isLoading) {
        return (
            <div className="w-full mt-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md shadow-sm">
                <div className="p-3">
                    <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 dark:border-blue-400"></div>
                        <span className="ml-2 text-xs text-zinc-500 dark:text-zinc-400">
                            Loading {type} details...
                        </span>
                    </div>
                </div>
            </div>
        )
    }

    if (!data) {
        return null
    }

    const formatTimestamp = (timestamp: number) => {
        const date = new Date(timestamp * 1000)
        return date.toLocaleDateString("en-US", {
            year: "2-digit",
            month: "short",
            day: "numeric",
        })
    }

    const copyToClipboard = (text: string | number | undefined | null) => {
        if (!text) return
        navigator.clipboard.writeText(text.toString())
        setCopiedText(text.toString())
        setTimeout(() => setCopiedText(null), 2000)
    }

    // Determine if we're showing subnet or blockchain
    const isSubnet = type === 'subnet'
    const subnet = isSubnet ? (data as Subnet) : null

    // Get blockchain data - either directly or from subnet's first blockchain
    const blockchain = isSubnet
        ? (subnet?.blockchains?.[0] ? { ...(subnet.blockchains[0] as any), isTestnet: false } : null)
        : (data as BlockchainInfo)

    return (
        <div className="w-full mt-3 border border-zinc-200 dark:border-zinc-800 rounded-md shadow-sm overflow-hidden">
            {/* Header */}
            <div className="px-3 py-1.5 bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-700">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                        {isSubnet ? 'Subnet Details' : 'Blockchain Details'}
                    </h3>
                    <div className="flex items-center space-x-2">
                        {isSubnet && subnet?.isL1 && (
                            <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200">
                                L1 Chain
                            </span>
                        )}
                        {blockchain?.isTestnet !== undefined && (
                            <span
                                className={`px-2 py-1 text-xs font-medium rounded-full ${blockchain.isTestnet
                                    ? "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200"
                                    : "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200"
                                    }`}
                            >
                                {blockchain.isTestnet ? "Testnet" : "Mainnet"}
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Content Area */}
            <div className="p-3 bg-white dark:bg-zinc-900 space-y-3">
                {/* Subnet-specific information */}
                {isSubnet && subnet && (
                    <>
                        {/* Basic Subnet Information */}
                        <div className="flex justify-between text-xs">
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
                            <div className="text-right">
                                {subnet.subnetOwnershipInfo.addresses && subnet.subnetOwnershipInfo.addresses.length > 0 && (
                                    <div className="space-y-1">
                                        <div className="flex items-center justify-end space-x-2">
                                            <Users className="h-3 w-3 text-zinc-500 dark:text-zinc-400" />
                                            <span className="text-zinc-900 dark:text-zinc-50">Owner:</span>
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

                        {/* L1 Conversion Information */}
                        {subnet.isL1 && subnet.l1ValidatorManagerDetails && (
                            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-2">
                                <div className="flex items-center space-x-2">
                                    <Key className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                                    <span className="text-xs font-medium text-blue-900 dark:text-blue-100">L1 Conversion</span>
                                </div>
                                <div className="space-y-2 text-xs mt-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-blue-700 dark:text-blue-300">Validator Manager:</span>
                                        <div className="flex items-center space-x-1">
                                            <span className="font-mono text-blue-900 dark:text-blue-100">
                                                {subnet.l1ValidatorManagerDetails?.contractAddress}
                                            </span>
                                            <button
                                                className="p-0.5 hover:bg-blue-200 dark:hover:bg-blue-800 rounded transition-colors"
                                                onClick={() => copyToClipboard(subnet.l1ValidatorManagerDetails?.contractAddress)}
                                            >
                                                <Copy className="h-2.5 w-2.5 text-blue-600 dark:text-blue-400" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </>
                )}

                {/* Blockchain Information */}
                {blockchain && (
                    <div>
                        <div className="flex items-center space-x-2 mb-2">
                            <FileText className="h-3 w-3 text-zinc-500 dark:text-zinc-400" />
                            <span className="text-xs font-medium text-zinc-900 dark:text-zinc-50">
                                {isSubnet ? 'Blockchain Details' : 'Details'}
                            </span>
                        </div>

                        {/* Basic blockchain info for blockchain-only view */}
                        {!isSubnet && (
                            <div className="flex justify-between text-xs mb-3">
                                <div className="space-y-1">
                                    <div className="flex items-center space-x-2">
                                        <Calendar className="h-3 w-3 text-zinc-500 dark:text-zinc-400" />
                                        <span className="text-zinc-900 dark:text-zinc-50">Created:</span>
                                        <span className="text-zinc-500 dark:text-zinc-400">{formatTimestamp(blockchain.createBlockTimestamp)}</span>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <Globe className="h-3 w-3 text-zinc-500 dark:text-zinc-400" />
                                        <span className="text-zinc-900 dark:text-zinc-50">Name:</span>
                                        <span className="text-zinc-500 dark:text-zinc-400">{blockchain.blockchainName || "Unknown"}</span>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="flex items-center justify-end space-x-2">
                                        <Database className="h-3 w-3 text-zinc-500 dark:text-zinc-400" />
                                        <span className="text-zinc-900 dark:text-zinc-50">Create Block:</span>
                                        <span className="text-zinc-500 dark:text-zinc-400">{blockchain.createBlockNumber}</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="bg-zinc-50 dark:bg-zinc-800/50 p-2 rounded text-xs">
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-zinc-600 dark:text-zinc-300">EVM Chain ID:</span>
                                    <div className="flex items-center space-x-1">
                                        <span className="font-mono text-zinc-800 dark:text-zinc-200">
                                            {blockchain.evmChainId}
                                        </span>
                                        <button
                                            className="p-0.5 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded transition-colors"
                                            onClick={() => copyToClipboard(blockchain.evmChainId)}
                                        >
                                            <Copy className="h-2.5 w-2.5 text-zinc-500 dark:text-zinc-400" />
                                        </button>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between">
                                    <span className="text-zinc-600 dark:text-zinc-300">Blockchain ID:</span>
                                    <div className="flex items-center space-x-1">
                                        <span className="font-mono text-zinc-800 dark:text-zinc-200 break-all">
                                            {blockchain.blockchainId}
                                        </span>
                                        <button
                                            className="p-0.5 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded transition-colors"
                                            onClick={() => copyToClipboard(blockchain.blockchainId)}
                                        >
                                            <Copy className="h-2.5 w-2.5 text-zinc-500 dark:text-zinc-400" />
                                        </button>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between">
                                    <span className="text-zinc-600 dark:text-zinc-300">Subnet ID:</span>
                                    <div className="flex items-center space-x-1">
                                        <span className="font-mono text-zinc-800 dark:text-zinc-200 break-all">
                                            {blockchain.subnetId}
                                        </span>
                                        <button
                                            className="p-0.5 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded transition-colors"
                                            onClick={() => copyToClipboard(blockchain.subnetId)}
                                        >
                                            <Copy className="h-2.5 w-2.5 text-zinc-500 dark:text-zinc-400" />
                                        </button>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between">
                                    <span className="text-zinc-600 dark:text-zinc-300">VM ID:</span>
                                    <div className="flex items-center space-x-1">
                                        <span className="font-mono text-zinc-800 dark:text-zinc-200 break-all">
                                            {blockchain.vmId}
                                        </span>
                                        <button
                                            className="p-0.5 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded transition-colors"
                                            onClick={() => copyToClipboard(blockchain.vmId)}
                                        >
                                            <Copy className="h-2.5 w-2.5 text-zinc-500 dark:text-zinc-400" />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Warning for non-standard VM */}
                            {blockchain.vmId && blockchain.vmId !== SUBNET_EVM_VM_ID && (
                                <div className="mt-2 flex items-center space-x-1 text-yellow-700 dark:text-yellow-300 bg-yellow-50 dark:bg-yellow-900/20 p-1.5 rounded">
                                    <AlertTriangle className="h-3 w-3 text-yellow-600 dark:text-yellow-400" />
                                    <span className="text-xs">Non-standard VM ID detected</span>
                                </div>
                            )}
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