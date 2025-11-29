"use client";

import { useState, ReactNode } from "react";
import { Copy, Check } from "lucide-react";

interface DetailRowProps {
  icon: ReactNode;
  label: string;
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
      className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded transition-colors"
      title="Copy to clipboard"
    >
      {copied ? (
        <Check className="w-3.5 h-3.5 text-green-500" />
      ) : (
        <Copy className="w-3.5 h-3.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300" />
      )}
    </button>
  );
}

export function DetailRow({ icon, label, value, themeColor = "#E57373", copyValue }: DetailRowProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-8">
      <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 sm:w-48 flex-shrink-0">
        <span style={{ color: themeColor }}>{icon}</span>
        <span className="text-sm">{label}:</span>
      </div>
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {value}
        {copyValue && <CopyButton text={copyValue} />}
      </div>
    </div>
  );
}

export { CopyButton };

