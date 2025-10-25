"use client";

import { useWalletStore } from "@/components/toolbox/stores/walletStore";
import { useEffect, useState, useMemo } from "react";
import { Button } from "@/components/toolbox/components/Button";
import { Input } from "@/components/toolbox/components/Input";
import { ResultField } from "@/components/toolbox/components/ResultField";
import { AbiEvent } from 'viem';
import ValidatorManagerABI from "@/contracts/icm-contracts/compiled/ValidatorManager.json";
import { utils } from "@avalabs/avalanchejs";
import SelectSubnetId from "@/components/toolbox/components/SelectSubnetId";
import { EVMAddressInput } from "@/components/toolbox/components/EVMAddressInput";
import { useViemChainStore } from "@/components/toolbox/stores/toolboxStore";
import { useSelectedL1 } from "@/components/toolbox/stores/l1ListStore";
import { useCreateChainStore } from "@/components/toolbox/stores/createChainStore";
import { ProgressSteps as Steps, ProgressStep as Step } from "@/components/toolbox/components/ProgressSteps";
import { WalletRequirementsConfigKey } from "@/components/toolbox/hooks/useWalletRequirements";
import { BaseConsoleToolProps, ConsoleToolMetadata, withConsoleToolMetadata } from "../../../components/WithConsoleToolMetadata";
import { useConnectedWallet } from "@/components/toolbox/contexts/ConnectedWalletContext";
import useConsoleNotifications from "@/hooks/useConsoleNotifications";
import { generateConsoleToolGitHubUrl } from "@/components/toolbox/utils/github-url";
import { Copy, Check } from "lucide-react";

const metadata: ConsoleToolMetadata = {
    title: "Initial Validator Manager Configuration",
    description: "Initialize the ValidatorManager contract with the initial configuration",
    toolRequirements: [
        WalletRequirementsConfigKey.EVMChainBalance
    ],
    githubUrl: generateConsoleToolGitHubUrl(import.meta.url)
};

