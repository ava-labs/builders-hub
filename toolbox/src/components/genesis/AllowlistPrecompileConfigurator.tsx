"use client"

import { RadioGroup } from "../RadioGroup"
import Allowlist from './AllowList'
import { AddressEntry, AllowlistPrecompileConfig } from "./types";
import { AlertCircle } from "lucide-react"

const hasErrors = (entries: AddressEntry[]) =>
    entries.some(entry => entry.error !== undefined);

const isValidAllowlistPrecompileConfig = (config: AllowlistPrecompileConfig): boolean => {
    if (!config.activated) return true;

    //check if at least one role has a valid address that is not required
    if (
        config.addresses.Admin.filter((entry: AddressEntry) => !entry.requiredReason && !entry.error).length === 0
        && config.addresses.Manager.filter((entry: AddressEntry) => !entry.requiredReason && !entry.error).length === 0
        && config.addresses.Enabled.filter((entry: AddressEntry) => !entry.requiredReason && !entry.error).length === 0
    ) return false;

    return !Object.values(config.addresses).some(entries => hasErrors(entries as AddressEntry[]));
}

interface AllowlistPrecompileConfiguratorProps {
    title: string
    description: string
    precompileAction: string
    config: AllowlistPrecompileConfig
    onUpdateConfig: (newConfig: AllowlistPrecompileConfig) => void
    radioOptionFalseLabel: string
    radioOptionTrueLabel: string
    validationError?: string
}

const simpleHash = (str: string): string => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16);
}

export default function AllowlistPrecompileConfigurator({
    title,
    description,
    precompileAction,
    config,
    onUpdateConfig,
    radioOptionFalseLabel,
    radioOptionTrueLabel,
    validationError
}: AllowlistPrecompileConfiguratorProps) {
    const handleUpdateAllowlist = (newAddresses: AllowlistPrecompileConfig['addresses']) => {
        onUpdateConfig({ ...config, addresses: newAddresses })
    }

    const handleActivatedChange = (value: string) => {
        onUpdateConfig({ ...config, activated: value === 'true' })
    }

    const internalValidationError = !isValidAllowlistPrecompileConfig(config);

    return (
        <div className="space-y-6">
            <div>
                <div className="mb-2 mt-4 font-medium text-zinc-800 dark:text-white">{title}</div>
                <p className="text-zinc-500 dark:text-zinc-400">{description} The permission for adding and removing addresses from the allowlist as well as granting and revoking other addresses these permissions can be granted to an EOR or a smart contract.</p>
            </div>

            <RadioGroup
                value={config.activated ? 'true' : 'false'}
                onChange={handleActivatedChange}
                className="space-y-2"
                idPrefix={`allowlist-${simpleHash(precompileAction)}-`}
                items={[
                    { value: "false", label: radioOptionFalseLabel },
                    { value: "true", label: radioOptionTrueLabel }
                ]}
            />


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
                <div className="mt-4 p-4 border-l-4 border-red-500 bg-red-50/70 dark:bg-red-900/20 dark:border-red-800/60 rounded-r-md flex items-start">
                    <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 mr-3 flex-shrink-0" />
                    <div>
                        <p className="text-red-700 dark:text-red-300 font-medium">Configuration Error</p>
                        <ul className="mt-1 text-red-600 dark:text-red-400 text-sm list-disc list-inside">
                            <li>Add at least one valid, non-duplicate address to any role.</li>
                        </ul>
                    </div>
                </div>
            )}
        </div>
    )
}

