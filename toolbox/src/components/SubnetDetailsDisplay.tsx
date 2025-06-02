"use client"

import type { Subnet, GlobalParamNetwork } from "@avalabs/avacloud-sdk/models/components"
import { Copy } from "lucide-react"
import { useState, useEffect } from "react"
import { AvaCloudSDK } from "@avalabs/avacloud-sdk"
import { useWalletStore } from "../stores/walletStore"
import { networkIDs } from "@avalabs/avalanchejs"

// Define the blockchain type based on the API response
interface BlockchainInfo {
    createBlockTimestamp: number;
    createBlockNumber: string;
    blockchainId: string;
    vmId: string;
    subnetId: string;
    blockchainName: string;
    evmChainId?: number;
}

interface SubnetDetailsDisplayProps {
    subnet: Subnet | null
    isLoading?: boolean
}

interface BlockchainDetails {
    blockchainId: string;
    name?: string;
    vmId?: string;
    evmChainId?: number;
}

export default function SubnetDetailsDisplay({ subnet, isLoading }: SubnetDetailsDisplayProps) {
    const [copiedText, setCopiedText] = useState<string | null>(null)
    const [blockchainDetails, setBlockchainDetails] = useState<Record<string, BlockchainDetails>>({})
    const { avalancheNetworkID } = useWalletStore()

    // Network names for API calls
    const networkNames: Record<number, GlobalParamNetwork> = {
        [networkIDs.MainnetID]: "mainnet",
        [networkIDs.FujiID]: "fuji",
    };

    if (isLoading) {
        return (
            <div className="w-full mt-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md">
                <div className="p-3">
                    <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 dark:border-blue-400"></div>
                        <span className="ml-2 text-xs text-zinc-500 dark:text-zinc-400">Loading...</span>
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
                month: "short",
                day: "numeric",
                year: "2-digit",
            })
        }

        return date.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "2-digit",
        })
    }

    const formatAddress = (address: string | undefined | null) => {
        if (!address) return ""
        if (address.length <= 16) return address
        return `${address.slice(0, 8)}...${address.slice(-8)}`
    }

    const copyToClipboard = (text: string | undefined | null) => {
        if (!text) return
        navigator.clipboard.writeText(text)
        setCopiedText(text)
        setTimeout(() => setCopiedText(null), 1500)
    }

    const CopyButton = ({ text, className = "" }: { text: string | undefined | null; className?: string }) => (
        <button
            className={`p-0.5 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded transition-colors ${className}`}
            onClick={() => copyToClipboard(text)}
        >
            <Copy className="h-3 w-3 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300" />
        </button>
    )

    useEffect(() => {
        const fetchBlockchainDetails = async () => {
            if (!subnet?.blockchains?.length) return;

            const network = networkNames[Number(avalancheNetworkID)];
            if (!network) return;

            const sdk = new AvaCloudSDK();
            const details: Record<string, BlockchainDetails> = {};

            for (const blockchain of subnet.blockchains) {
                try {
                    console.log('Fetching details for blockchain:', blockchain);
                    const result = await sdk.data.primaryNetwork.listBlockchains({
                        network,
                    });

                    // Log the raw response
                    console.log('Raw blockchain API response:', result);

                    // Find the matching blockchain in the response
                    for await (const page of result) {
                        const matchingBlockchain = page.result.blockchains.find(
                            b => b.blockchainId === blockchain.blockchainId
                        ) as any;

                        if (matchingBlockchain) {
                            // Log the matching blockchain to see its structure
                            console.log('Found matching blockchain:', matchingBlockchain);

                            details[blockchain.blockchainId] = {
                                blockchainId: blockchain.blockchainId,
                                // Only add properties if they exist
                                ...(matchingBlockchain.blockchainName && { name: matchingBlockchain.blockchainName }),
                                ...(matchingBlockchain.vmId && { vmId: matchingBlockchain.vmId }),
                                ...(matchingBlockchain.evmChainId && { evmChainId: matchingBlockchain.evmChainId })
                            };
                            break;
                        }
                    }
                } catch (error) {
                    console.error(`Error fetching details for blockchain ${blockchain.blockchainId}:`, error);
                    details[blockchain.blockchainId] = {
                        blockchainId: blockchain.blockchainId
                    };
                }
            }

            setBlockchainDetails(details);
        };

        fetchBlockchainDetails();
    }, [subnet, avalancheNetworkID]);

    return (
        <div className="w-full mt-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md overflow-hidden">
            {/* Header */}
            <div className="px-3 py-2 bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-700">
                <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-zinc-900 dark:text-zinc-50">Subnet Details</span>
                    <span
                        className={`px-2 py-0.5 text-xs font-medium rounded ${subnet.isL1
                            ? "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200"
                            : "bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300"
                            }`}
                    >
                        {subnet.isL1 ? "L1 Chain" : "Subnet"}
                    </span>
                </div>
            </div>

            {/* Content */}
            <div className="p-3 space-y-3">
                {/* Basic Info Row */}
                <div className="grid grid-cols-2 gap-4 text-xs">
                    <div>
                        <span className="text-zinc-500 dark:text-zinc-400">Created:</span>
                        <span className="ml-1 text-zinc-900 dark:text-zinc-50">{formatTimestamp(subnet.createBlockTimestamp)}</span>
                    </div>
                    <div>
                        <span className="text-zinc-500 dark:text-zinc-400">Blockchains:</span>
                        <span className="ml-1 text-zinc-900 dark:text-zinc-50">{subnet.blockchains?.length || 0}</span>
                    </div>
                </div>

                {/* Ownership Row */}
                <div className="grid grid-cols-2 gap-4 text-xs">
                    <div>
                        <span className="text-zinc-500 dark:text-zinc-400">Threshold:</span>
                        <span className="ml-1 text-zinc-900 dark:text-zinc-50">
                            {subnet.threshold}/{subnet.ownerAddresses?.length || 0}
                        </span>
                    </div>
                    <div>
                        <span className="text-zinc-500 dark:text-zinc-400">Owner:</span>
                        <div className="flex items-center mt-0.5">
                            <span className="font-mono text-zinc-700 dark:text-zinc-300 text-xs">
                                {formatAddress(subnet.ownerAddresses?.[0])}
                            </span>
                            <CopyButton text={subnet.ownerAddresses?.[0]} className="ml-1" />
                            {(subnet.ownerAddresses?.length || 0) > 1 && (
                                <span className="ml-1 text-zinc-500 text-xs">+{(subnet.ownerAddresses?.length || 0) - 1}</span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Blockchain Details */}
                {subnet.blockchains && subnet.blockchains.length > 0 && (() => {
                    // Log the complete raw data
                    console.log('Raw subnet data:', JSON.stringify(subnet, null, 2));

                    return (
                        <div className="bg-zinc-50 dark:bg-zinc-800/30 rounded p-2">
                            <div className="text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-2">Blockchain</div>
                            {subnet.blockchains.map((blockchain: any, index) => {
                                const details = blockchainDetails[blockchain.blockchainId] || {};
                                console.log('Blockchain details:', details);

                                return (
                                    <div key={index} className="space-y-1">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-medium text-zinc-900 dark:text-zinc-50">
                                                {details.name || "Blockchain"}
                                            </span>
                                            {details.evmChainId && (
                                                <span className="text-xs text-zinc-500 dark:text-zinc-400">EVM: {details.evmChainId}</span>
                                            )}
                                        </div>

                                        <div className="grid grid-cols-1 gap-1 text-xs">
                                            <div className="flex items-center justify-between">
                                                <span className="text-zinc-500 dark:text-zinc-400">ID:</span>
                                                <div className="flex items-center">
                                                    <span className="font-mono text-zinc-700 dark:text-zinc-300">
                                                        {formatAddress(blockchain.blockchainId)}
                                                    </span>
                                                    <CopyButton text={blockchain.blockchainId} className="ml-1" />
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-between">
                                                <span className="text-zinc-500 dark:text-zinc-400">VM:</span>
                                                <div className="flex items-center">
                                                    <span className="font-mono text-zinc-700 dark:text-zinc-300">
                                                        {formatAddress(details.vmId)}
                                                    </span>
                                                    <CopyButton text={details.vmId} className="ml-1" />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    );
                })()}

                {/* L1 Conversion Details */}
                {subnet.isL1 && subnet.l1ValidatorManagerDetails && (
                    <div className="bg-blue-50 dark:bg-blue-900/20 rounded p-2">
                        <div className="text-xs font-medium text-blue-700 dark:text-blue-300 mb-2">L1 Conversion</div>

                        {subnet.l1ConversionTransactionHash && (
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-xs text-zinc-500 dark:text-zinc-400">Tx:</span>
                                <div className="flex items-center">
                                    <span className="font-mono text-xs text-zinc-700 dark:text-zinc-300">
                                        {formatAddress(subnet.l1ConversionTransactionHash)}
                                    </span>
                                    <CopyButton text={subnet.l1ConversionTransactionHash} className="ml-1" />
                                </div>
                            </div>
                        )}

                        <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-zinc-500 dark:text-zinc-400">Manager:</span>
                            <div className="flex items-center">
                                <span className="font-mono text-xs text-zinc-700 dark:text-zinc-300">
                                    {formatAddress((subnet.l1ValidatorManagerDetails as any).contractAddress)}
                                </span>
                                <CopyButton text={(subnet.l1ValidatorManagerDetails as any).contractAddress} className="ml-1" />
                            </div>
                        </div>

                        <div className="flex items-center justify-between">
                            <span className="text-xs text-zinc-500 dark:text-zinc-400">Chain:</span>
                            <div className="flex items-center">
                                <span className="font-mono text-xs text-zinc-700 dark:text-zinc-300">
                                    {formatAddress((subnet.l1ValidatorManagerDetails as any).blockchainId)}
                                </span>
                                <CopyButton text={(subnet.l1ValidatorManagerDetails as any).blockchainId} className="ml-1" />
                            </div>
                        </div>
                    </div>
                )}

                {/* Copy feedback */}
                {copiedText && (
                    <div className="fixed bottom-4 right-4 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-100 px-3 py-1.5 rounded text-xs shadow-lg">
                        Copied!
                    </div>
                )}
            </div>
        </div>
    )
} 