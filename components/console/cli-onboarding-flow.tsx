"use client";

import { useState, useCallback } from "react";
import { Terminal, Copy, Check, ChevronRight } from "lucide-react";
import Link from "next/link";

interface CliOnboardingFlowProps {
  validatorCount?: number;
  showFaucetStep?: boolean;
  className?: string;
}

const INSTALL_CMD = "curl -sSfL https://build.avax.network/install/platform-cli | sh";
const GENERATE_KEY_CMD = "platform keys generate --name mykey";
const GET_ADDRESS_CMD = "platform wallet address --key-name mykey";

function CopyableCommand({ command, label }: { command: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API may fail if page is not focused
    }
  }, [command]);

  return (
    <div className="group relative rounded-lg bg-muted/50 border border-border px-4 py-3">
      {label && (
        <div className="text-xs text-muted-foreground mb-1.5">{label}</div>
      )}
      <button
        onClick={handleCopy}
        className="absolute top-2.5 right-2.5 p-1.5 rounded-md text-muted-foreground/0 group-hover:text-muted-foreground hover:!text-foreground transition-colors"
        aria-label="Copy command"
      >
        {copied ? (
          <Check className="w-3.5 h-3.5 text-emerald-500" />
        ) : (
          <Copy className="w-3.5 h-3.5" />
        )}
      </button>
      <pre className="text-xs font-mono leading-relaxed whitespace-pre-wrap break-all">
        <span className="text-muted-foreground/50 select-none">$ </span>
        <span className="text-foreground">{command}</span>
      </pre>
    </div>
  );
}

export function CliOnboardingFlow({
  validatorCount = 1,
  showFaucetStep = true,
  className,
}: CliOnboardingFlowProps) {
  const requiredAvax = (validatorCount * 0.1 + 0.05).toFixed(2);

  return (
    <div className={`rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-4 ${className ?? ""}`}>
      <div className="flex items-center gap-2">
        <Terminal className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium text-primary">Platform CLI Setup</span>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium">1</span>
          <span className="text-sm font-medium">Install platform-cli</span>
        </div>
        <CopyableCommand command={INSTALL_CMD} />
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium">2</span>
          <span className="text-sm font-medium">Generate a key</span>
        </div>
        <CopyableCommand command={GENERATE_KEY_CMD} />
        <p className="text-xs text-muted-foreground ml-7">
          Or import an existing key: <code className="text-xs bg-muted px-1 py-0.5 rounded">platform keys import --name mykey --private-key &quot;PrivateKey-...&quot;</code>
        </p>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium">3</span>
          <span className="text-sm font-medium">Get your P-Chain address</span>
        </div>
        <CopyableCommand command={GET_ADDRESS_CMD} />
        <p className="text-xs text-muted-foreground ml-7">
          Copy the P-Chain address from the output (starts with <code className="text-xs bg-muted px-1 py-0.5 rounded">P-fuji1...</code>)
        </p>
      </div>

      {showFaucetStep && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium">4</span>
            <span className="text-sm font-medium">Fund your P-Chain address</span>
          </div>
          <p className="text-xs text-muted-foreground ml-7">
            You need approximately <strong>{requiredAvax} AVAX</strong> on P-Chain ({validatorCount} validator{validatorCount !== 1 ? "s" : ""} &times; 0.1 AVAX + 0.05 gas).
            Paste your P-Chain address in the faucet to claim testnet AVAX.
          </p>
          <div className="ml-7">
            <Link
              href="/console/primary-network/faucet"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary border border-primary/30 rounded-lg hover:bg-primary/10 transition-colors"
            >
              Open Faucet
              <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