function Initialize({ onSuccess }: BaseConsoleToolProps) {
    const [proxyAddress, setProxyAddress] = useState<string>("");
    const { walletEVMAddress, publicClient } = useWalletStore();
    const { coreWalletClient } = useConnectedWallet();
    const [isChecking, setIsChecking] = useState(false);
    const [isInitializing, setIsInitializing] = useState(false);
    const [isInitialized, setIsInitialized] = useState<boolean | null>(null);
    const [initEvent, setInitEvent] = useState<unknown>(null);
    const [churnPeriodSeconds, setChurnPeriodSeconds] = useState("0");
    const [maximumChurnPercentage, setMaximumChurnPercentage] = useState("20");
    const [adminAddress, setAdminAddress] = useState("");
    const viemChain = useViemChainStore();
    const selectedL1 = useSelectedL1()();
    const [subnetId, setSubnetId] = useState("");
    const createChainStoreSubnetId = useCreateChainStore()(state => state.subnetId);
    const createChainStoreVMCAddress = useCreateChainStore()(state => state.managerAddress);

    const { notify } = useConsoleNotifications();

    useEffect(() => {
        if (walletEVMAddress && !adminAddress) {
            setAdminAddress(walletEVMAddress);
        }
    }, [walletEVMAddress, adminAddress]);

    useEffect(() => {
        if (createChainStoreSubnetId && !subnetId) {
            setSubnetId(createChainStoreSubnetId);
        } else if (selectedL1?.subnetId && !subnetId) {
            setSubnetId(selectedL1.subnetId);
        }
    }, [createChainStoreSubnetId, selectedL1, subnetId]);

    useEffect(() => {
        if (createChainStoreVMCAddress && !proxyAddress) {
            setProxyAddress(createChainStoreVMCAddress);
        }
    }, [createChainStoreVMCAddress]);
    
    let subnetIDHex = "";
    try {
        subnetIDHex = utils.bufferToHex(utils.base58check.decode(subnetId || ""));
    } catch (error) {
        console.error('Error decoding subnetId:', error);
    }


    async function checkIfInitialized() {
        if (!proxyAddress || !window.avalanche) return;

        setIsChecking(true);
        try {
            const initializedEvent = ValidatorManagerABI.abi.find(
                item => item.type === 'event' && item.name === 'Initialized'
            );

            if (!initializedEvent) {
                throw new Error('Initialized event not found in ABI');
            }

            // Instead of querying from block 0, try to check initialization status using the contract method first
            try {
                // Try to call a read-only method that would fail if not initialized
                const isInit = await publicClient.readContract({
                    address: proxyAddress as `0x${string}`,
                    abi: ValidatorManagerABI.abi,
                    functionName: 'admin'
                });

                // If we get here without error, contract is initialized
                setIsInitialized(true);
                console.log('Contract is initialized, admin:', isInit);
                return;
            } catch (readError) {
                // If this fails with a specific revert message about not being initialized, we know it's not initialized
                if ((readError as any)?.message?.includes('not initialized')) {
                    setIsInitialized(false);
                    return;
                }
                // Otherwise, fallback to log checking with a smaller block range
            }

            // Fallback: Check logs but with a more limited range
            // Get current block number
            const latestBlock = await publicClient.getBlockNumber();
            // Use a reasonable range (2000 blocks) or start from recent blocks
            const fromBlock = latestBlock > 2000n ? latestBlock - 2000n : 0n;

            const logs = await publicClient.getLogs({
                address: proxyAddress as `0x${string}`,
                event: initializedEvent as AbiEvent,
                fromBlock: fromBlock,
                toBlock: 'latest'
            });

            console.log('Initialization logs:', logs);
            setIsInitialized(logs.length > 0);
            if (logs.length > 0) {
                setInitEvent(logs[0]);
            }
        } catch (error) {
            console.error('Error checking initialization:', error);
            // setCriticalError(error instanceof Error ? error : new Error(String(error))); // Removed criticalError
        } finally {
            setIsChecking(false);
        }
    }

    async function handleInitialize() {
        setIsInitializing(true);

        const formattedSubnetId = subnetIDHex.startsWith('0x') ? subnetIDHex : `0x${subnetIDHex}`;
        const formattedAdmin = adminAddress as `0x${string}`;

        const settings = {
            admin: formattedAdmin,
            subnetID: formattedSubnetId,
            churnPeriodSeconds: BigInt(churnPeriodSeconds),
            maximumChurnPercentage: Number(maximumChurnPercentage)
        };

        const initPromise = coreWalletClient.writeContract({
            address: proxyAddress as `0x${string}`,
            abi: ValidatorManagerABI.abi,
            functionName: 'initialize',
            args: [settings],
            chain: viemChain ?? undefined,
            account: walletEVMAddress as `0x${string}`
        });

        notify({
            type: 'call',
            name: 'Initialize Validator Manager'
        }, initPromise, viemChain ?? undefined);

        try {
            const hash = await initPromise;
            await publicClient.waitForTransactionReceipt({ hash });
            await checkIfInitialized();
        } finally {
            setIsInitializing(false);
        }
    }

    // Calculate current step and completed steps
    const currentStep = useMemo(() => {
        if (isInitialized) return 3; // All done
        if (subnetId && proxyAddress && isInitialized === false) return 3; // Ready to initialize
        if (subnetId) return 3; // Has subnet, ready for config
        if (proxyAddress && isInitialized !== null) return 2; // Checked status, move to subnet
        return 1; // Starting
    }, [proxyAddress, isInitialized, subnetId]);

    const completedSteps = useMemo(() => {
        const completed: number[] = [];
        if (proxyAddress && isInitialized !== null) completed.push(1);
        if (subnetId) completed.push(2);
        if (isInitialized) completed.push(3);
        return completed;
    }, [proxyAddress, isInitialized, subnetId]);

    return (
        <div>
                <Steps currentStep={currentStep} completedSteps={completedSteps}>
                    <Step stepNumber={1}>
                        <h2 className="text-lg font-semibold">Select the Validator Manager</h2>
                        <p className="text-sm text-gray-500">
                            Select the proxy contract pointing to the ValidatorManager implementation you want to initialize.
                        </p>

                        <EVMAddressInput
                            label="Proxy Address of ValidatorManager"
                            value={proxyAddress}
                            onChange={setProxyAddress}
                            disabled={isInitializing}
                        />


                        <Button
                            onClick={checkIfInitialized}
                            loading={isChecking}
                            disabled={!proxyAddress}
                            size="sm"
                        >
                            Check Status
                        </Button>

                        {isInitialized !== null && (
                            <p className="mt-2 text-sm text-gray-500">
                                Status: {isInitialized ? 'Already Initialized' : 'Not Initialized'}
                            </p>
                        )}
                    </Step>
                    <Step stepNumber={2}>
                        <h2 className="text-lg font-semibold">Select Subnet/L1 for the Validator Manager</h2>
                        <p className="text-sm text-gray-500">
                            Enter the SubnetID of the Subnet/L1 this Validator Manager contract will manage the validators for. The P-Chain will only accept validator set changes from the Validator Manager contract addresses and blockchainID combination that was indicated in the ConvertSubnetToL1Tx.
                        </p>
                        <SelectSubnetId
                            value={subnetId}
                            onChange={setSubnetId}
                            hidePrimaryNetwork={true}
                        />

                        <Input
                            label={`Subnet ID (Hex), ${utils.hexToBuffer(subnetIDHex).length} bytes`}
                            value={subnetIDHex}
                            disabled
                        />

                    </Step>
                    <Step stepNumber={3}>
                        <h2 className="text-lg font-semibold">Set the Validator Manager Configuration</h2>
                        <p className="text-sm text-gray-500">
                            Set the intitial configuration for the Validator Manager contract. The admin address should be a multisig wallet for production L1s, since it can take full control over the L1 validator set by arbitrarily changing the validator set. The churn settings define how rapid changes to the validator set can be made.
                        </p>

                        <EVMAddressInput
                            label="Validator Admin Address (should be a multisig for production L1s, can be changed later)"
                            value={adminAddress}
                            onChange={setAdminAddress}
                            disabled={isInitializing}
                            placeholder="Enter admin address"
                        />

                        <Input
                            label="Churn Period (seconds)"
                            type="number"
                            value={churnPeriodSeconds}
                            onChange={setChurnPeriodSeconds}
                            placeholder="Enter churn period in seconds"
                        />
                        <Input
                            label="Maximum Churn Percentage"
                            type="number"
                            value={maximumChurnPercentage}
                            onChange={setMaximumChurnPercentage}
                            placeholder="Enter maximum churn percentage"
                        />
                        <Button
                            variant="primary"
                            onClick={handleInitialize}
                            loading={isInitializing}
                            disabled={isInitializing}
                        >
                            Initialize Contract
                        </Button>

                    </Step>
                </Steps>

                {(isInitialized === true && initEvent) ? (
                    <ResultField
                        label="Initialization Event"
                        value={jsonStringifyWithBigint(initEvent)}
                        showCheck={isInitialized}
                    />
                ) : null}
        </div>

    );
}

export default withConsoleToolMetadata(Initialize, metadata);

function jsonStringifyWithBigint(value: unknown): string {
    return JSON.stringify(value, (_, v) =>
        typeof v === 'bigint' ? v.toString() : v
        , 2);
}
