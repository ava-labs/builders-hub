import { Dispatch, SetStateAction } from 'react';
import { SectionWrapper } from '../SectionWrapper';
import { Input } from '../../Input';

type ChainParamsSectionProps = {
    evmChainId: number;
    setEvmChainId: Dispatch<SetStateAction<number>>;
    tokenName: string;
    setTokenName: Dispatch<SetStateAction<string>>;
    tokenSymbol: string;
    setTokenSymbol: Dispatch<SetStateAction<string>>;
    isExpanded: boolean;
    toggleExpand: () => void;
    validationError?: string;
    tokenNameError?: string;
    tokenSymbolError?: string;
};

export const ChainParamsSection = ({
    evmChainId,
    setEvmChainId,
    tokenName,
    setTokenName,
    tokenSymbol,
    setTokenSymbol,
    isExpanded,
    toggleExpand,
    validationError,
    tokenNameError,
    tokenSymbolError
}: ChainParamsSectionProps) => {
    return (
        <SectionWrapper
            title="Chain Parameters"
            description="Configure the basic parameters of your L1 blockchain."
            isExpanded={isExpanded}
            toggleExpand={toggleExpand}
            sectionId="chainParams"
        >
            <div className="space-y-4">
                <Input
                    label="EVM Chain ID"
                    value={evmChainId.toString()}
                    onChange={(value) => setEvmChainId(Number(value))}
                    placeholder="Enter chain ID"
                    type="number"
                    error={validationError}
                    helperText={validationError ? undefined : "Unique identifier for your blockchain. Check chainlist.org to avoid conflicts."}
                />
                <div className="-mt-2">
                    <a
                        href="https://chainlist.org"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-500 hover:text-blue-600"
                    >
                        View registered chain IDs on chainlist.org →
                    </a>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input
                        label="Token Name (Optional)"
                        value={tokenName}
                        onChange={setTokenName}
                        placeholder="Default: COIN"
                        error={tokenNameError}
                        helperText={tokenNameError ? undefined : "Full name of your native token (defaults to COIN if empty)"}
                    />
                    <Input
                        label="Token Symbol (Optional)"
                        value={tokenSymbol}
                        onChange={setTokenSymbol}
                        placeholder="Default: COIN"
                        error={tokenSymbolError}
                        helperText={tokenSymbolError ? undefined : "Short symbol for your native token (defaults to COIN if empty)"}
                    />
                </div>
            </div>
        </SectionWrapper>
    );
}; 
