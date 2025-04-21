"use client";

import { useToolboxStore, useViemChainStore } from "../toolboxStore";
import { useWalletStore } from "../../lib/walletStore";
import { useErrorBoundary } from "react-error-boundary";
import { useEffect, useState } from "react";
import { Button } from "../../components/Button";
import { Input } from "../../components/Input";
import { ResultField } from "../components/ResultField";
import { AbiEvent, Log, parseEther } from 'viem';
import NativeTokenStakingManagerABI from "../../../contracts/icm-contracts/compiled/NativeTokenStakingManager.json";
import { RequireChainToolboxL1 } from "../components/RequireChainToolboxL1";
import { Container } from "../components/Container";

export default function Initialize() {
    const { showBoundary } = useErrorBoundary();
    const { stakingManagerAddress, setStakingManagerAddress, managerAddress, setManagerAddress, rewardCalculatorAddress, setRewardCalculatorAddress } = useToolboxStore();
    const { walletEVMAddress, coreWalletClient, publicClient } = useWalletStore();
    const [isChecking, setIsChecking] = useState(false);
    const [isInitializing, setIsInitializing] = useState(false);
    const [isInitialized, setIsInitialized] = useState<boolean | null>(null);
    const [initEvent, setInitEvent] = useState<unknown>(null);
    const [minimumStakeAmount, setMinimumStakeAmount] = useState("1");
    const [maximumStakeAmount, setMaximumStakeAmount] = useState("100");
    const [minimumStakeDuration, setMinimumStakeDuration] = useState("3600");
    const [minimumDelegationFeeBips, setMinimumDelegationFeeBips] = useState("100");
    const [maximumStakeMultiplier, setMaximumStakeMultiplier] = useState("1");
    const [weightToValueFactor, setWeightToValueFactor] = useState("1");
    const [uptimeBlockchainID, setUptimeBlockchainID] = useState("");
    const viemChain = useViemChainStore();

    useEffect(() => {
        if (walletEVMAddress && !managerAddress) {
            setManagerAddress(walletEVMAddress);
        }
    }, [walletEVMAddress, managerAddress]);

    useEffect(() => {
        if (stakingManagerAddress) {
            checkIfInitialized();
        }
    }, []);

    async function checkIfInitialized() {
        if (!stakingManagerAddress || !window.avalanche) return;

        setIsChecking(true);
        try {
            const initializedEvent = NativeTokenStakingManagerABI.abi.find(
                (item: any) => item.type === 'event' && item.name === 'Initialized'
            );

            if (!initializedEvent) {
                throw new Error('Initialized event not found in ABI');
            }

            // Get the latest block number
            const latestBlock = await publicClient.getBlockNumber();

            // Define chunk size (staying well below the 2048 limit)
            const CHUNK_SIZE = 1000n;
            let logs: Log[] = [];

            // Check the most recent blocks first (most likely place for initialization)
            let fromBlock = latestBlock > CHUNK_SIZE ? latestBlock - CHUNK_SIZE : 0n;
            let toBlock = latestBlock;

            // First check recent blocks
            const recentLogs = await publicClient.getLogs({
                address: stakingManagerAddress as `0x${string}`,
                event: initializedEvent as AbiEvent,
                fromBlock,
                toBlock
            });

            if (recentLogs.length > 0) {
                logs = recentLogs;
            } else if (fromBlock > 0n) {
                // If not found in recent blocks and we have older blocks to check,
                // scan in chunks from oldest to newest until we find logs or reach the already checked blocks
                let currentToBlock = fromBlock - 1n;

                // Start from block 0 and move forward in chunks
                for (let currentFromBlock = 0n; currentFromBlock < currentToBlock; currentFromBlock += CHUNK_SIZE) {
                    const adjustedToBlock = currentFromBlock + CHUNK_SIZE > currentToBlock
                        ? currentToBlock
                        : currentFromBlock + CHUNK_SIZE - 1n;

                    const chunkLogs = await publicClient.getLogs({
                        address: stakingManagerAddress as `0x${string}`,
                        event: initializedEvent as AbiEvent,
                        fromBlock: currentFromBlock,
                        toBlock: adjustedToBlock
                    });

                    if (chunkLogs.length > 0) {
                        logs = chunkLogs;
                        break;
                    }
                }
            }

            console.log('Initialization logs:', logs);
            setIsInitialized(logs.length > 0);
            if (logs.length > 0) {
                setInitEvent(logs[0]);
            }
        } catch (error) {
            console.error('Error checking initialization:', error);
            showBoundary(error);
        } finally {
            setIsChecking(false);
        }
    }

    async function handleInitialize() {
        if (!stakingManagerAddress || !window.avalanche) return;

        setIsInitializing(true);
        try {
            const settings = {
                Manager: managerAddress,
                MinimumStakeAmount: parseEther(minimumStakeAmount),
                MaximumStakeAmount: parseEther(maximumStakeAmount),
                MinimumStakeDuration: BigInt(minimumStakeDuration),
                MinimumDelegationFeeBips: Number(minimumDelegationFeeBips),
                MaximumStakeMultiplier: Number(maximumStakeMultiplier),
                WeightToValueFactor: parseEther(weightToValueFactor),
                RewardCalculator: rewardCalculatorAddress,
                UptimeBlockchainID: uptimeBlockchainID as `0x${string}`
            };

            const hash = await coreWalletClient.writeContract({
                address: stakingManagerAddress as `0x${string}`,
                abi: NativeTokenStakingManagerABI.abi,
                functionName: 'initialize',
                args: [settings],
                chain: viemChain,
            });

            await publicClient.waitForTransactionReceipt({ hash });
            await checkIfInitialized();
        } catch (error) {
            showBoundary(error);
        } finally {
            setIsInitializing(false);
        }
    }

    return (
        <RequireChainToolboxL1>
            <Container
                title="Set Initial Staking Manager Configuration"
                description="This will initialize the NativeTokenStakingManager contract."
            >
                <div className="space-y-4">
                    <Input
                        label="Staking Manager address"
                        value={stakingManagerAddress}
                        onChange={setStakingManagerAddress}
                        placeholder="Enter staking manager address"
                        button={
                            <Button
                                variant="secondary"
                                onClick={checkIfInitialized}
                                loading={isChecking}
                                disabled={!stakingManagerAddress}
                            >
                                Check Status
                            </Button>
                        }
                    />

                    <div className="space-y-4">
                        <Input
                            label="ValidatorManager Address"
                            value={managerAddress}
                            onChange={setManagerAddress}
                            placeholder="Enter validator manager address"
                        />
                        <Input
                            label="Reward Calculator Address"
                            value={rewardCalculatorAddress}
                            onChange={setRewardCalculatorAddress}
                            placeholder="Enter reward calculator address"
                        />
                        <Input
                            label="Uptime Blockchain ID"
                            value={uptimeBlockchainID}
                            onChange={setUptimeBlockchainID}
                            placeholder="Enter uptime blockchain ID (32 bytes hex)"
                        />
                        <Input
                            label="Minimum Stake Amount (tokens)"
                            type="number"
                            value={minimumStakeAmount}
                            onChange={setMinimumStakeAmount}
                            placeholder="Enter minimum stake amount in tokens"
                            helperText="Value will be converted to wei (1 token = 10^18 wei)"
                        />
                        <Input
                            label="Maximum Stake Amount (tokens)"
                            type="number"
                            value={maximumStakeAmount}
                            onChange={setMaximumStakeAmount}
                            placeholder="Enter maximum stake amount in tokens"
                            helperText="Value will be converted to wei (1 token = 10^18 wei)"
                        />
                        <Input
                            label="Minimum Stake Duration"
                            type="number"
                            value={minimumStakeDuration}
                            onChange={setMinimumStakeDuration}
                            placeholder="Enter minimum stake duration"
                        />
                        <Input
                            label="Minimum Delegation Fee (BIPS)"
                            type="number"
                            value={minimumDelegationFeeBips}
                            onChange={setMinimumDelegationFeeBips}
                            placeholder="Enter minimum delegation fee in BIPS"
                        />
                        <Input
                            label="Maximum Stake Multiplier"
                            type="number"
                            value={maximumStakeMultiplier}
                            onChange={setMaximumStakeMultiplier}
                            placeholder="Enter maximum stake multiplier"
                        />
                        <Input
                            label="Weight To Value Factor (tokens)"
                            type="number"
                            value={weightToValueFactor}
                            onChange={setWeightToValueFactor}
                            placeholder="Enter weight to value factor in tokens"
                            helperText="Value will be converted to wei (1 token = 10^18 wei)"
                        />
                        <Button
                            variant="primary"
                            onClick={handleInitialize}
                            loading={isInitializing}
                            disabled={isInitializing}
                        >
                            Initialize Contract
                        </Button>
                    </div>
                    {isInitialized === true && (
                        <ResultField
                            label="Initialization Event"
                            value={jsonStringifyWithBigint(initEvent)}
                            showCheck={isInitialized}
                        />
                    )}
                </div>
            </Container>
        </RequireChainToolboxL1>
    );
};

function jsonStringifyWithBigint(value: unknown) {
    return JSON.stringify(value, (_, v) =>
        typeof v === 'bigint' ? v.toString() : v
        , 2);
}
