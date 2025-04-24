"use client";

import { useToolboxStore, useViemChainStore } from "../toolboxStore";
import { useWalletStore } from "../../lib/walletStore";
import { useErrorBoundary } from "react-error-boundary";
import { useState } from "react";
import { Button } from "../../components/Button";
import { ResultField } from "../components/ResultField";
import ExampleRewardCalculatorABI from "../../../contracts/icm-contracts/compiled/ExampleRewardCalculator.json";

import { Container } from "../components/Container";

export default function DeployRewardCalculator() {
    const { showBoundary } = useErrorBoundary();
    const { rewardCalculatorAddress, setRewardCalculatorAddress } = useToolboxStore();
    const { coreWalletClient, publicClient } = useWalletStore();
    const [isDeploying, setIsDeploying] = useState(false);
    const [rewardBasisPoints, setRewardBasisPoints] = useState<number>(500);
    const viemChain = useViemChainStore();

    async function handleDeploy() {
        setIsDeploying(true);
        setRewardCalculatorAddress("");
        try {
            const hash = await coreWalletClient.deployContract({
                abi: ExampleRewardCalculatorABI.abi,
                bytecode: ExampleRewardCalculatorABI.bytecode.object,
                args: [rewardBasisPoints],
                chain: viemChain,
            });

            const receipt = await publicClient.waitForTransactionReceipt({ hash });

            if (!receipt.contractAddress) {
                throw new Error('No contract address in receipt');
            }

            setRewardCalculatorAddress(receipt.contractAddress);
        } catch (error) {
            showBoundary(error);
        } finally {
            setIsDeploying(false);
        }
    }


    return (

        <Container
            title="Deploy Example Reward Calculator"
            description="This will deploy the ExampleRewardCalculator contract to the EVM network."
        >
            <div className="space-y-4">
                <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-md text-sm mb-4">
                    <p className="mb-2"><strong>Note:</strong> The example calculator:</p>
                    <ul className="list-disc pl-5 space-y-1">
                        <li>Sets a minimum uptime threshold (80%) for validators to receive rewards</li>
                        <li>Calculates rewards linearly based on stake amount and duration</li>
                        <li>Uses basis points (BIPs) to define the annual reward rate</li>
                    </ul>
                    <p className="mt-2">The <strong>rewardBasisPoints</strong> parameter represents the annual reward rate in basis points (1 basis point = 0.01%):</p>
                    <ul className="list-disc pl-5 space-y-1">
                        <li>500 basis points = 5% annual yield</li>
                        <li>1000 basis points = 10% annual yield</li>
                    </ul>
                    <p className="mb-2">This is just an example calculator that should be modified for your specific reward calculation needs. View the source code on GitHub: <a href="https://github.com/ava-labs/icm-contracts/blob/main/contracts/validator-manager/ExampleRewardCalculator.sol" target="_blank" rel="noopener noreferrer">ExampleRewardCalculator.sol</a></p>
                </div>

                <div className="mb-4">
                    <label htmlFor="rewardBasisPoints" className="block text-sm font-medium mb-1">
                        Annual Reward Rate (basis points)
                    </label>
                    <input
                        id="rewardBasisPoints"
                        type="number"
                        min="1"
                        max="10000"
                        value={rewardBasisPoints}
                        onChange={(e) => setRewardBasisPoints(Number(e.target.value))}
                        className="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900"
                    />
                </div>

                <Button
                    variant="primary"
                    onClick={handleDeploy}
                    loading={isDeploying}
                    disabled={isDeploying}
                >
                    Deploy Contract
                </Button>
            </div>
            {rewardCalculatorAddress && (
                <ResultField
                    label="Example Reward Calculator Address"
                    value={rewardCalculatorAddress}
                    showCheck={!!rewardCalculatorAddress}
                />
            )}
        </Container>

    );
};

