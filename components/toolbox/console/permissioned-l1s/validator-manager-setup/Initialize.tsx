"use client";

import { useWalletStore } from "@/components/toolbox/stores/walletStore";
import { useEffect, useState } from "react";
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
import { Step, Steps } from "fumadocs-ui/components/steps";
import { WalletRequirementsConfigKey } from "@/components/toolbox/hooks/useWalletRequirements";
import { BaseConsoleToolProps, ConsoleToolMetadata, withConsoleToolMetadata } from "../../../components/WithConsoleToolMetadata";
import { useConnectedWallet } from "@/components/toolbox/contexts/ConnectedWalletContext";
import useConsoleNotifications from "@/hooks/useConsoleNotifications";

const metadata: ConsoleToolMetadata = {
    title: "Initial Validator Manager Configuration",
    description: "Initialize the ValidatorManager contract with the initial configuration",
    walletRequirements: [
        WalletRequirementsConfigKey.EVMChainBalance
    ]
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

    const { sendCoreWalletNotSetNotification, notify } = useConsoleNotifications();

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

    return (
        <div>
                <Steps>
                    <Step>
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
                    </Step>
                    <Step>
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
                    <Step>
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
                {isInitialized === true && (
                    <ResultField
                        label="Initialization Event"
                        value={jsonStringifyWithBigint(initEvent)}
                        showCheck={isInitialized}
                    />
                )}
                {isInitialized !== null && (
                    <p className="mt-4">Initialization Status: {isInitialized ? 'Initialized' : 'Not Initialized'}</p>
                )}
        </div>

    );
}

export default withConsoleToolMetadata(Initialize, metadata);

function jsonStringifyWithBigint(value: unknown) {
    return JSON.stringify(value, (_, v) =>
        typeof v === 'bigint' ? v.toString() : v
        , 2);
}
