'use client';

import { KeyRound, Wallet } from 'lucide-react';
import { useAccount } from 'wagmi';
import { CONSOLE_WALLET_CONNECTOR_ID } from '@/lib/console-wallets/core-provider';
import { cn } from '../lib/utils';

/** The connected wallet's name, for "Sign with …" copy; a Console wallet reads as such rather than as Core. */
export function useConnectedWalletName(): string {
  const { connector } = useAccount();
  if (!connector) return 'your wallet';
  return connector.id === CONSOLE_WALLET_CONNECTOR_ID ? 'Console wallet' : connector.name || 'your wallet';
}

/**
 * The icon of whichever wallet will sign: the key for a Console wallet, the extension's own icon (Core, MetaMask…)
 * when it announces one, and a plain wallet otherwise.
 */
export function ConnectedWalletIcon({ className }: { className?: string }) {
  const { connector } = useAccount();
  if (connector?.id === CONSOLE_WALLET_CONNECTOR_ID) return <KeyRound className={cn('h-4 w-4', className)} />;
  if (connector?.icon) return <img src={connector.icon} alt="" className={cn('h-4 w-4 object-contain', className)} />;
  return <Wallet className={cn('h-4 w-4', className)} />;
}
