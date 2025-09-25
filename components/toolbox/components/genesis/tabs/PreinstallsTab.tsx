import { SetStateAction } from "react";
import { Address } from "viem";
import { Button } from "../../Button";
import { PreinstalledContractsSection, PreinstallConfig } from "../PreinstalledContractsSection";

interface PreinstallsTabProps {
    preinstallConfig: PreinstallConfig;
    setPreinstallConfig: (config: SetStateAction<PreinstallConfig>) => void;
    ownerAddress?: Address;
    tokenName?: string;
    tokenSymbol?: string;
    isGenesisReady: boolean;
    setActiveTab: (tab: string) => void;
}

export function PreinstallsTab({
    preinstallConfig,
    setPreinstallConfig,
    ownerAddress,
    tokenName,
    tokenSymbol,
    isGenesisReady,
    setActiveTab
}: PreinstallsTabProps) {
    return (
        <div className="space-y-6">
            <PreinstalledContractsSection
                config={preinstallConfig}
                onConfigChange={setPreinstallConfig}
                ownerAddress={ownerAddress}
                tokenName={tokenName}
                tokenSymbol={tokenSymbol}
            />

            <div className="flex justify-center space-x-4">
                <Button onClick={() => setActiveTab("config")} variant="secondary">
                    Back to Configuration
                </Button>
                <Button onClick={() => setActiveTab("precompiles")} variant="secondary">
                    View Precompiles
                </Button>
                {isGenesisReady && (
                    <Button onClick={() => setActiveTab("genesis")} variant="secondary">
                        View Genesis JSON
                    </Button>
                )}
            </div>
        </div>
    );
} 