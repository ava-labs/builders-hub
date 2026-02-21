"use client";

import { useState } from "react";
import { X, ChevronDown, ChevronUp, AlertTriangle, AlertCircle } from "lucide-react";
import { UpgradeEntry, PrecompileKey, PRECOMPILE_CONFIG_INFO, DEFAULT_FEE_CONFIG } from "./types";
import { AddressRoles, FeeConfigType } from "@/components/toolbox/components/genesis/types";
import AllowList from "@/components/toolbox/components/genesis/AllowList";

interface UpgradeEntryCardProps {
  entry: UpgradeEntry;
  index: number;
  errors: Record<string, string>;
  warnings: Record<string, string>;
  onUpdate: (patch: Partial<UpgradeEntry>) => void;
  onRemove: () => void;
}

function unixToDatetimeLocal(unix: number): string {
  const d = new Date(unix * 1000);
  // Format: YYYY-MM-DDTHH:mm
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function datetimeLocalToUnix(value: string): number {
  return Math.floor(new Date(value).getTime() / 1000);
}

const PRECOMPILE_OPTIONS = Object.entries(PRECOMPILE_CONFIG_INFO).map(([key, info]) => ({
  key: key as PrecompileKey,
  label: info.name,
  address: info.address,
}));

export default function UpgradeEntryCard({
  entry,
  index,
  errors,
  warnings,
  onUpdate,
  onRemove,
}: UpgradeEntryCardProps) {
  const [collapsed, setCollapsed] = useState(false);
  const prefix = `entry_${index}`;
  const hasError = Object.keys(errors).some(k => k.startsWith(prefix));
  const hasWarning = Object.keys(warnings).some(k => k.startsWith(prefix));

  const info = PRECOMPILE_CONFIG_INFO[entry.precompileKey];
  const isAllowlistPrecompile = info.hasAllowlist;

  // Build AddressRoles from flat arrays for AllowList component
  const addressRoles: AddressRoles = {
    Admin: entry.adminAddresses,
    Manager: entry.managerAddresses,
    Enabled: entry.enabledAddresses,
  };

  const handleAllowlistChange = (newAddresses: AddressRoles) => {
    onUpdate({
      adminAddresses: newAddresses.Admin,
      managerAddresses: newAddresses.Manager,
      enabledAddresses: newAddresses.Enabled,
    });
  };

  const handlePrecompileChange = (key: PrecompileKey) => {
    onUpdate({
      precompileKey: key,
      adminAddresses: [],
      managerAddresses: [],
      enabledAddresses: [],
      initialFeeConfig: undefined,
      allowFeeRecipients: undefined,
      rewardAddress: undefined,
      quorumNumerator: key === 'warpConfig' ? 67 : undefined,
    });
  };

  const feeConfig: FeeConfigType = entry.initialFeeConfig ?? DEFAULT_FEE_CONFIG;

  return (
    <div className={`border rounded-lg bg-card ${hasError ? 'border-red-400 dark:border-red-600' : hasWarning ? 'border-amber-400 dark:border-amber-600' : 'border-border'}`}>
      {/* Header */}
      <div className="flex items-center gap-2 p-4">
        <button
          type="button"
          onClick={() => setCollapsed(c => !c)}
          className="flex-1 flex items-center gap-2 text-left"
        >
          <span className="text-xs font-mono text-muted-foreground w-6">#{index + 1}</span>
          <select
            value={entry.precompileKey}
            onChange={e => handlePrecompileChange(e.target.value as PrecompileKey)}
            onClick={e => e.stopPropagation()}
            className="flex-1 text-sm font-medium bg-transparent border-none outline-none cursor-pointer text-foreground"
          >
            {PRECOMPILE_OPTIONS.map(opt => (
              <option key={opt.key} value={opt.key}>
                {opt.label} ({opt.address.slice(0, 10)}…)
              </option>
            ))}
          </select>
          {hasError && <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />}
          {!hasError && hasWarning && <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0" />}
          {collapsed ? <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" /> : <ChevronUp className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
        </button>
        <button
          type="button"
          onClick={onRemove}
          title="Remove entry"
          className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {!collapsed && (
        <div className="px-4 pb-4 space-y-4 border-t border-border pt-4">
          {/* Block Timestamp */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">Block Timestamp</label>
            <input
              type="datetime-local"
              value={unixToDatetimeLocal(entry.blockTimestamp)}
              onChange={e => {
                const unix = datetimeLocalToUnix(e.target.value);
                if (!isNaN(unix)) onUpdate({ blockTimestamp: unix });
              }}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <p className="text-xs text-muted-foreground">Unix timestamp: <span className="font-mono">{entry.blockTimestamp}</span></p>
            {errors[`${prefix}_timestamp`] && (
              <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle className="h-3 w-3" />{errors[`${prefix}_timestamp`]}</p>
            )}
            {!errors[`${prefix}_timestamp`] && warnings[`${prefix}_timestamp`] && (
              <p className="text-xs text-amber-500 flex items-center gap-1"><AlertTriangle className="h-3 w-3" />{warnings[`${prefix}_timestamp`]}</p>
            )}
          </div>

          {/* Action */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Action</label>
            <div className="flex gap-4">
              {(['enable', 'disable'] as const).map(action => (
                <label key={action} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name={`action-${entry.id}`}
                    value={action}
                    checked={entry.action === action}
                    onChange={() => onUpdate({ action })}
                    className="accent-primary"
                  />
                  <span className="text-sm capitalize">{action}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Enable-only configuration */}
          {entry.action === 'enable' && (
            <div className="space-y-4">
              {/* Allowlist addresses for non-warp precompiles */}
              {isAllowlistPrecompile && (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Configure which addresses have Admin, Manager, and Enabled roles for this precompile.
                  </p>
                  <AllowList
                    addresses={addressRoles}
                    onUpdateAllowlist={handleAllowlistChange}
                    precompileAction={entry.precompileKey}
                  />
                  {errors[`${prefix}_addresses`] && (
                    <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle className="h-3 w-3" />{errors[`${prefix}_addresses`]}</p>
                  )}
                </div>
              )}

              {/* Fee Manager: optional initialFeeConfig */}
              {entry.precompileKey === 'feeManagerConfig' && (
                <div className="space-y-2 pt-2 border-t border-border">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!entry.initialFeeConfig}
                      onChange={e =>
                        onUpdate({ initialFeeConfig: e.target.checked ? { ...DEFAULT_FEE_CONFIG } : undefined })
                      }
                      className="accent-primary"
                    />
                    <span className="text-sm font-medium">Set initial fee configuration</span>
                  </label>
                  {entry.initialFeeConfig && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pl-6">
                      {(
                        [
                          ['minBaseFee', 'Min Base Fee (wei)'],
                          ['targetGas', 'Target Gas'],
                          ['baseFeeChangeDenominator', 'Base Fee Change Denominator'],
                          ['minBlockGasCost', 'Min Block Gas Cost'],
                          ['maxBlockGasCost', 'Max Block Gas Cost'],
                          ['blockGasCostStep', 'Block Gas Cost Step'],
                        ] as [keyof FeeConfigType, string][]
                      ).map(([field, label]) => (
                        <div key={field} className="space-y-1">
                          <label className="text-xs font-medium text-muted-foreground">{label}</label>
                          <input
                            type="number"
                            value={feeConfig[field]}
                            onChange={e => {
                              const val = parseInt(e.target.value);
                              if (!isNaN(val)) {
                                onUpdate({ initialFeeConfig: { ...feeConfig, [field]: val } });
                              }
                            }}
                            className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Reward Manager: optional initial reward config */}
              {entry.precompileKey === 'rewardManagerConfig' && (
                <div className="space-y-3 pt-2 border-t border-border">
                  <p className="text-sm font-medium">Initial Reward Configuration <span className="text-muted-foreground font-normal">(optional)</span></p>
                  <div className="space-y-2">
                    {[
                      { value: 'none', label: 'No initial config' },
                      { value: 'allowFeeRecipients', label: 'Allow fee recipients' },
                      { value: 'rewardAddress', label: 'Set reward address' },
                    ].map(opt => (
                      <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name={`rewardConfig-${entry.id}`}
                          value={opt.value}
                          checked={
                            opt.value === 'none'
                              ? !entry.allowFeeRecipients && !entry.rewardAddress
                              : opt.value === 'allowFeeRecipients'
                              ? !!entry.allowFeeRecipients
                              : !entry.allowFeeRecipients && !!entry.rewardAddress
                          }
                          onChange={() => {
                            if (opt.value === 'none') {
                              onUpdate({ allowFeeRecipients: undefined, rewardAddress: undefined });
                            } else if (opt.value === 'allowFeeRecipients') {
                              onUpdate({ allowFeeRecipients: true, rewardAddress: undefined });
                            } else {
                              onUpdate({ allowFeeRecipients: undefined, rewardAddress: entry.rewardAddress ?? '' });
                            }
                          }}
                          className="accent-primary"
                        />
                        <span className="text-sm">{opt.label}</span>
                      </label>
                    ))}
                  </div>
                  {!entry.allowFeeRecipients && entry.rewardAddress !== undefined && (
                    <div className="space-y-1 pl-6">
                      <input
                        type="text"
                        value={entry.rewardAddress}
                        onChange={e => onUpdate({ rewardAddress: e.target.value })}
                        placeholder="0x..."
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                      {errors[`${prefix}_rewardAddress`] && (
                        <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle className="h-3 w-3" />{errors[`${prefix}_rewardAddress`]}</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Warp Config: quorumNumerator */}
              {entry.precompileKey === 'warpConfig' && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    Quorum Numerator <span className="text-muted-foreground font-normal">(1–100, default 67)</span>
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={entry.quorumNumerator ?? 67}
                    onChange={e => {
                      const val = parseInt(e.target.value);
                      if (!isNaN(val)) onUpdate({ quorumNumerator: val });
                    }}
                    className="w-32 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  {errors[`${prefix}_quorumNumerator`] && (
                    <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle className="h-3 w-3" />{errors[`${prefix}_quorumNumerator`]}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    The fraction of stake weight required to sign a Warp message (numerator out of 100).
                    The default of 67 means 67% of stake weight must sign.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
