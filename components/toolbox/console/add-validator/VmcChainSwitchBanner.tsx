'use client';

import React, { useState } from 'react';
import { AlertTriangle, ArrowRight } from 'lucide-react';
import { Button } from '@/components/toolbox/components/Button';
import { useWallet } from '@/components/toolbox/hooks/useWallet';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import type { VMCChainMismatch } from '@/components/toolbox/hooks/useVMCAddress';

interface VmcChainSwitchBannerProps {
  mismatch: VMCChainMismatch;
}

const FUJI_CHAIN_ID = 43113;
const MAINNET_CHAIN_ID = 43114;

function labelFor(chainId: number, fallback: string): string {
  if (chainId === FUJI_CHAIN_ID) return 'Fuji C-Chain';
  if (chainId === MAINNET_CHAIN_ID) return 'Mainnet C-Chain';
  return fallback;
}

/**
 * Wrong-network banner shown when the connected wallet's EVM chain doesn't
 * match the chain where the Validator Manager contract is deployed.
 *
 * The VMC's home chain is what every read and every initiate/complete call
 * has to target — when they diverge, reads return 0x (the screenshot bug)
 * and writes would revert. Clicking "Switch Network" goes through
 * useWallet().switchChain, which reuses the same safelySwitch + AddChainModal
 * fallback as the existing ChainGate component.
 */
export function VmcChainSwitchBanner({ mismatch }: VmcChainSwitchBannerProps) {
  const isTestnet = useWalletStore((s) => s.isTestnet);
  const { switchChain } = useWallet();
  const [isSwitching, setIsSwitching] = useState(false);

  const expectedLabel = labelFor(mismatch.expectedChainId, mismatch.expectedChainName);
  const currentLabel = labelFor(mismatch.currentChainId, `chain ${mismatch.currentChainId}`);

  const handleSwitch = async () => {
    setIsSwitching(true);
    try {
      await switchChain(mismatch.expectedChainId, isTestnet ?? false);
    } finally {
      setIsSwitching(false);
    }
  };

  return (
    <div
      className="flex flex-col gap-4 border border-amber-300 bg-white px-5 py-4 sm:flex-row sm:items-center dark:border-amber-900/70 dark:bg-zinc-950"
      role="alert"
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <div className="flex min-w-0 flex-col gap-1">
          <p className="font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-amber-700 dark:text-amber-400">
            Wrong network
          </p>
          <p className="text-[13px] leading-relaxed text-zinc-600 dark:text-zinc-400">
            The Validator Manager lives on{' '}
            <span className="font-medium text-zinc-900 dark:text-zinc-100">{expectedLabel}</span>. Your wallet is on{' '}
            <span className="font-medium text-zinc-900 dark:text-zinc-100">{currentLabel}</span>. Every read and write
            has to happen on its home chain.
          </p>
        </div>
      </div>
      <Button
        onClick={handleSwitch}
        loading={isSwitching}
        loadingText="Switching…"
        variant="primary"
        size="sm"
        className="w-full sm:w-auto"
        icon={<ArrowRight className="h-3.5 w-3.5" />}
      >
        Switch to {expectedLabel}
      </Button>
    </div>
  );
}
