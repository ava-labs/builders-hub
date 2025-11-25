'use client';

import { useState } from 'react';
import { Wallet, Check, AlertCircle } from 'lucide-react';

interface NetworkConfig {
  chainId: string;
  chainName: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  rpcUrls: string[];
  blockExplorerUrls: string[];
}

const AVALANCHE_MAINNET: NetworkConfig = {
  chainId: '0xA86A',
  chainName: 'Avalanche C-Chain',
  nativeCurrency: {
    name: 'Avalanche',
    symbol: 'AVAX',
    decimals: 18,
  },
  rpcUrls: ['https://api.avax.network/ext/bc/C/rpc'],
  blockExplorerUrls: ['https://subnets.avax.network/c-chain'],
};

const AVALANCHE_FUJI: NetworkConfig = {
  chainId: '0xA869',
  chainName: 'Avalanche Fuji Testnet',
  nativeCurrency: {
    name: 'Avalanche',
    symbol: 'AVAX',
    decimals: 18,
  },
  rpcUrls: ['https://api.avax-test.network/ext/bc/C/rpc'],
  blockExplorerUrls: ['https://subnets-test.avax.network/c-chain'],
};

interface AddNetworkButtonInlineProps {
  network: 'mainnet' | 'fuji';
}

export default function AddNetworkButtonInline({ network }: AddNetworkButtonInlineProps) {
  const [status, setStatus] = useState<'idle' | 'adding' | 'success' | 'error'>('idle');

  const addNetwork = async () => {
    if (typeof window === 'undefined' || !window.ethereum) {
      setStatus('error');
      setTimeout(() => setStatus('idle'), 3000);
      return;
    }

    setStatus('adding');

    const config = network === 'mainnet' ? AVALANCHE_MAINNET : AVALANCHE_FUJI;

    try {
      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [config],
      });
      setStatus('success');
      setTimeout(() => setStatus('idle'), 3000);
    } catch (err: any) {
      setStatus('error');
      setTimeout(() => setStatus('idle'), 3000);
    }
  };

  return (
    <button
      onClick={addNetwork}
      disabled={status === 'adding'}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {status === 'idle' && (
        <>
          <Wallet className="w-3.5 h-3.5" />
          Add to Wallet
        </>
      )}
      {status === 'adding' && 'Adding...'}
      {status === 'success' && (
        <>
          <Check className="w-3.5 h-3.5" />
          Added!
        </>
      )}
      {status === 'error' && (
        <>
          <AlertCircle className="w-3.5 h-3.5" />
          Try Again
        </>
      )}
    </button>
  );
}

