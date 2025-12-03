"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

interface CopyableIdChipProps {
  label: string;
  value: string;
  className?: string;
}

export function CopyableIdChip({ label, value, className = "" }: CopyableIdChipProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  return (
    <div 
      className={`group inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors ${className}`}
    >
      <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
        {label}
      </span>
      <code 
        className="text-xs font-mono text-zinc-600 dark:text-zinc-400 truncate max-w-[100px] sm:max-w-[160px]" 
        title={value}
      >
        {value}
      </code>
      <button
        onClick={handleCopy}
        className="p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
        title={`Copy ${label}`}
      >
        {copied ? (
          <Check className="w-3 h-3 text-green-500" />
        ) : (
          <Copy className="w-3 h-3 text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300" />
        )}
      </button>
    </div>
  );
}

interface ChainIdChipsProps {
  subnetId?: string;
  blockchainId?: string;
  className?: string;
}

export function ChainIdChips({ subnetId, blockchainId, className = "" }: ChainIdChipsProps) {
  if (!subnetId && !blockchainId) return null;

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      {subnetId && (
        <CopyableIdChip label="Subnet" value={subnetId} />
      )}
      {blockchainId && (
        <CopyableIdChip label="Chain" value={blockchainId} />
      )}
    </div>
  );
}

