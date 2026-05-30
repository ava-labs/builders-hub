'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { Shield, ShieldCheck, ShieldAlert, ShieldX, RefreshCw, Wallet } from 'lucide-react';
import allowListAbi from '@/contracts/precompiles/AllowList.json';
import { useWalletStore } from '../stores/walletStore';
import { cn } from '../lib/utils';

export type PrecompileRole = 0 | 1 | 2 | 3;

export const ROLE_NAMES: Record<PrecompileRole, string> = {
  0: 'None',
  1: 'Enabled',
  2: 'Admin',
  3: 'Manager',
};

const ROLE_DESCRIPTIONS: Record<PrecompileRole, string> = {
  0: 'No permissions — calls will revert',
  1: 'Can use precompile functions',
  2: 'Can manage all roles + use functions',
  3: 'Can manage Enabled roles + use functions',
};

const ROLE_STYLES: Record<
  PrecompileRole,
  { wrapper: string; icon: React.ComponentType<{ className?: string }>; iconColor: string }
> = {
  0: {
    wrapper: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border-red-200 dark:border-red-900/50',
    icon: ShieldX,
    iconColor: 'text-red-500',
  },
  1: {
    wrapper:
      'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900/50',
    icon: ShieldCheck,
    iconColor: 'text-emerald-500',
  },
  2: {
    wrapper:
      'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-900/50',
    icon: ShieldAlert,
    iconColor: 'text-purple-500',
  },
  3: {
    wrapper: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-900/50',
    icon: Shield,
    iconColor: 'text-blue-500',
  },
};

export interface PrecompileRoleBadgeProps {
  /** Precompile contract address (e.g. 0x0200…0001) */
  precompileAddress: string;
  /** Optional ABI override — defaults to standard AllowList. */
  abi?: any;
  /** Minimum role required to call write functions on this precompile. */
  minimumRole?: PrecompileRole;
  /** Compact display (omits role description). */
  compact?: boolean;
  className?: string;
  /** Re-read on tx success or other external events. */
  refreshKey?: number;
  /** Notifies parent of role changes so callers can disable Submit when role is insufficient. */
  onRoleChange?: (role: PrecompileRole | null) => void;
}

/**
 * PrecompileRoleBadge
 * Reads the connected wallet's role on a precompile's AllowList and renders a colored pill.
 * Lets users see *before* they submit whether the tx will succeed.
 */
export function PrecompileRoleBadge({
  precompileAddress,
  abi = allowListAbi.abi,
  minimumRole = 1,
  compact = false,
  className,
  refreshKey = 0,
  onRoleChange,
}: PrecompileRoleBadgeProps) {
  const { publicClient, walletEVMAddress } = useWalletStore();
  const [role, setRole] = useState<PrecompileRole | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Stash the callback in a ref so we can refresh without re-running the effect when
  // a parent passes an inline arrow function for onRoleChange.
  const onRoleChangeRef = useRef(onRoleChange);
  useEffect(() => {
    onRoleChangeRef.current = onRoleChange;
  }, [onRoleChange]);

  const refresh = useCallback(async () => {
    if (!walletEVMAddress) {
      setRole(null);
      onRoleChangeRef.current?.(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await publicClient.readContract({
        address: precompileAddress as `0x${string}`,
        abi,
        functionName: 'readAllowList',
        args: [walletEVMAddress],
      });
      const roleNum = Number(result) as PrecompileRole;
      setRole(roleNum);
      onRoleChangeRef.current?.(roleNum);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to read role';
      setError(msg);
      setRole(null);
      onRoleChangeRef.current?.(null);
    } finally {
      setLoading(false);
    }
  }, [publicClient, walletEVMAddress, precompileAddress, abi]);

  useEffect(() => {
    refresh();
  }, [refresh, refreshKey]);

  // No wallet connected
  if (!walletEVMAddress) {
    return (
      <div
        className={cn(
          'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium',
          'bg-zinc-50 dark:bg-zinc-900/50 text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800',
          className,
        )}
      >
        <Wallet className="w-3.5 h-3.5" />
        Wallet not connected
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={cn(
          'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium',
          'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-900/50',
          className,
        )}
        title={error}
      >
        Role unknown
        <button onClick={refresh} className="hover:opacity-70" aria-label="Retry">
          <RefreshCw className="w-3 h-3" />
        </button>
      </div>
    );
  }

  if (role === null || loading) {
    return (
      <div
        className={cn(
          'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium',
          'bg-zinc-50 dark:bg-zinc-900/50 text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800',
          className,
        )}
      >
        <RefreshCw className="w-3 h-3 animate-spin" />
        Checking role…
      </div>
    );
  }

  const style = ROLE_STYLES[role];
  const Icon = style.icon;
  const insufficient = role < minimumRole;

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium',
        style.wrapper,
        className,
      )}
      title={compact ? `${ROLE_NAMES[role]} — ${ROLE_DESCRIPTIONS[role]}` : undefined}
    >
      <Icon className={cn('w-3.5 h-3.5', style.iconColor)} />
      <span>{ROLE_NAMES[role]}</span>
      {!compact && (
        <span className="text-[10px] font-normal opacity-80 hidden sm:inline">
          {insufficient ? '— not authorized' : `— ${ROLE_DESCRIPTIONS[role]}`}
        </span>
      )}
      <button onClick={refresh} className="hover:opacity-70 ml-0.5" aria-label="Refresh role" title="Refresh role">
        <RefreshCw className={cn('w-3 h-3', loading && 'animate-spin')} />
      </button>
    </div>
  );
}

/**
 * Hook variant — gives parent components access to the role state.
 */
export function usePrecompileRole(
  precompileAddress: string,
  abi: any = allowListAbi.abi,
): { role: PrecompileRole | null; loading: boolean; refresh: () => Promise<void>; error: string | null } {
  const { publicClient, walletEVMAddress } = useWalletStore();
  const [role, setRole] = useState<PrecompileRole | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!walletEVMAddress) {
      setRole(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await publicClient.readContract({
        address: precompileAddress as `0x${string}`,
        abi,
        functionName: 'readAllowList',
        args: [walletEVMAddress],
      });
      setRole(Number(result) as PrecompileRole);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to read role');
    } finally {
      setLoading(false);
    }
  }, [publicClient, walletEVMAddress, precompileAddress, abi]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { role, loading, refresh, error };
}
