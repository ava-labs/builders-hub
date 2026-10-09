'use client';

import { RadioGroup } from '../RadioGroup';
import Allowlist from './AllowList';
import { AddressEntry, AllowlistPrecompileConfig } from './types';
import { AlertCircle } from 'lucide-react';

const hasErrors = (entries: AddressEntry[]) => entries.some((entry) => entry.error !== undefined);

const isValidAllowlistPrecompileConfig = (config: AllowlistPrecompileConfig): boolean => {
  if (!config.activated) return true;

  //check if at least one role has a valid address that is not required
  if (
    config.addresses.Admin.filter((entry: AddressEntry) => !entry.requiredReason && !entry.error).length === 0 &&
    config.addresses.Manager.filter((entry: AddressEntry) => !entry.requiredReason && !entry.error).length === 0 &&
    config.addresses.Enabled.filter((entry: AddressEntry) => !entry.requiredReason && !entry.error).length === 0
  )
    return false;

  return !Object.values(config.addresses).some((entries) => hasErrors(entries as AddressEntry[]));
};

interface AllowlistPrecompileConfiguratorProps {
  title: string;
  description: string;
  precompileAction: string;
  config: AllowlistPrecompileConfig;
  onUpdateConfig: (newConfig: AllowlistPrecompileConfig) => void;
  radioOptionFalseLabel: string;
  radioOptionTrueLabel: string;
  validationError?: string;
  showActivationToggle?: boolean;
}

const simpleHash = (str: string): string => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16);
};

export default function AllowlistPrecompileConfigurator({
  title,
  description,
  precompileAction,
  config,
  onUpdateConfig,
  radioOptionFalseLabel,
  radioOptionTrueLabel,
  validationError,
  showActivationToggle = true,
}: AllowlistPrecompileConfiguratorProps) {
  const handleUpdateAllowlist = (newAddresses: AllowlistPrecompileConfig['addresses']) => {
    onUpdateConfig({ ...config, addresses: newAddresses });
  };

  const handleActivatedChange = (value: string) => {
    onUpdateConfig({ ...config, activated: value === 'true' });
  };

  const internalValidationError = !isValidAllowlistPrecompileConfig(config);

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-2 mt-4 font-medium text-zinc-800 dark:text-white">{title}</div>
        <p className="text-zinc-500 dark:text-zinc-400">{description}</p>
      </div>

      {showActivationToggle && (
        <RadioGroup
          value={config.activated ? 'true' : 'false'}
          onChange={handleActivatedChange}
          className="space-y-2"
          idPrefix={`allowlist-${simpleHash(precompileAction)}-`}
          items={[
            { value: 'false', label: radioOptionFalseLabel },
            { value: 'true', label: radioOptionTrueLabel },
          ]}
        />
      )}

      {config.activated && (
        <div className={`transition-all duration-1000 h-auto`}>
          <Allowlist
            addresses={config.addresses}
            onUpdateAllowlist={handleUpdateAllowlist}
            precompileAction={precompileAction}
          />
        </div>
      )}

      {validationError && (
        <div className="mt-2 text-red-500 dark:text-red-400 text-sm flex items-center">
          <AlertCircle className="h-4 w-4 mr-1" />
          {validationError}
        </div>
      )}

      {!validationError && internalValidationError && (
        <div className="mt-4 flex items-start border border-red-200 bg-red-50/60 px-4 py-3 dark:border-red-900/60 dark:bg-red-950/20">
          <AlertCircle className="mr-3 mt-0.5 h-4 w-4 flex-shrink-0 text-red-600 dark:text-red-400" />
          <div>
            <p className="font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-red-700 dark:text-red-400">
              Configuration Error
            </p>
            <ul className="mt-1 list-inside list-disc text-[13px] text-red-800 dark:text-red-300">
              <li>Add at least one valid, non-duplicate address to any role.</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
