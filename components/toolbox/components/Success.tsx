import { Check, Copy as CopyIcon, ExternalLink, Loader2, Send } from 'lucide-react';
import { useState } from 'react';
import { isAddress } from 'viem';

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
      if (xpChain === 'P') {
        const baseUrl = isTestnet ? 'https://subnets-test.avax.network' : 'https://subnets.avax.network';
        return `${baseUrl}/p-chain/tx/${value}`;
      } else {
        return `/explorer/avalanche-c-chain/tx/${value}`;
      }
    }
    return null;
  };

  const explorerUrl = getExplorerUrl();

  // Visual state
  const isConfirmed = confirmed === true;
  const isPending = confirmed === false;
  // When confirmed is undefined: neutral "submitted" state (default for backward compat)

  const containerClass = isConfirmed
    ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800'
    : 'bg-zinc-50 dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-700';

  const iconBgClass = isConfirmed
    ? 'bg-green-100 dark:bg-green-900/30'
    : isPending
      ? 'bg-zinc-100 dark:bg-zinc-800'
      : 'bg-zinc-100 dark:bg-zinc-800';

  const labelClass = isConfirmed ? 'text-green-800 dark:text-green-200' : 'text-zinc-700 dark:text-zinc-300';

  const valueClass = isConfirmed ? 'text-green-900 dark:text-green-100' : 'text-zinc-900 dark:text-zinc-100';

  const icon = isConfirmed ? (
    <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
  ) : isPending ? (
    <Loader2 className="h-4 w-4 text-zinc-400 animate-spin" />
  ) : (
    <Send className="h-4 w-4 text-zinc-500 dark:text-zinc-400" />
  );

  return (
    <div className={`p-3 rounded-xl border ${containerClass} transition-colors`}>
      <div className="flex items-start gap-3">
        <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${iconBgClass}`}>{icon}</div>
        <div className="flex-1 min-w-0 space-y-1">
          <span className={`text-xs font-medium ${labelClass}`}>{label}</span>
          <div className="flex items-center gap-1.5">
            {explorerUrl ? (
              <a
                href={explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`font-mono text-xs break-all flex-1 hover:underline transition flex items-center gap-1 ${valueClass}`}
              >
                {value}
                <ExternalLink className="h-3 w-3 shrink-0 opacity-50" />
              </a>
            ) : (
              <code className={`font-mono text-xs break-all flex-1 ${valueClass}`}>{value}</code>
            )}
            {(isAddr || isPChainTxId || isEvmHash) && (
              <button
                onClick={handleCopy}
                className="shrink-0 p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                aria-label="Copy to clipboard"
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-green-500" />
                ) : (
                  <CopyIcon className="h-3.5 w-3.5 text-zinc-400" />
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
