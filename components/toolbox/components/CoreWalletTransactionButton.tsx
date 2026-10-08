'use client';

import { type ReactNode } from 'react';
import { cn } from '../lib/utils';
import { useWalletStore } from '../stores/walletStore';
import { ArrowRight, Loader2, Terminal } from 'lucide-react';
import { CliAlternative } from '@/components/console/cli-alternative';
import { ConnectedWalletIcon, useConnectedWalletName } from './ConnectedWalletIcon';

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
  /** Kept for callers; the console's signing action has one look. */
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'outline-danger' | 'light-danger';
  className?: string;
}

/**
 * A P-Chain transaction button that adapts based on wallet type:
 * - Core or a Console wallet: a transaction card that signs in the browser, marked with the signing wallet
 * - Any other EVM wallet: the platform-cli command becomes the way to run it
 */
export function CoreWalletTransactionButton({
  children,
  onClick,
  loading,
  loadingText,
  disabled,
  cliCommand,
  downloadFile,
  className,
}: CoreWalletTransactionButtonProps) {
  const coreWalletClient = useWalletStore((s) => s.coreWalletClient);
  const walletName = useConnectedWalletName();

  if (coreWalletClient) {
    return (
      <div className={cn('flex flex-col gap-4', className)}>
        <button
          type="button"
          onClick={onClick}
          disabled={disabled || loading}
          className="group flex w-full items-center gap-4 border border-zinc-900 bg-zinc-900 px-5 py-4 text-left text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:border-zinc-200 disabled:bg-zinc-50 disabled:text-zinc-400 dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300 dark:disabled:border-zinc-800 dark:disabled:bg-zinc-900 dark:disabled:text-zinc-500"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center border border-current/20 bg-white/10 group-disabled:bg-transparent dark:bg-zinc-900/10">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ConnectedWalletIcon className="h-4 w-4" />}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-mono text-[12px] font-bold uppercase tracking-[0.14em]">
              {loading ? loadingText || 'Working…' : children}
            </span>
            <span className="mt-0.5 block text-[12px] opacity-70">
              {loading ? 'Waiting on the P-Chain' : `Signs with ${walletName}`}
            </span>
          </span>
          {!loading && (
            <ArrowRight className="h-4 w-4 shrink-0 text-[#E6212F] transition-transform group-hover:translate-x-0.5 group-disabled:text-current" />
          )}
        </button>
        {cliCommand && <CliAlternative command={cliCommand} download={downloadFile} />}
      </div>
    );
  }

  // Wallets that can't sign P-Chain transactions: the command is how this step runs.
  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {cliCommand ? (
        <>
          <p className="flex items-start gap-2 text-[13px] leading-relaxed text-zinc-600 dark:text-zinc-300">
            <Terminal className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-400" />
            Your wallet can&apos;t sign P-Chain transactions here. Run this with platform-cli, or connect Core or a
            Console wallet from the top bar.
          </p>
          <CliAlternative command={cliCommand} download={downloadFile} />
        </>
      ) : (
        <button
          type="button"
          disabled
          className="inline-flex h-10 w-full cursor-not-allowed items-center justify-center border border-zinc-200 bg-zinc-50 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-500"
        >
          {children}
        </button>
      )}
    </div>
  );
}
