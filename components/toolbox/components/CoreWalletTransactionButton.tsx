"use client";

import { type ReactNode, useState, useCallback } from "react";
import { Button } from "./Button";
import { useWalletStore } from "../stores/walletStore";
import { Terminal, Copy, Check } from "lucide-react";

interface CoreWalletTransactionButtonProps {
  children: ReactNode;
  onClick?: () => void;
  loading?: boolean;
  loadingText?: string;
  disabled?: boolean;
  cliCommand?: string;
  variant?: "primary" | "secondary" | "outline" | "danger" | "outline-danger" | "light-danger";
  className?: string;
}

function CliCommandBlock({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [command]);

  return (
    <div className="group relative rounded-lg bg-muted/50 border border-border px-4 py-3">
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

/**
 * A transaction button that adapts based on wallet type:
 * - Core wallet: renders a normal button with Core icon + subtle CLI alternative
 * - Non-Core wallet: renders a disabled button with a promoted CLI alternative
 */
export function CoreWalletTransactionButton({
  children,
  onClick,
  loading,
  loadingText,
  disabled,
  cliCommand,
  variant = "primary",
  className,
}: CoreWalletTransactionButtonProps) {
  const walletType = useWalletStore((s) => s.walletType);
  const isCoreWallet = walletType === "core";

  if (isCoreWallet) {
    return (
      <>
        <Button
          onClick={onClick}
          loading={loading}
          loadingText={loadingText}
          disabled={disabled}
          variant={variant}
          icon={<img src="/images/core.svg" alt="" className="w-4 h-4" />}
          className={className}
        >
          {children}
        </Button>
        {cliCommand && (
          <div className="mt-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                or via CLI
              </span>
              <div className="flex-1 h-px bg-border" />
            </div>
            <CliCommandBlock command={cliCommand} />
          </div>
        )}
      </>
    );
  }

  // Non-Core wallet: disabled button + prominent CLI instructions
  return (
    <div className="space-y-3">
      <div className="relative">
        <Button
          disabled={true}
          variant={variant}
          className={className}
        >
          {children}
        </Button>
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 rounded-xl">
          <span className="text-xs font-medium text-muted-foreground">
            Requires Core Wallet for P-Chain transactions
          </span>
        </div>
      </div>
      {cliCommand && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
          <div className="flex items-center gap-2 mb-2">
            <Terminal className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-primary">Use the CLI instead</span>
          </div>
          <CliCommandBlock command={cliCommand} />
        </div>
      )}
    </div>
  );
}
