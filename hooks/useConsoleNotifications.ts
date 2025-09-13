import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { toast } from 'sonner';

// TO-DO move somewhere better
const getPChainTxExplorerURL = (txID: string, isTestnet: boolean) => {
    return `https://${isTestnet ? "subnets-test" : "subnets"}.avax.network/p-chain/tx/${txID}`;
}

const useConsoleNotifications = () => {
    const { isTestnet } = useWalletStore();

    // TO-DO this should not be a thing. Core wallet should not be possible to be not set
    const sendCoreWalletNotSetNotification = () => {
        toast.error('Core wallet not set');
    }

    const sendCreateSubnetNotifications = (createSubnetTx: Promise<string>) => {
        toast.promise(createSubnetTx, {
            loading: 'Signing CreateSubnetTx with Core...',
            success: (txID: string) => ({
                message: 'Subnet created successfully',
                action: {
                    label: 'Open in Explorer',
                    onClick: () => window.open(getPChainTxExplorerURL(txID, isTestnet), '_blank')
                }
            }),
            error: (error) => 'Failed to create Subnet: ' + error.message,
        });

        createSubnetTx
            .then((txID) => {
                // TO-DO Add to History
            })
            .catch((error) => {
                // TO-DO Add to History Error
            });
    };

    const sendCreateChainNotifications = (createChainTx: Promise<string>) => {
        toast.promise(createChainTx, {
            loading: 'Signing CreateChainTx with Core...',
            success: (txID: string) => ({
                message: 'Chain created successfully',
                action: {
                    label: 'Open in Explorer',
                    onClick: () => window.open(getPChainTxExplorerURL(txID, isTestnet), '_blank')
                }
            }),
            error: (error) => 'Failed to create Chain: ' + error.message,
        });

        createChainTx
            .then((txID) => {
                // TO-DO Add to History
            })
            .catch((error) => {
                // TO-DO Add to History Error
            });
    };

    const sendConvertSubnetToL1Notifications = (convertSubnetToL1Tx: Promise<string>) => {
        toast.promise(convertSubnetToL1Tx, {
            loading: 'Signing ConvertSubnetToL1Tx with Core...',
            success: (txID: string) => ({
                message: 'Subnet converted to L1 successfully',
                action: {
                    label: 'Open in Explorer',
                    onClick: () => window.open(getPChainTxExplorerURL(txID, isTestnet), '_blank')
                }
            }),
            error: (error) => 'Failed to convert Subnet to L1: ' + error.message,
        });

        convertSubnetToL1Tx
            .then((txID) => {
                // TO-DO Add to History
            })
            .catch((error) => {
                // TO-DO Add to History Error
            });
    };

    return {
        sendCoreWalletNotSetNotification,
        sendCreateSubnetNotifications,
        sendCreateChainNotifications,
        sendConvertSubnetToL1Notifications,
    };
};

export default useConsoleNotifications;