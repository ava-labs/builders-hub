import React from 'react';
import { Copy, Users, Shield, Hash, CheckCircle } from 'lucide-react';

interface MultisigInfoProps {
  safeInfo: {
    address: string;
    threshold: number;
    owners: string[];
    version: string;
    nonce: number;
  };
  walletAddress: string;
}

const EYEBROW = 'font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400';

export const MultisigInfo: React.FC<MultisigInfoProps> = ({ safeInfo, walletAddress }) => {
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const shortenAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <div className="overflow-hidden border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      {/* Header */}
      <div className="border-b border-zinc-200 bg-zinc-50/60 p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center border border-zinc-200 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-950">
            <img src="/images/ash.png" alt="Ash" className="h-7 w-auto" />
          </div>
          <div className="flex flex-col justify-center">
            <h3 className="mb-1 mt-0 text-[15px] font-semibold text-zinc-900 dark:text-zinc-100">
              Ash Wallet Multisig
            </h3>
            <p className="mb-0 mt-0 text-[12px] text-zinc-500 dark:text-zinc-400">Safe multisig wallet information</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="space-y-6 p-5">
        {/* Safe Address */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className={`flex items-center gap-1.5 ${EYEBROW}`}>
              <Shield className="h-3.5 w-3.5" />
              Safe Address
            </span>
            <button
              onClick={() => copyToClipboard(safeInfo.address)}
              className="p-1 text-zinc-400 transition-colors hover:text-zinc-900 dark:hover:text-zinc-100"
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="break-all border border-zinc-200 bg-zinc-50/60 px-3 py-2.5 font-mono text-[12px] text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-100">
            {safeInfo.address}
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 border border-zinc-200 md:grid-cols-3 dark:border-zinc-800 [&>*+*]:border-t md:[&>*+*]:border-l md:[&>*+*]:border-t-0 [&>*+*]:border-zinc-200 dark:[&>*+*]:border-zinc-800">
          <div className="p-4">
            <div className={`mb-1 flex items-center gap-1.5 ${EYEBROW}`}>
              <Users className="h-3.5 w-3.5" />
              Threshold
            </div>
            <div className="text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
              {safeInfo.threshold}
            </div>
            <div className="text-[12px] text-zinc-500 dark:text-zinc-400">of {safeInfo.owners.length} owners</div>
          </div>

          <div className="p-4">
            <div className={`mb-1 flex items-center gap-1.5 ${EYEBROW}`}>
              <Hash className="h-3.5 w-3.5" />
              Nonce
            </div>
            <div className="text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">{safeInfo.nonce}</div>
            <div className="text-[12px] text-zinc-500 dark:text-zinc-400">Current transaction</div>
          </div>

          <div className="p-4">
            <div className={`mb-1 flex items-center gap-1.5 ${EYEBROW}`}>
              <Shield className="h-3.5 w-3.5" />
              Version
            </div>
            <div className="text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
              {safeInfo.version || 'N/A'}
            </div>
            <div className="text-[12px] text-zinc-500 dark:text-zinc-400">Safe contract</div>
          </div>
        </div>

        {/* Owners */}
        <div>
          <h4 className={`mb-3 flex items-center gap-1.5 ${EYEBROW}`}>
            <Users className="h-3.5 w-3.5" />
            Owners ({safeInfo.owners.length})
          </h4>
          <div className="divide-y divide-zinc-200 border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {safeInfo.owners.map((owner: string, index: number) => {
              const isCurrentUser = owner.toLowerCase() === walletAddress.toLowerCase();
              return (
                <div
                  key={owner}
                  className={`relative flex items-center justify-between p-3 transition-colors before:absolute before:inset-y-0 before:left-0 before:w-0.5 ${
                    isCurrentUser ? 'before:bg-zinc-900 dark:before:bg-zinc-100' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-7 w-7 items-center justify-center border border-zinc-200 font-mono text-[11px] font-bold tabular-nums text-zinc-600 dark:border-zinc-800 dark:text-zinc-300">
                      {index + 1}
                    </div>
                    <div>
                      <div className="break-all font-mono text-[13px] text-zinc-900 dark:text-zinc-100">
                        {shortenAddress(owner)}
                      </div>
                      <div className="font-mono text-[11px] text-zinc-500 dark:text-zinc-400">{owner}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isCurrentUser && (
                      <span className="inline-flex items-center border border-emerald-200 bg-emerald-50/60 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/20 dark:text-emerald-300">
                        <CheckCircle className="mr-1 h-3 w-3" />
                        You
                      </span>
                    )}
                    <button
                      onClick={() => copyToClipboard(owner)}
                      className="p-1 text-zinc-400 transition-colors hover:text-zinc-900 dark:hover:text-zinc-100"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
