import { useMemo, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { User } from 'lucide-react';
import type { RequirementAction, Requirement } from '../types/requirements';
import { useLoginModalTrigger } from '@/hooks/useLoginModal';

export enum AccountRequirementsConfigKey {
  UserLoggedIn = 'userLoggedIn',
}

/**
 * Dev-only bypass for the Builder Hub account check.
 *
 * On `next dev` (NODE_ENV !== 'production') or when the app is being
 * served from localhost / 127.0.0.1, the UserLoggedIn requirement is
 * auto-satisfied so contributors don't have to stand up a full
 * NextAuth session loop just to click through a tool. Production builds
 * served from real domains still enforce the check exactly as before.
 *
 * The backend (e.g. quick-l1 /deploy) still validates session-derived
 * userId server-side, so this is strictly a UI-convenience escape —
 * actions that require the account will fail downstream in dev if the
 * user hasn't logged in for real. But browsing/previewing a gated tool
 * no longer requires a round-trip through the login modal.
 */
function isDevLocalhostBypass(): boolean {
  if (process.env.NODE_ENV !== 'production') return true;
  if (typeof window === 'undefined') return false;
  const h = window.location.hostname;
  return h === 'localhost' || h === '127.0.0.1';
}

// Reusable action constants for account requirements
const ACCOUNT_ACTIONS = {
  LOGIN: {
    type: 'login' as const,
    label: 'Log In',
    title: 'Log In to Builder Hub',
    description: 'You need to be logged in to use this feature',
  },
} as const;

interface AccountState {
  isAuthenticated: boolean;
  isLoading: boolean;
}

interface AccountRequirementConfig {
  id: string;
  title: string;
  description: string;
  icon: any;
  action: RequirementAction;
  alternativeActions?: RequirementAction[];
  prerequisites?: AccountRequirementsConfigKey[];
  getStatus: (accountState: AccountState) => { met: boolean; waiting: boolean };
}

// Constants for each account requirement type
const ACCOUNT_REQUIREMENTS: Record<AccountRequirementsConfigKey, AccountRequirementConfig> = {
  [AccountRequirementsConfigKey.UserLoggedIn]: {
    id: 'user-logged-in',
    title: 'Builder Hub Account',
    description: 'You need to be logged in to Builder Hub',
    icon: User,
    action: ACCOUNT_ACTIONS.LOGIN,
    getStatus: (accountState: AccountState) => ({
      met: accountState.isAuthenticated,
      waiting: accountState.isLoading,
    }),
  },
};

export function useAccountRequirements(configKey: AccountRequirementsConfigKey | AccountRequirementsConfigKey[]): {
  requirements: Requirement[];
  allRequirementsMet: boolean;
  unmetRequirements: Requirement[];
  handleAction: (requirement: Requirement) => void;
} {
  const session = useSession();
  const status = session?.status || 'loading';
  const { openLoginModal } = useLoginModalTrigger();

  // Memoized to stabilise the value for the duration of the mount — the
  // hostname shouldn't change without a navigation, and re-evaluating on
  // every render would invalidate accountState's memo unnecessarily.
  const devBypass = useMemo(() => isDevLocalhostBypass(), []);

  const isAuthenticated: boolean = devBypass || status === 'authenticated';
  // Don't get stuck in a "loading" state on localhost — when bypass is
  // active, we're synchronously authenticated from frame 0.
  const isLoading: boolean = !devBypass && status === 'loading';

  // Create account state object
  const accountState: AccountState = useMemo(
    () => ({
      isAuthenticated,
      isLoading,
    }),
    [isAuthenticated, isLoading],
  );

  // Action handler dispatcher
  const handleAction = useCallback(
    (requirement: Requirement) => {
      if (!requirement.action) {
        return;
      }

      const action = requirement.action;

      switch (action.type) {
        case 'redirect':
          if ('link' in action) {
            window.open(action.link, action.target || '_self');
          }
          break;
        case 'login':
          // Use embedded login modal instead of redirect
          openLoginModal();
          break;
        default:
          break;
      }
    },
    [openLoginModal],
  );

  // Function to recursively collect all prerequisites in dependency order
  const collectAllRequirements = useCallback((keys: AccountRequirementsConfigKey[]): AccountRequirementsConfigKey[] => {
    const result: AccountRequirementsConfigKey[] = [];
    const visited = new Set<AccountRequirementsConfigKey>();

    const collectRecursive = (key: AccountRequirementsConfigKey) => {
      if (visited.has(key)) return;
      visited.add(key);

      const requirement = ACCOUNT_REQUIREMENTS[key];
      if (!requirement) return;

      // First, recursively add prerequisites
      if (requirement.prerequisites) {
        for (const prereqKey of requirement.prerequisites) {
          collectRecursive(prereqKey);
        }
      }

      // Then add current requirement
      result.push(key);
    };

    for (const key of keys) {
      collectRecursive(key);
    }

    return result;
  }, []);

  // Build requirements array
  const requirements: Requirement[] = useMemo(() => {
    const requestedKeys: AccountRequirementsConfigKey[] = Array.isArray(configKey) ? configKey : [configKey];
    const allKeys: AccountRequirementsConfigKey[] = collectAllRequirements(requestedKeys);

    return allKeys.map((key: AccountRequirementsConfigKey): Requirement => {
      const requirement = ACCOUNT_REQUIREMENTS[key];

      let prerequisiteNotMet: AccountRequirementsConfigKey | undefined;
      let met = false;
      let waiting = false;
      let resolvedAction: RequirementAction | null = requirement.action;

      if (requirement.prerequisites) {
        for (const prereqKey of requirement.prerequisites) {
          const prereqRequirement = ACCOUNT_REQUIREMENTS[prereqKey];
          const prereqStatus = prereqRequirement.getStatus(accountState);

          if (!prereqStatus.met || prereqStatus.waiting) {
            prerequisiteNotMet = prereqKey;
            met = false;
            waiting = true;
            break;
          }
        }
      }

      // If all prerequisites are met, check the actual requirement
      if (!prerequisiteNotMet) {
        const status = requirement.getStatus(accountState);
        met = status.met;
        waiting = status.waiting;
      }

      const result: Requirement = {
        id: requirement.id,
        title: requirement.title,
        description: requirement.description,
        icon: requirement.icon,
        action: resolvedAction,
        alternativeActions: requirement.alternativeActions,
        met,
        waiting,
        prerequisiteNotMet: prerequisiteNotMet as string | undefined,
      };
      return result;
    });
  }, [configKey, accountState, collectAllRequirements]);

  // Check if all requirements are met
  const allRequirementsMet: boolean = useMemo(() => {
    return requirements.every((req: Requirement) => req.met && !req.waiting);
  }, [requirements]);

  // Get unmet requirements
  const unmetRequirements: Requirement[] = useMemo(() => {
    return requirements.filter((req: Requirement) => !req.met || req.waiting);
  }, [requirements]);

  return {
    requirements,
    allRequirementsMet,
    unmetRequirements,
    handleAction,
  };
}
