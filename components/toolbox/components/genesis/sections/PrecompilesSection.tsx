import { Dispatch, SetStateAction, useCallback } from 'react';
import { Address } from 'viem';
import { SectionWrapper } from '../SectionWrapper';
import AllowlistPrecompileConfigurator from '../AllowlistPrecompileConfigurator';
import { AllowlistPrecompileConfig } from '../types';
import { Textarea as TextArea } from '../../TextArea';
import { AddConnectedWalletButton } from '@/components/toolbox/components/ConnectWallet/AddConnectedWalletButton';
import { useGenesisHighlight } from '../GenesisHighlightContext';
import { cn } from '@/lib/cn';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Info } from 'lucide-react';

type PrecompilesSectionProps = {
    deployerConfig: AllowlistPrecompileConfig;
    setDeployerConfig: Dispatch<SetStateAction<AllowlistPrecompileConfig>>;
    txConfig: AllowlistPrecompileConfig;
    setTxConfig: Dispatch<SetStateAction<AllowlistPrecompileConfig>>;
    nativeMinterConfig: AllowlistPrecompileConfig;
    setNativeMinterConfig: Dispatch<SetStateAction<AllowlistPrecompileConfig>>;
    feeManagerEnabled: boolean;
    setFeeManagerEnabled: Dispatch<SetStateAction<boolean>>;
    feeManagerAdmins: Address[];
    setFeeManagerAdmins: Dispatch<SetStateAction<Address[]>>;
    rewardManagerEnabled: boolean;
    setRewardManagerEnabled: Dispatch<SetStateAction<boolean>>;
    rewardManagerAdmins: Address[];
    setRewardManagerAdmins: Dispatch<SetStateAction<Address[]>>;
    compact?: boolean;
    validationErrors: { [key: string]: string };
    walletAddress?: Address; // Add wallet address for auto-filling
};

