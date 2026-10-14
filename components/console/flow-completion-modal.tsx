'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { Dialog, DialogClose, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Check, ArrowRight, Copy, ExternalLink, X } from 'lucide-react';
import type { FlowMetadata, FlowNextStep } from '@/components/console/console-flows';

/**
 * Custom action button configuration for the completion modal
 */
export type FlowCompletionAction = {
  label: string;
  onClick?: () => void;
  href?: string;
  variant?: 'primary' | 'secondary' | 'outline';
  icon?: React.ReactNode;
  external?: boolean;
};

type FlowCompletionModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  metadata: FlowMetadata & { accomplishments: string[] };
  transactionHash?: string;
  explorerUrl?: string;
  customActions?: FlowCompletionAction[];
  showHistoryLink?: boolean;
  historyPath?: string;
  onClose?: () => void;
};

const EYEBROW = 'font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400';
const BTN =
  'inline-flex h-10 items-center justify-center gap-2 border px-4 font-mono text-[11px] font-bold uppercase tracking-[0.14em] transition-colors';
const BTN_PRIMARY = `${BTN} border-zinc-900 bg-zinc-900 text-white hover:bg-zinc-700 dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300`;
const BTN_QUIET = `${BTN} border-transparent text-zinc-500 underline-offset-4 hover:text-zinc-900 hover:underline dark:text-zinc-400 dark:hover:text-zinc-100`;
const ICON_BTN =
  '-m-1 p-1 text-zinc-400 transition-colors hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-zinc-100';

/**
 * Transaction hash with copy functionality
 */
