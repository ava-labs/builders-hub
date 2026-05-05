'use client';

import { CheckCircle, XCircle, Loader2, CircleMinus, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { cn } from '../lib/utils';
import type { ValidatorPreflightResult, PreflightCheck } from '@/components/toolbox/hooks/useValidatorPreflight';

type FlowType = 'register' | 'initiate-removal' | 'complete-removal' | 'complete-registration';

interface ValidatorPreflightChecklistProps {
  preflight: ValidatorPreflightResult;
  currentFlow: FlowType;
}

const STATUS_BADGE_STYLES: Record<string, string> = {
  Unknown: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
  Pending: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  Active: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  Removing: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
  Completed: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
  Invalidated: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
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
 *  - met       → green CheckCircle
 *  - not_met   → gray XCircle
 *  - loading   → blue spinning Loader2
 *  - blocked   → gray CircleMinus
 */
function CheckIcon({ status }: { status: PreflightCheck['status'] }) {
  switch (status) {
    case 'met':
      return <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />;
    case 'not_met':
      return <XCircle className="h-5 w-5 text-red-400 flex-shrink-0" />;
    case 'loading':
      return <Loader2 className="h-5 w-5 text-blue-500 animate-spin flex-shrink-0" />;
    case 'blocked':
      return <CircleMinus className="h-5 w-5 text-zinc-300 dark:text-zinc-600 flex-shrink-0" />;
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
      <div className="rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 text-blue-500 animate-spin flex-shrink-0" />
          <span className="text-sm text-zinc-500 dark:text-zinc-400">Checking validator state...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (preflight.error) {
    return (
      <div className="rounded-2xl border border-red-200 dark:border-red-800/50 bg-red-50 dark:bg-red-900/10 p-4">
        <div className="flex items-center gap-3">
          <XCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
          <span className="text-sm text-red-700 dark:text-red-300">{preflight.error}</span>
        </div>
      </div>
    );
  }

  const checkItems = buildCheckItems(preflight, currentFlow);
  const badgeStyle = STATUS_BADGE_STYLES[preflight.statusLabel] ?? STATUS_BADGE_STYLES.Unknown;

  return (
    <div className="rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-zinc-500 dark:text-zinc-400" />
            <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              {FLOW_LABELS[currentFlow]} Preflight
            </span>
          </div>
          <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', badgeStyle)}>
            {preflight.statusLabel}
          </span>
        </div>

        {/* Validator metadata when available */}
        {(preflight.validatorData || preflight.stakingData) && (
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
            {preflight.validatorData && <span>Weight: {formatWeight(preflight.validatorData.weight)}</span>}
            {preflight.stakingData?.owner && <span>Owner: {truncateAddress(preflight.stakingData.owner)}</span>}
          </div>
        )}
      </div>

      {/* Checklist */}
      <div className="px-4 pb-4 space-y-3">
        {checkItems.map((item, index) => (
          <div key={index} className="space-y-1">
            <div className="flex items-center gap-3">
              <CheckIcon status={item.check.status} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-zinc-900 dark:text-white">{item.label}</p>
              </div>
            </div>

            {/* Reason for failure */}
            {item.check.status === 'not_met' && item.check.reason && (
              <p className="ml-8 text-xs text-zinc-500 dark:text-zinc-400">{item.check.reason}</p>
            )}

            {/* Suggestion link */}
            {item.check.status === 'not_met' && item.check.suggestion && (
              <div className="ml-8">
                <Link
                  href={item.check.suggestion.path}
                  className="inline-flex items-center text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                >
                  {item.check.suggestion.label} &rarr;
                </Link>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="shrink-0 px-4 py-2.5 border-t border-zinc-200/80 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 flex items-center justify-between">
        <span className="text-xs text-zinc-500">Validator lifecycle check</span>
        <span className="text-[11px] text-zinc-400 font-mono">on-chain</span>
      </div>
    </div>
  );
}
