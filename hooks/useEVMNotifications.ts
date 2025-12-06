import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { toast } from 'sonner';
import { useConsoleLog } from './use-console-log';
import { Chain, createPublicClient, http } from 'viem';
import { usePathname } from 'next/navigation';
import { showCustomErrorToast } from '@/components/ui/custom-error-toast';
import posthog from 'posthog-js';

const getEVMExplorerUrl = (txHash: string, viemChain: Chain) => {
    if (viemChain.blockExplorers?.default?.url) {
        return `${viemChain.blockExplorers.default.url}/tx/${txHash}`;
    } else if (viemChain.id === 43114 || viemChain.id === 43113) {
        return `https://${viemChain.id === 43113 ? "subnets-test" : "subnets"}.avax.network/c-chain/tx/${txHash}`;
    } else {
        const rpcUrl = viemChain.rpcUrls.default.http[0];
        return `https://devnet.routescan.io/tx/${txHash}?rpc=${rpcUrl}`;
    }
};

export type EVMTransactionType = 'deploy' | 'call' | 'transfer' | 'local';

export type EVMNotificationOptions = {
    type: EVMTransactionType;
    name: string; // Human-readable name for the action
    timeoutMs?: number; // Optional timeout in milliseconds (default: 10 seconds)
};

// Default timeout: 10 seconds
const DEFAULT_TIMEOUT_MS = 10000;

const getMessages = (type: EVMTransactionType, name: string) => {
    switch (type) {
        case 'deploy':
            return {
                loading: `Deploying ${name}...`,
                success: `${name} deployed successfully`,
                error: `Failed to deploy ${name}: `
            };
        case 'call':
            return {
                loading: `Executing ${name}...`,
                success: `${name} completed successfully`,
                error: `Failed to execute ${name}: `
            };
        case 'transfer':
            return {
                loading: `Sending ${name}...`,
                success: `${name} sent successfully`,
                error: `Failed to send ${name}: `
            };
        case 'local':
            return {
                loading: `Processing ${name}...`,
                success: `${name} completed successfully`,
                error: `Failed to process ${name}: `
            };
    }
};

// Custom error class for timeout with transaction hash
class TransactionTimeoutError extends Error {
    txHash: string;

    constructor(txHash: string, timeoutMs: number) {
        const timeoutSeconds = Math.round(timeoutMs / 1000);
        super(
            `Transaction confirmation timed out after ${timeoutSeconds} second${timeoutSeconds !== 1 ? 's' : ''}. ` +
            `Your transaction (${txHash.slice(0, 10)}...) may still be pending. ` +
            `Please check the block explorer to verify its status before retrying.`
        );
        this.name = 'TransactionTimeoutError';
        this.txHash = txHash;
    }
}

// Wait for transaction with configurable timeout
async function waitForTransactionWithTimeout(
    publicClient: ReturnType<typeof createPublicClient>,
    hash: `0x${string}`,
    timeoutMs: number
): Promise<Awaited<ReturnType<ReturnType<typeof createPublicClient>['waitForTransactionReceipt']>>> {
    return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
            reject(new TransactionTimeoutError(hash, timeoutMs));
        }, timeoutMs);

        publicClient
            .waitForTransactionReceipt({ hash })
            .then((receipt) => {
                clearTimeout(timeoutId);
                resolve(receipt);
            })
            .catch((error) => {
                clearTimeout(timeoutId);
                reject(error);
            });
    });
}

