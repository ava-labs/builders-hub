'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { useWalletStore } from '../stores/walletStore';
import { Button } from './Button';
import { EVMAddressInput } from './EVMAddressInput';
import { ResultField } from './ResultField';
import allowListAbi from '../../../contracts/precompiles/AllowList.json';
import { useContractActions } from '../hooks/contracts/useContractActions';
import { cn } from '../lib/utils';
import { Shield, Search, UserPlus, UserMinus, ChevronDown, Check } from 'lucide-react';

// Role definitions
const ROLES = {
  admin: { value: 2, label: 'Admin', description: 'Can manage all roles', function: 'setAdmin' },
  manager: { value: 3, label: 'Manager', description: 'Can manage enabled addresses', function: 'setManager' },
  enabled: { value: 1, label: 'Enabled', description: 'Can use the precompile', function: 'setEnabled' },
  none: { value: 0, label: 'None (Remove)', description: 'Remove all permissions', function: 'setNone' },
} as const;

type RoleKey = keyof typeof ROLES;

const ROLE_LABELS: Record<number, string> = {
  0: 'None',
  1: 'Enabled',
  2: 'Admin',
  3: 'Manager',
};

interface RoleSelectorProps {
  value: RoleKey;
  onChange: (role: RoleKey) => void;
  disabled?: boolean;
}

