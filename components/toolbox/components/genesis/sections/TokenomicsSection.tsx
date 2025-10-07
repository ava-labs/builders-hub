import { Dispatch, SetStateAction } from 'react';
import { Address } from 'viem';
import { SectionWrapper } from '../SectionWrapper';
import { Input } from '../../Input';
import TokenAllocationList from '../TokenAllocationList';
import AllowlistPrecompileConfigurator from '../AllowlistPrecompileConfigurator';
import { AllocationEntry, AllowlistPrecompileConfig } from '../types';
import { useGenesisHighlight } from '../GenesisHighlightContext';
import { PrecompileToggleList, PrecompileItem } from '../PrecompileToggleList';
import { PRECOMPILE_INFO } from '../precompileInfo';

type TokenomicsSectionProps = {
    tokenAllocations: AllocationEntry[];
    setTokenAllocations: (allocations: AllocationEntry[]) => void;
    nativeMinterConfig: AllowlistPrecompileConfig;
    setNativeMinterConfig: Dispatch<SetStateAction<AllowlistPrecompileConfig>>;
    tokenName: string;
    setTokenName: Dispatch<SetStateAction<string>>;
    tokenSymbol?: string;
    setTokenSymbol?: Dispatch<SetStateAction<string>>;
    validationErrors: { [key: string]: string };
    compact?: boolean;
    walletAddress?: Address;
};

export const TokenomicsSection = ({
    tokenAllocations,
    setTokenAllocations,
    nativeMinterConfig,
    setNativeMinterConfig,
    tokenName,
    setTokenName,
    tokenSymbol,
    setTokenSymbol,
    validationErrors,
    compact,
    walletAddress,
}: TokenomicsSectionProps) => {
    const { setHighlightPath, clearHighlight } = useGenesisHighlight();

    const handleFocus = (path: string) => {
        setHighlightPath(path);
    };

    const handleBlur = () => {
        clearHighlight();
    };

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
            id: 'nativeMinter',
            label: 'Native Token Minter',
            checked: !!nativeMinterConfig.activated,
            onCheckedChange: (checked) => {
                const isEnabled = !!checked;
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
                handleSwitchChange('contractNativeMinterConfig', isEnabled);
            },
            info: PRECOMPILE_INFO.nativeMinter,
            expandedContent: (
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
            )
        }
    ];

    return (
        <SectionWrapper
            title="Tokenomics"
            description={compact ? '' : 'Configure your blockchain\'s native token economics.'}
            titleTooltip="Configure your blockchain's native token economics including initial distribution and minting permissions."
            titleTooltipLink={{ href: "/docs/avalanche-l1s/evm-configuration/tokenomics", text: "Learn more about tokenomics" }}
            sectionId="tokenomics"
            compact={compact}
        >
            <div className="space-y-4">
                {/* Coin Name Fields */} 
                <div className="grid grid-cols-2 gap-4">
                    <Input
                        label="Token Name"
                        value={tokenName}
                        onChange={setTokenName}
                        placeholder="COIN"
                        onFocus={() => handleFocus('tokenName')}
                        onBlur={handleBlur}
                    />
                    <Input
                        label="Token Symbol"
                        value={tokenSymbol || ''}
                        onChange={setTokenSymbol || (() => {})}
                        placeholder="COIN"
                    />
                </div>

                {/* Initial Token Allocation */}
                <div>
                    <TokenAllocationList
                        allocations={tokenAllocations}
                        onAllocationsChange={setTokenAllocations}
                        compact={compact}
                    />
                    {validationErrors.tokenAllocations && <p className="text-red-500 text-sm mt-1">{validationErrors.tokenAllocations}</p>}
                </div>

                {/* Native Token Minter */}
                <PrecompileToggleList items={precompileItems} showEnabledCount={false} />
            </div>
        </SectionWrapper>
    );
};