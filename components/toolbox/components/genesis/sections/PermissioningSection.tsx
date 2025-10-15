import { Dispatch, SetStateAction } from 'react';
import { Address } from 'viem';
import { SectionWrapper } from '../SectionWrapper';
import AllowlistPrecompileConfigurator from '../AllowlistPrecompileConfigurator';
import { AllowlistPrecompileConfig } from '../types';
import { useGenesisHighlight } from '../GenesisHighlightContext';
import { PrecompileToggleList, PrecompileItem } from '../PrecompileToggleList';
import { PRECOMPILE_INFO } from '../precompileInfo';

type PermissioningSectionProps = {
    deployerConfig: AllowlistPrecompileConfig;
    setDeployerConfig: Dispatch<SetStateAction<AllowlistPrecompileConfig>>;
    txConfig: AllowlistPrecompileConfig;
    setTxConfig: Dispatch<SetStateAction<AllowlistPrecompileConfig>>;
    compact?: boolean;
    validationErrors: { [key: string]: string };
    walletAddress?: Address;
};

export const PermissioningSection = ({
    deployerConfig,
    setDeployerConfig,
    txConfig,
    setTxConfig,
    compact,
    validationErrors,
    walletAddress
}: PermissioningSectionProps) => {
    const { setHighlightPath, clearHighlight } = useGenesisHighlight();

    const handleSwitchChange = (precompileType: string, value: boolean) => {
        if (value) {
            // Delay highlight to allow JSON to regenerate (debounced at 300ms)
            setTimeout(() => {
                setHighlightPath(`config.${precompileType}`);
                setTimeout(() => clearHighlight(), 2000); // Clear after 2 seconds
            }, 400);
        }
    };

    // Build items for PrecompileToggleList
    const precompileItems: PrecompileItem[] = [
        {
            id: 'contractDeployer',
            label: 'Contract Deployer Allowlist',
            checked: !!deployerConfig.activated,
            onCheckedChange: (checked) => {
                const isEnabled = !!checked;
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
                handleSwitchChange('contractDeployerAllowListConfig', isEnabled);
            },
            info: PRECOMPILE_INFO.contractDeployerAllowList,
            expandedContent: (
                <AllowlistPrecompileConfigurator
                    title=""
                    description={compact ? '' : 'Addresses allowed to deploy smart contracts'}
                    precompileAction="deploy contracts"
                    config={deployerConfig}
                    onUpdateConfig={setDeployerConfig}
                    radioOptionFalseLabel=""
                    radioOptionTrueLabel=""
                    validationError={validationErrors.contractDeployerAllowList}
                    showActivationToggle={false}
                />
            )
        },
        {
            id: 'txAllowList',
            label: 'Transaction Allowlist',
            checked: !!txConfig.activated,
            onCheckedChange: (checked) => {
                const isEnabled = !!checked;
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
                handleSwitchChange('txAllowListConfig', isEnabled);
            },
            info: PRECOMPILE_INFO.txAllowList,
            expandedContent: (
                <AllowlistPrecompileConfigurator
                    title=""
                    description={compact ? '' : 'Addresses allowed to submit transactions'}
                    precompileAction="submit transactions"
                    config={txConfig}
                    onUpdateConfig={setTxConfig}
                    radioOptionFalseLabel=""
                    radioOptionTrueLabel=""
                    validationError={validationErrors.txAllowList}
                    showActivationToggle={false}
                />
            )
        }
    ];

    return (
        <SectionWrapper
            title="Permissioning"
            description={compact ? '' : 'Configure access controls for contract deployment and transactions.'}
            titleTooltip="Control who can interact with your blockchain. You can restrict contract deployment and transaction submission to specific addresses, creating a permissioned network."
            titleTooltipLink={{ href: "/docs/avalanche-l1s/evm-configuration/permissions", text: "Learn more about permissions" }}
            sectionId="permissioning"
            compact={compact}
        >
            <PrecompileToggleList items={precompileItems} />
        </SectionWrapper>
    );
};