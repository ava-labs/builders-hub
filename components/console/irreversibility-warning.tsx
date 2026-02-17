"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";

export interface IrreversibilityWarningProps {
  /** Main warning title */
  title: string;
  /** Detailed description of what the action does */
  description: string;
  /** List of items user should verify before proceeding */
  checklist?: string[];
  /** Callback when user confirms understanding */
  onConfirm?: () => void;
  /** Callback when user cancels */
  onCancel?: () => void;
  /** Whether the confirm button is in loading state */
  isLoading?: boolean;
  /** Custom confirm button text */
  confirmText?: string;
  /** Custom cancel button text */
  cancelText?: string;
  /** Severity level affects styling */
  severity?: "warning" | "critical";
  /** Additional CSS classes */
  className?: string;
  /** Whether to show as inline banner (default) or require explicit acknowledgment */
  requireAcknowledgment?: boolean;
  /** Children to render below the warning content */
  children?: React.ReactNode;
}

/**
 * A reusable warning component for irreversible actions.
 * Can be used as a simple banner or as an acknowledgment gate with checklist.
 */
export function IrreversibilityWarning({
  title,
  description,
  checklist = [],
  onConfirm,
  onCancel,
  isLoading = false,
  confirmText = "I understand, proceed",
  cancelText = "Cancel",
  severity = "warning",
  className,
  requireAcknowledgment = false,
  children,
}: IrreversibilityWarningProps) {
  const [checkedItems, setCheckedItems] = useState<Set<number>>(new Set());

  const allChecked = checklist.length === 0 || checkedItems.size === checklist.length;
  const canProceed = !requireAcknowledgment || allChecked;

  const toggleItem = (index: number) => {
    setCheckedItems((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const severityConfig = {
    warning: {
      container:
        "border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30",
      iconBg: "bg-amber-100 dark:bg-amber-900/50",
      icon: <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />,
      title: "text-amber-900 dark:text-amber-100",
      description: "text-amber-800 dark:text-amber-200",
      checkboxBorder: "border-amber-400 dark:border-amber-600",
      checkboxChecked: "bg-amber-500 border-amber-500",
      confirmBtn:
        "bg-amber-600 hover:bg-amber-700 text-white dark:bg-amber-600 dark:hover:bg-amber-700",
    },
    critical: {
      container:
        "border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950/30",
      iconBg: "bg-red-100 dark:bg-red-900/50",
      icon: <ShieldAlert className="h-5 w-5 text-red-600 dark:text-red-400" />,
      title: "text-red-900 dark:text-red-100",
      description: "text-red-800 dark:text-red-200",
      checkboxBorder: "border-red-400 dark:border-red-600",
      checkboxChecked: "bg-red-500 border-red-500",
      confirmBtn:
        "bg-red-600 hover:bg-red-700 text-white dark:bg-red-600 dark:hover:bg-red-700",
    },
  };

  const config = severityConfig[severity];

  return (
    <div
      className={cn(
        "rounded-lg border-2 p-4",
        config.container,
        className
      )}
      role="alert"
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full",
            config.iconBg
          )}
        >
          {config.icon}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className={cn("text-base font-semibold", config.title)}>
            {title}
          </h3>
          <p className={cn("mt-1 text-sm", config.description)}>{description}</p>
        </div>
      </div>

      {/* Checklist */}
      {checklist.length > 0 && (
        <div className="mt-4 space-y-2 ml-13">
          <p className={cn("text-xs font-medium uppercase tracking-wider mb-2", config.description)}>
            Please confirm you have:
          </p>
          {checklist.map((item, index) => (
            <label
              key={index}
              className={cn(
                "flex items-center gap-3 cursor-pointer group p-2 rounded-md transition-colors",
                "hover:bg-black/5 dark:hover:bg-white/5"
              )}
            >
              <div
                className={cn(
                  "flex h-5 w-5 items-center justify-center rounded border-2 transition-all",
                  checkedItems.has(index)
                    ? config.checkboxChecked
                    : config.checkboxBorder
                )}
                onClick={() => toggleItem(index)}
              >
                {checkedItems.has(index) && (
                  <CheckCircle2 className="h-4 w-4 text-white" />
                )}
              </div>
              <span
                className={cn(
                  "text-sm",
                  config.description,
                  checkedItems.has(index) && "line-through opacity-70"
                )}
              >
                {item}
              </span>
            </label>
          ))}
        </div>
      )}

      {/* Children */}
      {children && <div className="mt-4">{children}</div>}

      {/* Action buttons (only shown if requireAcknowledgment is true) */}
      {requireAcknowledgment && (onConfirm || onCancel) && (
        <div className="mt-4 flex flex-col sm:flex-row gap-2 sm:justify-end">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              disabled={isLoading}
              className={cn(
                "px-4 py-2 text-sm font-medium rounded-md transition-colors",
                "border border-zinc-300 dark:border-zinc-600",
                "text-zinc-700 dark:text-zinc-300",
                "hover:bg-zinc-100 dark:hover:bg-zinc-800",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            >
              {cancelText}
            </button>
          )}
          {onConfirm && (
            <button
              type="button"
              onClick={onConfirm}
              disabled={!canProceed || isLoading}
              className={cn(
                "px-4 py-2 text-sm font-medium rounded-md transition-colors",
                config.confirmBtn,
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            >
              {isLoading ? "Processing..." : confirmText}
            </button>
          )}
        </div>
      )}

      {/* Progress indicator for checklist */}
      {requireAcknowledgment && checklist.length > 0 && (
        <div className="mt-3 flex items-center gap-2 text-xs">
          <div className="flex-1 h-1.5 bg-black/10 dark:bg-white/10 rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full transition-all duration-300 rounded-full",
                severity === "critical" ? "bg-red-500" : "bg-amber-500"
              )}
              style={{
                width: `${(checkedItems.size / checklist.length) * 100}%`,
              }}
            />
          </div>
          <span className={config.description}>
            {checkedItems.size}/{checklist.length} confirmed
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * A simpler inline warning banner variant without action buttons.
 * Use this for informational warnings that don't require user confirmation.
 */
export function IrreversibilityBanner({
  title,
  description,
  severity = "warning",
  className,
}: Pick<IrreversibilityWarningProps, "title" | "description" | "severity" | "className">) {
  return (
    <IrreversibilityWarning
      title={title}
      description={description}
      severity={severity}
      className={className}
      requireAcknowledgment={false}
    />
  );
}

export default IrreversibilityWarning;
