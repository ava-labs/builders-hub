'use client';

import React, { useState, useEffect } from 'react';
import {
  withConsoleToolMetadata,
  type ConsoleToolMetadata,
} from '@/components/toolbox/components/WithConsoleToolMetadata';
import { WalletRequirementsConfigKey } from '@/components/toolbox/hooks/useWalletRequirements';
import { Button } from '@/components/toolbox/components/Button';
import { Input } from '@/components/toolbox/components/Input';
import { useEERCDeployment } from '@/hooks/eerc/useEERCDeployment';
import { useEERCDeposit } from '@/hooks/eerc/useEERCDeposit';
import type { ERC20Meta } from '@/lib/eerc/types';
import { parseUnits, formatUnits } from 'viem';

const metadata: ConsoleToolMetadata = {
  title: 'Deposit to Encrypted ERC',
  description: (
    <>
      Wrap an existing ERC20 balance into its encrypted form. The deposit amount becomes a Poseidon ciphertext on-chain
      — only you (and the auditor) can decrypt it.
    </>
  ),
  toolRequirements: [WalletRequirementsConfigKey.EVMChainBalance],
};

function DepositMint() {
  const converter = useEERCDeployment('converter');
  const deployment = converter.deployment;
  const tokens = deployment?.supportedTokens ?? [];
  const [selectedToken, setSelectedToken] = useState<ERC20Meta | undefined>(tokens[0]);
  const [amountText, setAmountText] = useState('');

  useEffect(() => {
    if (!selectedToken && tokens[0]) setSelectedToken(tokens[0]);
  }, [selectedToken, tokens]);

  const dep = useEERCDeposit(deployment, selectedToken);

  if (!deployment) {
    return (
      <div className="rounded-lg border border-dashed bg-muted/30 p-6 text-sm">
        <p className="font-medium mb-1">No converter deployment on this chain.</p>
        <p className="text-muted-foreground">
          Switch to Avalanche Fuji to use the canonical converter (wraps mUSDC + WAVAX), or deploy your own converter
          from the <em>Deploy Your Own</em> menu.
        </p>
      </div>
    );
  }

  let amountWei: bigint | null = null;
  let parseError: string | null = null;
  if (amountText && selectedToken) {
    try {
      amountWei = parseUnits(amountText, selectedToken.decimals);
    } catch {
      parseError = 'Invalid amount';
    }
  }
  const preview = amountWei !== null ? dep.preview(amountWei) : { cents: 0n, dustWei: 0n };
  const busy =
    dep.status === 'checking-allowance' ||
    dep.status === 'approving' ||
    dep.status === 'depositing' ||
    dep.status === 'confirming';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground uppercase tracking-wide">Token:</span>
        {tokens.map((t) => (
          <button
            key={t.address}
            onClick={() => setSelectedToken(t)}
            className={
              selectedToken?.address === t.address
                ? 'px-3 py-1 text-xs rounded-full bg-foreground text-background'
                : 'px-3 py-1 text-xs rounded-full border hover:bg-accent'
            }
          >
            {t.symbol}
          </button>
        ))}
      </div>

      <div className="rounded-lg border bg-card p-5 space-y-4">
        <Input
          label={`Amount in ${selectedToken?.symbol ?? ''}`}
          value={amountText}
          onChange={setAmountText}
          placeholder="0.0"
          type="number"
          step="0.01"
        />

        {amountWei !== null && amountWei > 0n && selectedToken && (
          <div className="rounded-md bg-muted/50 p-3 text-xs space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">You deposit</span>
              <span className="font-mono">
                {formatUnits(amountWei, selectedToken.decimals)} {selectedToken.symbol}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Encrypted balance credit</span>
              <span className="font-mono">
                {(Number(preview.cents) / 100).toFixed(2)} e{selectedToken.symbol}
              </span>
            </div>
            {preview.dustWei > 0n && (
              <div className="mt-2 rounded border border-amber-500/30 bg-amber-500/5 p-2 text-amber-700 dark:text-amber-300">
                <strong>Dust refund:</strong> {formatUnits(preview.dustWei, selectedToken.decimals)}{' '}
                {selectedToken.symbol} won't fit in eERC's {deployment.decimals}-decimal representation and will be
                returned to you by the contract.
              </div>
            )}
            {preview.cents === 0n && (
              <div className="mt-2 rounded border border-red-500/30 bg-red-500/5 p-2 text-red-700 dark:text-red-300">
                Amount too small — this would convert to 0 cents after decimal adjustment. Enter at least 0.01{' '}
                {selectedToken.symbol}.
              </div>
            )}
          </div>
        )}

        {parseError && <div className="text-xs text-red-600 dark:text-red-400">{parseError}</div>}
        {dep.error && <div className="text-xs text-red-600 dark:text-red-400">{dep.error}</div>}

        {dep.status === 'success' && dep.txHash && (
          <div className="rounded-md border border-green-500/30 bg-green-500/5 p-3 text-xs text-green-700 dark:text-green-300">
            Deposit confirmed.{' '}
            <a
              href={`https://testnet.snowtrace.io/tx/${dep.txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              View on Snowtrace
            </a>
          </div>
        )}

        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            loading={busy}
            disabled={amountWei === null || amountWei <= 0n || preview.cents === 0n}
            onClick={() => {
              if (amountWei !== null)
                dep.deposit(amountWei).catch(() => {
                  /* surfaced via dep.error */
                });
            }}
          >
            {dep.status === 'approving'
              ? 'Approving...'
              : dep.status === 'depositing'
                ? 'Depositing...'
                : dep.status === 'confirming'
                  ? 'Confirming...'
                  : 'Deposit'}
          </Button>
        </div>
      </div>

      <Educational />
    </div>
  );
}

function Educational() {
  return (
    <details className="rounded-lg border bg-muted/20 p-4 text-sm">
      <summary className="cursor-pointer font-medium">How does converter-mode deposit work?</summary>
      <div className="space-y-2 pt-3 text-muted-foreground">
        <p>
          Deposits in converter mode don't require a ZK proof — the contract already trusts the ERC20 transferFrom call
          for the public accounting. The only cryptography you perform is a <em>Poseidon ciphertext</em> (PCT)
          encrypting the deposit amount under your own BabyJubJub public key.
        </p>
        <p>
          The contract multiplies your PCT into your existing encrypted balance, updating it homomorphically. The source
          ERC20 is pulled via transferFrom; if any fractional part can't fit into eERC's 2-decimal form, it's returned
          to you as dust.
        </p>
        <p>
          The auditor PCT is NOT included here — deposits are publicly visible (amount + token are in the tx). The
          privacy kicks in when you <em>transfer</em> or <em>withdraw</em>, at which point proofs and auditor
          ciphertexts are required.
        </p>
      </div>
    </details>
  );
}

export default withConsoleToolMetadata(DepositMint, metadata);
