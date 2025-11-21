"use client";

import { useState } from "react";
import { useWalletStore } from "@/components/toolbox/stores/walletStore";
import { useToolboxStore, useViemChainStore } from "@/components/toolbox/stores/toolboxStore";
import { Button } from "@/components/toolbox/components/Button";
import { Success } from "@/components/toolbox/components/Success";
import { Input } from "@/components/toolbox/components/Input";
import { WalletRequirementsConfigKey } from "@/components/toolbox/hooks/useWalletRequirements";
import ExampleRewardCalculator from "@/contracts/icm-contracts/compiled/ExampleRewardCalculator.json";
import versions from '@/scripts/versions.json';
import useConsoleNotifications from '@/hooks/useConsoleNotifications';
import { ConsoleToolMetadata, withConsoleToolMetadata } from '../../../components/WithConsoleToolMetadata';
import { generateConsoleToolGitHubUrl } from "@/components/toolbox/utils/github-url";

const ICM_COMMIT = versions["ava-labs/icm-contracts"];
const EXAMPLE_REWARD_CALCULATOR_SOURCE_URL = `https://github.com/ava-labs/icm-contracts/blob/${ICM_COMMIT}/contracts/validator-manager/ExampleRewardCalculator.sol`;

const metadata: ConsoleToolMetadata = {
    title: "Deploy Example Reward Calculator",
    description: "Deploy an Example Reward Calculator contract for calculating staking rewards.",
    toolRequirements: [
        WalletRequirementsConfigKey.EVMChainBalance,
    ],
    githubUrl: generateConsoleToolGitHubUrl(import.meta.url)
};

function DeployExampleRewardCalculator() {
    const [criticalError, setCriticalError] = useState<Error | null>(null);
    const [isDeploying, setIsDeploying] = useState(false);
    const [rewardBasisPoints, setRewardBasisPoints] = useState<string>("500"); // Default 5% APR (500 basis points)

    const { coreWalletClient, publicClient, walletEVMAddress } = useWalletStore();
    const viemChain = useViemChainStore();
    const { rewardCalculatorAddress, setRewardCalculatorAddress } = useToolboxStore();
    const { notify } = useConsoleNotifications();

    // Throw critical errors during render
    if (criticalError) {
        throw criticalError;
    }

    async function deployExampleRewardCalculator() {
        setIsDeploying(true);
        setRewardCalculatorAddress("");
        try {
            if (!coreWalletClient) throw new Error("Wallet not connected");
            if (!walletEVMAddress) throw new Error("Wallet address not available");
            if (!viemChain) throw new Error("Chain not selected");

            await coreWalletClient.addChain({ chain: viemChain });
            await coreWalletClient.switchChain({ id: viemChain!.id });

            // Let viem handle gas estimation automatically
            // ExampleRewardCalculator is a simple contract, so auto-estimation should work
            const deployPromise = coreWalletClient.deployContract({
                abi: ExampleRewardCalculator.abi as any,
                bytecode: ExampleRewardCalculator.bytecode.object as `0x${string}`,
                args: [BigInt(rewardBasisPoints)], // Constructor takes uint64 rewardBasisPoints
                chain: viemChain,
                account: walletEVMAddress as `0x${string}`,
            });

            notify({
                type: 'deploy',
                name: 'Example Reward Calculator'
            }, deployPromise, viemChain ?? undefined);

            const hash = await deployPromise;
            const receipt = await publicClient.waitForTransactionReceipt({ hash });

            if (!receipt.contractAddress) {
                throw new Error('No contract address in receipt');
            }

            setRewardCalculatorAddress(receipt.contractAddress);
        } catch (error) {
            setCriticalError(error instanceof Error ? error : new Error(String(error)));
        } finally {
            setIsDeploying(false);
        }
    }

    return (
        <div className="space-y-4">
            <p className="text-sm text-gray-500">
                This will deploy the <code>ExampleRewardCalculator</code> contract to the EVM network <code>{viemChain?.id}</code>.
                The Example Reward Calculator implements a linear, non-compounding reward calculation that rewards a set percentage of tokens per year.
            </p>
            <p className="text-sm text-gray-500">
                Contract source: <a href={EXAMPLE_REWARD_CALCULATOR_SOURCE_URL} target="_blank" rel="noreferrer">ExampleRewardCalculator.sol</a> @ <code>{ICM_COMMIT.slice(0, 7)}</code>
            </p>

            <div className="space-y-4">
                <Input
                    label="Reward Rate (basis points, 100 = 1% APR)"
                    value={rewardBasisPoints}
                    onChange={setRewardBasisPoints}
                    type="number"
                    min="0"
                    max="10000"
                    disabled={isDeploying}
                    placeholder="500 (5% APR)"
                    helperText="The annual percentage rate (APR) for staking rewards. 100 basis points = 1%"
                />
            </div>

            <Button
                variant="primary"
                onClick={deployExampleRewardCalculator}
                loading={isDeploying}
                disabled={isDeploying || !!rewardCalculatorAddress || !rewardBasisPoints}
            >
                Deploy Example Reward Calculator
            </Button>

            <p>Deployment Status: <code>{rewardCalculatorAddress || "Not deployed"}</code></p>

            {rewardCalculatorAddress && (
                <Success
                    label="Example Reward Calculator Address"
                    value={rewardCalculatorAddress}
                />
            )}
        </div>
    );
}

export default withConsoleToolMetadata(DeployExampleRewardCalculator, metadata);

