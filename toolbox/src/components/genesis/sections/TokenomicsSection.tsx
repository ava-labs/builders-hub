import { Dispatch, SetStateAction } from 'react';
import { SectionWrapper } from '../SectionWrapper';
import TokenAllocationList from '../TokenAllocationList';
import AllowlistPrecompileConfigurator from '../AllowlistPrecompileConfigurator';
import { AllocationEntry, AllowlistPrecompileConfig } from '../types';

type TokenomicsSectionProps = {
    tokenAllocations: AllocationEntry[];
    setTokenAllocations: Dispatch<SetStateAction<AllocationEntry[]>>;
    nativeMinterConfig: AllowlistPrecompileConfig;
    setNativeMinterConfig: Dispatch<SetStateAction<AllowlistPrecompileConfig>>;
    isExpanded: boolean;
    toggleExpand: () => void;
    validationErrors: { [key: string]: string };
};

export const TokenomicsSection = ({
    tokenAllocations,
    setTokenAllocations,
    nativeMinterConfig,
    setNativeMinterConfig,
    isExpanded,
    toggleExpand,
    validationErrors // Pass errors object
}: TokenomicsSectionProps) => {
    return (
        <SectionWrapper
            title="Tokenomics"
            description="Tokenomics in Layer 1 blockchains on the Avalanche network are highly flexible, allowing developers to tailor economic models to their specific needs. Each L1 can define its own native token, specifying its initial allocation, distribution mechanism, and whether it should be mintable for ongoing issuance. This enables a wide range of economic designs, from fixed-supply tokens to inflationary models that support network sustainability."
            isExpanded={isExpanded}
            toggleExpand={toggleExpand}
            sectionId="tokenomics"
        >
            <div className="space-y-6">
                <p></p>

                {/* Initial Allocation */} 
                <div>
                    <h3 className="font-medium mb-3">Initial Token Allocation</h3>
                    <div className="mb-4">
                        <p className="text-zinc-500 dark:text-zinc-400">
                            Add addresses and their initial token balances. The first address will also be the initial owner for the ProxyAdmin contract.
                        </p>
                        {validationErrors.tokenAllocations && <p className="text-red-500 text-sm mt-1">{validationErrors.tokenAllocations}</p>}
                    </div>
                    <TokenAllocationList
                        allocations={tokenAllocations}
                        onAllocationsChange={setTokenAllocations}
                        // Pass specific allocation errors if needed (e.g., by filtering validationErrors)
                    />
                </div>

                {/* Minting Rights */} 
                <div>
                    <AllowlistPrecompileConfigurator
                        title="Minting Rights of Native Token"
                        description="Configure which addresses can mint additional native tokens."
                        precompileAction="mint native tokens"
                        config={nativeMinterConfig}
                        onUpdateConfig={setNativeMinterConfig}
                        radioOptionFalseLabel="Fixed token supply."
                        radioOptionTrueLabel="Allow minting additional tokens."
                        validationError={validationErrors.contractNativeMinter}
                    />
                </div>
            </div>
        </SectionWrapper>
    );
}; 