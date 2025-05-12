import { Dispatch, SetStateAction } from 'react';
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
            description="By design, blockchain networks are fully permissionless, allowing anyone to transact and deploy smart contracts. However, certain use cases require permissioning to control who can participate in transactions or deploy contracts. On Avalanche, permissioning is an optional feature for Layer 1 blockchains that may or may not be activated, depending on the network's needs."
            isExpanded={isExpanded}
            toggleExpand={toggleExpand}
            sectionId="permissions"
        >
            <div className="space-y-6">

                {/* Contract Deployer Allowlist */}

                <AllowlistPrecompileConfigurator
                    title="Contract Deployer Allowlist"
                    description="You can optionally restrict which addresses may deploy smart contracts on this blockchain."
                    precompileAction="deploy contracts"
                    config={deployerConfig}
                    onUpdateConfig={setDeployerConfig}
                    radioOptionFalseLabel="Anyone can deploy contracts."
                    radioOptionTrueLabel="Only approved addresses can deploy contracts."
                    validationError={validationErrors.contractDeployerAllowList}
                />


                {/* Transaction Allowlist */}

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
        </SectionWrapper>
    );
}; 