function TxHash({ hash, explorerUrl }: { hash: string; explorerUrl?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(hash);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [hash]);

  return (
    <div className="flex items-center gap-3 border border-zinc-200 bg-zinc-50/60 px-3 py-2.5 dark:border-zinc-800 dark:bg-zinc-900/40">
      <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
        Tx
      </span>
      <code className="flex-1 truncate font-mono text-[12px] text-zinc-900 dark:text-zinc-100">
        {hash.slice(0, 10)}...{hash.slice(-8)}
      </code>
      <div className="flex items-center gap-3">
        <button type="button" onClick={handleCopy} className={ICON_BTN} title="Copy hash">
          {copied ? (
            <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
        </button>
        {explorerUrl && (
          <a
            href={explorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`group/ext ${ICON_BTN}`}
            title="View on explorer"
          >
            <ExternalLink className="h-3.5 w-3.5 transition-colors group-hover/ext:text-[#E6212F]" />
          </a>
        )}
      </div>
    </div>
  );
}

/**
 * Next step row - hairline row with the red arrow on hover
 */
function NextStepCard({ step, index, isRecommended }: { step: FlowNextStep; index: number; isRecommended: boolean }) {
  return (
    <Link
      href={step.path}
      className="group flex items-center justify-between gap-4 border border-zinc-200 bg-white px-4 py-3 transition-colors hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-600"
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span className="shrink-0 font-mono text-[11px] tabular-nums text-zinc-400 dark:text-zinc-500">
          {String(index + 1).padStart(2, '0')}
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="truncate text-[14px] font-medium tracking-tight text-zinc-900 dark:text-zinc-50">
              {step.title}
            </h4>
            {isRecommended && (
              <span className="shrink-0 border border-zinc-900 px-1.5 py-px font-mono text-[9.5px] font-bold uppercase tracking-[0.14em] text-zinc-900 dark:border-zinc-100 dark:text-zinc-100">
                Recommended
              </span>
            )}
          </div>
          <p className="truncate text-[12.5px] text-zinc-500 dark:text-zinc-400">{step.description}</p>
        </div>
      </div>
      <ArrowRight className="h-3.5 w-3.5 shrink-0 -translate-x-0.5 text-zinc-300 transition-all group-hover:translate-x-0 group-hover:text-[#E6212F] dark:text-zinc-600" />
    </Link>
  );
}

/**
 * Completion modal - matches console design language
 */
export function FlowCompletionModal({
  open,
  onOpenChange,
  metadata,
  transactionHash,
  explorerUrl,
  customActions,
  historyPath = '/console',
  onClose,
}: FlowCompletionModalProps) {
  const recommended = metadata.nextSteps.filter((s) => s.priority === 'recommended');
  const optional = metadata.nextSteps.filter((s) => s.priority === 'optional');

  const handleClose = useCallback(() => {
    onClose?.();
    onOpenChange(false);
  }, [onClose, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        hideCloseButton
        className="gap-0 overflow-hidden rounded-none border-zinc-200 bg-white p-0 shadow-xl sm:max-w-lg dark:border-zinc-800 dark:bg-zinc-950"
      >
        {/* Header */}
        <div className="border-b border-zinc-200 px-6 py-5 dark:border-zinc-800">
          <div className="flex items-start gap-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center border border-emerald-200 bg-emerald-50 dark:border-emerald-900/60 dark:bg-emerald-950/30">
              <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" strokeWidth={2.5} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-400">
                Complete
              </p>
              <DialogTitle className="mt-1.5 text-[17px] font-semibold leading-snug tracking-tight text-zinc-900 dark:text-zinc-50">
                {metadata.title}
              </DialogTitle>
              <p className="mt-1 text-[13px] leading-relaxed text-zinc-500 dark:text-zinc-400">
                {metadata.completionSummary}
              </p>
            </div>
            <DialogClose className={ICON_BTN} aria-label="Close">
              <X className="h-4 w-4" />
            </DialogClose>
          </div>

          {/* Transaction hash */}
          {transactionHash && (
            <div className="mt-4">
              <TxHash hash={transactionHash} explorerUrl={explorerUrl} />
            </div>
          )}
        </div>

        {/* Accomplishments */}
        {metadata.accomplishments.length > 0 && (
          <div className="border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
            <h3 className={`${EYEBROW} mb-3`}>What you accomplished</h3>
            <ul className="space-y-2">
              {metadata.accomplishments.map((text, index) => (
                <li key={index} className="flex items-start gap-2 text-[13px] text-zinc-700 dark:text-zinc-300">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <span>{text}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Next Steps */}
        {(recommended.length > 0 || optional.length > 0) && (
          <div className="px-6 py-5">
            {recommended.length > 0 && (
              <div className="space-y-3">
                <h3 className={EYEBROW}>Next steps</h3>
                <div className="space-y-2">
                  {recommended.map((step, i) => (
                    <NextStepCard key={step.path} step={step} index={i} isRecommended={i === 0} />
                  ))}
                </div>
              </div>
            )}

            {optional.length > 0 && (
              <div className={recommended.length > 0 ? 'mt-5' : ''}>
                {recommended.length > 0 && (
                  <div className="mb-3 flex items-center gap-4">
                    <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
                    <span className="font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
                      or
                    </span>
                    <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
                  </div>
                )}
                <div className="space-y-2">
                  {optional.map((step, i) => (
                    <NextStepCard key={step.path} step={step} index={recommended.length + i} isRecommended={false} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="border-t border-zinc-200 bg-zinc-50/80 px-6 py-4 dark:border-zinc-800 dark:bg-zinc-900/40">
          <div className="flex items-center justify-end gap-2">
            {customActions?.length ? (
              <div className="flex w-full items-center justify-end gap-2">
                {customActions.map((action, index) => {
                  const isPrimary = action.variant === 'primary';
                  const className = isPrimary ? `flex-1 ${BTN_PRIMARY}` : BTN_QUIET;

                  if (action.href) {
                    return (
                      <Link key={index} href={action.href} className={className}>
                        {action.label}
                      </Link>
                    );
                  }
                  return (
                    <button key={index} type="button" onClick={action.onClick} className={className}>
                      {action.label}
                    </button>
                  );
                })}
              </div>
            ) : (
              <>
                <Link href={historyPath} className={BTN_QUIET}>
                  Back to Console
                </Link>
                {recommended[0] && (
                  <Link href={recommended[0].path} className={BTN_PRIMARY}>
                    {recommended[0].title}
                  </Link>
                )}
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Hook for managing flow completion modal state
 */
export function useFlowCompletion() {
  const [isOpen, setIsOpen] = useState(false);
  const [completionData, setCompletionData] = useState<{
    transactionHash?: string;
    explorerUrl?: string;
  }>({});

  const showCompletion = useCallback((data?: { transactionHash?: string; explorerUrl?: string }) => {
    if (data) setCompletionData(data);
    setIsOpen(true);
  }, []);

  const hideCompletion = useCallback(() => {
    setIsOpen(false);
    setCompletionData({});
  }, []);

  return {
    isOpen,
    completionData,
    showCompletion,
    hideCompletion,
    setIsOpen,
  };
}
