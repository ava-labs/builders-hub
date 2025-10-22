import { Dispatch, SetStateAction, useMemo } from 'react';
import { Address } from 'viem';
import { SectionWrapper } from '../SectionWrapper';
import FeeConfig from '../FeeConfig';
import { FeeConfigType, ValidationMessages, AllowlistPrecompileConfig } from '../types';
import AllowlistPrecompileConfigurator from '../AllowlistPrecompileConfigurator';
import { useGenesisHighlight } from '../GenesisHighlightContext';
import { PrecompileToggleList, PrecompileItem } from '../PrecompileToggleList';
import { PRECOMPILE_INFO } from '../precompileInfo';

type FeeConfigurationSectionProps = {
    gasLimit: number;
    setGasLimit: Dispatch<SetStateAction<number>>;
    targetBlockRate: number;
    setTargetBlockRate: Dispatch<SetStateAction<number>>;
    feeConfig: FeeConfigType;
    setFeeConfig: Dispatch<SetStateAction<FeeConfigType>>;
    feeManagerConfig: AllowlistPrecompileConfig;
    setFeeManagerConfig: Dispatch<SetStateAction<AllowlistPrecompileConfig>>;
    rewardManagerConfig: AllowlistPrecompileConfig;
    setRewardManagerConfig: Dispatch<SetStateAction<AllowlistPrecompileConfig>>;
    validationMessages: ValidationMessages;
    compact?: boolean;
    walletAddress?: Address;
};

export const FeeConfigurationSection = ({
    gasLimit,
    setGasLimit,
    targetBlockRate,
    setTargetBlockRate,
    feeConfig,
    setFeeConfig,
    feeManagerConfig,
    setFeeManagerConfig,
    rewardManagerConfig,
    setRewardManagerConfig,
    validationMessages,
    compact,
    walletAddress
}: FeeConfigurationSectionProps) => {
    const { setHighlightPath, clearHighlight } = useGenesisHighlight();

    // Combine specific errors/warnings for FeeConfig component
    const feeConfigValidation = useMemo(() => ({
        errors: {
            gasLimit: validationMessages.errors.gasLimit,
            blockRate: validationMessages.errors.blockRate,
            minBaseFee: validationMessages.errors.minBaseFee,
            targetGas: validationMessages.errors.targetGas,
            baseFeeChangeDenominator: validationMessages.errors.baseFeeChangeDenominator,
            minBlockGasCost: validationMessages.errors.minBlockGasCost,
            maxBlockGasCost: validationMessages.errors.maxBlockGasCost,
            feeManager: validationMessages.errors.feeManager
        },
        warnings: {
            gasLimit: validationMessages.warnings.gasLimit,
            blockRate: validationMessages.warnings.blockRate,
            minBaseFee: validationMessages.warnings.minBaseFee,
            targetGas: validationMessages.warnings.targetGas,
            baseFeeChangeDenominator: validationMessages.warnings.baseFeeChangeDenominator,
            minBlockGasCost: validationMessages.warnings.minBlockGasCost,
            maxBlockGasCost: validationMessages.warnings.maxBlockGasCost,
            blockGasCostStep: validationMessages.warnings.blockGasCostStep
        }
    }), [validationMessages]);

    const handleSwitchChange = (precompileType: string, value: boolean) => {
        if (value) {
            // Delay highlight to allow JSON to regenerate (debounced at 300ms)
            setTimeout(() => {
                setHighlightPath(`config.${precompileType}`);
                setTimeout(() => clearHighlight(), 2000);
            }, 400);
        }
    };

    // Build items for PrecompileToggleList
    const precompileItems: PrecompileItem[] = [
        {
            id: 'feeManager',
            label: 'Fee Manager',
            checked: !!feeManagerConfig.activated,
            onCheckedChange: (checked) => {
                const isEnabled = !!checked;
                setFeeManagerConfig(prev => {
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
                handleSwitchChange('feeManagerAddress', isEnabled);
            },
            info: PRECOMPILE_INFO.feeManager,
            expandedContent: (
                <AllowlistPrecompileConfigurator
                    title=""
                    description={compact ? '' : 'Addresses allowed to manage fee configuration'}
                    precompileAction="manage fee configuration"
                    config={feeManagerConfig}
                    onUpdateConfig={setFeeManagerConfig}
                    radioOptionFalseLabel=""
                    radioOptionTrueLabel=""
                    validationError={validationMessages.errors.feeManager}
                    showActivationToggle={false}
                />
            )
        },
        {
            id: 'rewardManager',
            label: 'Reward Manager',
            checked: !!rewardManagerConfig.activated,
            onCheckedChange: (checked) => {
                const isEnabled = !!checked;
                setRewardManagerConfig(prev => {
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
                handleSwitchChange('rewardManagerAddress', isEnabled);
            },
            info: PRECOMPILE_INFO.rewardManager,
            expandedContent: (
                <AllowlistPrecompileConfigurator
                    title=""
                    description={compact ? '' : 'Addresses allowed to manage rewards'}
                    precompileAction="manage rewards"
                    config={rewardManagerConfig}
                    onUpdateConfig={setRewardManagerConfig}
                    radioOptionFalseLabel=""
                    radioOptionTrueLabel=""
                    validationError={validationMessages.errors.rewardManager}
                    showActivationToggle={false}
                />
            )
        }
    ];

    return (
        <SectionWrapper
            title="Fee Configuration"
            description={compact ? "" : "Configure fee parameters and dynamic managers."}
            titleTooltip="Set transaction fees and gas parameters for your blockchain. You can also enable dynamic fee management to adjust fees after launch without requiring network upgrades."
            titleTooltipLink={{ href: "/docs/avalanche-l1s/evm-configuration/transaction-fees", text: "Learn more about transaction fees" }}
            sectionId="transactionFees"
            compact={compact}
        >
            {/* Pass all necessary props to FeeConfig */}
            <FeeConfig
                gasLimit={gasLimit}
                setGasLimit={setGasLimit}
                targetBlockRate={targetBlockRate}
                setTargetBlockRate={setTargetBlockRate}
                feeConfig={feeConfig}
                onFeeConfigChange={setFeeConfig}
                validationMessages={feeConfigValidation}
            />

            {/* Fee Manager and Reward Manager */}
            <div className="mt-4">
                <PrecompileToggleList items={precompileItems} />
            </div>
        </SectionWrapper>
    );
};