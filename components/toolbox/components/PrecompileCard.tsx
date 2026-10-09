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
 * `ReadContract` layout: square hairline panel, header with icon + title + role badge
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
        'flex flex-col overflow-hidden border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950',
        className,
      )}
    >
      {/* Header */}
      <div className="shrink-0 border-b border-zinc-200 bg-zinc-50/60 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/40">
        <div className="flex items-start gap-3">
          <div className={cn('shrink-0 rounded-none p-2', iconWrapperClass)}>
            <Icon className={cn('h-4 w-4', iconClass)} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h3 className="truncate text-[14px] font-semibold text-zinc-900 dark:text-zinc-100">{title}</h3>
              <PrecompileRoleBadge
                precompileAddress={precompileAddress}
                minimumRole={minimumRole}
                refreshKey={roleRefreshKey}
                onRoleChange={onRoleChange}
                compact
              />
            </div>
            {subtitle && <p className="mt-0.5 text-[12px] text-zinc-500 dark:text-zinc-400">{subtitle}</p>}
            <button
              type="button"
              onClick={copyAddress}
              className="mt-2 inline-flex items-center gap-1.5 border border-zinc-200 bg-white px-2 py-0.5 font-mono text-[11px] text-zinc-600 transition-colors hover:border-zinc-400 hover:text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:border-zinc-600 dark:hover:text-zinc-100"
              title="Copy address"
            >
              {copied ? (
                <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <Copy className="w-3 h-3 text-zinc-400" />
              )}
              {precompileAddress}
            </button>
          </div>
        </div>
      </div>

      {/* Optional tab strip */}
      {tabs && tabs.length > 0 && (
        <div className="flex shrink-0 overflow-x-auto border-b border-zinc-200 dark:border-zinc-800">
          {tabs.map((tab) => {
            const TabIcon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange?.(tab.id)}
                className={cn(
                  '-mb-px flex items-center gap-1.5 whitespace-nowrap border-b-2 px-4 py-2.5 font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] transition-colors',
                  isActive
                    ? 'border-zinc-900 text-zinc-900 dark:border-zinc-100 dark:text-zinc-100'
                    : 'border-transparent text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100',
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
        <div className="shrink-0 border-t border-zinc-200 bg-zinc-50/60 px-4 py-2.5 dark:border-zinc-800 dark:bg-zinc-900/40">
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
        'flex items-center justify-between gap-3 border border-zinc-200 bg-zinc-50/60 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900/40',
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        <span className="text-[12px] font-medium text-zinc-700 dark:text-zinc-300">{label}</span>
        {hint && <p className="truncate text-[11px] text-zinc-500 dark:text-zinc-400">{hint}</p>}
      </div>
      <span
        className={cn(
          'max-w-[60%] shrink-0 truncate font-mono text-[12px]',
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
    <div className="overflow-hidden border border-zinc-200 dark:border-zinc-800">
      {collapsible ? (
        <button
          onClick={() => setOpen(!open)}
          className="group/grp flex w-full items-center justify-between bg-zinc-50/60 px-3 py-2 transition-colors dark:bg-zinc-900/40"
        >
          <div className="text-left">
            <span className="font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
              {title}
            </span>
            {description && <p className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">{description}</p>}
          </div>
          {open ? (
            <ChevronDown className="h-3.5 w-3.5 text-zinc-400 transition-colors group-hover/grp:text-[#E6212F]" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-zinc-400 transition-colors group-hover/grp:text-[#E6212F]" />
          )}
        </button>
      ) : (
        <div className="border-b border-zinc-200 bg-zinc-50/60 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900/40">
          <span className="font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
            {title}
          </span>
          {description && <p className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">{description}</p>}
        </div>
      )}
      {(!collapsible || open) && <div className="space-y-2 p-3">{children}</div>}
    </div>
  );
}
