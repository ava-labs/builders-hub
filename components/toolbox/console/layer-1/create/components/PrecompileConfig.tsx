import React from 'react';
import { Address } from 'viem';

export interface AddressEntry {
    id: string;
    address: Address;
}

export interface PrecompileAddresses {
    Admin: AddressEntry[];
    Manager: AddressEntry[];
    Enabled: AddressEntry[];
}

export interface PrecompileConfigData {
    activated: boolean;
    addresses: PrecompileAddresses;
}

interface RoleConfig {
    key: keyof PrecompileAddresses;
    label: string;
    description: string;
    buttonText: string;
}

interface PrecompileConfigProps {
    title: string;
    config: PrecompileConfigData;
    onConfigChange: (config: PrecompileConfigData) => void;
    walletAddress?: string;
    roles?: RoleConfig[];
    disabled?: boolean;
    disabledMessage?: string;
}

const defaultRoles: RoleConfig[] = [
    {
        key: 'Admin',
        label: 'Admin Addresses',
        description: 'Can grant/revoke roles',
        buttonText: '+ Add admin'
    },
    {
        key: 'Manager',
        label: 'Manager Addresses',
        description: 'Can enable/disable addresses',
        buttonText: '+ Add manager'
    },
    {
        key: 'Enabled',
        label: 'Enabled Addresses',
        description: 'Can use this precompile',
        buttonText: '+ Add enabled address'
    }
];

export function PrecompileConfig({
    title,
    config,
    onConfigChange,
    walletAddress,
    roles = defaultRoles,
    disabled = false,
    disabledMessage
}: PrecompileConfigProps) {
    const handleToggle = (checked: boolean) => {
        if (disabled) return;
        
        if (!checked) {
            onConfigChange({
                activated: false,
                addresses: {
                    Admin: [],
                    Manager: [],
                    Enabled: []
                }
            });
        } else {
            onConfigChange({
                activated: true,
                addresses: {
                    Admin: walletAddress ? [{ id: '1', address: walletAddress as Address }] : [],
                    Manager: [],
                    Enabled: []
                }
            });
        }
    };

    const handleAddressChange = (role: keyof PrecompileAddresses, idx: number, value: string) => {
        const newConfig = { ...config };
        newConfig.addresses[role][idx].address = value as Address;
        onConfigChange(newConfig);
    };

    const handleRemoveAddress = (role: keyof PrecompileAddresses, id: string) => {
        const newConfig = { ...config };
        newConfig.addresses[role] = newConfig.addresses[role].filter(a => a.id !== id);
        onConfigChange(newConfig);
    };

    const handleAddAddress = (role: keyof PrecompileAddresses) => {
        const newConfig = { ...config };
        const newId = Date.now().toString();
        newConfig.addresses[role].push({ id: newId, address: '' as Address });
        onConfigChange(newConfig);
    };

    return (
        <div className={`border border-zinc-200 dark:border-zinc-700 rounded-lg p-3 ${disabled ? 'opacity-60' : ''}`}>
            <label className={`flex items-center space-x-2 ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                <input
                    type="checkbox"
                    checked={config.activated}
                    onChange={(e) => handleToggle(e.target.checked)}
                    disabled={disabled}
                    className="rounded border-zinc-300 dark:border-zinc-700 text-blue-500 focus:ring-blue-500"
                />
                <span className="text-sm text-zinc-700 dark:text-zinc-300 font-medium">{title}</span>
            </label>
            
            {disabled && disabledMessage && (
                <p className="text-xs text-zinc-500 dark:text-zinc-500 mt-2 pl-6">{disabledMessage}</p>
            )}
            
            {!disabled && config.activated && (
                <div className="mt-3 pl-6 space-y-3">
                    {roles.map((role) => (
                        <div key={role.key}>
                            <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                                {role.label}
                            </label>
                            <p className="text-xs text-zinc-500 dark:text-zinc-500 mb-1">
                                {role.description}
                            </p>
                            {config.addresses[role.key].map((entry, idx) => (
                                <div key={entry.id} className="flex gap-1 mb-1">
                                    <input
                                        type="text"
                                        value={entry.address}
                                        onChange={(e) => handleAddressChange(role.key, idx, e.target.value)}
                                        className="flex-1 px-2 py-1 text-xs border border-zinc-300 dark:border-zinc-700 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-zinc-900 dark:text-white"
                                        placeholder="0x..."
                                    />
                                    <button
                                        onClick={() => handleRemoveAddress(role.key, entry.id)}
                                        className="px-2 py-1 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                                    >
                                        ✕
                                    </button>
                                </div>
                            ))}
                            <button
                                onClick={() => handleAddAddress(role.key)}
                                className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700"
                            >
                                {role.buttonText}
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// Simple admin-only precompile component
interface SimplePrecompileConfigProps {
    title: string;
    enabled: boolean;
    admins: Address[];
    onToggle: (enabled: boolean) => void;
    onAdminsChange: (admins: Address[]) => void;
    walletAddress?: string;
    adminDescription?: string;
}

export function SimplePrecompileConfig({
    title,
    enabled,
    admins,
    onToggle,
    onAdminsChange,
    walletAddress,
    adminDescription = 'Can configure settings'
}: SimplePrecompileConfigProps) {
    const handleToggle = (checked: boolean) => {
        onToggle(checked);
        if (checked && walletAddress) {
            onAdminsChange([walletAddress as Address]);
        } else if (!checked) {
            onAdminsChange([]);
        }
    };

    const handleAdminChange = (idx: number, value: string) => {
        const newAdmins = [...admins];
        newAdmins[idx] = value as Address;
        onAdminsChange(newAdmins);
    };

    const handleRemoveAdmin = (idx: number) => {
        onAdminsChange(admins.filter((_, i) => i !== idx));
    };

    const handleAddAdmin = () => {
        onAdminsChange([...admins, '' as Address]);
    };

    return (
        <div className="border border-zinc-200 dark:border-zinc-700 rounded-lg p-3">
            <label className="flex items-center space-x-2 cursor-pointer">
                <input
                    type="checkbox"
                    checked={enabled}
                    onChange={(e) => handleToggle(e.target.checked)}
                    className="rounded border-zinc-300 dark:border-zinc-700 text-blue-500 focus:ring-blue-500"
                />
                <span className="text-sm text-zinc-700 dark:text-zinc-300 font-medium">{title}</span>
            </label>
            
            {enabled && (
                <div className="mt-3 pl-6">
                    <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                        Admin Addresses
                    </label>
                    <p className="text-xs text-zinc-500 dark:text-zinc-500 mb-1">
                        {adminDescription}
                    </p>
                    {admins.map((address, idx) => (
                        <div key={idx} className="flex gap-1 mb-1">
                            <input
                                type="text"
                                value={address}
                                onChange={(e) => handleAdminChange(idx, e.target.value)}
                                className="flex-1 px-2 py-1 text-xs border border-zinc-300 dark:border-zinc-700 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-zinc-900 dark:text-white"
                                placeholder="0x..."
                            />
                            <button
                                onClick={() => handleRemoveAdmin(idx)}
                                className="px-2 py-1 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                            >
                                ✕
                            </button>
                        </div>
                    ))}
                    <button
                        onClick={handleAddAdmin}
                        className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700"
                    >
                        + Add admin
                    </button>
                </div>
            )}
        </div>
    );
}