export const PrecompilesSection = ({
    deployerConfig,
    setDeployerConfig,
    txConfig,
    setTxConfig,
    nativeMinterConfig,
    setNativeMinterConfig,
    feeManagerEnabled,
    setFeeManagerEnabled,
    feeManagerAdmins,
    setFeeManagerAdmins,
    rewardManagerEnabled,
    setRewardManagerEnabled,
    rewardManagerAdmins,
    setRewardManagerAdmins,
    compact,
    validationErrors,
    walletAddress
}: PrecompilesSectionProps) => {
    const { setHighlightPath, clearHighlight } = useGenesisHighlight();

    // Precompile addresses and descriptions
    const precompileInfo = {
        contractDeployer: {
            address: '0x0200000000000000000000000000000000000000',
            name: 'Contract Deployer Allow List',
            description: 'Controls who can deploy smart contracts on your blockchain. Restricts contract deployment to authorized addresses only.'
        },
        nativeMinter: {
            address: '0x0200000000000000000000000000000000000001',
            name: 'Native Minter',
            description: 'Allows authorized addresses to mint new native tokens, increasing the total supply on your blockchain.'
        },
        txAllowList: {
            address: '0x0200000000000000000000000000000000000002',
            name: 'Transaction Allow List',
            description: 'Restricts who can submit transactions to your blockchain, creating a permissioned network.'
        },
        feeManager: {
            address: '0x0200000000000000000000000000000000000003',
            name: 'Fee Manager',
            description: 'Enables dynamic fee configuration adjustments by authorized admins without requiring a hard fork.'
        },
        rewardManager: {
            address: '0x0200000000000000000000000000000000000004',
            name: 'Reward Manager',
            description: 'Manages validator rewards and fee recipient configuration for block producers.'
        },
        warp: {
            address: '0x0200000000000000000000000000000000000005',
            name: 'Warp Messenger',
            description: 'Enables native cross-subnet messaging for Avalanche interchain communication.'
        }
    };

    // Custom green switch component
    const GreenSwitch = ({ checked, onCheckedChange }: { checked: boolean; onCheckedChange: (checked: boolean) => void }) => (
        <button
            onClick={() => onCheckedChange(!checked)}
            className={cn(
                "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
                "focus:outline-none focus:ring-2 focus:ring-green-500/20",
                checked ? "bg-green-600 dark:bg-green-500" : "bg-zinc-300 dark:bg-zinc-700"
            )}
        >
            <span
                className={cn(
                    "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                    checked ? "translate-x-5" : "translate-x-0.5"
                )}
            />
        </button>
    );

    const handleSwitchChange = (precompileType: string, value: boolean) => {
        if (value) {
            setHighlightPath(`precompile-${precompileType}`);
            setTimeout(() => clearHighlight(), 2000); // Clear after 2 seconds
        }
    };

    const parseAddressList = useCallback((input: string): Address[] => {
        const trimmedInput = input.trim();
        if (!trimmedInput) return [];
        if (!trimmedInput.includes(',')) {
            const singleAddress = trimmedInput.trim();
            return /^0x[a-fA-F0-9]{40}$/i.test(singleAddress) ? [singleAddress as Address] : [];
        }
        const addresses = trimmedInput.split(',')
            .map(addr => addr.trim())
            .filter(addr => /^0x[a-fA-F0-9]{40}$/i.test(addr));
        return addresses as Address[];
    }, []);

    const formatAddressList = useCallback((addresses: Address[]): string => {
        return addresses.map(addr => addr.startsWith('0x') ? addr : `0x${addr}`).join(', ');
    }, []);

    return (
        <SectionWrapper
            title="Precompiles"
            description={compact ? '' : 'Enable and configure optional precompiles for permissioning and dynamic parameters.'}
            sectionId="precompiles"
            compact={compact}
        >
            <div className="space-y-3">
                <div className="flex items-center justify-between text-[12px]">
                    <div className="text-zinc-600 dark:text-zinc-400">Enabled</div>
                    <div className="text-zinc-700 dark:text-zinc-300 font-medium">{[
                        deployerConfig.activated,
                        txConfig.activated,
                        nativeMinterConfig.activated,
                        feeManagerEnabled,
                        rewardManagerEnabled
                    ].filter(Boolean).length} / 5</div>
                </div>

                <div className="divide-y divide-zinc-200 dark:divide-zinc-800 border border-zinc-200 dark:border-zinc-800 rounded-md overflow-hidden">
                {/* Contract Deployer Allowlist */}
                    <div className="px-3 py-2 text-[12px] bg-white dark:bg-zinc-950">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="font-medium text-zinc-800 dark:text-zinc-200">Contract Deployer Allowlist</span>
                                <Tooltip>
                                    <TooltipTrigger>
                                        <Info className="h-3 w-3 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300" />
                                    </TooltipTrigger>
                                    <TooltipContent className="max-w-xs">
                                        <div className="space-y-1">
                                            <div className="font-semibold">{precompileInfo.contractDeployer.name}</div>
                                            <div className="text-xs font-mono">{precompileInfo.contractDeployer.address}</div>
                                            <div className="text-xs">{precompileInfo.contractDeployer.description}</div>
                                        </div>
                                    </TooltipContent>
                                </Tooltip>
                            </div>
                        <GreenSwitch checked={!!deployerConfig.activated} onCheckedChange={(c) => {
                            const isEnabled = !!c;
                            setDeployerConfig(prev => {
                                const newConfig = { ...prev, activated: isEnabled };
                                // Auto-add wallet address as admin when enabling
                                if (isEnabled && walletAddress && (!prev.addresses?.Admin || prev.addresses.Admin.length === 0)) {
                                    newConfig.addresses = {
                                        ...(prev.addresses || { Admin: [], Manager: [], Enabled: [] }),
                                        Admin: [{ 
                                            id: `admin-${Date.now()}`,
                                            address: walletAddress, 
                                            error: undefined, 
                                            requiredReason: undefined 
                                        }]
                                    };
                                }
                                return newConfig;
                            });
                            handleSwitchChange('contractDeployer', isEnabled);
                        }} />
                    </div>
                    {deployerConfig.activated && (
                        <div className="mt-2">
                        <AllowlistPrecompileConfigurator
                            title=""
                            description={compact ? '' : 'Configure Admin, Manager, and Enabled roles for contract deployment permissions.'}
                            precompileAction="deploy contracts"
                            config={deployerConfig}
                            onUpdateConfig={setDeployerConfig}
                            radioOptionFalseLabel=""
                            radioOptionTrueLabel=""
                            validationError={validationErrors.contractDeployerAllowList}
                            showActivationToggle={false}
                        />
                        </div>
                    )}
                </div>

                {/* Transaction Allowlist */}
                    <div className="px-3 py-2 text-[12px] bg-white dark:bg-zinc-950">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="font-medium text-zinc-800 dark:text-zinc-200">Transaction Allowlist</span>
                                <Tooltip>
                                    <TooltipTrigger>
                                        <Info className="h-3 w-3 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300" />
                                    </TooltipTrigger>
                                    <TooltipContent className="max-w-xs">
                                        <div className="space-y-1">
                                            <div className="font-semibold">{precompileInfo.txAllowList.name}</div>
                                            <div className="text-xs font-mono">{precompileInfo.txAllowList.address}</div>
                                            <div className="text-xs">{precompileInfo.txAllowList.description}</div>
                                        </div>
                                    </TooltipContent>
                                </Tooltip>
                            </div>
                        <GreenSwitch checked={!!txConfig.activated} onCheckedChange={(c) => {
                            const isEnabled = !!c;
                            setTxConfig(prev => {
                                const newConfig = { ...prev, activated: isEnabled };
                                // Auto-add wallet address as admin when enabling
                                if (isEnabled && walletAddress && (!prev.addresses?.Admin || prev.addresses.Admin.length === 0)) {
                                    newConfig.addresses = {
                                        ...(prev.addresses || { Admin: [], Manager: [], Enabled: [] }),
                                        Admin: [{ 
                                            id: `admin-${Date.now()}`,
                                            address: walletAddress, 
                                            error: undefined, 
                                            requiredReason: undefined 
                                        }]
                                    };
                                }
                                return newConfig;
                            });
                            handleSwitchChange('txAllowList', isEnabled);
                        }} />
                    </div>
                    {txConfig.activated && (
                        <div className="mt-2">
                        <AllowlistPrecompileConfigurator
                            title=""
                            description={compact ? '' : 'Set Admin, Manager, and Enabled roles to control transaction submission rights.'}
                            precompileAction="submit transactions"
                            config={txConfig}
                            onUpdateConfig={setTxConfig}
                            radioOptionFalseLabel=""
                            radioOptionTrueLabel=""
                            validationError={validationErrors.txAllowList}
                            showActivationToggle={false}
                        />
                        </div>
                    )}
                </div>

                {/* Native Minter */}
                    <div className="px-3 py-2 text-[12px] bg-white dark:bg-zinc-950">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="font-medium text-zinc-800 dark:text-zinc-200">Native Token Minter</span>
                                <Tooltip>
                                    <TooltipTrigger>
                                        <Info className="h-3 w-3 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300" />
                                    </TooltipTrigger>
                                    <TooltipContent className="max-w-xs">
                                        <div className="space-y-1">
                                            <div className="font-semibold">{precompileInfo.nativeMinter.name}</div>
                                            <div className="text-xs font-mono">{precompileInfo.nativeMinter.address}</div>
                                            <div className="text-xs">{precompileInfo.nativeMinter.description}</div>
                                        </div>
                                    </TooltipContent>
                                </Tooltip>
                            </div>
                        <GreenSwitch checked={!!nativeMinterConfig.activated} onCheckedChange={(c) => {
                            const isEnabled = !!c;
                            setNativeMinterConfig(prev => {
                                const newConfig = { ...prev, activated: isEnabled };
                                // Auto-add wallet address as admin when enabling
                                if (isEnabled && walletAddress && (!prev.addresses?.Admin || prev.addresses.Admin.length === 0)) {
                                    newConfig.addresses = {
                                        ...(prev.addresses || { Admin: [], Manager: [], Enabled: [] }),
                                        Admin: [{ 
                                            id: `admin-${Date.now()}`,
                                            address: walletAddress, 
                                            error: undefined, 
                                            requiredReason: undefined 
                                        }]
                                    };
                                }
                                return newConfig;
                            });
                            handleSwitchChange('nativeMinter', isEnabled);
                        }} />
                    </div>
                    {nativeMinterConfig.activated && (
                        <div className="mt-2">
                        <AllowlistPrecompileConfigurator
                            title=""
                            description={compact ? '' : 'Assign Admin, Manager, and Enabled roles for native token minting authority.'}
                            precompileAction="mint native tokens"
                            config={nativeMinterConfig}
                            onUpdateConfig={setNativeMinterConfig}
                            radioOptionFalseLabel=""
                            radioOptionTrueLabel=""
                            validationError={validationErrors.contractNativeMinter}
                            showActivationToggle={false}
                        />
                        </div>
                    )}
                </div>

                {/* Fee Manager */}
                    <div className="px-3 py-2 text-[12px] bg-white dark:bg-zinc-950">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="font-medium text-zinc-800 dark:text-zinc-200">Fee Manager</span>
                                <Tooltip>
                                    <TooltipTrigger>
                                        <Info className="h-3 w-3 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300" />
                                    </TooltipTrigger>
                                    <TooltipContent className="max-w-xs">
                                        <div className="space-y-1">
                                            <div className="font-semibold">{precompileInfo.feeManager.name}</div>
                                            <div className="text-xs font-mono">{precompileInfo.feeManager.address}</div>
                                            <div className="text-xs">{precompileInfo.feeManager.description}</div>
                                        </div>
                                    </TooltipContent>
                                </Tooltip>
                            </div>
                        <GreenSwitch checked={feeManagerEnabled} onCheckedChange={(c) => {
                            const isEnabled = !!c;
                            setFeeManagerEnabled(isEnabled);
                            // Auto-add wallet address as admin when enabling
                            if (isEnabled && walletAddress && feeManagerAdmins.length === 0) {
                                setFeeManagerAdmins([walletAddress]);
                            }
                            handleSwitchChange('feeManager', isEnabled);
                        }} />
                    </div>
                    {feeManagerEnabled && (
                        <div className="mt-2">
                            <TextArea
                                label="Admin Addresses"
                                value={formatAddressList(feeManagerAdmins)}
                                onChange={(value: string) => setFeeManagerAdmins(parseAddressList(value))}
                                placeholder="0x1234..., 0x5678..."
                                rows={2}
                                error={validationErrors.feeManager}
                            />
                            <AddConnectedWalletButton
                                onAddAddress={(address) => {
                                    setFeeManagerAdmins([...(feeManagerAdmins || []), address as Address]);
                                }}
                                addressSource={feeManagerAdmins}
                                buttonText="Add Connected Wallet"
                            />
                        </div>
                    )}
                </div>

                {/* Reward Manager */}
                    <div className="px-3 py-2 text-[12px] bg-white dark:bg-zinc-950">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="font-medium text-zinc-800 dark:text-zinc-200">Reward Manager</span>
                                <Tooltip>
                                    <TooltipTrigger>
                                        <Info className="h-3 w-3 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300" />
                                    </TooltipTrigger>
                                    <TooltipContent className="max-w-xs">
                                        <div className="space-y-1">
                                            <div className="font-semibold">{precompileInfo.rewardManager.name}</div>
                                            <div className="text-xs font-mono">{precompileInfo.rewardManager.address}</div>
                                            <div className="text-xs">{precompileInfo.rewardManager.description}</div>
                                        </div>
                                    </TooltipContent>
                                </Tooltip>
                            </div>
                        <GreenSwitch checked={rewardManagerEnabled} onCheckedChange={(c) => {
                            const isEnabled = !!c;
                            setRewardManagerEnabled(isEnabled);
                            // Auto-add wallet address as admin when enabling
                            if (isEnabled && walletAddress && rewardManagerAdmins.length === 0) {
                                setRewardManagerAdmins([walletAddress]);
                            }
                            handleSwitchChange('rewardManager', isEnabled);
                        }} />
                    </div>
                    {rewardManagerEnabled && (
                        <div className="mt-2">
                            <TextArea
                                label="Admin Addresses"
                                value={formatAddressList(rewardManagerAdmins)}
                                onChange={(value: string) => setRewardManagerAdmins(parseAddressList(value))}
                                placeholder="0x1234..., 0x5678..."
                                rows={2}
                                error={validationErrors.rewardManager}
                            />
                            <AddConnectedWalletButton
                                onAddAddress={(address) => {
                                    setRewardManagerAdmins([...(rewardManagerAdmins || []), address as Address]);
                                }}
                                addressSource={rewardManagerAdmins}
                                buttonText="Add Connected Wallet"
                            />
                        </div>
                    )}
                </div>
                </div>
            </div>
        </SectionWrapper>
    );
};


