import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { getTxHistoryStore } from '@/components/toolbox/stores/txHistoryStore';
import { useConsoleLog } from './use-console-log';
import { Chain, createPublicClient, http } from 'viem';
import { usePathname } from 'next/navigation';
import posthog from 'posthog-js';
import l1ChainsData from '@/constants/l1-chains.json';
import {
  getAllCustomChains,
  findCustomChainByEvmChainId,
} from '@/components/explorer/utils/chainConverter';
import { useNotificationPanelStore } from '@/components/console/notification-panel';

const EXPLORER_BASE_PATH = '/explorer';

const getEVMExplorerUrl = (txHash: string, viemChain: Chain) => {
  if (viemChain.id === 43114 || viemChain.id === 43113) {
    return `${EXPLORER_BASE_PATH}/avalanche-c-chain/tx/${txHash}`;
  }
  const l1Chain = l1ChainsData.find((c) => c.chainId === String(viemChain.id));
  if (l1Chain?.slug) {
    return `${EXPLORER_BASE_PATH}/${l1Chain.slug}/tx/${txHash}`;
  }
  const customChain = findCustomChainByEvmChainId(getAllCustomChains(), viemChain.id);
  if (customChain) {
    return `${EXPLORER_BASE_PATH}/${customChain.id}/tx/${txHash}`;
  }
  if (viemChain.blockExplorers?.default?.url) {
    return `${viemChain.blockExplorers.default.url}/tx/${txHash}`;
  }
  const rpcUrl = viemChain.rpcUrls.default.http[0];
  return `https://devnet.routescan.io/tx/${txHash}?rpc=${rpcUrl}`;
};

export type EVMTransactionType = 'deploy' | 'call' | 'transfer' | 'local';

export type EVMNotificationOptions = {
  type: EVMTransactionType;
  name: string;
};

const getMessages = (type: EVMTransactionType, name: string) => {
  switch (type) {
    case 'deploy':
      return { loading: `Deploying ${name}...`, success: `${name} deployed successfully`, error: `Failed to deploy ${name}: ` };
    case 'call':
      return { loading: `Executing ${name}...`, success: `${name} completed successfully`, error: `Failed to execute ${name}: ` };
    case 'transfer':
      return { loading: `Sending ${name}...`, success: `${name} sent successfully`, error: `Failed to send ${name}: ` };
    case 'local':
      return { loading: `Processing ${name}...`, success: `${name} completed successfully`, error: `Failed to process ${name}: ` };
  }
};

const useEVMNotifications = () => {
  const isTestnet = typeof window !== 'undefined' ? useWalletStore((s) => s.isTestnet) : false;
  const { addLog } = useConsoleLog(false);
  const pathname = usePathname();

  const notifyEVM = (options: EVMNotificationOptions, promise: Promise<any>, viemChain?: Chain) => {
    const messages = getMessages(options.type, options.name);
    const store = useNotificationPanelStore.getState();
    const notifId = store.addNotification({
      name: options.name,
      status: 'loading',
      message: messages.loading,
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
    const actionPath = `${flowPath}/${options.type}/${options.name.toLowerCase().replace(/\s+/g, '_')}`;

    promise
      .then(async (result) => {
        let logData: Record<string, any>;

        if (options.type === 'local') {
          logData = {
            result: typeof result === 'string' ? result : JSON.stringify(result),
            network: isTestnet ? 'testnet' : 'mainnet',
          };
          store.updateNotification(notifId, {
            status: 'success',
            message: messages.success,
          });
        } else if (viemChain) {
          const hash = result;
          store.updateNotification(notifId, {
            message: 'Waiting for transaction confirmation...',
            txHash: hash,
          });

          const publicClient = createPublicClient({ chain: viemChain, transport: http() });
          const receipt = await publicClient.waitForTransactionReceipt({ hash: hash as `0x${string}` });

          // Update tx history store with confirmed/failed status
          const txHistoryState = getTxHistoryStore(Boolean(isTestnet)).getState();
          if (receipt.status === 'reverted') {
            let revertMessage = `Transaction reverted (hash: ${hash})`;

            // On Fuji, auto-trace the failed tx for richer error context
            if (isTestnet) {
              try {
                const traceResp = await fetch('/api/debug-rpc', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    method: 'debug_traceTransaction',
                    params: [hash, { tracer: 'callTracer', tracerConfig: { onlyTopCall: false } }],
                  }),
                });
                if (traceResp.ok) {
                  const traceData = await traceResp.json();
                  const reason = traceData?.result?.revertReason || traceData?.result?.error;
                  if (reason) revertMessage = `Transaction reverted: ${reason} (hash: ${hash})`;
                }
              } catch {
                // Trace failed, use default message
              }
            }

            txHistoryState.updateTxStatus(hash, 'failed', revertMessage);
            throw new Error(revertMessage);
          }
          txHistoryState.updateTxStatus(hash, 'confirmed');

          const explorerUrl = getEVMExplorerUrl(hash, viemChain);

          if (options.type === 'deploy' && receipt.contractAddress) {
            logData = { txHash: hash, address: receipt.contractAddress, chainId: viemChain.id, network: isTestnet ? 'testnet' : 'mainnet' };
          } else {
            logData = { txHash: hash, chainId: viemChain.id, network: isTestnet ? 'testnet' : 'mainnet' };
          }

          store.updateNotification(notifId, {
            status: 'success',
            message: messages.success,
            explorerUrl,
          });
        } else {
          logData = { result, network: isTestnet ? 'testnet' : 'mainnet' };
          store.updateNotification(notifId, {
            status: 'success',
            message: messages.success,
          });
        }

        addLog({ status: 'success', actionPath, data: logData });
        posthog.capture('console_action_success', {
          action_type: options.type,
          action_name: options.name,
          action_path: actionPath,
          network: isTestnet ? 'testnet' : 'mainnet',
          ...(viemChain?.id && { chain_id: viemChain.id }),
          ...(viemChain?.name && { chain_name: viemChain.name }),
          ...(logData.txHash && { tx_hash: logData.txHash }),
          ...(logData.address && { contract_address: logData.address }),
          context: pathname?.includes('/academy') ? 'academy' : pathname?.includes('/docs') ? 'docs' : 'console',
          chain_type: 'evm',
        });
      })
      .catch((error) => {
        const errorMessage = messages.error + error.message;
        store.updateNotification(notifId, {
          status: 'error',
          message: errorMessage,
        });

        // Update tx history store if a hash was captured before the error
        // (error might occur during confirmation, not during signing)
        getTxHistoryStore(Boolean(isTestnet)).getState().updateTxStatus(
          error?.transactionHash || '',
          'failed',
          error.message,
        );

        addLog({ status: 'error', actionPath, data: { error: error.message, network: isTestnet ? 'testnet' : 'mainnet' } });
        posthog.capture('console_action_error', {
          action_type: options.type,
          action_name: options.name,
          action_path: actionPath,
          network: isTestnet ? 'testnet' : 'mainnet',
          ...(viemChain?.id && { chain_id: viemChain.id }),
          ...(viemChain?.name && { chain_name: viemChain.name }),
          error_message: error.message,
          context: pathname?.includes('/academy') ? 'academy' : pathname?.includes('/docs') ? 'docs' : 'console',
          chain_type: 'evm',
        });
      });
  };

  return notifyEVM;
};

export default useEVMNotifications;
