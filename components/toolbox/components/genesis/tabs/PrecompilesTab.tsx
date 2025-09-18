import { Address } from "viem";
import { Button } from "../../Button";
import { PrecompileCard } from "../PrecompileCard";
import { formatAddressList } from "../utils";
import { AllowlistPrecompileConfig } from "../types";

const PRECOMPILE_ADDRESSES = {
    contractDeployer: "0x0200000000000000000000000000000000000000" as Address,
    nativeMinter: "0x0200000000000000000000000000000000000001" as Address,
    txAllowList: "0x0200000000000000000000000000000000000002" as Address,
    feeManager: "0x0200000000000000000000000000000000000003" as Address,
    rewardManager: "0x0200000000000000000000000000000000000004" as Address,
    warpMessenger: "0x0200000000000000000000000000000000000005" as Address,
};

interface PrecompilesTabProps {
    contractDeployerAllowListConfig: AllowlistPrecompileConfig;
    contractNativeMinterConfig: AllowlistPrecompileConfig;
    txAllowListConfig: AllowlistPrecompileConfig;
    feeManagerEnabled: boolean;
    feeManagerAdmins: Address[];
    rewardManagerEnabled: boolean;
    rewardManagerAdmins: Address[];
    warpConfig: {
        enabled: boolean;
        quorumNumerator: number;
        requirePrimaryNetworkSigners: boolean;
    };
    isGenesisReady: boolean;
    setActiveTab: (tab: string) => void;
}

export function PrecompilesTab({
    contractDeployerAllowListConfig,
    contractNativeMinterConfig,
    txAllowListConfig,
    feeManagerEnabled,
    feeManagerAdmins,
    rewardManagerEnabled,
    rewardManagerAdmins,
    warpConfig,
    isGenesisReady,
    setActiveTab
}: PrecompilesTabProps) {
    const renderAllowlistAddresses = (config: AllowlistPrecompileConfig) => {
        if (!config.activated) return null;

        const hasAnyAddresses = 
            config.addresses.Admin.length > 0 ||
            config.addresses.Manager.length > 0 ||
            config.addresses.Enabled.length > 0;

        if (!hasAnyAddresses) {
            return (
                <div className="text-zinc-500 dark:text-zinc-400 text-sm">
                    No addresses configured
                </div>
            );
        }

        return (
            <div className="space-y-3">
                {config.addresses.Admin.length > 0 && (
                    <div>
                        <div className="font-medium text-sm text-zinc-700 dark:text-zinc-300">Admin Addresses:</div>
                        <div className="text-xs mt-1 font-mono text-zinc-600 dark:text-zinc-400 break-all">
                            {config.addresses.Admin.map(entry => entry.address).join(', ')}
                        </div>
                    </div>
                )}

                {config.addresses.Manager.length > 0 && (
                    <div>
                        <div className="font-medium text-sm text-zinc-700 dark:text-zinc-300">Manager Addresses:</div>
                        <div className="text-xs mt-1 font-mono text-zinc-600 dark:text-zinc-400 break-all">
                            {config.addresses.Manager.map(entry => entry.address).join(', ')}
                        </div>
                    </div>
                )}

                {config.addresses.Enabled.length > 0 && (
                    <div>
                        <div className="font-medium text-sm text-zinc-700 dark:text-zinc-300">Enabled Addresses:</div>
                        <div className="text-xs mt-1 font-mono text-zinc-600 dark:text-zinc-400 break-all">
                            {config.addresses.Enabled.map(entry => entry.address).join(', ')}
                        </div>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="space-y-6">
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-sm overflow-hidden p-5">
                <h3 className="text-lg font-medium mb-4 text-zinc-800 dark:text-white">Precompile Info</h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">
                    Review the status of precompiles based on your configuration.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <PrecompileCard
                        title="Contract Deployer Allow List"
                        address={PRECOMPILE_ADDRESSES.contractDeployer}
                        enabled={contractDeployerAllowListConfig.activated}
                    >
                        {renderAllowlistAddresses(contractDeployerAllowListConfig)}
                    </PrecompileCard>

                    <PrecompileCard
                        title="Native Minter"
                        address={PRECOMPILE_ADDRESSES.nativeMinter}
                        enabled={contractNativeMinterConfig.activated}
                    >
                        {renderAllowlistAddresses(contractNativeMinterConfig)}
                    </PrecompileCard>

                    <PrecompileCard
                        title="Transaction Allow List"
                        address={PRECOMPILE_ADDRESSES.txAllowList}
                        enabled={txAllowListConfig.activated}
                    >
                        {renderAllowlistAddresses(txAllowListConfig)}
                    </PrecompileCard>

                    <PrecompileCard
                        title="Fee Manager"
                        address={PRECOMPILE_ADDRESSES.feeManager}
                        enabled={feeManagerEnabled}
                    >
                        {feeManagerEnabled && (
                            <div>
                                <div className="font-medium text-sm text-zinc-700 dark:text-zinc-300">Admin Addresses:</div>
                                <div className="text-xs mt-1 font-mono text-zinc-600 dark:text-zinc-400 break-all">
                                    {feeManagerAdmins.length > 0
                                        ? formatAddressList(feeManagerAdmins)
                                        : <span className="text-red-500">None specified (Required)</span>}
                                </div>
                            </div>
                        )}
                    </PrecompileCard>

                    <PrecompileCard
                        title="Reward Manager"
                        address={PRECOMPILE_ADDRESSES.rewardManager}
                        enabled={rewardManagerEnabled}
                    >
                        {rewardManagerEnabled && (
                            <div>
                                <div className="font-medium text-sm text-zinc-700 dark:text-zinc-300">Admin Addresses:</div>
                                <div className="text-xs mt-1 font-mono text-zinc-600 dark:text-zinc-400 break-all">
                                    {rewardManagerAdmins.length > 0
                                        ? formatAddressList(rewardManagerAdmins)
                                        : <span className="text-red-500">None specified (Required)</span>}
                                </div>
                            </div>
                        )}
                    </PrecompileCard>

                    <PrecompileCard
                        title="Warp Messenger"
                        address={PRECOMPILE_ADDRESSES.warpMessenger}
                        enabled={warpConfig.enabled}
                    >
                        <div className="space-y-2 text-sm text-zinc-700 dark:text-zinc-300">
                            <div>Quorum: {warpConfig.quorumNumerator}%</div>
                            <div>Require Primary Signers: {warpConfig.requirePrimaryNetworkSigners ? "Yes" : "No"}</div>
                        </div>
                    </PrecompileCard>
                </div>
            </div>

            <div className="flex justify-center space-x-4">
                <Button onClick={() => setActiveTab("config")} variant="secondary">
                    Back to Configuration
                </Button>
                <Button onClick={() => setActiveTab("preinstalls")} variant="secondary">
                    View PreInstalls
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