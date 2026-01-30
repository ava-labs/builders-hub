"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Check, ArrowRight, Copy, ExternalLink } from "lucide-react";
import type { FlowMetadata, FlowNextStep } from "@/config/console-flows";

/**
 * Custom action button configuration for the completion modal
 */
export type FlowCompletionAction = {
  label: string;
  onClick?: () => void;
  href?: string;
  variant?: "primary" | "secondary" | "outline";
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
    <div className="flex items-center gap-3 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/80 dark:border-zinc-700/50">
      <code className="flex-1 text-sm font-mono text-zinc-600 dark:text-zinc-400 truncate">
        {hash.slice(0, 10)}...{hash.slice(-8)}
      </code>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={handleCopy}
          className="p-2 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
          title="Copy hash"
        >
          {copied ? (
            <Check className="h-4 w-4 text-green-500" />
          ) : (
            <Copy className="h-4 w-4 text-zinc-400" />
          )}
        </button>
        {explorerUrl && (
          <a
            href={explorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
            title="View on explorer"
          >
            <ExternalLink className="h-4 w-4 text-zinc-400" />
          </a>
        )}
      </div>
    </div>
  );
}

/**
 * Next step card - matches console card style
 */
function NextStepCard({
  step,
  index,
  isRecommended,
}: {
  step: FlowNextStep;
  index: number;
  isRecommended: boolean;
}) {
  return (
    <Link href={step.path} className="group block">
      <div className="relative p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 transition-all duration-200 hover:border-zinc-300 dark:hover:border-zinc-700 hover:shadow-lg hover:shadow-zinc-200/50 dark:hover:shadow-zinc-900/50">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <span className="text-[13px] tabular-nums text-zinc-400 dark:text-zinc-500 shrink-0">
              {String(index + 1).padStart(2, "0")}
            </span>
            <div className="min-w-0">
              <h4 className="text-[15px] font-medium text-zinc-900 dark:text-zinc-100 truncate">
                {step.title}
              </h4>
              <p className="text-[13px] text-zinc-500 dark:text-zinc-400 truncate">
                {step.description}
              </p>
            </div>
          </div>
          <div className="shrink-0 w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center group-hover:bg-zinc-900 dark:group-hover:bg-zinc-100 transition-colors">
            <ArrowRight className="w-4 h-4 text-zinc-400 group-hover:text-white dark:group-hover:text-zinc-900 transition-colors" />
          </div>
        </div>
        {isRecommended && (
          <div className="absolute -top-2 right-4">
            <span className="px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-full">
              Recommended
            </span>
          </div>
        )}
      </div>
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
  historyPath = "/console",
  onClose,
}: FlowCompletionModalProps) {
  const recommended = metadata.nextSteps.filter((s) => s.priority === "recommended");
  const optional = metadata.nextSteps.filter((s) => s.priority === "optional");

  const handleClose = useCallback(() => {
    onClose?.();
    onOpenChange(false);
  }, [onClose, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg p-0 gap-0 bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 overflow-hidden">
        {/* Header */}
        <div className="p-6 bg-white dark:bg-zinc-900 border-b border-zinc-200/80 dark:border-zinc-800">
          <div className="flex items-start gap-4">
            <div className="shrink-0 w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <Check className="w-6 h-6 text-green-600 dark:text-green-400" strokeWidth={2.5} />
            </div>
            <div className="flex-1 min-w-0 pt-1">
              <h2 className="text-xl font-medium text-zinc-900 dark:text-zinc-100">
                {metadata.title}
              </h2>
              <p className="mt-1 text-[15px] text-zinc-500 dark:text-zinc-400">
                {metadata.completionSummary}
              </p>
            </div>
          </div>

          {/* Transaction hash */}
          {transactionHash && (
            <div className="mt-4">
              <TxHash hash={transactionHash} explorerUrl={explorerUrl} />
            </div>
          )}
        </div>

        {/* Next Steps */}
        {(recommended.length > 0 || optional.length > 0) && (
          <div className="p-6">
            {recommended.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                  Next Steps
                </h3>
                <div className="space-y-2">
                  {recommended.map((step, i) => (
                    <NextStepCard
                      key={step.path}
                      step={step}
                      index={i}
                      isRecommended={i === 0}
                    />
                  ))}
                </div>
              </div>
            )}

            {optional.length > 0 && (
              <div className={recommended.length > 0 ? "mt-6" : ""}>
                {recommended.length > 0 && (
                  <div className="flex items-center gap-4 mb-4">
                    <div className="flex-1 h-px bg-zinc-200 dark:bg-zinc-800" />
                    <span className="text-xs text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">
                      or
                    </span>
                    <div className="flex-1 h-px bg-zinc-200 dark:bg-zinc-800" />
                  </div>
                )}
                <div className="space-y-2">
                  {optional.map((step, i) => (
                    <NextStepCard
                      key={step.path}
                      step={step}
                      index={recommended.length + i}
                      isRecommended={false}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="p-4 bg-white dark:bg-zinc-900 border-t border-zinc-200/80 dark:border-zinc-800">
          <div className="flex items-center justify-between">
            {customActions?.length ? (
              <div className="flex items-center gap-2 w-full">
                {customActions.map((action, index) => {
                  const isPrimary = action.variant === "primary";
                  const className = isPrimary
                    ? "flex-1 px-4 py-2.5 text-sm font-medium rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors text-center"
                    : "px-4 py-2.5 text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors";

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
                <Link
                  href={historyPath}
                  className="px-4 py-2.5 text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
                >
                  Back to Console
                </Link>
                {recommended[0] && (
                  <Link
                    href={recommended[0].path}
                    className="px-5 py-2.5 text-sm font-medium rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors"
                  >
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
