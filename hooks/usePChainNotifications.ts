import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { getTxHistoryStore } from '@/components/toolbox/stores/txHistoryStore';
import { useConsoleLog } from './use-console-log';
import { PChainClient, createPChainClient } from '@avalanche-sdk/client';
import { avalanche, avalancheFuji } from '@avalanche-sdk/client/chains';
import { usePathname } from 'next/navigation';
import posthog from 'posthog-js';
import { useNotificationPanelStore } from '@/components/console/notification-panel';

const getPChainTxExplorerURL = (txID: string, isTestnet: boolean) => {
  return `https://${isTestnet ? 'subnets-test' : 'subnets'}.avax.network/p-chain/tx/${txID}`;
};

export type PChainAction =
  | 'createSubnet'
  | 'createChain'
  | 'convertToL1'
  | 'addPermissionlessValidator'
  | 'registerL1Validator'
  | 'setL1ValidatorWeight'
  | 'increaseL1ValidatorBalance'
  | 'disableL1Validator'
  | 'exportCross'
  | 'importCross';
export const PChainActionList = [
  'createSubnet',
  'createChain',
  'convertToL1',
  'addPermissionlessValidator',
  'registerL1Validator',
  'setL1ValidatorWeight',
  'increaseL1ValidatorBalance',
  'disableL1Validator',
  'exportCross',
  'importCross',
];

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
  increaseL1ValidatorBalance: {
    loadingMessage: 'Signing IncreaseL1ValidatorBalanceTx with Core...',
    successMessage: 'Validator balance increased successfully',
    errorMessagePrefix: 'Failed to increase validator balance: ',
    eventType: 'validator_balance_increased',
  },
  disableL1Validator: {
    loadingMessage: 'Signing DisableL1ValidatorTx with Core...',
    successMessage: 'Validator disabled successfully',
    errorMessagePrefix: 'Failed to disable validator: ',
    eventType: 'validator_disabled',
  },
  exportCross: {
    loadingMessage: 'Signing cross-chain export with Core...',
    successMessage: 'Export confirmed — importing to destination',
    errorMessagePrefix: 'Export failed: ',
    eventType: 'cross_chain_export',
  },
  importCross: {
    loadingMessage: 'Signing cross-chain import with Core...',
    successMessage: 'Transfer complete!',
    errorMessagePrefix: 'Import failed: ',
    eventType: 'cross_chain_import',
  },
};

const waitForTransaction = async (client: PChainClient, txID: string, maxAttempts = 30, interval = 2000) => {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const receipt = await client.getTxStatus({ txID });
    if (receipt.status === 'Committed') {
      return true;
    } else if (receipt.status === 'Dropped') {
      throw new Error(`Transaction ${receipt.status}`);
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
  throw new Error('Transaction confirmation timeout');
};

const usePChainNotifications = () => {
  const isTestnet = typeof window !== 'undefined' ? useWalletStore((s) => s.isTestnet) : false;
  const { addLog } = useConsoleLog(false);
  const pathname = usePathname();

  const client: PChainClient = createPChainClient({
    chain: isTestnet ? avalancheFuji : avalanche,
    transport: { type: 'http' },
  });

  const notifyPChain = (action: PChainAction, promise: Promise<string>) => {
    const config = configs[action];
    const store = useNotificationPanelStore.getState();
    const notifId = store.addNotification({
      name: config.eventType.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      status: 'loading',
      message: config.loadingMessage,
    });

    const pathSegments = pathname?.split('/').filter(Boolean) || [];
    const rootSections = ['console', 'academy', 'docs'];
    let flowPath = pathname;
    for (const section of rootSections) {
      const sectionIndex = pathSegments.indexOf(section);
      if (sectionIndex !== -1) {
        flowPath = pathSegments.slice(sectionIndex + 1, -1).join('/');
        break;
      }
    }
    const actionPath = `${flowPath}/${config.eventType}`;
    const skipConfirmationWait = action === 'exportCross' || action === 'importCross';

    promise
      .then(async (txID) => {
        try {
          if (typeof txID !== 'string' && txID && 'txHash' in txID) {
            txID = (txID as { txHash: string }).txHash;
          }

          // Log P-Chain tx to history store as pending
          const txHistory = getTxHistoryStore(Boolean(isTestnet)).getState();
          txHistory.addTx({
            type: 'pchain',
            network: isTestnet ? 'fuji' : 'mainnet',
            operation: config.eventType.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
            txHash: txID,
            status: 'pending',
          });

          if (!skipConfirmationWait) {
            store.updateNotification(notifId, {
              message: 'Waiting for transaction confirmation...',
              txHash: txID,
            });
            await waitForTransaction(client, txID as string);
          }

          // Update tx history to confirmed
          txHistory.updateTxStatus(txID, 'confirmed');

          const explorerUrl = getPChainTxExplorerURL(txID, isTestnet);
          store.updateNotification(notifId, {
            status: 'success',
            message: config.successMessage,
            txHash: txID,
            explorerUrl,
          });

          const data =
            action === 'createChain'
              ? { txID, blockchainID: txID, network: isTestnet ? 'testnet' : 'mainnet' }
              : { txID, network: isTestnet ? 'testnet' : 'mainnet' };
          addLog({ status: 'success', actionPath, data });

          posthog.capture('console_action_success', {
            action_type: config.eventType,
            action_name: action,
            action_path: actionPath,
            network: isTestnet ? 'testnet' : 'mainnet',
            tx_id: txID,
            context: pathname?.includes('/academy') ? 'academy' : pathname?.includes('/docs') ? 'docs' : 'console',
            chain_type: 'p-chain',
          });
        } catch (error) {
          const errorMessage = config.errorMessagePrefix + (error as Error).message;
          store.updateNotification(notifId, {
            status: 'error',
            message: errorMessage,
          });

          // Update tx history to failed (txID available in this scope)
          getTxHistoryStore(Boolean(isTestnet)).getState().updateTxStatus(txID, 'failed', (error as Error).message);

          addLog({
            status: 'error',
            actionPath,
            data: { error: (error as Error).message, network: isTestnet ? 'testnet' : 'mainnet' },
          });
          posthog.capture('console_action_error', {
            action_type: config.eventType,
            action_name: action,
            action_path: actionPath,
            network: isTestnet ? 'testnet' : 'mainnet',
            error_message: (error as Error).message,
            context: pathname?.includes('/academy') ? 'academy' : pathname?.includes('/docs') ? 'docs' : 'console',
            chain_type: 'p-chain',
          });
        }
      })
      .catch((error) => {
        const errorMessage = config.errorMessagePrefix + error.message;
        store.updateNotification(notifId, {
          status: 'error',
          message: errorMessage,
        });

        addLog({
          status: 'error',
          actionPath,
          data: { error: error.message, network: isTestnet ? 'testnet' : 'mainnet' },
        });
        posthog.capture('console_action_error', {
          action_type: config.eventType,
          action_name: action,
          action_path: actionPath,
          network: isTestnet ? 'testnet' : 'mainnet',
          error_message: error.message,
          context: pathname?.includes('/academy') ? 'academy' : pathname?.includes('/docs') ? 'docs' : 'console',
          chain_type: 'p-chain',
        });
      });
  };

  return notifyPChain;
};

export default usePChainNotifications;
