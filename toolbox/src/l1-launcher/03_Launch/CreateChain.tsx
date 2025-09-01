import { useWalletStore } from '../../lib/walletStore';
import { useL1LauncherStore } from '../L1LauncherStore';
import { useState } from 'react';
import NextPrev from '../components/NextPrev';

export default function CreateChain() {
    const { coreWalletClient, pChainAddress } = useWalletStore()

    const {
        evmChainName,
        genesisString,
        setSubnetID,
        setChainId,
        subnetId,
        chainId,
    } = useL1LauncherStore();

    // Subnet section state
    const [isCreatingSubnet, setIsCreatingSubnet] = useState(false);
    const [subnetError, setSubnetError] = useState<string | null>(null);

    // Chain section state
    const [isCreatingChain, setIsCreatingChain] = useState(false);
    const [chainError, setChainError] = useState<string | null>(null);

    const handleCreateSubnet = async () => {
        setIsCreatingSubnet(true);
        setSubnetError(null);

        try {
            const subnetTxId = await coreWalletClient.createSubnet({
                subnetOwners: [pChainAddress]
            })

            // Wait for transaction to be processed
            await new Promise(resolve => setTimeout(resolve, 5 * 1000));
            setSubnetID(subnetTxId);
        } catch (error: any) {
            console.error('Failed to create subnet', error);
            setSubnetError(error.message || 'Failed to create subnet');
        } finally {
            setIsCreatingSubnet(false);
        }
    };

    const handleCreateChain = async () => {
        setIsCreatingChain(true);
        setChainError(null);

        try {
            const chainTxId = await coreWalletClient.createChain({
                chainName: evmChainName,
                subnetId: subnetId,
                vmId: "srEXiWaHuhNyGwPUi444Tu47ZEDwxTWrbQiuD7FmgSAQ6X7Dy",
                fxIds: [],
                genesisData: genesisString,
                subnetAuth: [0],
            })

            // Wait for transaction to be processed
            await new Promise(resolve => setTimeout(resolve, 5 * 1000));
            setChainId(chainTxId || '');

        } catch (error: any) {
            console.error('Failed to create chain', error);
            setChainError(error.message || 'Failed to create chain');
        } finally {
            setIsCreatingChain(false);
        }
    };

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-2xl font-medium mb-4">Create Subnet + Chain</h1>
                <p className="text-gray-700 dark:text-gray-300">Creating an L1 involves two separate transactions on the P-Chain. First, create a Subnet, then create a Chain within that Subnet using your genesis configuration.</p>
            </div>

            {/* Subnet Creation Card */}
            <div className="p-6 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 shadow-sm">
                <h2 className="text-xl font-medium mb-4">Step 1: Create Subnet</h2>

                {subnetId ? (
                    <div className="mb-4">
                        <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                            <svg className="w-5 h-5" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 16 12">
                                <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M1 5.917 5.724 10.5 15 1.5" />
                            </svg>
                            <span>Subnet created successfully</span>
                        </div>
                        <div className="mt-2 flex items-center">
                            <span className="font-medium text-gray-700 dark:text-gray-300">Subnet ID:</span>
                            <a
                                href={`https://subnets-test.avax.network/p-chain/tx/${subnetId}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="ml-2 text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 text-sm font-mono"
                            >
                                {subnetId}
                            </a>
                        </div>
                    </div>
                ) : (
                    <>
                        <p className="mb-4 text-gray-700 dark:text-gray-300">Create a new Subnet on the P-Chain where your blockchain will live.</p>

                        {subnetError && (
                            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-md border border-red-200 dark:border-red-800">
                                <p className="font-medium">Error:</p>
                                <p>{subnetError}</p>
                            </div>
                        )}

                        <button
                            onClick={handleCreateSubnet}
                            disabled={isCreatingSubnet}
                            className={`px-6 py-2 rounded-md ${isCreatingSubnet
                                ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                                : 'bg-blue-500 text-white hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700'
                                }`}
                        >
                            {isCreatingSubnet ? (
                                <span className="flex items-center gap-2">
                                    <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Creating Subnet...
                                </span>
                            ) : 'Create Subnet'}
                        </button>
                    </>
                )}
            </div>

            {/* Chain Creation Card */}
            <div className="p-6 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 shadow-sm">
                <h2 className="text-xl font-medium mb-4">Step 2: Create Chain</h2>

                {chainId ? (
                    <div className="mb-4">
                        <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                            <svg className="w-5 h-5" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 16 12">
                                <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M1 5.917 5.724 10.5 15 1.5" />
                            </svg>
                            <span>Chain created successfully</span>
                        </div>
                        <div className="mt-2 flex items-center">
                            <span className="font-medium text-gray-700 dark:text-gray-300">Chain ID:</span>
                            <a
                                href={`https://subnets-test.avax.network/p-chain/tx/${chainId}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="ml-2 text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 text-sm font-mono"
                            >
                                {chainId}
                            </a>
                        </div>
                    </div>
                ) : (
                    <>
                        <p className="mb-4 text-gray-700 dark:text-gray-300">Create a new Chain within your Subnet using the genesis configuration.</p>

                        {chainError && (
                            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-md border border-red-200 dark:border-red-800">
                                <p className="font-medium">Error:</p>
                                <p>{chainError}</p>
                            </div>
                        )}

                        <button
                            onClick={handleCreateChain}
                            disabled={isCreatingChain || !subnetId}
                            className={`px-6 py-2 rounded-md ${isCreatingChain || !subnetId
                                ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                                : 'bg-blue-500 text-white hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700'
                                }`}
                        >
                            {isCreatingChain ? (
                                <span className="flex items-center gap-2">
                                    <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Creating Chain...
                                </span>
                            ) : !subnetId ? 'Create Subnet First' : 'Create Chain'}
                        </button>
                    </>
                )}
            </div>

            <NextPrev
                nextEnabled={!!chainId}
            />
        </div>
    );
}
