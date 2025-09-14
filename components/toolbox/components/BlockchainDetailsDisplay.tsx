"use client"

import { Users, Database, Key, Copy, AlertTriangle, FileText, Globe, ChevronDown, ChevronRight, Network } from "lucide-react"
import { useState } from "react"
import type { BlockchainInfo } from "./SelectBlockchain";
import { SUBNET_EVM_VM_ID } from "@/constants/console";
import { useWalletStore } from "../stores/walletStore";
import { PRIMARY_NETWORK_SUBNET_ID } from "./InputSubnetId";

interface BlockchainDetailsDisplayProps {
    subnet?: any | null
    blockchain?: BlockchainInfo | null
    isLoading?: boolean
    error?: string | null
    isExpanded?: boolean
    onToggleExpanded?: () => void
    customTitle?: string
}

export default function BlockchainDetailsDisplay({
    subnet,
    blockchain,
    isLoading,
    error,
    isExpanded = false,
    onToggleExpanded,
    customTitle
}: BlockchainDetailsDisplayProps) {
    const [copiedText, setCopiedText] = useState<string | null>(null)
    const [internalIsExpanded, setInternalIsExpanded] = useState(false)
    const { isTestnet } = useWalletStore();

    // Use external state if provided, otherwise use internal state
    const currentIsExpanded = onToggleExpanded ? isExpanded : internalIsExpanded;
    const handleToggleExpanded = onToggleExpanded || (() => setInternalIsExpanded(!internalIsExpanded));

    if (isLoading) {
        return (
            <div className="mt-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
                <div className="p-4 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 dark:border-blue-400"></div>
                    <span className="ml-2 text-xs text-zinc-500 dark:text-zinc-400">
                        Loading details...
                    </span>
                </div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="mt-4 rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 shadow-sm">
                <div className="p-4 flex items-center">
                    <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 mr-2" />
                    <span className="text-sm text-red-700 dark:text-red-300">{error}</span>
                </div>
            </div>
        )
    }

    if (!subnet && !blockchain) {
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

    // Determine what data we're showing
    const isSubnetView = !!subnet
    const blockchainData = blockchain || (subnet?.blockchains?.[0] ? { ...subnet.blockchains[0], isTestnet } : null)

    const getTitle = () => {
        // Check for primary network first (works for both subnet and blockchain views)
        const subnetIdToCheck = isSubnetView ? subnet?.subnetId : blockchainData?.subnetId;
        if (subnetIdToCheck === PRIMARY_NETWORK_SUBNET_ID) {
            return "Primary Network Details";
        }

        if (isSubnetView) {
            if (subnet?.isL1) {
                return "L1 Details"
            } else {
                return "Subnet Details"
            }
        } else {
            return "Blockchain Details"
        }
    }

    const getNetworkBadges = () => {
        const badges = []

        if (blockchainData?.isTestnet !== undefined) {
            badges.push(
                <span
                    key="network"
                    className={`px-2 py-1 text-xs font-medium rounded-full ${blockchainData.isTestnet
                        ? "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200"
                        : "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200"
                        }`}
                >
                    {blockchainData.isTestnet ? "Testnet" : "Mainnet"}
                </span>
            )
        }

        return badges
    }

    return (
        <div className="mt-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
            {/* Header with toggle */}
            <button
                onClick={handleToggleExpanded}
                className="w-full p-4 flex items-center justify-between text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-all duration-200 rounded-t-xl group"
            >
                <div className="flex items-center">
                    <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/20 mr-3 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/30 transition-colors">
                        <Network className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="flex items-center">
                        <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                            {customTitle || getTitle()}
                        </span>
                        <div className="flex items-center space-x-2 ml-3">
                            {getNetworkBadges()}
                        </div>
                    </div>
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
                    {/* Subnet Information */}
                    {isSubnetView && subnet && (
                        <>
                            {/* Basic Subnet Info */}
                            <div className="bg-zinc-50/50 dark:bg-zinc-800/30 rounded-lg p-3">
                                <div className="text-sm font-medium text-zinc-700 dark:text-zinc-300 flex items-center mb-3">
                                    <Database className="h-4 w-4 mr-2 text-zinc-500 dark:text-zinc-400" />
                                    Subnet Information
                                </div>
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs text-zinc-600 dark:text-zinc-300">Created:</span>
                                        <span className="text-xs text-zinc-800 dark:text-zinc-200">
                                            {formatTimestamp(subnet.createBlockTimestamp)}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs text-zinc-600 dark:text-zinc-300">Blockchains:</span>
                                        <span className="text-xs text-zinc-800 dark:text-zinc-200">
                                            {subnet.blockchains?.length || 0}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Subnet Owner */}
                            {subnet.subnetOwnershipInfo?.addresses && subnet.subnetOwnershipInfo.addresses.length > 0 && (
                                <div className="bg-zinc-50/50 dark:bg-zinc-800/30 rounded-lg p-3">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="text-sm font-medium text-zinc-700 dark:text-zinc-300 flex items-center">
                                            <Users className="h-4 w-4 mr-2 text-zinc-500 dark:text-zinc-400" />
                                            Subnet Owner
                                        </div>
                                        <button
                                            onClick={() => copyToClipboard(subnet.subnetOwnershipInfo.addresses[0])}
                                            className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 flex items-center px-2 py-1 rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                                        >
                                            <Copy className="h-3 w-3 mr-1" />
                                            Copy
                                        </button>
                                    </div>
                                    <div className="font-mono text-xs bg-white dark:bg-zinc-900 p-3 rounded-md border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 overflow-auto break-all">
                                        {subnet.subnetOwnershipInfo.addresses[0]}
                                    </div>
                                    <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-2">
                                        {subnet.subnetOwnershipInfo.threshold} of {subnet.subnetOwnershipInfo.addresses.length} signatures required
                                    </div>
                                </div>
                            )}

                            {/* L1 Validator Manager */}
                            {subnet.isL1 && subnet.l1ValidatorManagerDetails && (
                                <div className="bg-blue-50/50 dark:bg-blue-900/20 rounded-lg p-3 border border-blue-200 dark:border-blue-800">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="text-sm font-medium text-blue-700 dark:text-blue-300 flex items-center">
                                            <Key className="h-4 w-4 mr-2 text-blue-600 dark:text-blue-400" />
                                            L1 Validator Manager
                                        </div>
                                        <button
                                            onClick={() => copyToClipboard(subnet.l1ValidatorManagerDetails?.contractAddress)}
                                            className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 flex items-center px-2 py-1 rounded-md hover:bg-blue-100 dark:hover:bg-blue-800 transition-colors"
                                        >
                                            <Copy className="h-3 w-3 mr-1" />
                                            Copy
                                        </button>
                                    </div>
                                    <div className="font-mono text-xs bg-white dark:bg-zinc-900 p-3 rounded-md border border-blue-300 dark:border-blue-700 text-zinc-800 dark:text-zinc-200 overflow-auto break-all">
                                        {subnet.l1ValidatorManagerDetails.contractAddress}
                                    </div>
                                </div>
                            )}
                        </>
                    )}

                    {/* Blockchain Information */}
                    {blockchainData && (
                        <>
                            {/* Basic Blockchain Info */}
                            {!isSubnetView && (
                                <div className="bg-zinc-50/50 dark:bg-zinc-800/30 rounded-lg p-3">
                                    <div className="text-sm font-medium text-zinc-700 dark:text-zinc-300 flex items-center mb-3">
                                        <FileText className="h-4 w-4 mr-2 text-zinc-500 dark:text-zinc-400" />
                                        Blockchain Information
                                    </div>
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs text-zinc-600 dark:text-zinc-300">Created:</span>
                                            <span className="text-xs text-zinc-800 dark:text-zinc-200">
                                                {formatTimestamp(blockchainData.createBlockTimestamp)}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs text-zinc-600 dark:text-zinc-300">Name:</span>
                                            <span className="text-xs text-zinc-800 dark:text-zinc-200">
                                                {blockchainData.blockchainName || "Unknown"}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs text-zinc-600 dark:text-zinc-300">Create Block:</span>
                                            <span className="text-xs text-zinc-800 dark:text-zinc-200">
                                                {blockchainData.createBlockNumber}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Technical Details */}
                            <div className="bg-zinc-50/50 dark:bg-zinc-800/30 rounded-lg p-3">
                                <div className="text-sm font-medium text-zinc-700 dark:text-zinc-300 flex items-center mb-3">
                                    <Globe className="h-4 w-4 mr-2 text-zinc-500 dark:text-zinc-400" />
                                    Technical Details
                                </div>
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs text-zinc-600 dark:text-zinc-300">EVM Chain ID:</span>
                                        <div className="flex items-center space-x-1">
                                            <span className="font-mono text-xs text-zinc-800 dark:text-zinc-200">
                                                {blockchainData.evmChainId}
                                            </span>
                                            <button
                                                onClick={() => copyToClipboard(blockchainData.evmChainId)}
                                                className="p-0.5 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded transition-colors"
                                            >
                                                <Copy className="h-2.5 w-2.5 text-zinc-500 dark:text-zinc-400" />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between">
                                        <span className="text-xs text-zinc-600 dark:text-zinc-300">Blockchain ID:</span>
                                        <div className="flex items-center space-x-1">
                                            <span className="font-mono text-xs text-zinc-800 dark:text-zinc-200 break-all">
                                                {blockchainData.blockchainId}
                                            </span>
                                            <button
                                                onClick={() => copyToClipboard(blockchainData.blockchainId)}
                                                className="p-0.5 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded transition-colors"
                                            >
                                                <Copy className="h-2.5 w-2.5 text-zinc-500 dark:text-zinc-400" />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between">
                                        <span className="text-xs text-zinc-600 dark:text-zinc-300">Subnet ID:</span>
                                        <div className="flex items-center space-x-1">
                                            <span className="font-mono text-xs text-zinc-800 dark:text-zinc-200 break-all">
                                                {blockchainData.subnetId}
                                            </span>
                                            <button
                                                onClick={() => copyToClipboard(blockchainData.subnetId)}
                                                className="p-0.5 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded transition-colors"
                                            >
                                                <Copy className="h-2.5 w-2.5 text-zinc-500 dark:text-zinc-400" />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between">
                                        <span className="text-xs text-zinc-600 dark:text-zinc-300">VM ID:</span>
                                        <div className="flex items-center space-x-1">
                                            <span className="font-mono text-xs text-zinc-800 dark:text-zinc-200 break-all">
                                                {blockchainData.vmId}
                                            </span>
                                            <button
                                                onClick={() => copyToClipboard(blockchainData.vmId)}
                                                className="p-0.5 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded transition-colors"
                                            >
                                                <Copy className="h-2.5 w-2.5 text-zinc-500 dark:text-zinc-400" />
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* VM Warning */}
                                {blockchainData.vmId && blockchainData.vmId !== SUBNET_EVM_VM_ID && (
                                    <div className="mt-3 flex items-center space-x-2 text-yellow-700 dark:text-yellow-300 bg-yellow-50 dark:bg-yellow-900/20 p-2 rounded border border-yellow-200 dark:border-yellow-800">
                                        <AlertTriangle className="h-3 w-3 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
                                        <span className="text-xs">Non-standard VM ID detected</span>
                                    </div>
                                )}
                            </div>
                        </>
                    )}

                    {/* Copy feedback */}
                    {copiedText && (
                        <div className="fixed bottom-4 right-4 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-100 px-3 py-1.5 rounded-md shadow-md text-xs z-50">
                            Copied to clipboard!
                        </div>
                    )}
                </div>
            )}
        </div>
    )
} 
