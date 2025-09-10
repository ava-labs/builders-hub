'use client';
import { ChevronRight, Loader2, X } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import React from 'react';
import ToolboxConsoleWrapper from '../../toolbox/src/components/ToolboxConsoleWrapper';
import { CONSOLE_COMPONENT_MAP } from '@/constants/console-tools';

// Use shared component map
const consoleComponentMap = CONSOLE_COMPONENT_MAP;

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
        <ToolboxConsoleWrapper>
          <Component />
        </ToolboxConsoleWrapper>
      </div>
    </div>
  );
};