function RoleSelector({ value, onChange, disabled }: RoleSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  return (
    <div className="relative" ref={dropdownRef}>
      <label className="mb-2 block font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
        Role
      </label>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={cn(
          'flex h-10 w-full items-center justify-between border px-3 text-left text-[13px] transition-colors focus:outline-none',
          'bg-white dark:bg-zinc-950',
          isOpen
            ? 'border-zinc-900 dark:border-zinc-300'
            : 'border-zinc-200 hover:border-zinc-400 focus:border-zinc-900 dark:border-zinc-800 dark:hover:border-zinc-600 dark:focus:border-zinc-300',
          disabled && 'cursor-not-allowed opacity-50',
        )}
      >
        <div>
          <span className="font-medium text-zinc-900 dark:text-zinc-100">{ROLES[value].label}</span>
          <span className="ml-2 text-[12px] text-zinc-500 dark:text-zinc-400">{ROLES[value].description}</span>
        </div>
        <ChevronDown className={cn('h-3.5 w-3.5 text-zinc-400 transition-transform', isOpen && 'rotate-180')} />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-px w-full divide-y divide-zinc-200 overflow-hidden border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-950">
          {(Object.entries(ROLES) as [RoleKey, (typeof ROLES)[RoleKey]][]).map(([key, role]) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                onChange(key);
                setIsOpen(false);
              }}
              className={cn(
                'group/role relative flex w-full items-center justify-between px-3 py-2.5 text-left text-[13px] transition-colors',
                'before:absolute before:inset-y-0 before:left-0 before:w-0.5 before:transition-colors',
                value === key
                  ? 'before:bg-zinc-900 dark:before:bg-zinc-100'
                  : 'hover:before:bg-zinc-300 dark:hover:before:bg-zinc-600',
              )}
            >
              <div>
                <span
                  className={cn(
                    'font-medium text-zinc-900 underline-offset-4 group-hover/role:underline dark:text-zinc-100',
                    value === key && 'font-semibold',
                  )}
                >
                  {role.label}
                </span>
                <span className="ml-2 text-[12px] text-zinc-500 dark:text-zinc-400">{role.description}</span>
              </div>
              {value === key && <Check className="h-3.5 w-3.5 text-zinc-900 dark:text-zinc-100" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface SetRoleFormProps {
  precompileAddress: string;
  precompileType?: string;
  abi?: any;
  onSuccess?: () => void;
  onFunctionChange?: (fn: string) => void;
  defaultAddress?: string;
}

function SetRoleForm({
  precompileAddress,
  precompileType = 'precompiled contract',
  abi = allowListAbi.abi,
  onSuccess,
  onFunctionChange,
  defaultAddress,
}: SetRoleFormProps) {
  const { publicClient, walletEVMAddress } = useWalletStore();
  const [isProcessing, setIsProcessing] = useState(false);
  const [address, setAddress] = useState<string>(defaultAddress || '');
  const [role, setRole] = useState<RoleKey>('enabled');
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Routes the role-set tx through the canonical write path so it
  // pre-flight simulates, fires the console toast, and lands a row in
  // the tx-history store the same way every other modern toolbox
  // contract action does. Because every consumer of AllowlistComponent /
  // AllowlistRoleManager flows through this form, fixing it here covers
  // DeployerAllowlist, TransactionAllowlist, FeeManager (allowlist tab),
  // RewardManager (allowlist tab), and EnableStakingManagerMinting in
  // a single edit.
  const actions = useContractActions(precompileAddress, abi);

  useEffect(() => {
    if (defaultAddress && !address) {
      setAddress(defaultAddress);
    }
  }, [defaultAddress]);

  const handleSetRole = async () => {
    setIsProcessing(true);
    setError(null);
    setTxHash(null);

    try {
      const functionName = ROLES[role].function;
      const hash = await actions.write(functionName, [address], `Set ${ROLES[role].label} role on ${precompileType}`, {
        gas: 1_000_000n,
      });

      // Local receipt wait — the toast tracks status independently, but
      // we still need to know when the chain is settled before calling
      // onSuccess (which typically refreshes role badges / tables).
      const receipt = await publicClient.waitForTransactionReceipt({ hash: hash as `0x${string}` });

      if (receipt.status === 'success') {
        setTxHash(hash);
        onSuccess?.();
      } else {
        setError('Transaction failed');
      }
    } catch (err) {
      // useContractActions already runs the message through
      // parseContractError; surface the message verbatim instead of
      // re-wrapping. Fall back to a generic line if we somehow got a
      // non-Error throw.
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRoleChange = (newRole: RoleKey) => {
    setRole(newRole);
    onFunctionChange?.(ROLES[newRole].function);
  };

  const canSetRole = Boolean(address && walletEVMAddress && !isProcessing);

  const buttonText = useMemo(() => {
    if (!walletEVMAddress) return 'Connect Wallet';
    if (role === 'none') return `Remove from ${precompileType} Allowlist`;
    return `Set ${ROLES[role].label} Role`;
  }, [walletEVMAddress, role, precompileType]);

  const buttonIcon = role === 'none' ? UserMinus : UserPlus;
  const ButtonIcon = buttonIcon;

  return (
    <div className="space-y-4">
      {error && (
        <div className="border border-red-200 bg-red-50/60 p-3 text-[13px] text-red-800 dark:border-red-900/60 dark:bg-red-950/20 dark:text-red-300">
          {error}
        </div>
      )}

      <EVMAddressInput label="Address" value={address} onChange={setAddress} disabled={isProcessing} />

      <RoleSelector value={role} onChange={handleRoleChange} disabled={isProcessing} />

      <Button
        onClick={handleSetRole}
        loading={isProcessing}
        variant={role === 'none' ? 'secondary' : 'primary'}
        disabled={!canSetRole}
        className="w-full flex items-center justify-center gap-2"
      >
        <ButtonIcon className="h-3.5 w-3.5" />
        {buttonText}
      </Button>

      {txHash && <ResultField label="Transaction Successful" value={txHash} showCheck={true} />}
    </div>
  );
}

interface ReadRoleFormProps {
  precompileAddress: string;
  precompileType?: string;
  abi?: any;
}

function ReadRoleForm({
  precompileAddress,
  precompileType: _precompileType = 'precompiled contract',
  abi = allowListAbi.abi,
}: ReadRoleFormProps) {
  const { publicClient } = useWalletStore();
  const [isReading, setIsReading] = useState(false);
  const [readAddress, setReadAddress] = useState<string>('');
  const [readResult, setReadResult] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRead = async () => {
    setIsReading(true);
    setError(null);
    setReadResult(null);

    try {
      const result = await publicClient.readContract({
        address: precompileAddress as `0x${string}`,
        abi: abi,
        functionName: 'readAllowList',
        args: [readAddress],
      });

      setReadResult(Number(result));
    } catch (error) {
      console.error('Reading failed:', error);
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError('An unknown error occurred');
      }
    } finally {
      setIsReading(false);
    }
  };

  const canRead = Boolean(readAddress && !isReading);

  return (
    <div className="space-y-4">
      {error && (
        <div className="border border-red-200 bg-red-50/60 p-3 text-[13px] text-red-800 dark:border-red-900/60 dark:bg-red-950/20 dark:text-red-300">
          {error}
        </div>
      )}

      <EVMAddressInput label="Address to Check" value={readAddress} onChange={setReadAddress} disabled={isReading} />

      <Button
        onClick={handleRead}
        loading={isReading}
        variant="secondary"
        disabled={!canRead}
        className="w-full flex items-center justify-center gap-2"
      >
        <Search className="h-3.5 w-3.5" />
        Check Role
      </Button>

      {readResult !== null && (
        <div className="border border-zinc-200 bg-zinc-50/60 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/40">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
              Current Role
            </span>
            <span
              className={cn(
                'border px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.12em]',
                readResult === 0 &&
                  'border-zinc-200 bg-zinc-50/60 text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-400',
                readResult === 1 &&
                  'border-emerald-200 bg-emerald-50/60 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/20 dark:text-emerald-300',
                readResult === 2 &&
                  'border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900',
                readResult === 3 &&
                  'border-zinc-900 bg-white text-zinc-900 dark:border-zinc-300 dark:bg-zinc-950 dark:text-zinc-100',
              )}
            >
              {ROLE_LABELS[readResult] || `Unknown (${readResult})`}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// Export for use with precompile code viewer
export interface AllowlistRoleManagerProps {
  precompileAddress: string;
  precompileType?: string;
  abi?: any;
  onSuccess?: () => void;
  onFunctionChange?: (fn: string) => void;
  defaultAddress?: string;
}

export function AllowlistRoleManager({
  precompileAddress,
  precompileType = 'precompiled contract',
  abi = allowListAbi.abi,
  onSuccess,
  onFunctionChange,
  defaultAddress,
}: AllowlistRoleManagerProps) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="border border-zinc-200 bg-zinc-50/60 p-2 dark:border-zinc-800 dark:bg-zinc-900/40">
          <Shield className="h-4 w-4 text-zinc-700 dark:text-zinc-300" />
        </div>
        <div>
          <h3 className="text-[14px] font-semibold text-zinc-900 dark:text-zinc-100">Manage Permissions</h3>
          <p className="text-[12px] text-zinc-500 dark:text-zinc-400">
            Set or check address roles for {precompileType}
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Set Role Section */}
        <div className="border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <h4 className="mb-4 font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
            Set Role
          </h4>
          <SetRoleForm
            precompileAddress={precompileAddress}
            precompileType={precompileType}
            abi={abi}
            onSuccess={onSuccess}
            onFunctionChange={onFunctionChange}
            defaultAddress={defaultAddress}
          />
        </div>

        {/* Check Role Section */}
        <div className="border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <h4 className="mb-4 font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
            Check Role
          </h4>
          <ReadRoleForm precompileAddress={precompileAddress} precompileType={precompileType} abi={abi} />
        </div>
      </div>
    </div>
  );
}

// Wrapper component for backwards compatibility with existing components
export function AllowlistComponent({
  precompileAddress,
  precompileType = 'precompiled contract',
  abi = allowListAbi.abi,
  onSuccess,
  defaultEnabledAddress,
}: {
  precompileAddress: string;
  precompileType?: string;
  abi?: any;
  onSuccess?: () => void;
  defaultEnabledAddress?: string;
}) {
  return (
    <AllowlistRoleManager
      precompileAddress={precompileAddress}
      precompileType={precompileType}
      abi={abi}
      onSuccess={onSuccess}
      defaultAddress={defaultEnabledAddress}
    />
  );
}
