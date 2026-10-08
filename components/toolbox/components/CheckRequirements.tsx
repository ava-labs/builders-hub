import { useState, useEffect } from 'react';
import { Button } from './Button';
import { CheckCircle2, XCircle, Wallet, Loader2, CircleMinus, CircleHelp, AlertCircle } from 'lucide-react';
import { useWalletRequirements, WalletRequirementsConfigKey } from '../hooks/useWalletRequirements';
import { useAccountRequirements, AccountRequirementsConfigKey } from '../hooks/useAccountRequirements';
import { ConnectedWalletProvider } from '../contexts/ConnectedWalletContext';
import type { Requirement } from '../types/requirements';

// Export config key enums for convenience
export { WalletRequirementsConfigKey, AccountRequirementsConfigKey };

export type RequirementsConfigKey = WalletRequirementsConfigKey | AccountRequirementsConfigKey;

interface CheckRequirementsProps {
  children: React.ReactNode;
  toolRequirements: RequirementsConfigKey[];
}

interface RequirementsState {
  isActive: boolean;
  isLoading: boolean;
  error: string | null;
}

const EYEBROW = 'font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400';
const PANEL = 'w-full max-w-md border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950';

// Type guard to check if a key is a WalletRequirementsConfigKey
function isWalletRequirementKey(key: RequirementsConfigKey): key is WalletRequirementsConfigKey {
  return Object.values(WalletRequirementsConfigKey).includes(key as WalletRequirementsConfigKey);
}

