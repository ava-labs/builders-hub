"use client";

import { useSession } from 'next-auth/react';

import { useState, useMemo } from 'react';
import useConsoleNotifications from '@/hooks/useConsoleNotifications';
import type { ConsoleLog } from '@/types/console-log';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { useSelectedL1 } from '@/components/toolbox/stores/l1ListStore';
import { useToolboxStore } from '@/components/toolbox/stores/toolboxStore';
import { useCreateChainStore } from '@/components/toolbox/stores/createChainStore';
import { 
  Search, 
  ExternalLink,
  Copy,
  Check,
  Download,
  LogIn
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/cn';

export default function ConsoleHistoryPage() {
  const { data: session, status } = useSession();
  const { logs: fullHistory, getExplorerUrl, loading } = useConsoleNotifications();
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  // Toolbox store data
  const { isTestnet } = useWalletStore();
  const selectedL1 = useSelectedL1()();
  const toolboxStore = useToolboxStore();
  const createChainStore = useCreateChainStore()();

  // Create store-based items that look like history items
  const storeItems = useMemo(() => {
    const items: Array<{
      id: string;
      title: string;
      description?: string;
      address: string;
      chainId?: string;
      type: 'address' | 'tx';
    }> = [];

    // Add items from createChainStore
    if (createChainStore) {
      if (createChainStore.subnetId && createChainStore.subnetId !== '') {
        items.push({
          id: 'cc-subnet',
          title: 'Subnet ID',
          description: createChainStore.chainName || 'Chain Configuration',
          address: createChainStore.subnetId,
          type: 'tx'
        });
      }
      if (createChainStore.chainID && createChainStore.chainID !== '') {
        items.push({
          id: 'cc-chain-id',
          title: 'Chain ID',
          description: createChainStore.chainName || 'Blockchain ID',
          address: createChainStore.chainID,
          type: 'tx'
        });
      }
      if (createChainStore.managerAddress && createChainStore.managerAddress !== '0xfacade0000000000000000000000000000000000') {
        items.push({
          id: 'cc-manager',
          title: 'Manager Address',
          description: 'Chain Manager Contract',
          address: createChainStore.managerAddress,
          chainId: createChainStore.evmChainId?.toString(),
          type: 'address'
        });
      }
      if (createChainStore.convertToL1TxId && createChainStore.convertToL1TxId !== '') {
        items.push({
          id: 'cc-l1-tx',
          title: 'Convert to L1 Transaction',
          description: 'L1 Conversion',
          address: createChainStore.convertToL1TxId,
          type: 'tx'
        });
      }
    }

    // Add items from toolboxStore
    if (toolboxStore) {
      const chainId = selectedL1?.evmChainId?.toString();
      
      if (toolboxStore.validatorManagerAddress && toolboxStore.validatorManagerAddress !== '') {
        items.push({
          id: 'tb-validator-mgr',
          title: 'Validator Manager',
          description: 'Deployed Contract',
          address: toolboxStore.validatorManagerAddress,
          chainId,
          type: 'address'
        });
      }
      if (toolboxStore.stakingManagerAddress && toolboxStore.stakingManagerAddress !== '') {
        items.push({
          id: 'tb-staking-mgr',
          title: 'Staking Manager',
          description: 'Deployed Contract',
          address: toolboxStore.stakingManagerAddress,
          chainId,
          type: 'address'
        });
      }
      if (toolboxStore.poaManagerAddress && toolboxStore.poaManagerAddress !== '') {
        items.push({
          id: 'tb-poa-mgr',
          title: 'POA Manager',
          description: 'Deployed Contract',
          address: toolboxStore.poaManagerAddress,
          chainId,
          type: 'address'
        });
      }
      if (toolboxStore.teleporterRegistryAddress && toolboxStore.teleporterRegistryAddress !== '') {
        items.push({
          id: 'tb-teleporter',
          title: 'Teleporter Registry',
          description: 'ICM Contract',
          address: toolboxStore.teleporterRegistryAddress,
          chainId,
          type: 'address'
        });
      }
      if (toolboxStore.icmReceiverAddress && toolboxStore.icmReceiverAddress !== '') {
        items.push({
          id: 'tb-icm-receiver',
          title: 'ICM Receiver',
          description: 'Deployed Contract',
          address: toolboxStore.icmReceiverAddress,
          chainId,
          type: 'address'
        });
      }
      if (toolboxStore.wrappedNativeTokenAddress && toolboxStore.wrappedNativeTokenAddress !== '') {
        items.push({
          id: 'tb-wrapped-native',
          title: 'Wrapped Native Token',
          description: 'Token Contract',
          address: toolboxStore.wrappedNativeTokenAddress,
          chainId,
          type: 'address'
        });
      }
      if (toolboxStore.erc20TokenHomeAddress && toolboxStore.erc20TokenHomeAddress !== '') {
        items.push({
          id: 'tb-erc20-home',
          title: 'ERC20 Token Home',
          description: 'Token Contract',
          address: toolboxStore.erc20TokenHomeAddress,
          chainId,
          type: 'address'
        });
      }
      if (toolboxStore.nativeTokenHomeAddress && toolboxStore.nativeTokenHomeAddress !== '') {
        items.push({
          id: 'tb-native-home',
          title: 'Native Token Home',
          description: 'Token Contract',
          address: toolboxStore.nativeTokenHomeAddress,
          chainId,
          type: 'address'
        });
      }
    }

    return items;
  }, [createChainStore, toolboxStore, selectedL1]);

  // Filter history based on search
  const filteredHistory = useMemo(() => {
    if (!searchTerm) return fullHistory;
    
    const search = searchTerm.toLowerCase();
    return fullHistory.filter(notification => 
      notification.actionPath?.toLowerCase().includes(search) ||
      JSON.stringify(notification.data).toLowerCase().includes(search)
    );
  }, [fullHistory, searchTerm]);

  // Filter store items based on search
  const filteredStoreItems = useMemo(() => {
    if (!searchTerm) return storeItems;
    
    const search = searchTerm.toLowerCase();
    return storeItems.filter(item => 
      item.title.toLowerCase().includes(search) ||
      item.description?.toLowerCase().includes(search) ||
      item.address.toLowerCase().includes(search)
    );
  }, [storeItems, searchTerm]);

  const handleCopy = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const handleExport = () => {
    const exportData = {
      history: filteredHistory,
      configuration: filteredStoreItems
    };
    const dataStr = JSON.stringify(exportData, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `console-history-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const getExplorerLink = (notification: ConsoleLog): string | null => {
    const data = notification.data as any;
    const network = data.network || 'testnet';
    
    // Helper to convert chain ID to chain identifier
    const getChainIdentifier = (chainId: string | undefined): string => {
      if (!chainId) return 'C';
      // C-Chain IDs: 43114 (mainnet), 43113 (testnet/fuji)
      if (chainId === '43114' || chainId === '43113') return 'C';
      // For other chains, return the chain ID itself
      return chainId;
    };
    
    // Check for transaction IDs/hashes
    if (data.txID) {
      return getExplorerUrl(data.txID, 'tx', network, 'P');
    }
    if (data.txHash) {
      const chain = getChainIdentifier(data.chainID);
      return getExplorerUrl(data.txHash, 'tx', network, chain);
    }
    
    // Check for contract addresses
    if (data.contractAddress) {
      const chain = getChainIdentifier(data.chainID);
      return getExplorerUrl(data.contractAddress, 'address', network, chain);
    }
    
    // For subnet/chain creation, use the ID as transaction ID
    if (data.subnetID && notification.actionPath?.includes('subnet_created')) {
      return getExplorerUrl(data.subnetID, 'tx', network, 'P');
    }
    if (data.blockchainID && notification.actionPath?.includes('chain_created')) {
      return getExplorerUrl(data.blockchainID, 'tx', network, 'P');
    }
    if (data.txID && notification.actionPath?.includes('l1_conversion')) {
      return getExplorerUrl(data.txID, 'tx', network, 'P');
    }
    
    return null;
  };

  const getDisplayInfo = (log: ConsoleLog) => {
    const { actionPath, status, data } = log;
    let title = '';
    let description = '';

    const network = data.network ? ` (${data.network})` : '';

    // Parse the action path to extract context
    // Format: "section/subsection/.../action_type/action_name"
    const pathParts = actionPath?.split('/') || [];
    
    if (pathParts.length >= 2) {
      // Get the last two parts: action_type and action_name
      const actionName = pathParts[pathParts.length - 1] || '';
      const actionType = pathParts[pathParts.length - 2] || '';
      
      // Format the action name for display
      const formattedName = actionName
        .replace(/_/g, ' ')
        .replace(/\b\w/g, char => char.toUpperCase());
      
      // Generate title based on action type and status
      const statusText = status === 'success' ? 'Success' : 'Failed';
      
      switch (actionType) {
        case 'deploy':
          title = `Deploy ${formattedName} - ${statusText}`;
          break;
        case 'call':
          title = `${formattedName} - ${statusText}`;
          break;
        case 'transfer':
          title = `Transfer ${formattedName} - ${statusText}`;
          break;
        case 'local':
          title = `${formattedName} - ${statusText}`;
          break;
        default:
          // For P-Chain actions or other types
          title = `${formattedName} - ${statusText}`;
      }
    } else if (actionPath) {
      // Fallback for simple action paths
      const formattedAction = actionPath
        .replace(/_/g, ' ')
        .replace(/\b\w/g, char => char.toUpperCase());
      title = `${formattedAction} - ${status === 'success' ? 'Success' : 'Failed'}`;
    } else {
      // No action path provided
      title = `Event ${status.toUpperCase()}`;
    }

    // Generate description based on available data fields
    if (status === 'error') {
      description = data.error || 'Unknown error occurred';
    } else {
      const details = [];
      
      // Add relevant data fields to description
      if (data.txHash) {
        details.push(`Transaction: ${data.txHash.slice(0, 10)}...`);
      }
      if (data.txID) {
        details.push(`Transaction ID: ${data.txID.slice(0, 10)}...`);
      }
      if (data.address) {
        details.push(`Address: ${data.address}`);
      }
      if (data.subnetID) {
        details.push(`Subnet ID: ${data.subnetID.slice(0, 10)}...`);
      }
      if (data.blockchainID) {
        details.push(`Blockchain ID: ${data.blockchainID.slice(0, 10)}...`);
      }
      if (data.chainId) {
        details.push(`Chain ID: ${data.chainId}`);
      }
      if (data.result && typeof data.result === 'string') {
        const preview = data.result.length > 30 ? `${data.result.slice(0, 30)}...` : data.result;
        details.push(`Result: ${preview}`);
      }
      
      if (details.length > 0) {
        description = details.join('\n') + network;
      } else {
        // If no specific fields, show a generic success message or stringify the data
        description = Object.keys(data).length > 1 
          ? `Details: ${JSON.stringify(data).slice(0, 100)}...` 
          : `Operation completed successfully${network}`;
      }
    }

    return { title, description };
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl">
      {/* Simple Header */}
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-semibold">
          History
        </h1>
        {(fullHistory.length > 0 || storeItems.length > 0) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleExport}
            disabled={filteredHistory.length === 0 && filteredStoreItems.length === 0}
            title="Export history as JSON"
          >
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        )}
      </div>

      {/* Simple Search */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* History List */}
      {status === 'loading' || loading ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      ) : filteredHistory.length === 0 && filteredStoreItems.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            {fullHistory.length === 0 && storeItems.length === 0
              ? "No history yet"
              : "No results found"}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* History Section */}
          {(filteredHistory.length > 0 || !session?.user) && (
            <div>
              <div className="mb-4">
                <h2 className="text-lg font-semibold">Transaction History</h2>
                <p className="text-sm text-muted-foreground mt-1">Your recent transactions and operations</p>
              </div>
              <div className="space-y-2">
                {/* Login prompt if not signed in */}
                {!session?.user && filteredHistory.length === 0 && (
                  <div className="text-center py-8 border rounded-lg bg-muted/10">
                    <div className="space-y-4">
                      <p className="text-muted-foreground text-sm">
                        Sign in to see your console history across sessions
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.location.href = '/login'}
                        className="gap-2"
                      >
                        <LogIn className="h-4 w-4" />
                        Sign In
                      </Button>
                    </div>
                  </div>
                )}
                
                {filteredHistory.map((notification) => {
                  const { title, description } = getDisplayInfo(notification);
                  const explorerUrl = getExplorerLink(notification);
                  const data = notification.data as any;
                  
                  // Extract the main identifier (tx hash, address, etc)
                  const mainId = data.txHash || data.txID || data.address || data.signedMessage;
                  const mainIdStr = mainId ? String(mainId) : '';
                  const shortId = mainIdStr.length > 14 ? `${mainIdStr.slice(0, 8)}...${mainIdStr.slice(-6)}` : mainIdStr;
                  
                  return (
                    <div
                      key={notification.id}
                      className={cn(
                        "p-4 rounded-lg border bg-card/50 transition-all",
                        explorerUrl && "hover:bg-card cursor-pointer",
                        notification.status === 'error' && "border-destructive/20"
                      )}
                      onClick={(e) => {
                        if (explorerUrl && !(e.target as HTMLElement)?.closest('button')) {
                          window.open(explorerUrl, '_blank');
                        }
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <span className={cn(
                              "text-sm font-medium",
                              notification.status === 'error' && "text-destructive"
                            )}>
                              {title}
                            </span>
                            {data.network && (
                              <span className={cn(
                                "text-xs px-1.5 py-0.5 rounded-full font-medium",
                                data.network === 'mainnet' 
                                  ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" 
                                  : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                              )}>
                                {data.network === 'mainnet' ? 'Mainnet' : 'Testnet'}
                              </span>
                            )}
                            {shortId && (
                              <code className="text-xs text-muted-foreground font-mono">
                                {shortId}
                              </code>
                            )}
                          </div>
                          {/* Show action path as breadcrumb for context */}
                          {notification.actionPath && (
                            <div className="text-xs text-muted-foreground mt-1">
                              <span className="font-mono opacity-70">
                                {notification.actionPath.split('/').slice(0, -1).join(' / ')}
                              </span>
                            </div>
                          )}
                          {description && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {description}
                            </p>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-3 ml-4">
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(notification.timestamp), 'HH:mm')}
                          </span>
                          {mainIdStr && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCopy(mainIdStr, notification.id);
                              }}
                              className="p-1 hover:bg-accent rounded transition-colors"
                              title="Copy"
                            >
                              {copiedId === notification.id ? (
                                <Check className="h-3 w-3 text-green-500" />
                              ) : (
                                <Copy className="h-3 w-3 text-muted-foreground" />
                              )}
                            </button>
                          )}
                          {explorerUrl && (
                            <ExternalLink className="h-3 w-3 text-muted-foreground" />
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          
          {/* Store Items Section */}
          {filteredStoreItems.length > 0 && (
            <div>
              <div className="mb-4">
                <h2 className="text-lg font-semibold">Console Configuration</h2>
                <p className="text-sm text-muted-foreground mt-1">Active contracts and chain configuration from your current session</p>
              </div>
              <div className="space-y-2">
                {filteredStoreItems.map((item) => {
                  const network = isTestnet ? 'testnet' : 'mainnet';
                  const chainId = item.chainId || (selectedL1?.evmChainId?.toString());
                  const explorerUrl = item.type === 'tx' 
                    ? getExplorerUrl(item.address, 'tx', network, 'P')
                    : chainId 
                      ? getExplorerUrl(item.address, 'address', network, chainId)
                      : null;
                  const shortId = item.address.length > 14 ? `${item.address.slice(0, 8)}...${item.address.slice(-6)}` : item.address;
                  
                  return (
                    <div
                      key={item.id}
                      className={cn(
                        "p-4 rounded-lg border bg-card/50 transition-all",
                        explorerUrl && "hover:bg-card cursor-pointer"
                      )}
                      onClick={(e) => {
                        if (explorerUrl && !(e.target as HTMLElement)?.closest('button')) {
                          window.open(explorerUrl, '_blank');
                        }
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-medium">
                              {item.title}
                            </span>
                            <span className={cn(
                              "text-xs px-1.5 py-0.5 rounded-full font-medium",
                              network === 'mainnet' 
                                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" 
                                : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                            )}>
                              {network === 'mainnet' ? 'Mainnet' : 'Testnet'}
                            </span>
                            <code className="text-xs text-muted-foreground font-mono">
                              {shortId}
                            </code>
                          </div>
                          {item.description && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {item.description}
                            </p>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-3 ml-4">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopy(item.address, item.id);
                            }}
                            className="p-1 hover:bg-accent rounded transition-colors"
                            title="Copy"
                          >
                            {copiedId === item.id ? (
                              <Check className="h-3 w-3 text-green-500" />
                            ) : (
                              <Copy className="h-3 w-3 text-muted-foreground" />
                            )}
                          </button>
                          {explorerUrl && (
                            <ExternalLink className="h-3 w-3 text-muted-foreground" />
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
