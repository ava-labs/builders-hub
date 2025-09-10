'use client';
import { ChevronRight, Loader2, X } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import React from 'react';

// Console component mapping - maps console paths to their actual components
const consoleComponentMap: Record<string, () => Promise<{ default: React.ComponentType<any> }>> = {
  // Primary Network
  'primary-network/faucet': () => import('../../toolbox/src/toolbox/Wallet/Faucet'),
  'primary-network/unit-converter': () => import('../../toolbox/src/toolbox/Conversion/UnitConverter'),
  'primary-network/stake': () => import('../../toolbox/src/toolbox/PrimaryNetwork/Stake'),
  
  // Layer 1
  'layer-1/create': () => import('../../app/console/layer-1/create/page'),
  'layer-1/validator-set': () => import('../../toolbox/src/toolbox/ValidatorManager/QueryL1ValidatorSet'),
  
  // Permissioned L1s
  'permissioned-l1s/add-validator': () => import('../../toolbox/src/toolbox/ValidatorManager/AddValidator/AddValidator'),
  'permissioned-l1s/remove-validator': () => import('../../toolbox/src/toolbox/ValidatorManager/RemoveValidator/RemoveValidator'),
  'permissioned-l1s/change-validator-weight': () => import('../../toolbox/src/toolbox/ValidatorManager/ChangeWeight/ChangeWeight'),
  'permissioned-l1s/validator-manager-setup': () => import('../../toolbox/src/toolbox/ValidatorManager/DeployValidatorManager'),
  'permissioned-l1s/deployer-allowlist': () => import('../../toolbox/src/toolbox/Precompiles/DeployerAllowlist'),
  'permissioned-l1s/transactor-allowlist': () => import('../../toolbox/src/toolbox/Precompiles/TransactionAllowlist'),
  
  // ICM
  'icm/setup': () => import('../../app/console/icm/setup/page'),
  
  // ICTT
  'ictt/setup': () => import('../../app/console/ictt/setup/page'),
  'ictt/token-transfer': () => import('../../toolbox/src/toolbox/ICTT/TestSend'),
  
  // L1 Tokenomics
  'l1-tokenomics/fee-manager': () => import('../../toolbox/src/toolbox/Precompiles/FeeManager'),
  'l1-tokenomics/reward-manager': () => import('../../toolbox/src/toolbox/Precompiles/RewardManager'),
  'l1-tokenomics/native-minter': () => import('../../toolbox/src/toolbox/Precompiles/NativeMinter'),
  
  // Utilities
  'utilities/format-converter': () => import('../../toolbox/src/toolbox/Conversion/FormatConverter'),
  
  // Testnet Infrastructure
  'testnet-infra/nodes': () => import('../../toolbox/src/toolbox/Nodes/ManagedTestnetNodes'),
  
  // Additional commonly used tools
  'primary-network/node-setup': () => import('../../toolbox/src/toolbox/Nodes/AvalancheGoDockerPrimaryNetwork'),
  'layer-1/l1-node-setup': () => import('../../toolbox/src/toolbox/Nodes/AvalancheGoDockerL1'),
  'layer-1/l1-validator-balance': () => import('../../toolbox/src/toolbox/L1/QueryL1Details'),
  'layer-1/explorer-setup': () => import('../../toolbox/src/toolbox/L1/SelfHostedExplorer'),
};

// Dynamic imports for console header components
const WalletBootstrap = dynamic(() => import('../../toolbox/src/components/console-header/wallet-bootstrap'), {
  ssr: false,
});

const EvmNetworkWallet = dynamic(() => import('../../toolbox/src/components/console-header/evm-network-wallet').then(mod => ({ default: mod.EvmNetworkWallet })), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center p-2">
      <Loader2 className="size-4 animate-spin text-fd-muted-foreground" />
    </div>
  )
});

const WalletPChain = dynamic(() => import('../../toolbox/src/components/console-header/pchain-wallet').then(mod => ({ default: mod.WalletPChain })), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center p-2">
      <Loader2 className="size-4 animate-spin text-fd-muted-foreground" />
    </div>
  )
});

const BuilderHubAccountButton = dynamic(() => import('../console/builder-hub-account-button').then(mod => ({ default: mod.BuilderHubAccountButton })), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center p-2">
      <Loader2 className="size-4 animate-spin text-fd-muted-foreground" />
    </div>
  )
});

// Console tool component that dynamically loads and renders the appropriate component
export const ConsoleToolRenderer = ({ consolePath }: { consolePath: string }) => {
  const [Component, setComponent] = useState<React.ComponentType<any> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadComponent = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const importFn = consoleComponentMap[consolePath];
        if (!importFn) {
          throw new Error(`No component found for path: ${consolePath}`);
        }
        
        const module = await importFn();
        setComponent(() => module.default);
      } catch (err) {
        console.error('Failed to load console component:', err);
        setError(err instanceof Error ? err.message : 'Failed to load component');
      } finally {
        setLoading(false);
      }
    };

    loadComponent();
  }, [consolePath]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8">
        <Loader2 className="size-8 animate-spin text-red-600 mb-4" />
        <p className="text-sm text-fd-muted-foreground">Loading console tool...</p>
      </div>
    );
  }

  if (error || !Component) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <div className="mb-4 p-3 rounded-full bg-red-100 dark:bg-red-900/20">
          <X className="size-6 text-red-600" />
        </div>
        <h3 className="text-lg font-semibold mb-2">Component Not Found</h3>
        <p className="text-sm text-fd-muted-foreground mb-4">
          {error || `No component available for: ${consolePath}`}
        </p>
        <a 
          href={`/console/${consolePath}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
        >
          <ChevronRight className="size-4" />
          Open in Console
        </a>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      {/* Wallet Bootstrap for Core Wallet integration */}
      <WalletBootstrap />
      
      {/* Console Header with EVM and P-Chain wallets */}
      <div className="flex items-center justify-end gap-2 p-4 border-b border-fd-border bg-fd-muted/20">
        <div className="flex items-center gap-2">
          <EvmNetworkWallet />
          <WalletPChain />
          <BuilderHubAccountButton />
        </div>
      </div>
      
      {/* Main component content */}
      <div className="p-6">
        <Component />
      </div>
    </div>
  );
};
