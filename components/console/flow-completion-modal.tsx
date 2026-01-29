"use client";

import { useMemo, useState, useCallback } from "react";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { CheckCircle, Star, ArrowRight, PartyPopper, History, ExternalLink, Copy, Check } from "lucide-react";
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
  /** Optional transaction hash to display and copy */
  transactionHash?: string;
  /** Optional block explorer URL for the transaction */
  explorerUrl?: string;
  /** Custom actions to display in the footer */
  customActions?: FlowCompletionAction[];
  /** Show "View History" link (default: true if no custom actions) */
  showHistoryLink?: boolean;
  /** Custom history path (default: /console/history) */
  historyPath?: string;
  /** Callback when modal is closed */
  onClose?: () => void;
};

/**
 * Reusable accomplishment item with checkmark
 */
function AccomplishmentItem({ text }: { text: string }) {
  return (
    <li className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
      <CheckCircle className="h-4 w-4 flex-shrink-0 text-green-500" />
      <span>{text}</span>
    </li>
  );
}

/**
 * Reusable next step card with navigation link
 */
function NextStepCard({
  step,
  isRecommended,
}: {
  step: FlowNextStep;
  isRecommended: boolean;
}) {
  return (
    <Link
      href={step.path}
      className={`
        group flex items-center justify-between p-3 rounded-lg border transition-all
        ${
          isRecommended
            ? "border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 hover:bg-blue-100 dark:hover:bg-blue-950/50"
            : "border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
        }
      `}
    >
      <div className="flex items-start gap-3">
        {isRecommended && (
          <Star className="h-4 w-4 mt-0.5 text-blue-500 flex-shrink-0" />
        )}
        <div>
          <h4 className="font-medium text-sm text-zinc-900 dark:text-zinc-100">
            {step.title}
          </h4>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            {step.description}
          </p>
        </div>
      </div>
      <ArrowRight className="h-4 w-4 text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300 transition-colors" />
    </Link>
  );
}

/**
 * Transaction hash display with copy functionality
 */
function TransactionHashDisplay({
  hash,
  explorerUrl,
}: {
  hash: string;
  explorerUrl?: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(hash);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  }, [hash]);

  const truncatedHash = `${hash.slice(0, 10)}...${hash.slice(-8)}`;

  return (
    <div className="flex items-center gap-2 p-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
      <code className="flex-1 text-xs font-mono text-zinc-600 dark:text-zinc-400 truncate">
        {truncatedHash}
      </code>
      <button
        type="button"
        onClick={handleCopy}
        className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded transition-colors"
        title="Copy transaction hash"
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
          className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded transition-colors"
          title="View on explorer"
        >
          <ExternalLink className="h-4 w-4 text-zinc-400" />
        </a>
      )}
    </div>
  );
}

/**
 * Completion modal shown when user finishes a console flow.
 * Displays accomplishments and recommended next steps.
 */
export function FlowCompletionModal({
  open,
  onOpenChange,
  metadata,
  transactionHash,
  explorerUrl,
  customActions,
  showHistoryLink,
  historyPath = "/console",
  onClose,
}: FlowCompletionModalProps) {
  // Split next steps by priority for grouped display
  const { recommended, optional } = useMemo(
    () => ({
      recommended: metadata.nextSteps.filter((s) => s.priority === "recommended"),
      optional: metadata.nextSteps.filter((s) => s.priority === "optional"),
    }),
    [metadata.nextSteps]
  );

  const firstRecommendedPath = recommended[0]?.path;

  // Show history link by default if no custom actions are provided
  const shouldShowHistory = showHistoryLink ?? !customActions?.length;

  const handleClose = useCallback(() => {
    onClose?.();
    onOpenChange(false);
  }, [onClose, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700">
        <DialogHeader className="text-center sm:text-left">
          <div className="flex items-center gap-2 mb-2">
            <PartyPopper className="h-6 w-6 text-yellow-500" />
            <DialogTitle className="text-xl">Congratulations!</DialogTitle>
          </div>
          <DialogDescription className="text-base">
            {metadata.completionSummary}
          </DialogDescription>
        </DialogHeader>

        {/* Transaction Hash (if provided) */}
        {transactionHash && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
              Transaction
            </h3>
            <TransactionHashDisplay hash={transactionHash} explorerUrl={explorerUrl} />
          </div>
        )}

        {/* Accomplishments Section */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
            What you accomplished
          </h3>
          <ul className="space-y-2">
            {metadata.accomplishments.map((text, index) => (
              <AccomplishmentItem key={index} text={text} />
            ))}
          </ul>
        </div>

        {/* Next Steps Section */}
        {metadata.nextSteps.length > 0 && (
          <div className="space-y-3 border-t border-zinc-200 dark:border-zinc-700 pt-4">
            {/* Recommended Next Steps */}
            {recommended.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                  Recommended Next Steps
                </h3>
                <div className="space-y-2">
                  {recommended.map((step) => (
                    <NextStepCard
                      key={step.path}
                      step={step}
                      isRecommended={true}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Optional Next Steps */}
            {optional.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                  Optional
                </h3>
                <div className="space-y-2">
                  {optional.map((step) => (
                    <NextStepCard
                      key={step.path}
                      step={step}
                      isRecommended={false}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-2">
          {/* Custom Actions */}
          {customActions?.map((action, index) => {
            const buttonClass = `w-full sm:w-auto px-4 py-2 text-sm rounded-md flex items-center justify-center gap-2 transition-colors ${
              action.variant === "primary"
                ? "bg-blue-600 text-white hover:bg-blue-700"
                : action.variant === "secondary"
                ? "bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 hover:bg-zinc-300 dark:hover:bg-zinc-600"
                : "border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            }`;

            if (action.href) {
              return (
                <Link
                  key={index}
                  href={action.href}
                  className={buttonClass}
                  target={action.external ? "_blank" : undefined}
                  rel={action.external ? "noopener noreferrer" : undefined}
                >
                  {action.icon}
                  {action.label}
                  {action.external && <ExternalLink className="h-3 w-3" />}
                </Link>
              );
            }

            return (
              <button
                key={index}
                type="button"
                onClick={action.onClick}
                className={buttonClass}
              >
                {action.icon}
                {action.label}
              </button>
            );
          })}

          {/* History Link */}
          {shouldShowHistory && (
            <Link
              href={historyPath}
              className="w-full sm:w-auto px-4 py-2 text-sm rounded-md border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors flex items-center justify-center gap-2"
            >
              <History className="h-4 w-4" />
              Back to Console
            </Link>
          )}

          {/* Close button (only show if no custom actions or history link) */}
          {!customActions?.length && !shouldShowHistory && (
            <button
              onClick={handleClose}
              className="w-full sm:w-auto px-4 py-2 text-sm rounded-md border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              Close
            </button>
          )}

          {/* Go to Next Step button */}
          {firstRecommendedPath && (
            <Link
              href={firstRecommendedPath}
              className="w-full sm:w-auto px-4 py-2 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors text-center"
            >
              Go to Next Step
            </Link>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Hook for managing flow completion modal state.
 * Makes it easy to integrate the completion modal into any step flow.
 */
export function useFlowCompletion() {
  const [isOpen, setIsOpen] = useState(false);
  const [completionData, setCompletionData] = useState<{
    transactionHash?: string;
    explorerUrl?: string;
  }>({});

  const showCompletion = useCallback((data?: { transactionHash?: string; explorerUrl?: string }) => {
    if (data) {
      setCompletionData(data);
    }
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
