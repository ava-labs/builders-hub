"use client";

import { useState } from "react";
import { useWalletStore } from "@/components/toolbox/stores/walletStore";
import { useToolboxStore, useViemChainStore } from "@/components/toolbox/stores/toolboxStore";
import { Button } from "@/components/toolbox/components/Button";
import { Success } from "@/components/toolbox/components/Success";
import { BaseConsoleToolProps, ConsoleToolMetadata, withConsoleToolMetadata } from '../../../components/WithConsoleToolMetadata';
import { generateConsoleToolGitHubUrl } from "@/components/toolbox/utils/github-url";
import { WalletRequirementsConfigKey } from "@/components/toolbox/hooks/useWalletRequirements";
import NativeTokenStakingManager from "@/contracts/icm-contracts/compiled/NativeTokenStakingManager.json";
import ERC20TokenStakingManager from "@/contracts/icm-contracts/compiled/ERC20TokenStakingManager.json";
import versions from '@/scripts/versions.json';
import useConsoleNotifications from '@/hooks/useConsoleNotifications';
import { getLinkedBytecode } from "@/components/toolbox/utils/contract-deployment";
import { useCriticalError } from "@/components/toolbox/hooks/useCriticalError";
import { LibraryRequirementStatus } from "@/components/toolbox/components/LibraryRequirementStatus";

const ICM_COMMIT = versions["ava-labs/icm-contracts"];

const metadata: ConsoleToolMetadata = {
    title: "Deploy Staking Manager",
    description: "Deploy a Staking Manager contract (Native or ERC20) to the EVM network.",
    toolRequirements: [
        WalletRequirementsConfigKey.EVMChainBalance,
    ],
    githubUrl: generateConsoleToolGitHubUrl(import.meta.url)
};

type TokenType = 'native' | 'erc20';

interface DeployStakingManagerProps extends BaseConsoleToolProps {
    initialTokenType?: TokenType;
}

function DeployStakingManager({ initialTokenType = 'native' }: DeployStakingManagerProps) {
    const [isDeploying, setIsDeploying] = useState(false);
    const [tokenType, setTokenType] = useState<TokenType>(initialTokenType);
    const { setCriticalError } = useCriticalError();

    const { coreWalletClient, publicClient, walletEVMAddress } = useWalletStore();
    const viemChain = useViemChainStore();
    const {
        nativeStakingManagerAddress,
        setNativeStakingManagerAddress,
        erc20StakingManagerAddress,
        setErc20StakingManagerAddress,
        validatorMessagesLibAddress
    } = useToolboxStore();
    const { notify } = useConsoleNotifications();

    const isNative = tokenType === 'native';
    const contractAddress = isNative ? nativeStakingManagerAddress : erc20StakingManagerAddress;
    const setContractAddress = isNative ? setNativeStakingManagerAddress : setErc20StakingManagerAddress;

    const contractJson = isNative ? NativeTokenStakingManager : ERC20TokenStakingManager;
    const contractName = isNative ? 'Native Token Staking Manager' : 'ERC20 Token Staking Manager';
    const sourceUrl = `https://github.com/ava-labs/icm-contracts/blob/${ICM_COMMIT}/contracts/validator-manager/${isNative ? 'NativeTokenStakingManager' : 'ERC20TokenStakingManager'}.sol`;

    async function deployStakingManager() {
        setIsDeploying(true);
        setContractAddress("");
        try {
            if (!viemChain) throw new Error("Viem chain not found");
            if (!coreWalletClient) throw new Error("Wallet not connected");
            if (!walletEVMAddress) throw new Error("Wallet address not available");

            // Check for library first
            if (!validatorMessagesLibAddress) {
                throw new Error('ValidatorMessages library must be deployed first. Please go to Validator Manager Setup and deploy the library.');
            }

            // Follow exact pattern from ValidatorManager deployment
            await coreWalletClient.addChain({ chain: viemChain });
            await coreWalletClient.switchChain({ id: viemChain!.id });

            const deployPromise = coreWalletClient.deployContract({
                abi: contractJson.abi as any,
                bytecode: getLinkedBytecode(contractJson.bytecode, validatorMessagesLibAddress),
                args: [0], // ICMInitializable.Allowed
                chain: viemChain,
                account: walletEVMAddress as `0x${string}`,
            });

            notify({
                type: 'deploy',
                name: contractName
            }, deployPromise, viemChain ?? undefined);

            const hash = await deployPromise;
            const receipt = await publicClient.waitForTransactionReceipt({ hash });

            if (!receipt.contractAddress) {
                throw new Error('No contract address in receipt');
            }

            setContractAddress(receipt.contractAddress);
        } catch (error) {
            setCriticalError(error instanceof Error ? error : new Error(String(error)));
        } finally {
            setIsDeploying(false);
        }
    }

    return (
        <div className="space-y-4">
            <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-lg p-4 border border-zinc-200 dark:border-zinc-700">
                <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">
                    Select Token Type
                </h3>
                <div className="flex gap-3">
                    <button
                        onClick={() => setTokenType('native')}
                        disabled={isDeploying || !!contractAddress}
                        className={`flex-1 px-4 py-3 rounded-lg border-2 transition-all ${
                            tokenType === 'native'
                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600'
                        } ${isDeploying || contractAddress ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                    >
                        <div className="text-left">
                            <div className="font-semibold text-sm">Native Token</div>
                            <div className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">
                                Use the L1's native token for staking
                            </div>
                        </div>
                    </button>
                    <button
                        onClick={() => setTokenType('erc20')}
                        disabled={isDeploying || !!contractAddress}
                        className={`flex-1 px-4 py-3 rounded-lg border-2 transition-all ${
                            tokenType === 'erc20'
                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600'
                        } ${isDeploying || contractAddress ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                    >
                        <div className="text-left">
                            <div className="font-semibold text-sm">ERC20 Token</div>
                            <div className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">
                                Use a custom ERC20 token for staking
                            </div>
                        </div>
                    </button>
                </div>
            </div>

            <p className="text-sm text-gray-500">
                This will deploy the <code>{isNative ? 'NativeTokenStakingManager' : 'ERC20TokenStakingManager'}</code> contract to the EVM network <code>{viemChain?.id}</code>.
                {isNative
                    ? ' The Native Token Staking Manager enables permissionless staking on your L1 using the native token.'
                    : ' The ERC20 Token Staking Manager enables permissionless staking on your L1 using a custom ERC20 token.'}
            </p>
            <p className="text-sm text-gray-500">
                Contract source: <a href={sourceUrl} target="_blank" rel="noreferrer">{isNative ? 'NativeTokenStakingManager.sol' : 'ERC20TokenStakingManager.sol'}</a> @ <code>{ICM_COMMIT.slice(0, 7)}</code>
            </p>
            {walletEVMAddress && (
                <p className="text-sm text-gray-500">
                    Connected wallet: <code>{walletEVMAddress}</code>
                </p>
            )}

            <LibraryRequirementStatus libraryAddress={validatorMessagesLibAddress} />

            <Button
                variant="primary"
                onClick={deployStakingManager}
                loading={isDeploying}
                disabled={isDeploying || !!contractAddress || !validatorMessagesLibAddress}
            >
                {!validatorMessagesLibAddress
                    ? "Deploy ValidatorMessages Library First"
                    : `Deploy ${contractName}`}
            </Button>

            <p>Deployment Status: <code>{contractAddress || "Not deployed"}</code></p>

            {contractAddress && (
                <Success
                    label={`${contractName} Address`}
                    value={contractAddress}
                />
            )}
        </div>
    );
}

export default withConsoleToolMetadata(DeployStakingManager, metadata);
