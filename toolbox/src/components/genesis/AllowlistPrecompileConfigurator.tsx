"use client"

import { RadioGroup } from "../RadioGroup"
import Allowlist from './AllowList'
import { AddressEntry, AllowlistPrecompileConfig } from "./types";

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
    radioOptionTrueLabel
}: AllowlistPrecompileConfiguratorProps) {
    const handleUpdateAllowlist = (newAddresses: AllowlistPrecompileConfig['addresses']) => {
        onUpdateConfig({ ...config, addresses: newAddresses })
    }

    const handleActivatedChange = (value: string) => {
        onUpdateConfig({ ...config, activated: value === 'true' })
    }

    return (
        <div className="space-y-6">
            <div>
                <h3 className="mb-4 font-medium">{title}</h3>
                <p className="text-gray-600">{description} These addresses can be controlled by an EOR or a smart contract.</p>
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

            {!isValidAllowlistPrecompileConfig(config) && (
                <p className="text-red-500">There are errors in the allowlist configuration. Add at least one address to at least one role (required addresses do not count). The same address can only be added to a single role.</p>
            )}
        </div>
    )
}

