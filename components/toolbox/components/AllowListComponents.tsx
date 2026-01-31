"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useWalletStore } from "../stores/walletStore";
import { useViemChainStore } from "../stores/toolboxStore";
import { Button } from "./Button";
import { EVMAddressInput } from "./EVMAddressInput";
import { ResultField } from "./ResultField";
import allowListAbi from "../../../contracts/precompiles/AllowList.json";
import { useConnectedWallet } from "../contexts/ConnectedWalletContext";
import { cn } from "../lib/utils";
import { Shield, Search, UserPlus, UserMinus, ChevronDown } from "lucide-react";

// Role definitions
const ROLES = {
  admin: { value: 2, label: "Admin", description: "Can manage all roles", function: "setAdmin" },
  manager: { value: 3, label: "Manager", description: "Can manage enabled addresses", function: "setManager" },
  enabled: { value: 1, label: "Enabled", description: "Can use the precompile", function: "setEnabled" },
  none: { value: 0, label: "None (Remove)", description: "Remove all permissions", function: "setNone" },
} as const;

type RoleKey = keyof typeof ROLES;

const ROLE_LABELS: Record<number, string> = {
  0: "None",
  1: "Enabled",
  2: "Admin",
  3: "Manager",
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

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  return (
    <div className="relative" ref={dropdownRef}>
      <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
        Role
      </label>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={cn(
          "w-full flex items-center justify-between px-3 py-2.5 rounded-lg border text-left transition-colors",
          "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700",
          "hover:border-zinc-300 dark:hover:border-zinc-600",
          disabled && "opacity-50 cursor-not-allowed",
          isOpen && "ring-2 ring-blue-500 border-blue-500"
        )}
      >
        <div>
          <span className="font-medium text-zinc-900 dark:text-zinc-100">{ROLES[value].label}</span>
          <span className="ml-2 text-xs text-zinc-500 dark:text-zinc-400">{ROLES[value].description}</span>
        </div>
        <ChevronDown className={cn("w-4 h-4 text-zinc-500 transition-transform", isOpen && "rotate-180")} />
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg overflow-hidden">
          {(Object.entries(ROLES) as [RoleKey, typeof ROLES[RoleKey]][]).map(([key, role]) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                onChange(key);
                setIsOpen(false);
              }}
              className={cn(
                "w-full flex items-center justify-between px-3 py-2.5 text-left transition-colors",
                "hover:bg-zinc-50 dark:hover:bg-zinc-800",
                value === key && "bg-blue-50 dark:bg-blue-900/20"
              )}
            >
              <div>
                <span className={cn(
                  "font-medium",
                  value === key ? "text-blue-600 dark:text-blue-400" : "text-zinc-900 dark:text-zinc-100"
                )}>
                  {role.label}
                </span>
                <span className="ml-2 text-xs text-zinc-500 dark:text-zinc-400">{role.description}</span>
              </div>
              {value === key && (
                <div className="w-2 h-2 rounded-full bg-blue-500" />
              )}
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
}

function SetRoleForm({
  precompileAddress,
  precompileType = "precompiled contract",
  abi = allowListAbi.abi,
  onSuccess,
  onFunctionChange,
}: SetRoleFormProps) {
  const { publicClient, walletEVMAddress, walletChainId } = useWalletStore();
  const { coreWalletClient } = useConnectedWallet();
  const viemChain = useViemChainStore();
  const [isProcessing, setIsProcessing] = useState(false);
  const [address, setAddress] = useState<string>("");
  const [role, setRole] = useState<RoleKey>("enabled");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSetRole = async () => {
    setIsProcessing(true);
    setError(null);
    setTxHash(null);

    try {
      const functionName = ROLES[role].function;
      const hash = await coreWalletClient.writeContract({
        address: precompileAddress as `0x${string}`,
        abi: abi,
        functionName,
        args: [address],
        account: walletEVMAddress as `0x${string}`,
        chain: viemChain,
        gas: BigInt(1_000_000),
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      if (receipt.status === "success") {
        setTxHash(hash);
        onSuccess?.();
      } else {
        setError("Transaction failed");
      }
    } catch (error) {
      console.error("Setting role failed:", error);
      if (error instanceof Error) {
        if (error.message.includes("Failed to fetch")) {
          setError(
            `Failed to connect to the network. Please ensure you are connected to the correct L1 chain (Current Chain ID: ${walletChainId})`
          );
        } else {
          setError(error.message);
        }
      } else {
        setError("An unknown error occurred");
      }
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
    if (!walletEVMAddress) return "Connect Wallet";
    if (role === "none") return `Remove from ${precompileType} Allowlist`;
    return `Set ${ROLES[role].label} Role`;
  }, [walletEVMAddress, role, precompileType]);

  const buttonIcon = role === "none" ? UserMinus : UserPlus;
  const ButtonIcon = buttonIcon;

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-3 text-sm text-red-700 bg-red-50 dark:bg-red-900/20 dark:text-red-400 rounded-lg border border-red-200 dark:border-red-800">
          {error}
        </div>
      )}

      <EVMAddressInput
        label="Address"
        value={address}
        onChange={setAddress}
        disabled={isProcessing}
      />

      <RoleSelector
        value={role}
        onChange={handleRoleChange}
        disabled={isProcessing}
      />

      <Button
        onClick={handleSetRole}
        loading={isProcessing}
        variant={role === "none" ? "secondary" : "primary"}
        disabled={!canSetRole}
        className="w-full flex items-center justify-center gap-2"
      >
        <ButtonIcon className="w-4 h-4" />
        {buttonText}
      </Button>

      {txHash && (
        <ResultField
          label="Transaction Successful"
          value={txHash}
          showCheck={true}
        />
      )}
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
  precompileType = "precompiled contract",
  abi = allowListAbi.abi,
}: ReadRoleFormProps) {
  const { publicClient } = useWalletStore();
  const [isReading, setIsReading] = useState(false);
  const [readAddress, setReadAddress] = useState<string>("");
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
        functionName: "readAllowList",
        args: [readAddress],
      });

      setReadResult(Number(result));
    } catch (error) {
      console.error("Reading failed:", error);
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError("An unknown error occurred");
      }
    } finally {
      setIsReading(false);
    }
  };

  const canRead = Boolean(readAddress && !isReading);

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-3 text-sm text-red-700 bg-red-50 dark:bg-red-900/20 dark:text-red-400 rounded-lg border border-red-200 dark:border-red-800">
          {error}
        </div>
      )}

      <EVMAddressInput
        label="Address to Check"
        value={readAddress}
        onChange={setReadAddress}
        disabled={isReading}
      />

      <Button
        onClick={handleRead}
        loading={isReading}
        variant="secondary"
        disabled={!canRead}
        className="w-full flex items-center justify-center gap-2"
      >
        <Search className="w-4 h-4" />
        Check Role
      </Button>

      {readResult !== null && (
        <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg border border-zinc-200 dark:border-zinc-700">
          <div className="flex items-center justify-between">
            <span className="text-sm text-zinc-600 dark:text-zinc-400">Current Role:</span>
            <span className={cn(
              "px-2.5 py-1 rounded-full text-xs font-medium",
              readResult === 0 && "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400",
              readResult === 1 && "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400",
              readResult === 2 && "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400",
              readResult === 3 && "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400",
            )}>
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
}

export function AllowlistRoleManager({
  precompileAddress,
  precompileType = "precompiled contract",
  abi = allowListAbi.abi,
  onSuccess,
  onFunctionChange,
}: AllowlistRoleManagerProps) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
          <Shield className="w-5 h-5 text-purple-600 dark:text-purple-400" />
        </div>
        <div>
          <h3 className="font-medium text-zinc-900 dark:text-zinc-100">Manage Permissions</h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Set or check address roles for {precompileType}
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Set Role Section */}
        <div className="p-4 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50">
          <h4 className="text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-4">Set Role</h4>
          <SetRoleForm
            precompileAddress={precompileAddress}
            precompileType={precompileType}
            abi={abi}
            onSuccess={onSuccess}
            onFunctionChange={onFunctionChange}
          />
        </div>

        {/* Check Role Section */}
        <div className="p-4 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50">
          <h4 className="text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-4">Check Role</h4>
          <ReadRoleForm
            precompileAddress={precompileAddress}
            precompileType={precompileType}
            abi={abi}
          />
        </div>
      </div>
    </div>
  );
}

// Wrapper component for backwards compatibility with existing components
export function AllowlistComponent({
  precompileAddress,
  precompileType = "precompiled contract",
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
    />
  );
}
