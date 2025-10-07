import { SectionWrapper } from '../SectionWrapper';
import { PreinstallConfig } from '../types';
import { useMemo, useCallback } from 'react';
import { useGenesisHighlight } from '../GenesisHighlightContext';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Info, ExternalLink } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { PREDEPLOY_INFO } from '../precompileInfo';

type PredeploysSectionProps = {
    config: PreinstallConfig;
    onConfigChange: (config: PreinstallConfig) => void;
    ownerAddress?: string;
    tokenName?: string;
    tokenSymbol?: string;
    compact?: boolean;
};

export const PredeploysSection = ({
    config,
    onConfigChange,
    ownerAddress,
    tokenName,
    tokenSymbol,
    compact
}: PredeploysSectionProps) => {
    const { setHighlightPath, clearHighlight } = useGenesisHighlight();
    const enabledCount = useMemo(() => Object.values(config).filter(Boolean).length, [config]);
    const totalCount = useMemo(() => Object.keys(config).length, [config]);

    // Build predeploy info with dynamic token name
    const predeployInfo = useMemo(() => ({
        ...PREDEPLOY_INFO,
        wrappedNativeToken: {
            ...PREDEPLOY_INFO.wrappedNativeToken,
            name: `Wrapped ${tokenName || 'Native Token'}`
        }
    }), [tokenName]);

    const handleToggle = useCallback((key: keyof PreinstallConfig, enabled: boolean) => {
        let next = { ...config, [key]: enabled } as PreinstallConfig;
        if (key === 'proxy') {
            next.proxyAdmin = enabled;
        }
        if (key === 'proxyAdmin') {
            next.proxy = enabled;
        }
        onConfigChange(next);
        
        // Highlight the predeploy in JSON when enabled
        if (enabled) {
            // Delay highlight to allow JSON to regenerate (debounced at 300ms)
            setTimeout(() => {
                // Use the actual predeploy key for highlighting  
                const highlightKey = `predeploy-${key}`;
                setHighlightPath(highlightKey);
                setTimeout(() => clearHighlight(), 2000);
            }, 400);
        }
    }, [config, onConfigChange, setHighlightPath, clearHighlight]);

    const items: { id: keyof PreinstallConfig; label: string }[] = [
        { id: 'proxy', label: 'Transparent Upgradeable Proxy' },
        { id: 'proxyAdmin', label: 'Proxy Admin Contract' },
        { id: 'icmMessenger', label: 'ICM Messenger' },
        { id: 'wrappedNativeToken', label: `Wrapped ${tokenName || 'Native Token'}` },
        { id: 'safeSingletonFactory', label: 'Safe Singleton Factory' },
        { id: 'multicall3', label: 'Multicall3' },
        { id: 'create2Deployer', label: 'Create2Deployer' }
    ];
    
    return (
        <SectionWrapper
            title="Pre-Deploys"
            description={compact ? '' : 'Enable pre-deployed contracts to ship with your genesis.'}
            titleTooltip="Pre-deployed contracts are smart contracts that exist on your blockchain from the moment it launches. These provide essential functionality like multi-sig wallets, token wrapping, and cross-chain messaging without requiring manual deployment."
            sectionId="predeploys"
            compact={compact}
        >
            <div className="space-y-3">
                <div className="flex items-center justify-between text-[12px]">
                    <div className="text-zinc-600 dark:text-zinc-400">Enabled</div>
                    <div className="text-zinc-700 dark:text-zinc-300 font-medium">{enabledCount} / {totalCount}</div>
                </div>

                <div className="divide-y divide-zinc-200 dark:divide-zinc-800 border border-zinc-200 dark:border-zinc-800 rounded-md overflow-hidden">
                    {items.map((item) => (
                        <div key={item.id} className="flex items-center justify-between px-3 py-2 text-[12px] bg-white dark:bg-zinc-950">
                            <div className="flex items-center gap-2">
                                <span className="font-medium text-zinc-800 dark:text-zinc-200 truncate">{item.label}</span>
                                {predeployInfo[item.id as keyof typeof predeployInfo] && (
                                    <Tooltip>
                                        <TooltipTrigger>
                                            <Info className="h-3 w-3 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300" />
                                        </TooltipTrigger>
                                        <TooltipContent className="max-w-xs">
                                            <div className="space-y-2">
                                                <div>
                                                    <div className="font-semibold">{predeployInfo[item.id as keyof typeof predeployInfo].name}</div>
                                                    <div className="text-xs font-mono mt-1">{predeployInfo[item.id as keyof typeof predeployInfo].address}</div>
                                                </div>
                                                <div className="text-xs">{predeployInfo[item.id as keyof typeof predeployInfo].description}</div>
                                                {predeployInfo[item.id as keyof typeof predeployInfo].githubUrl && (
                                                    <a 
                                                        href={predeployInfo[item.id as keyof typeof predeployInfo].githubUrl}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
                                                    >
                                                        View contract source
                                                        <ExternalLink className="h-3 w-3" />
                                                    </a>
                                                )}
                                            </div>
                                        </TooltipContent>
                                    </Tooltip>
                                )}
                            </div>
                            <Switch checked={config[item.id]} onCheckedChange={(c) => handleToggle(item.id, !!c)} />
                        </div>
                    ))}
                </div>
            </div>
        </SectionWrapper>
    );
};