'use client';

import { ArrowRight, CheckCircle, XCircle, Loader2, CircleMinus, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { cn } from '../lib/utils';
import type { ValidatorPreflightResult, PreflightCheck } from '@/components/toolbox/hooks/useValidatorPreflight';

type FlowType = 'register' | 'initiate-removal' | 'complete-removal' | 'complete-registration';

interface ValidatorPreflightChecklistProps {
  preflight: ValidatorPreflightResult;
  currentFlow: FlowType;
}

const STATUS_BADGE_STYLES: Record<string, string> = {
  Unknown: 'border-zinc-200 text-zinc-500 dark:border-zinc-800 dark:text-zinc-400',
  Pending: 'border-zinc-300 text-zinc-700 dark:border-zinc-700 dark:text-zinc-300',
  Active: 'border-emerald-200 text-emerald-700 dark:border-emerald-900/60 dark:text-emerald-400',
  Removing: 'border-amber-200 text-amber-700 dark:border-amber-900/60 dark:text-amber-400',
  Completed: 'border-zinc-200 text-zinc-500 dark:border-zinc-800 dark:text-zinc-400',
  Invalidated: 'border-red-200 text-red-700 dark:border-red-900/60 dark:text-red-400',
};

const FLOW_LABELS: Record<FlowType, string> = {
  register: 'Registration',
  'initiate-removal': 'Initiate Removal',
  'complete-removal': 'Complete Removal',
  'complete-registration': 'Complete Registration',
};

/**
 * Maps a flow type to its corresponding check key in the preflight result.
 */
function getFlowCheck(preflight: ValidatorPreflightResult, flow: FlowType): PreflightCheck {
  switch (flow) {
    case 'register':
      return preflight.checks.register;
    case 'initiate-removal':
      return preflight.checks.initiateRemoval;
    case 'complete-removal':
      return preflight.checks.completeRemoval;
    case 'complete-registration':
      return preflight.checks.completeRegistration;
  }
}

/**
 * Renders the appropriate status icon for a preflight check.
 * Follows the same icon pattern as CheckRequirements:
 *  - met       → emerald CheckCircle
 *  - not_met   → gray XCircle
 *  - loading   → spinning Loader2
 *  - blocked   → gray CircleMinus
 */
function CheckIcon({ status }: { status: PreflightCheck['status'] }) {
  switch (status) {
    case 'met':
      return <CheckCircle className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />;
    case 'not_met':
      return <XCircle className="h-4 w-4 shrink-0 text-red-500 dark:text-red-400" />;
    case 'loading':
      return <Loader2 className="h-4 w-4 shrink-0 animate-spin text-zinc-400" />;
    case 'blocked':
      return <CircleMinus className="h-4 w-4 shrink-0 text-zinc-300 dark:text-zinc-600" />;
  }
}

/**
 * Builds the list of display items to render for a given flow.
 * Each item corresponds to a prerequisite or the main flow check itself.
 */
function buildCheckItems(
  preflight: ValidatorPreflightResult,
  currentFlow: FlowType,
): Array<{ label: string; check: PreflightCheck }> {
  const items: Array<{ label: string; check: PreflightCheck }> = [];

  // Always show the main flow check
  const mainCheck = getFlowCheck(preflight, currentFlow);

  switch (currentFlow) {
    case 'register':
      items.push({ label: 'Node not already registered', check: mainCheck });
      break;

    case 'initiate-removal':
      items.push({ label: 'Validator is active', check: mainCheck });
      if (preflight.churn) {
        const percentAvailable =
          preflight.churn.maxBudget > 0n
            ? Number((preflight.churn.remainingBudget * 100n) / preflight.churn.maxBudget)
            : 0;
        items.push({
          label: `Churn budget: ${percentAvailable}% available`,
          check: {
            status: preflight.churn.remainingBudget > 0n ? 'met' : 'not_met',
            reason: preflight.churn.remainingBudget > 0n ? null : 'Churn budget exhausted for this period',
            suggestion: null,
          },
        });
      }
      break;

    case 'complete-removal':
      items.push({ label: 'Removal has been initiated', check: mainCheck });
      break;

    case 'complete-registration':
      items.push({ label: 'Registration is pending', check: mainCheck });
      break;
  }

  return items;
}

/**
 * Truncates a hex address or owner string for display.
 */
function truncateAddress(addr: string): string {
  if (addr.length <= 14) return addr;
  return `${addr.slice(0, 8)}...${addr.slice(-6)}`;
}

/**
 * Formats a raw validator weight for display.
 * Weights are raw values from the contract, NOT denominated in nanotokens.
 */
function formatWeight(weight: bigint): string {
  return weight.toLocaleString();
}

export function ValidatorPreflightChecklist({ preflight, currentFlow }: ValidatorPreflightChecklistProps) {
  // Loading state — show skeleton
  if (preflight.isLoading) {
    return (
      <div className="border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 px-4 py-3">
        <div className="flex items-center gap-3">
          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-zinc-400" />
          <span className="font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
            Checking validator state…
          </span>
        </div>
      </div>
    );
  }

  // Error state
  if (preflight.error) {
    return (
      <div className="border border-red-200 bg-red-50/60 px-4 py-3 dark:border-red-900/60 dark:bg-red-950/20">
        <div className="flex items-center gap-3">
          <XCircle className="h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
          <span className="text-[13px] text-red-800 dark:text-red-300">{preflight.error}</span>
        </div>
      </div>
    );
  }

  const checkItems = buildCheckItems(preflight, currentFlow);
  const badgeStyle = STATUS_BADGE_STYLES[preflight.statusLabel] ?? STATUS_BADGE_STYLES.Unknown;

  return (
    <div className="border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 overflow-hidden">
      {/* Header */}
      <div className="space-y-2 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-3.5 w-3.5 text-zinc-400" />
            <span className="font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
              {FLOW_LABELS[currentFlow]} Preflight
            </span>
          </div>
          <span
            className={cn(
              'border px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.12em]',
              badgeStyle,
            )}
          >
            {preflight.statusLabel}
          </span>
        </div>

        {/* Validator metadata when available */}
        {(preflight.validatorData || preflight.stakingData) && (
          <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
            {preflight.validatorData && <span>Weight: {formatWeight(preflight.validatorData.weight)}</span>}
            {preflight.stakingData?.owner && <span>Owner: {truncateAddress(preflight.stakingData.owner)}</span>}
          </div>
        )}
      </div>

      {/* Checklist */}
      <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
        {checkItems.map((item, index) => (
          <div key={index} className="space-y-1 px-4 py-3">
            <div className="flex items-center gap-3">
              <CheckIcon status={item.check.status} />
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-zinc-900 dark:text-zinc-50">{item.label}</p>
              </div>
            </div>

            {/* Reason for failure */}
            {item.check.status === 'not_met' && item.check.reason && (
              <p className="ml-7 text-[12px] text-zinc-500 dark:text-zinc-400">{item.check.reason}</p>
            )}

            {/* Suggestion link */}
            {item.check.status === 'not_met' && item.check.suggestion && (
              <div className="ml-7">
                <Link
                  href={item.check.suggestion.path}
                  className="group/sug inline-flex items-center gap-1 font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-zinc-900 underline-offset-4 hover:underline dark:text-zinc-100"
                >
                  {item.check.suggestion.label}
                  <ArrowRight className="h-3 w-3 text-[#E6212F] transition-transform group-hover/sug:translate-x-0.5" />
                </Link>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="flex shrink-0 items-center justify-between border-t border-zinc-200 bg-zinc-50/60 px-4 py-2 dark:border-zinc-800 dark:bg-zinc-900/40">
        <span className="text-[12px] text-zinc-500 dark:text-zinc-400">Validator lifecycle check</span>
        <span className="text-[11px] text-zinc-400 font-mono">on-chain</span>
      </div>
    </div>
  );
}
