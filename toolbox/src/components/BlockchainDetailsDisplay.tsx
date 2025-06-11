"use client"

import { Calendar, Database, Copy, AlertTriangle, FileText } from "lucide-react"
import { useState } from "react"
import type { BlockchainInfo } from "./SelectBlockchain"

interface BlockchainDetailsDisplayProps {
    blockchain: BlockchainInfo | null
    isLoading?: boolean
}

export default function BlockchainDetailsDisplay({ blockchain, isLoading }: BlockchainDetailsDisplayProps) {
    const [copiedText, setCopiedText] = useState<string | null>(null)

    // Standard EVM VM ID
    const STANDARD_EVM_VM_ID = "srEXiWaHuhNyGwPUi444Tu47ZEDwxTWrbQiuD7FmgSAQ6X7Dy"

    if (isLoading) {
        return (
            <div className="w-full mt-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md shadow-sm">
                <div className="p-3">
                    <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 dark:border-blue-400"></div>
                        <span className="ml-2 text-xs text-zinc-500 dark:text-zinc-400">Loading blockchain details...</span>
                    </div>
                </div>
            </div>
        )
    }

    if (!blockchain) {
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

    const isNonStandardVM = blockchain.vmId && blockchain.vmId !== STANDARD_EVM_VM_ID

    return (
        <div className="w-full mt-3 border border-zinc-200 dark:border-zinc-800 rounded-md shadow-sm overflow-hidden">
            {/* Header */}
            <div className="px-3 py-1.5 bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-700">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-50 flex items-center">Blockchain Details</h3>
                    <span
                        className={`px-2 py-1 text-xs font-medium rounded-full ${blockchain.isTestnet
                            ? "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200"
                            : "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200"
                            }`}
                    >
                        {blockchain.isTestnet ? "Testnet" : "Mainnet"}
                    </span>
                </div>
            </div>

            {/* Content Area */}
            <div className="p-3 bg-white dark:bg-zinc-900 space-y-3">
                {/* Basic Information */}
                <div className="flex justify-between text-xs">
                    {/* Left Column - Created & Name */}
                    <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                            <Calendar className="h-3 w-3 text-zinc-500 dark:text-zinc-400" />
                            <span className="text-zinc-900 dark:text-zinc-50">Created:</span>
                            <span className="text-zinc-500 dark:text-zinc-400">{formatTimestamp(blockchain.createBlockTimestamp)}</span>
                        </div>

                        <div className="flex items-center space-x-2">
                            <FileText className="h-3 w-3 text-zinc-500 dark:text-zinc-400" />
                            <span className="text-zinc-900 dark:text-zinc-50">Name:</span>
                            <span className="text-zinc-500 dark:text-zinc-400">{blockchain.blockchainName || "Unknown"}</span>
                        </div>
                    </div>

                    {/* Right Column - Block Number */}
                    <div className="text-right">
                        <div className="flex items-center justify-end space-x-2">
                            <Database className="h-3 w-3 text-zinc-500 dark:text-zinc-400" />
                            <span className="text-zinc-900 dark:text-zinc-50">Create Block:</span>
                            <span className="text-zinc-500 dark:text-zinc-400">{blockchain.createBlockNumber}</span>
                        </div>
                    </div>
                </div>

                {/* Blockchain Details */}
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
                    {isNonStandardVM && (
                        <div className="mt-2 flex items-center space-x-1 text-yellow-700 dark:text-yellow-300 bg-yellow-50 dark:bg-yellow-900/20 p-1.5 rounded">
                            <AlertTriangle className="h-3 w-3 text-yellow-600 dark:text-yellow-400" />
                            <span className="text-xs">Non-standard VM detected</span>
                        </div>
                    )}
                </div>

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