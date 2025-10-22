import { toast } from 'sonner';
import { useConsoleLog } from './use-console-log';
import { Chain } from 'viem';
import usePChainNotifications from './usePChainNotifications';
import useEVMNotifications from './useEVMNotifications';
import { type PChainAction, PChainActionList } from './usePChainNotifications';
import { type EVMNotificationOptions } from './useEVMNotifications';

type ConsoleAction = PChainAction | EVMNotificationOptions;

const useConsoleNotifications = () => {
    const { logs, loading, getExplorerUrl } = useConsoleLog(false); // Don't auto-fetch logs
    const notifyP = usePChainNotifications();
    const notifyE = useEVMNotifications();

    // TO-DO this should not be a thing. Core wallet should not be possible to be not set
    const sendCoreWalletNotSetNotification = () => {
        toast.error('Core wallet not set');
    }

    const notify = <T>(action: ConsoleAction, promise: Promise<T>, viemChain?: Chain) => {
        if (typeof action === 'string' && PChainActionList.includes(action)) {
            notifyP(action as PChainAction, promise as Promise<string>);
        } else if (typeof action === 'object' && 'type' in action) {
            // Local operations don't require a chain
            if (!viemChain && action.type !== 'local') {
                throw new Error('viemChain is required for EVM deploy, call, and transfer actions');
            }
            notifyE(action as EVMNotificationOptions, promise, viemChain);
        }
    };

    return {
        sendCoreWalletNotSetNotification,
        notify,
        logs,
        loading,
        getExplorerUrl
    };
};

export default useConsoleNotifications;