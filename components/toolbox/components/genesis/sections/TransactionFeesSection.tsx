import { Dispatch, SetStateAction, useMemo } from 'react';
import { Address } from 'viem';
import { SectionWrapper } from '../SectionWrapper';
import FeeConfig from '../FeeConfig'; // Assuming FeeConfig handles its internal inputs
import { FeeConfigType, ValidationMessages } from '../types';

// We might need to import components for Fee/Reward Manager admin lists if not handled by FeeConfig
// import EthereumAddressList from '../EthereumAddressList';

type TransactionFeesSectionProps = {
    gasLimit: number;
    setGasLimit: Dispatch<SetStateAction<number>>;
    targetBlockRate: number;
    setTargetBlockRate: Dispatch<SetStateAction<number>>;
    feeConfig: FeeConfigType;
    setFeeConfig: Dispatch<SetStateAction<FeeConfigType>>;
    feeManagerEnabled: boolean;
    setFeeManagerEnabled: Dispatch<SetStateAction<boolean>>;
    feeManagerAdmins: Address[];
    setFeeManagerAdmins: Dispatch<SetStateAction<Address[]>>;
    rewardManagerEnabled: boolean;
    setRewardManagerEnabled: Dispatch<SetStateAction<boolean>>;
    rewardManagerAdmins: Address[];
    setRewardManagerAdmins: Dispatch<SetStateAction<Address[]>>;
    validationMessages: ValidationMessages;
    compact?: boolean;
};

export const TransactionFeesSection = ({
    gasLimit,
    setGasLimit,
    targetBlockRate,
    setTargetBlockRate,
    feeConfig,
    setFeeConfig, 
    feeManagerEnabled,
    setFeeManagerEnabled,
    feeManagerAdmins,
    setFeeManagerAdmins,
    rewardManagerEnabled,
    setRewardManagerEnabled,
    rewardManagerAdmins,
    setRewardManagerAdmins,
    validationMessages,
    compact
}: TransactionFeesSectionProps) => {

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
            feeManager: validationMessages.errors.feeManager, // Pass these down
            rewardManager: validationMessages.errors.rewardManager
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

    return (
        <SectionWrapper
            title="Transaction Fees & Gas"
            description={compact ? "" : "Configure fee parameters and optional dynamic managers."}
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
        </SectionWrapper>
    );
}; 