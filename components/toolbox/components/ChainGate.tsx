'use client';

import React from 'react';
import { AlertTriangle, ArrowRight, Wallet } from 'lucide-react';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { useCreateChainStore } from '@/components/toolbox/stores/createChainStore';
import { useWallet } from '@/components/toolbox/hooks/useWallet';
import { Button } from '@/components/toolbox/components/Button';
import type { RequiredChain } from '@/components/console/step-flow';

interface ChainGateProps {
  requiredChain?: RequiredChain;
  children: React.ReactNode;
}

const FUJI_CHAIN_ID = 43113;
const MAINNET_CHAIN_ID = 43114;

/**
 * Checks if the wallet is on the correct chain for the current step.
 * If not, shows an inline prompt to switch or add the chain.
 * If requiredChain is 'any' or 'p-chain' or undefined, passes through.
 */
export function ChainGate({ requiredChain, children }: ChainGateProps) {
  const { walletChainId, isTestnet, walletEVMAddress } = useWalletStore();
  const createChainStore = useCreateChainStore()();
  const { addChain, switchChain } = useWallet();

  // No requirement or P-Chain (no EVM switch needed) — pass through
  if (!requiredChain || requiredChain === 'any' || requiredChain === 'p-chain') {
    return <>{children}</>;
  }

  // No wallet connected — show children anyway (individual steps handle wallet checks)
  if (!walletEVMAddress) {
    return <>{children}</>;
  }

  // Determine the expected chain ID
  let expectedChainId: number | null = null;
  let chainLabel = '';

  if (requiredChain === 'c-chain') {
    expectedChainId = isTestnet ? FUJI_CHAIN_ID : MAINNET_CHAIN_ID;
    chainLabel = isTestnet ? 'Fuji C-Chain' : 'C-Chain';
  } else if (requiredChain === 'l1') {
    expectedChainId = createChainStore?.evmChainId ?? null;
    chainLabel = createChainStore?.chainName || 'your L1';
  }

  // Can't determine expected chain — pass through
  if (expectedChainId === null) {
    return <>{children}</>;
  }

  // Already on the right chain
  if (walletChainId === expectedChainId) {
    return <>{children}</>;
  }

  // Wrong chain — show switch prompt
  return (
    <div className="space-y-4">
      <div
        className="rounded-2xl border border-zinc-700 bg-zinc-800 p-6"
        style={{
          boxShadow: 'inset 0 1px 0 0 rgba(255,255,255,0.06), 0 2px 8px rgba(0,0,0,0.15), 0 8px 24px rgba(0,0,0,0.1)',
        }}
      >
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10">
            <AlertTriangle className="h-5 w-5 text-amber-400" />
          </div>
          <div className="flex-1 space-y-3">
            <div>
              <h3 className="text-base font-semibold text-white">Switch to {chainLabel}</h3>
              <p className="mt-1 text-sm text-zinc-400">
                This step requires your wallet to be connected to{' '}
                <span className="text-zinc-200 font-medium">{chainLabel}</span>
                {requiredChain === 'l1' && ' (Chain ID: ' + expectedChainId + ')'}. You&apos;re currently on a different
                network.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Button
                onClick={async () => {
                  try {
                    await switchChain(expectedChainId!, isTestnet ?? false);
                  } catch {
                    // Switch failed — chain might not be added yet
                    // Fall through to "Add to Wallet" below
                  }
                }}
                variant="primary"
                size="sm"
                icon={<ArrowRight className="h-3.5 w-3.5" />}
              >
                Switch Network
              </Button>

              {requiredChain === 'l1' && (
                <Button
                  onClick={() => addChain({ allowLookup: true })}
                  variant="secondary"
                  size="sm"
                  icon={<Wallet className="h-3.5 w-3.5" />}
                >
                  Add to Wallet
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Still render children below — some users may want to read the step while switching */}
      <div className="opacity-40 pointer-events-none">{children}</div>
    </div>
  );
}
