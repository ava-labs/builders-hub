'use client';

import { type ReactNode, useState, useCallback } from 'react';
import { Button } from './Button';
import { cn } from '../lib/utils';
import { useWalletStore } from '../stores/walletStore';
import { Loader2, Terminal, Copy, Check, ExternalLink, ArrowRight, Download } from 'lucide-react';

interface DownloadFileConfig {
  data: string;
  filename: string;
  label?: string;
}

interface CoreWalletTransactionButtonProps {
  children: ReactNode;
  onClick?: () => void;
  loading?: boolean;
  loadingText?: string;
  disabled?: boolean;
  cliCommand?: string;
  downloadFile?: DownloadFileConfig;
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'outline-danger' | 'light-danger';
  className?: string;
}

function DownloadFileButton({ data, filename, label }: DownloadFileConfig) {
  const handleDownload = useCallback(() => {
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [data, filename]);

  return (
    <button
      onClick={handleDownload}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-border bg-background hover:bg-muted text-foreground transition-colors"
    >
      <Download className="w-3 h-3" />
      {label || `Download ${filename}`}
    </button>
  );
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
        {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
      </button>
      <pre className="text-xs font-mono leading-relaxed whitespace-pre-wrap break-all">
        <span className="text-muted-foreground/50 select-none">$ </span>
        <span className="text-foreground">{command}</span>
      </pre>
    </div>
  );
}

/**
 * A P-Chain transaction button that adapts based on wallet type:
 * - Core wallet: branded transaction card with onClick handler for in-browser signing
 * - Non-Core EVM wallet: shows CLI command as the primary action path
 */
export function CoreWalletTransactionButton({
  children,
  onClick,
  loading,
  loadingText,
  disabled,
  cliCommand,
  downloadFile,
  variant = 'primary',
  className,
}: CoreWalletTransactionButtonProps) {
  const coreWalletClient = useWalletStore((s) => s.coreWalletClient);
  const hasCoreWallet = !!coreWalletClient;

  if (hasCoreWallet) {
    return (
      <>
        <div className={cn('space-y-2', className)}>
          <button
            onClick={onClick}
            disabled={disabled || loading}
            className="w-full group relative flex flex-col items-center gap-2 px-6 py-5 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-750 hover:border-zinc-300 dark:hover:border-zinc-600 shadow-sm hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-sm"
          >
            <img src="/images/core-wordmark.png" alt="Core" className="w-10 h-10 rounded-xl" />
            {loading ? (
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                <span className="text-sm font-medium text-muted-foreground">{loadingText || 'Loading...'}</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-semibold text-foreground">{children}</span>
                <ArrowRight className="w-3.5 h-3.5 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
              </div>
            )}
          </button>
        </div>

        {cliCommand && (
          <div className="mt-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex-1 h-px bg-border" />
              <a
                href="https://github.com/ava-labs/platform-cli"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-medium text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors inline-flex items-center gap-1"
              >
                or via platform-cli
                <ExternalLink className="h-3 w-3" />
              </a>
              <div className="flex-1 h-px bg-border" />
            </div>
            {downloadFile && downloadFile.data && (
              <div className="mb-2">
                <DownloadFileButton {...downloadFile} />
              </div>
            )}
            <CliCommandBlock command={cliCommand} />
          </div>
        )}
      </>
    );
  }

  // Non-Core wallet: show CLI command as primary action
  return (
    <div className="space-y-3">
      {cliCommand ? (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
          <div className="flex items-center gap-2 mb-2">
            <Terminal className="h-4 w-4 text-primary" />
            <a
              href="https://github.com/ava-labs/platform-cli"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-primary hover:underline inline-flex items-center gap-1"
            >
              Run via platform-cli
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
          {downloadFile && downloadFile.data && (
            <div className="mb-2">
              <DownloadFileButton {...downloadFile} />
            </div>
          )}
          <CliCommandBlock command={cliCommand} />
        </div>
      ) : (
        <Button disabled={true} variant={variant} className={className}>
          {children}
        </Button>
      )}
    </div>
  );
}
