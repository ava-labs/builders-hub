"use client";

import { useState, ReactNode } from "react";
import { Copy, Check } from "lucide-react";

/* The detail pages' row primitive, in the spec-plate voice: mono uppercase
   labels in a fixed left column, values right, hairline rules between rows
   (drawn by the parent's divide-y). Icons and per-chain theme colors are
   accepted for compatibility but the sheet stays neutral: icons render in
   the label's zinc, never the chain's brand color. */

interface DetailRowProps {
  icon: ReactNode;
  label: ReactNode;
  value: ReactNode;
  themeColor?: string;
  copyValue?: string;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="p-1 transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
      title="Copy to clipboard"
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-[#E6212F]" />
      ) : (
        <Copy className="h-3.5 w-3.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300" />
      )}
    </button>
  );
}

export function DetailRow({ icon, label, value, copyValue }: DetailRowProps) {
  return (
    <div className="flex flex-col gap-2 py-1 sm:flex-row sm:items-start sm:gap-8">
      <div className="flex flex-shrink-0 items-center gap-2 text-zinc-400 sm:w-48 dark:text-zinc-500">
        <span className="[&_svg]:h-3.5 [&_svg]:w-3.5">{icon}</span>
        <span className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.16em]">{label}</span>
      </div>
      <div className="flex min-w-0 flex-1 items-center gap-2 text-sm">
        {value}
        {copyValue && <CopyButton text={copyValue} />}
      </div>
    </div>
  );
}

export { CopyButton };
