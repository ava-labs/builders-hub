import React, { Dispatch, SetStateAction } from 'react';
import { SectionWrapper } from '../SectionWrapper';
import AllowlistPrecompileConfigurator from '../AllowlistPrecompileConfigurator';
import { AllowlistPrecompileConfig } from '../types';

type PermissionsSectionProps = {
    deployerConfig: AllowlistPrecompileConfig;
    setDeployerConfig: Dispatch<SetStateAction<AllowlistPrecompileConfig>>;
    txConfig: AllowlistPrecompileConfig;
    setTxConfig: Dispatch<SetStateAction<AllowlistPrecompileConfig>>;
    isExpanded: boolean;
    toggleExpand: () => void;
    validationErrors: { [key: string]: string };
};

export const PermissionsSection = ({
    deployerConfig,
    setDeployerConfig,
    txConfig,
    setTxConfig,
    isExpanded,
    toggleExpand,
    validationErrors
}: PermissionsSectionProps) => {
    return (
        <SectionWrapper
            title="Permissions"
            description="Configure access controls for deploying contracts and submitting transactions."
            isExpanded={isExpanded}
            toggleExpand={toggleExpand}
            sectionId="permissions"
        >
            <div className="space-y-6">
                 {/* Contract Deployer Allowlist */} 
                 <div>
                    <AllowlistPrecompileConfigurator
                        title="Contract Deployer Allowlist"
                        description="Configure which addresses can deploy smart contracts."
                        precompileAction="deploy contracts"
                        config={deployerConfig}
                        onUpdateConfig={setDeployerConfig}
                        radioOptionFalseLabel="Anyone can deploy contracts."
                        radioOptionTrueLabel="Only approved addresses can deploy contracts."
                        validationError={validationErrors.contractDeployerAllowList}
                    />
                 </div>

                 {/* Transaction Allowlist */} 
                 <div>
                    <AllowlistPrecompileConfigurator
                        title="Transaction Allowlist"
                        description="Configure which addresses can submit transactions."
                        precompileAction="submit transactions"
                        config={txConfig}
                        onUpdateConfig={setTxConfig}
                        radioOptionFalseLabel="Anyone can submit transactions."
                        radioOptionTrueLabel="Only approved addresses can submit transactions."
                        validationError={validationErrors.txAllowList}
                    />
                 </div>
            </div>
        </SectionWrapper>
    );
}; 