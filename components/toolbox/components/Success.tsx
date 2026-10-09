import { Check, Copy as CopyIcon, ExternalLink, Loader2, Send } from 'lucide-react';
import { useState } from 'react';
import { isAddress } from 'viem';
import { cn } from '../lib/utils';

interface SuccessProps {
  label: string;
  value: string;
  isTestnet?: boolean;
  xpChain?: 'P' | 'C';
  /** When undefined: shows neutral "submitted" state. When true: green confirmed. When false: pending spinner. */
  confirmed?: boolean;
}

export const Success = ({ label, value, isTestnet = true, xpChain = 'P', confirmed }: SuccessProps) => {
  const [copied, setCopied] = useState(false);
  if (!value) return null;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const isPChainTxId = /^[1-9A-HJ-NP-Za-km-z]{40,60}$/.test(value);
  const isEvmHash = /^0x[a-fA-F0-9]{64}$/.test(value);
  const isAddr = isAddress(value);

  const getExplorerUrl = () => {
    if (isPChainTxId) {
      if (xpChain === 'P') return `/explorer/${isTestnet ? 'fuji' : 'mainnet'}/p-chain/tx/${value}`;
      // A base58 id on the C-Chain is an atomic (import/export) tx. Our EVM tx
      // route looks up hashes over `eth_getTransactionByHash`, which can't
      // resolve an atomic id, so this one case stays on the external explorer.
      return `https://explorer${isTestnet ? '-test' : ''}.avax.network/c-chain/tx/${value}`;
    }
    return null;
  };

  const explorerUrl = getExplorerUrl();

  // Visual state
  const isConfirmed = confirmed === true;
  const isPending = confirmed === false;
  // When confirmed is undefined: neutral "submitted" state (default for backward compat)

  const icon = isConfirmed ? (
    <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
  ) : isPending ? (
    <Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-400" />
  ) : (
    <Send className="h-3.5 w-3.5 text-zinc-500 dark:text-zinc-400" />
  );

  return (
    <div
      className={cn(
        'border bg-white transition-colors dark:bg-zinc-950',
        isConfirmed ? 'border-emerald-300 dark:border-emerald-900' : 'border-zinc-200 dark:border-zinc-800',
      )}
    >
      <div className="flex items-start gap-3 px-4 py-3">
        <span
          className={cn(
            'flex h-8 w-8 shrink-0 items-center justify-center border',
            isConfirmed
              ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900/60 dark:bg-emerald-950/30'
              : 'border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900',
          )}
        >
          {icon}
        </span>
        <div className="min-w-0 flex-1 space-y-1">
          <span
            className={cn(
              'block font-mono text-[10.5px] font-bold uppercase tracking-[0.14em]',
              isConfirmed ? 'text-emerald-700 dark:text-emerald-400' : 'text-zinc-500 dark:text-zinc-400',
            )}
          >
            {label}
          </span>
          <div className="flex items-center gap-1.5">
            {explorerUrl ? (
              <a
                href={explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="group/link flex flex-1 items-center gap-1 break-all font-mono text-[12px] text-zinc-900 underline-offset-4 hover:underline dark:text-zinc-100"
              >
                {value}
                <ExternalLink className="h-3 w-3 shrink-0 text-zinc-400 transition-colors group-hover/link:text-[#E6212F]" />
              </a>
            ) : (
              <code className="flex-1 break-all font-mono text-[12px] text-zinc-900 dark:text-zinc-100">{value}</code>
            )}
            {(isAddr || isPChainTxId || isEvmHash) && (
              <button
                type="button"
                onClick={handleCopy}
                className="shrink-0 p-1 text-zinc-400 transition-colors hover:text-zinc-900 dark:hover:text-zinc-100"
                aria-label="Copy to clipboard"
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <CopyIcon className="h-3.5 w-3.5" />
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
