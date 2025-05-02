import React, { Dispatch, SetStateAction } from 'react';
import { SectionWrapper } from '../SectionWrapper';
import { Input } from '../../../components/Input';

type ChainParamsSectionProps = {
    evmChainId: number;
    setEvmChainId: Dispatch<SetStateAction<number>>;
    isExpanded: boolean;
    toggleExpand: () => void;
    validationError?: string;
};

export const ChainParamsSection = ({ 
    evmChainId, 
    setEvmChainId, 
    isExpanded, 
    toggleExpand, 
    validationError 
}: ChainParamsSectionProps) => {
    return (
        <SectionWrapper
            title="Chain Parameters"
            description="Enter the basic parameters of your L1, such as the EVM chain ID."
            isExpanded={isExpanded}
            toggleExpand={toggleExpand}
            sectionId="chainParams"
        >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <Input
                        label="EVM Chain ID"
                        value={evmChainId.toString()}
                        onChange={(value) => setEvmChainId(Number(value))}
                        placeholder="Enter chain ID"
                        type="number"
                        error={validationError}
                        helperText={validationError ? undefined : "Unique identifier for your blockchain. Check chainlist.org to avoid conflicts."}
                    />
                    <div className="mt-2">
                        <a 
                            href="https://chainlist.org"
                            target="_blank"
                            rel="noopener noreferrer" 
                            className="text-sm text-blue-500 hover:text-blue-600"
                        >
                            View registered chain IDs on chainlist.org →
                        </a>
                    </div>
                </div>
            </div>
        </SectionWrapper>
    );
}; 