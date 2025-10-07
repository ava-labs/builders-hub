import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { toast } from 'sonner';
import { useConsoleLog } from './use-console-log';
import { PChainClient, createPChainClient } from '@avalanche-sdk/client';
import { avalanche, avalancheFuji } from '@avalanche-sdk/client/chains';
import { usePathname } from 'next/navigation';

const getPChainTxExplorerURL = (txID: string, isTestnet: boolean) => {
    return `https://${isTestnet ? "subnets-test" : "subnets"}.avax.network/p-chain/tx/${txID}`;
};

export type PChainAction = 'createSubnet' | 'createChain' | 'convertToL1' | 'addPermissionlessValidator' | 'registerL1Validator' | 'setL1ValidatorWeight';
export const PChainActionList = ['createSubnet', 'createChain', 'convertToL1', 'addPermissionlessValidator', 'registerL1Validator', 'setL1ValidatorWeight'];

type PChainNotificationConfig = {
    loadingMessage: string;
    successMessage: string;
    errorMessagePrefix: string;
    eventType: string;
};

const configs: Record<PChainAction, PChainNotificationConfig> = {
    createSubnet: {
        loadingMessage: 'Signing CreateSubnetTx with Core...',
        successMessage: 'Subnet created successfully',
        errorMessagePrefix: 'Failed to create Subnet: ',
        eventType: 'subnet_created',
    },
    createChain: {
        loadingMessage: 'Signing CreateChainTx with Core...',
        successMessage: 'Chain created successfully',
        errorMessagePrefix: 'Failed to create Chain: ',
        eventType: 'chain_created',
    },
    convertToL1: {
        loadingMessage: 'Signing ConvertSubnetToL1Tx with Core...',
        successMessage: 'Subnet converted to L1 successfully',
        errorMessagePrefix: 'Failed to convert Subnet to L1: ',
        eventType: 'l1_conversion',
    },
    addPermissionlessValidator: {
        loadingMessage: 'Signing AddPermissionlessValidatorTx with Core...',
        successMessage: 'Validator added successfully',
        errorMessagePrefix: 'Failed to add validator: ',
        eventType: 'validator_added',
    },
    registerL1Validator: {
        loadingMessage: 'Signing RegisterL1ValidatorTx with Core...',
        successMessage: 'Validator registered successfully',
        errorMessagePrefix: 'Failed to register validator: ',
        eventType: 'validator_registered',
    },
    setL1ValidatorWeight: {
        loadingMessage: 'Signing SetL1ValidatorWeightTx with Core...',
        successMessage: 'Validator weight set successfully',
        errorMessagePrefix: 'Failed to set validator weight: ',
        eventType: 'validator_weight_set',
    },
};

const waitForTransaction = async (client: PChainClient, txID: string, maxAttempts = 10, interval = 300) => {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const receipt = await client.getTxStatus({ txID });
        if (receipt.status === 'Committed') {
            return true;
        } else if (receipt.status === 'Dropped') {
            throw new Error(`Transaction ${receipt.status}`);
        }
        await new Promise(resolve => setTimeout(resolve, interval));
    }
    throw new Error('Transaction confirmation timeout');
};

const usePChainNotifications = () => {
    const isTestnet = typeof window !== 'undefined' ? useWalletStore((s) => s.isTestnet) : false;
    const { addLog } = useConsoleLog(false); // Don't auto-fetch logs
    const pathname = usePathname();

    const client: PChainClient = createPChainClient({ chain: isTestnet ? avalancheFuji : avalanche, transport: { type: 'http' } });

    const notifyPChain = (action: PChainAction, promise: Promise<string>) => {
        const config = configs[action];

        const toastId = toast.loading(config.loadingMessage);

        // Extract the flow context from the current pathname
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
        const actionPath = `${flowPath}/${config.eventType}`;

        promise
            .then(async (txID) => {
                toast.loading('Waiting for transaction confirmation...', { id: toastId });

                try {
                    if (typeof txID !== 'string' && txID && 'txHash' in txID) {
                        txID = (txID as { txHash: string }).txHash;
                    }
                    await waitForTransaction(client, txID as string);
                    toast.success(`${config.successMessage}`, {
                        id: toastId,
                        action: {
                            label: 'Open in Explorer',
                            onClick: () => window.open(getPChainTxExplorerURL(txID, isTestnet), '_blank')
                        }
                    });

                    const data = action === 'createChain'
                        ? { txID, blockchainID: txID, network: isTestnet ? 'testnet' : 'mainnet' }
                        : { txID, network: isTestnet ? 'testnet' : 'mainnet' };
                    addLog({
                        status: 'success',
                        actionPath,
                        data
                    });
                } catch (error) {
                    toast.error(config.errorMessagePrefix + (error as Error).message, { id: toastId });
                    addLog({
                        status: 'error',
                        actionPath,
                        data: { error: (error as Error).message, network: isTestnet ? 'testnet' : 'mainnet' }
                    });
                }
            })
            .catch((error) => {
                toast.error(config.errorMessagePrefix + error.message, { id: toastId });
                addLog({
                    status: 'error',
                    actionPath,
                    data: { error: error.message, network: isTestnet ? 'testnet' : 'mainnet' }
                });
            });
    };

    return notifyPChain;
};

export default usePChainNotifications;
