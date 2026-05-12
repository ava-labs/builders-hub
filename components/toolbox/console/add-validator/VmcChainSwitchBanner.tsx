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
      className="rounded-2xl border border-amber-500/30 bg-amber-500/5 dark:bg-amber-500/10 p-4"
      role="alert"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/15">
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        </div>
        <div className="flex-1 space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Wallet is on the wrong network for this L1
            </h3>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              The Validator Manager for this subnet is deployed on{' '}
              <span className="font-medium text-zinc-900 dark:text-zinc-100">{expectedLabel}</span>, but your wallet is
              currently on <span className="font-medium text-zinc-900 dark:text-zinc-100">{currentLabel}</span>. All
              validator-manager reads and writes have to happen on its home chain.
            </p>
          </div>
          <Button
            onClick={handleSwitch}
            loading={isSwitching}
            loadingText="Switching…"
            variant="primary"
            size="sm"
            icon={<ArrowRight className="h-3.5 w-3.5" />}
          >
            Switch to {expectedLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