export const CheckRequirements = ({ children, toolRequirements }: CheckRequirementsProps) => {
  // Separate wallet requirements from account requirements
  const walletRequirementKeys = toolRequirements.filter((key) =>
    isWalletRequirementKey(key),
  ) as WalletRequirementsConfigKey[];
  const accountRequirementKeys = toolRequirements.filter(
    (key) => !isWalletRequirementKey(key),
  ) as AccountRequirementsConfigKey[];

  // Use both hooks - they will handle empty arrays gracefully
  const walletRequirementsData = useWalletRequirements(walletRequirementKeys);
  const accountRequirementsData = useAccountRequirements(accountRequirementKeys);

  // Merge requirements from both hooks
  const requirements = [...walletRequirementsData.requirements, ...accountRequirementsData.requirements];

  // All requirements must be met from both sources
  const allRequirementsMet = walletRequirementsData.allRequirementsMet && accountRequirementsData.allRequirementsMet;

  // Combined action handler that delegates to the appropriate hook
  const handleAction = (requirement: Requirement): void => {
    // Check if this is a wallet requirement by looking at its ID
    const isWalletReq = walletRequirementsData.requirements.some((r) => r.id === requirement.id);
    if (isWalletReq) {
      walletRequirementsData.handleAction(requirement);
    } else {
      accountRequirementsData.handleAction(requirement);
    }
  };

  const hasWalletRequirements = walletRequirementKeys.length > 0;
  const [state, setState] = useState<RequirementsState>({
    isActive: false,
    isLoading: true,
    error: null,
  });
  const [isHydrated, setIsHydrated] = useState(false);

  // Handle hydration
  useEffect(() => {
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (!isHydrated) return;

    const checkRequirements = async () => {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      setTimeout(() => {
        if (allRequirementsMet) {
          setState({ isLoading: false, isActive: true, error: null });
        } else {
          setState({ isLoading: false, isActive: false, error: null });
        }
      }, 100);
    };

    checkRequirements();
  }, [allRequirementsMet, isHydrated]);

  if (state.isLoading) {
    return (
      <div className="flex h-[100vh] items-center justify-center p-4">
        <div className={`${PANEL} flex items-center justify-center gap-2 px-6 py-8`}>
          <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />
          <p className={EYEBROW}>Checking requirements…</p>
        </div>
      </div>
    );
  }

  if (state.error) {
    return (
      <div className="flex h-[100vh] items-center justify-center p-4">
        <div className={PANEL}>
          <div className="border-b border-zinc-200 px-6 py-5 dark:border-zinc-800">
            <p className={EYEBROW}>Requirements</p>
            <h3 className="mt-1.5 text-[17px] font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">Error</h3>
          </div>
          <div className="px-6 py-5">
            <div className="flex items-start gap-3 border border-red-200 bg-red-50/60 px-4 py-3 text-[13px] leading-relaxed text-red-800 dark:border-red-900/60 dark:bg-red-950/20 dark:text-red-300">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
              <p className="min-w-0 break-words">Error checking requirements: {state.error}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!state.isActive) {
    return (
      <div className="not-prose flex h-[100vh] items-center justify-center p-4" data-console-tool-gate>
        <div className={PANEL}>
          {/* Header */}
          <div className="flex items-start gap-4 border-b border-zinc-200 px-6 py-5 dark:border-zinc-800">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
              <Wallet className="h-4 w-4 text-zinc-500 dark:text-zinc-400" />
            </span>
            <div className="min-w-0">
              <p className={EYEBROW}>Requirements</p>
              <h2 className="mt-1.5 text-[17px] font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                To use this tool you need:
              </h2>
            </div>
          </div>

          {/* Requirements List */}
          <ul className="divide-y divide-zinc-200 border-b border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {requirements.map((requirement) => (
              <li key={requirement.id} className="flex items-start gap-3 px-6 py-3">
                <div className="mt-0.5 shrink-0">
                  {requirement.prerequisiteNotMet ? (
                    <CircleMinus className="h-4 w-4 text-zinc-300 dark:text-zinc-600" />
                  ) : requirement.waiting ? (
                    <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />
                  ) : requirement.unknown ? (
                    <CircleHelp className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  ) : requirement.met ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <XCircle className="h-4 w-4 text-zinc-400 dark:text-zinc-500" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p
                    className={
                      requirement.met && !requirement.unknown
                        ? 'text-[13px] font-medium text-zinc-500 dark:text-zinc-400'
                        : 'text-[13px] font-medium text-zinc-900 dark:text-zinc-50'
                    }
                  >
                    {requirement.title}
                  </p>
                  {requirement.unknown && !requirement.waiting && !requirement.prerequisiteNotMet && (
                    <p className="mt-0.5 text-[12px] leading-relaxed text-amber-700 dark:text-amber-400">
                      Can&apos;t verify: the chain&apos;s RPC did not respond. You can proceed; fix the RPC URL if
                      actions fail.
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>

          {/* How to meet requirements section */}
          {(() => {
            const actionableRequirements = requirements.filter(
              (req) => !req.met && !req.waiting && !req.prerequisiteNotMet && req.action,
            );

            if (actionableRequirements.length === 0) {
              return null;
            }

            return (
              <div className="px-6 py-5">
                <h3 className={`${EYEBROW} mb-3`}>How to meet these requirements</h3>
                <div className="space-y-2">
                  {(() => {
                    const uniqueActions = new Map();

                    actionableRequirements.forEach((requirement) => {
                      const action = requirement.action!;
                      const actionKey = `${action.title}-${action.description}-${action.type === 'redirect' && 'link' in action ? action.link : ''}`;

                      if (!uniqueActions.has(actionKey)) {
                        uniqueActions.set(actionKey, {
                          action,
                          requirement,
                          relatedRequirements: [requirement.title],
                          isAlternative: false,
                        });
                      } else {
                        uniqueActions.get(actionKey).relatedRequirements.push(requirement.title);
                      }

                      if (requirement.alternativeActions) {
                        requirement.alternativeActions.forEach((altAction) => {
                          const altActionKey = `alt-${altAction.title}-${altAction.description}-${altAction.type === 'redirect' && 'link' in altAction ? altAction.link : ''}`;

                          if (!uniqueActions.has(altActionKey)) {
                            uniqueActions.set(altActionKey, {
                              action: altAction,
                              requirement: { ...requirement, action: altAction },
                              relatedRequirements: [requirement.title],
                              isAlternative: true,
                            });
                          } else {
                            uniqueActions.get(altActionKey).relatedRequirements.push(requirement.title);
                          }
                        });
                      }
                    });

                    const mainActions = Array.from(uniqueActions.values()).filter(
                      (actionGroup) => !actionGroup.isAlternative,
                    );
                    const alternativeActions = Array.from(uniqueActions.values()).filter(
                      (actionGroup) => actionGroup.isAlternative,
                    );

                    return (
                      <>
                        {mainActions.map((actionGroup, index) => (
                          <div
                            key={index}
                            className="flex items-center justify-between gap-4 border border-zinc-200 bg-zinc-50/60 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/40"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="text-[13px] font-medium text-zinc-900 dark:text-zinc-50">
                                {actionGroup.action.title}
                              </p>
                              <p className="mt-0.5 text-[12px] leading-relaxed text-zinc-500 dark:text-zinc-400">
                                {actionGroup.action.description}
                              </p>
                              {actionGroup.relatedRequirements.length > 1 && (
                                <p className="mt-1 font-mono text-[10.5px] uppercase tracking-[0.1em] text-zinc-400 dark:text-zinc-500">
                                  For: {actionGroup.relatedRequirements.join(', ')}
                                </p>
                              )}
                            </div>
                            <Button
                              onClick={() => handleAction(actionGroup.requirement)}
                              size="sm"
                              variant="primary"
                              className="w-auto shrink-0"
                            >
                              {actionGroup.action.label}
                            </Button>
                          </div>
                        ))}

                        {alternativeActions.length > 0 && (
                          <>
                            <div className="flex items-center gap-4 py-3">
                              <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
                              <span className="font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
                                Or
                              </span>
                              <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
                            </div>

                            <div className="space-y-2">
                              <h4 className={EYEBROW}>Just learning or testing?</h4>
                              {alternativeActions.map((actionGroup, index) => (
                                <div
                                  key={`alt-${index}`}
                                  className="flex items-center justify-between gap-4 border border-zinc-200 px-4 py-3 dark:border-zinc-800"
                                >
                                  <div className="min-w-0 flex-1">
                                    <p className="text-[13px] font-medium text-zinc-900 dark:text-zinc-50">
                                      {actionGroup.action.title}
                                    </p>
                                    <p className="mt-0.5 text-[12px] leading-relaxed text-zinc-500 dark:text-zinc-400">
                                      {actionGroup.action.description}
                                    </p>
                                    {actionGroup.relatedRequirements.length > 1 && (
                                      <p className="mt-1 font-mono text-[10.5px] uppercase tracking-[0.1em] text-zinc-400 dark:text-zinc-500">
                                        For: {actionGroup.relatedRequirements.join(', ')}
                                      </p>
                                    )}
                                  </div>
                                  <Button
                                    onClick={() => handleAction(actionGroup.requirement)}
                                    size="sm"
                                    variant="outline"
                                    className="w-auto shrink-0"
                                  >
                                    {actionGroup.action.label}
                                  </Button>
                                </div>
                              ))}
                            </div>
                          </>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    );
  }

  // Wrap with ConnectedWalletProvider only if there are wallet requirements
  return hasWalletRequirements ? <ConnectedWalletProvider>{children}</ConnectedWalletProvider> : <>{children}</>;
};
