import { Dispatch, SetStateAction } from 'react';
import { Input } from '../../Input';
import { Select } from '../../Select';
import { useGenesisHighlight } from '../GenesisHighlightContext';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Info, ExternalLink } from 'lucide-react';

type ChainParamsSectionProps = {
    evmChainId: number;
    setEvmChainId: Dispatch<SetStateAction<number>>;
    vmId?: string;
    setVmId?: Dispatch<SetStateAction<string>>;
    tokenName: string;
    setTokenName: Dispatch<SetStateAction<string>>;
    tokenSymbol: string;
    setTokenSymbol: Dispatch<SetStateAction<string>>;
    validationError?: string;
    tokenNameError?: string;
    tokenSymbolError?: string;
    compact?: boolean;
    hideTokenFields?: boolean;
};

export const ChainParamsSection = ({
    evmChainId,
    setEvmChainId,
    vmId,
    setVmId,
    tokenName,
    setTokenName,
    tokenSymbol,
    setTokenSymbol,
    validationError,
    tokenNameError,
    tokenSymbolError,
    compact,
    hideTokenFields
}: ChainParamsSectionProps) => {
    const { setHighlightPath, clearHighlight } = useGenesisHighlight();

    const handleFocus = (path: string) => {
        setHighlightPath(path);
    };

    const handleBlur = () => {
        clearHighlight();
    };
    return (
            <div className="space-y-2">
                {/* Chain Name handled outside this section; this focuses on ID and VM */}
                <div>
                    <div className="flex items-baseline gap-1.5 mb-1">
                        <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">EVM Chain ID</label>
                        <Tooltip>
                            <TooltipTrigger className="inline-flex">
                                <Info className="h-3.5 w-3.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                                <div className="space-y-2">
                                    <p className="text-xs">A unique identifier for your blockchain network. Choose an ID that doesn't conflict with existing chains.</p>
                                    <a 
                                        href="https://chainlist.org" 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
                                    >
                                        Check registered IDs on chainlist.org
                                        <ExternalLink className="h-3 w-3" />
                                    </a>
                                </div>
                            </TooltipContent>
                        </Tooltip>
                    </div>
                    <Input
                        label=""
                        value={evmChainId.toString()}
                        onChange={(value) => setEvmChainId(Number(value))}
                        placeholder="Enter chain ID"
                        type="number"
                        error={validationError}
                        onFocus={() => handleFocus('chainId')}
                        onBlur={handleBlur}
                    />
                </div>
                
                {!hideTokenFields && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input
                            label="Token Name (Optional)"
                            value={tokenName}
                            onChange={setTokenName}
                            placeholder="Default: COIN"
                            error={tokenNameError}
                            helperText={tokenNameError ? undefined : (compact ? undefined : "Full name of your native token (defaults to COIN if empty)")}
                            onFocus={() => handleFocus('tokenName')}
                            onBlur={handleBlur}
                        />
                        <Input
                            label="Token Symbol (Optional)"
                            value={tokenSymbol}
                            onChange={setTokenSymbol}
                            placeholder="Default: COIN"
                            error={tokenSymbolError}
                            helperText={tokenSymbolError ? undefined : (compact ? undefined : "Short symbol for your native token (defaults to COIN if empty)")}
                            onFocus={() => handleFocus('tokenSymbol')}
                            onBlur={handleBlur}
                        />
                    </div>
                )}
            </div>
    );
}; 
