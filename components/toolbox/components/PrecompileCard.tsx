'use client';

import type { ReactNode } from 'react';
import { Copy, Check, ChevronDown, ChevronRight } from 'lucide-react';
import { useState, useCallback } from 'react';
import { PrecompileRoleBadge, type PrecompileRole } from './PrecompileRoleBadge';
import { cn } from '../lib/utils';

export interface PrecompileCardProps {
  /** Lucide icon component to render in the header */
  icon: React.ComponentType<{ className?: string }>;
  /** Tailwind classes for the icon's tinted background pill */
  iconWrapperClass: string;
  /** Tailwind classes for the icon color */
  iconClass: string;
  title: string;
  subtitle?: string;
  /** Precompile contract address — shown as monospace label */
  precompileAddress: string;
  /** Minimum role required for this card's primary action (default: 1 = Enabled) */
  minimumRole?: PrecompileRole;
  /** Bumps to refresh the role badge after a successful tx. */
  roleRefreshKey?: number;
  /** Notifies parent of role state — used to disable submit when `< minimumRole`. */
  onRoleChange?: (role: PrecompileRole | null) => void;
  /** Body of the card (form / actions) */
  children: ReactNode;
  /** Optional collapsible "tabs" rendered along the top of the body (e.g. read/write/admin) */
  tabs?: { id: string; label: string; icon?: React.ComponentType<{ className?: string }> }[];
  activeTab?: string;
  onTabChange?: (id: string) => void;
  /** Footer ribbon (e.g. interface link, version stamp) */
  footer?: ReactNode;
  className?: string;
}

/**
 * PrecompileCard
 *
 * Shared shell for precompile UIs in /console — matches the validator-manager
 * `ReadContract` layout: rounded-2xl panel, header with icon + title + role badge
 * + copyable contract address, optional tab strip, scrollable body, and footer.
 */
export function PrecompileCard({
  icon: Icon,
  iconWrapperClass,
  iconClass,
  title,
  subtitle,
  precompileAddress,
  minimumRole = 1,
  roleRefreshKey = 0,
  onRoleChange,
  children,
  tabs,
  activeTab,
  onTabChange,
  footer,
  className,
}: PrecompileCardProps) {
  const [copied, setCopied] = useState(false);

  const copyAddress = useCallback(async () => {
    await navigator.clipboard.writeText(precompileAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [precompileAddress]);

  return (
    <div
      className={cn(
        'flex flex-col rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden',
        className,
      )}
    >
      {/* Header */}
      <div className="shrink-0 px-4 py-3 border-b border-zinc-200/80 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
        <div className="flex items-start gap-3">
          <div className={cn('shrink-0 p-2 rounded-lg', iconWrapperClass)}>
            <Icon className={cn('w-5 h-5', iconClass)} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h3 className="font-medium text-zinc-900 dark:text-zinc-100 truncate">{title}</h3>
              <PrecompileRoleBadge
                precompileAddress={precompileAddress}
                minimumRole={minimumRole}
                refreshKey={roleRefreshKey}
                onRoleChange={onRoleChange}
                compact
              />
            </div>
            {subtitle && <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{subtitle}</p>}
            <button
              type="button"
              onClick={copyAddress}
              className="mt-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-700 text-[11px] font-mono text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
              title="Copy address"
            >
              {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3 text-zinc-400" />}
              {precompileAddress}
            </button>
          </div>
        </div>
      </div>

      {/* Optional tab strip */}
      {tabs && tabs.length > 0 && (
        <div className="shrink-0 flex border-b border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30 overflow-x-auto">
          {tabs.map((tab) => {
            const TabIcon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange?.(tab.id)}
                className={cn(
                  'flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium whitespace-nowrap transition-colors border-b-2 -mb-px',
                  isActive
                    ? 'border-amber-500 text-amber-700 dark:text-amber-300 bg-white dark:bg-zinc-900'
                    : 'border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300',
                )}
              >
                {TabIcon && <TabIcon className="w-3.5 h-3.5" />}
                {tab.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Body */}
      <div className="flex-1 p-4 space-y-4">{children}</div>

      {footer && (
        <div className="shrink-0 px-4 py-2.5 border-t border-zinc-200/80 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
          {footer}
        </div>
      )}
    </div>
  );
}

/**
 * StateRow — single read-only key/value row used inside a card's body.
 * Designed for the "Current Configuration" pattern in FeeManager / RewardManager.
 */
export function StateRow({
  label,
  value,
  hint,
  status,
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  status?: 'active' | 'inactive' | 'warning';
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-zinc-700/60',
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">{label}</span>
        {hint && <p className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate">{hint}</p>}
      </div>
      <span
        className={cn(
          'shrink-0 text-xs font-mono truncate max-w-[60%]',
          status === 'active' && 'text-emerald-600 dark:text-emerald-400',
          status === 'inactive' && 'text-zinc-500 dark:text-zinc-400',
          status === 'warning' && 'text-amber-600 dark:text-amber-400',
          !status && 'text-zinc-900 dark:text-zinc-100',
        )}
      >
        {value}
      </span>
    </div>
  );
}

/**
 * StateGroup — labelled collection of StateRows with a header.
 */
export function StateGroup({
  title,
  description,
  defaultOpen = true,
  collapsible = false,
  children,
}: {
  title: string;
  description?: string;
  defaultOpen?: boolean;
  collapsible?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-lg border border-zinc-200/80 dark:border-zinc-800 overflow-hidden">
      {collapsible ? (
        <button
          onClick={() => setOpen(!open)}
          className="w-full flex items-center justify-between px-3 py-2 bg-zinc-50 dark:bg-zinc-800/50 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
        >
          <div className="text-left">
            <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">{title}</span>
            {description && <p className="text-[10px] text-zinc-500 dark:text-zinc-400">{description}</p>}
          </div>
          {open ? (
            <ChevronDown className="w-3.5 h-3.5 text-zinc-500" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-zinc-500" />
          )}
        </button>
      ) : (
        <div className="px-3 py-2 bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200/80 dark:border-zinc-800">
          <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">{title}</span>
          {description && <p className="text-[10px] text-zinc-500 dark:text-zinc-400">{description}</p>}
        </div>
      )}
      {(!collapsible || open) && <div className="p-3 space-y-2">{children}</div>}
    </div>
  );
}