const useEVMNotifications = () => {
    const isTestnet = typeof window !== 'undefined' ? useWalletStore((s) => s.isTestnet) : false;
    const { addLog } = useConsoleLog(false); // Don't auto-fetch logs
    const pathname = usePathname();


    const notifyEVM = (options: EVMNotificationOptions, promise: Promise<any>, viemChain?: Chain) => {
        const messages = getMessages(options.type, options.name);
        const toastId = toast.loading(messages.loading);

        // Extract the flow context from the current pathname
        // e.g., "/console/permissioned-l1s/validator-manager-setup/deploy-validator-manager" 
        // becomes "permissioned-l1s/validator-manager-setup"
        // Also handles /academy and /docs paths
        const pathSegments = pathname?.split('/').filter(Boolean) || [];
        
        // Check for console, academy, or docs in the path
        const rootSections = ['console', 'academy', 'docs'];
        let flowPath = pathname;
        
        for (const section of rootSections) {
            const sectionIndex = pathSegments.indexOf(section);
            if (sectionIndex !== -1) {
                flowPath = pathSegments.slice(sectionIndex + 1, -1).join('/');
                break;
            }
        }

        // Create a contextual action path based on the flow and action
        const actionPath = `${flowPath}/${options.type}/${options.name.toLowerCase().replace(/\s+/g, '_')}`;

        promise
            .then(async (result) => {
                let logData: Record<string, any>;

                // Local operations don't need transaction confirmation
                if (options.type === 'local') {
                    logData = { 
                        result: typeof result === 'string' ? result : JSON.stringify(result), 
                        network: isTestnet ? 'testnet' : 'mainnet' 
                    };
                    toast.success(messages.success, { id: toastId });
                } 
                // All EVM transactions need confirmation
                else if (viemChain) {
                    const hash = result;
                    const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;
                    toast.loading('Waiting for transaction confirmation...', { id: toastId });

                    const publicClient = createPublicClient({
                        chain: viemChain,
                        transport: http()
                    });
                    const receipt = await waitForTransactionWithTimeout(
                        publicClient,
                        hash as `0x${string}`,
                        timeoutMs
                    );

                    // For deployments, include the deployed contract address
                    if (options.type === 'deploy' && receipt.contractAddress) {
                        logData = {
                            txHash: hash,
                            address: receipt.contractAddress,
                            chainId: viemChain.id,
                            network: isTestnet ? 'testnet' : 'mainnet'
                        };
                    } else {
                        logData = {
                            txHash: hash,
                            chainId: viemChain.id,
                            network: isTestnet ? 'testnet' : 'mainnet'
                        };
                    }

                    toast.success(`${messages.success}`, {
                        id: toastId,
                        action: {
                            label: 'Open in Explorer',
                            onClick: () => window.open(getEVMExplorerUrl(hash, viemChain), '_blank')
                        }
                    });
                } else {
                    // For cases where we might not have a chain (edge case)
                    logData = { result, network: isTestnet ? 'testnet' : 'mainnet' };
                    toast.success(messages.success, { id: toastId });
                }

                addLog({
                    status: 'success',
                    actionPath,
                    data: logData
                });

                // Track successful action in PostHog
                posthog.capture('console_action_success', {
                    action_type: options.type,
                    action_name: options.name,
                    action_path: actionPath,
                    network: isTestnet ? 'testnet' : 'mainnet',
                    ...(viemChain?.id && { chain_id: viemChain.id }),
                    ...(viemChain?.name && { chain_name: viemChain.name }),
                    ...(logData.txHash && { tx_hash: logData.txHash }),
                    ...(logData.address && { contract_address: logData.address }),
                    context: pathname?.includes('/academy') ? 'academy' : (pathname?.includes('/docs') ? 'docs' : 'console'),
                    chain_type: 'evm'
                });
            })
            .catch((error) => {
                const errorMessage = messages.error + error.message;

                toast.dismiss(toastId);
                showCustomErrorToast(errorMessage);

                addLog({
                    status: 'error',
                    actionPath,
                    data: { error: error.message, network: isTestnet ? 'testnet' : 'mainnet' }
                });

                // Track error in PostHog
                posthog.capture('console_action_error', {
                    action_type: options.type,
                    action_name: options.name,
                    action_path: actionPath,
                    network: isTestnet ? 'testnet' : 'mainnet',
                    ...(viemChain?.id && { chain_id: viemChain.id }),
                    ...(viemChain?.name && { chain_name: viemChain.name }),
                    error_message: error.message,
                    context: pathname?.includes('/academy') ? 'academy' : (pathname?.includes('/docs') ? 'docs' : 'console'),
                    chain_type: 'evm'
                });
            });
    };

    return notifyEVM;
};

export default useEVMNotifications;
