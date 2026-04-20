'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  withConsoleToolMetadata,
  type ConsoleToolMetadata,
} from '@/components/toolbox/components/WithConsoleToolMetadata';
import { WalletRequirementsConfigKey } from '@/components/toolbox/hooks/useWalletRequirements';
import { Button } from '@/components/toolbox/components/Button';
import { useEERCDeployment } from '@/hooks/eerc/useEERCDeployment';
import { useEERCBalance } from '@/hooks/eerc/useEERCBalance';
import type { ERC20Meta } from '@/lib/eerc/types';

const metadata: ConsoleToolMetadata = {
  title: 'Encrypted Balance & History',
  description: (
    <>
      Decrypt your on-chain encrypted balance and view the raw ciphertext. The plaintext amount only exists on your
      device — the chain stores it as a Poseidon ciphertext bound to your BabyJubJub public key.
    </>
  ),
  toolRequirements: [WalletRequirementsConfigKey.EVMChainBalance],
};

type Mode = 'standalone' | 'converter';

function BalanceHistory() {
  const standalone = useEERCDeployment('standalone');
  const converter = useEERCDeployment('converter');

  const modes: Mode[] = [];
  if (standalone.isReady) modes.push('standalone');
  if (converter.isReady) modes.push('converter');

  const [activeMode, setActiveMode] = useState<Mode | null>(modes[0] ?? null);
  const deployment = activeMode === 'standalone' ? standalone.deployment : converter.deployment;
  const supportedTokens = deployment?.supportedTokens ?? [];
  const [activeToken, setActiveToken] = useState<ERC20Meta | undefined>(supportedTokens[0]);

  // Sync token selection when user switches to converter mode for the first time.
  React.useEffect(() => {
    if (activeMode === 'converter' && !activeToken && supportedTokens[0]) {
      setActiveToken(supportedTokens[0]);
    }
  }, [activeMode, activeToken, supportedTokens]);

  if (modes.length === 0) {
    return (
      <div className="rounded-lg border border-dashed bg-muted/30 p-6 text-sm">
        <p className="font-medium mb-1">No Encrypted ERC deployment on this chain.</p>
        <p className="text-muted-foreground">
          Switch to Avalanche Fuji to use the canonical demo deployment, or deploy your own from the{' '}
          <em>Deploy Your Own</em> menu.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        {modes.map((m) => (
          <button
            key={m}
            onClick={() => setActiveMode(m)}
            className={
              activeMode === m
                ? 'px-3 py-1.5 text-sm rounded-md bg-foreground text-background'
                : 'px-3 py-1.5 text-sm rounded-md border hover:bg-accent'
            }
          >
            {m === 'standalone' ? 'Standalone (PRIV)' : 'Converter (wrapped ERC20s)'}
          </button>
        ))}
      </div>

      {activeMode === 'converter' && supportedTokens.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground uppercase tracking-wide">Token:</span>
          {supportedTokens.map((t) => (
            <button
              key={t.address}
              onClick={() => setActiveToken(t)}
              className={
                activeToken?.address === t.address
                  ? 'px-3 py-1 text-xs rounded-full bg-foreground text-background'
                  : 'px-3 py-1 text-xs rounded-full border hover:bg-accent'
              }
            >
              {t.symbol}
            </button>
          ))}
        </div>
      )}

      {activeMode && deployment && (
        <BalanceCard
          mode={activeMode}
          token={activeMode === 'converter' ? activeToken : undefined}
          deployment={deployment}
        />
      )}
    </div>
  );
}

function BalanceCard({
  mode,
  token,
  deployment,
}: {
  mode: Mode;
  token: ERC20Meta | undefined;
  deployment: ReturnType<typeof useEERCDeployment>['deployment'];
}) {
  const [showCipher, setShowCipher] = useState(false);
  const balance = useEERCBalance(deployment, mode, token);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-card p-6 space-y-3">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              {mode === 'standalone' ? 'Standalone balance' : `Converter balance — ${token?.symbol ?? ''}`}
            </div>
            <div className="text-3xl font-semibold mt-1 font-mono">
              {balance.isLoading
                ? '...'
                : balance.formatted !== null
                  ? balance.formatted
                  : balance.hasIdentity
                    ? '—'
                    : 'sign to decrypt'}
              <span className="text-base text-muted-foreground ml-1">
                {mode === 'standalone' ? 'PRIV' : `e${token?.symbol ?? ''}`}
              </span>
            </div>
          </div>
          <Button variant="secondary" onClick={() => balance.refresh()} size="sm">
            Refresh
          </Button>
        </div>
        {balance.error && <div className="text-xs text-red-600 dark:text-red-400">{balance.error}</div>}
        {!balance.hasIdentity && (
          <div className="text-xs text-muted-foreground">
            You don't have a cached BabyJubJub identity.{' '}
            <Link href="/console/encrypted-erc/register" className="underline">
              Register first
            </Link>{' '}
            to derive your decryption key.
          </div>
        )}
      </div>

      <button
        onClick={() => setShowCipher((v) => !v)}
        className="text-xs text-muted-foreground hover:text-foreground underline"
      >
        {showCipher ? 'Hide' : 'Show'} raw encrypted state
      </button>

      {showCipher && balance.raw && (
        <div className="rounded-lg border bg-muted/30 p-4 space-y-4 text-xs">
          <div>
            <div className="font-medium mb-1">EGCT (ElGamal ciphertext)</div>
            <div className="font-mono break-all text-muted-foreground space-y-1">
              <div>c1.x: {balance.raw.eGCT.c1[0].toString()}</div>
              <div>c1.y: {balance.raw.eGCT.c1[1].toString()}</div>
              <div>c2.x: {balance.raw.eGCT.c2[0].toString()}</div>
              <div>c2.y: {balance.raw.eGCT.c2[1].toString()}</div>
            </div>
          </div>
          <div>
            <div className="font-medium mb-1">balancePCT (Poseidon ciphertext — 7 elements)</div>
            <div className="font-mono break-all text-muted-foreground space-y-1">
              {balance.raw.balancePCT.map((v, i) => (
                <div key={i}>
                  [{i}]: {v.toString()}
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="font-medium mb-1">Counters</div>
            <div className="font-mono text-muted-foreground">
              nonce: {balance.raw.nonce.toString()} &middot; transactionIndex: {balance.raw.transactionIndex.toString()}{' '}
              &middot; history entries: {balance.raw.amountPCTs.length}
            </div>
          </div>
          <p className="pt-2 text-muted-foreground">
            The chain sees only these ciphertexts. Your BabyJubJub private key — derived locally from your wallet
            signature — is the only thing that can decrypt the balancePCT into the plaintext amount shown above.
          </p>
        </div>
      )}
    </div>
  );
}

export default withConsoleToolMetadata(BalanceHistory, metadata);
