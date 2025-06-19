"use client";

import { useWalletStore } from "../../stores/walletStore";
import { useErrorBoundary } from "react-error-boundary";
import { useEffect, useState } from "react";
import { Button } from "../../components/Button";
import { Input } from "../../components/Input";
import { ResultField } from "../../components/ResultField";
import { AbiEvent } from 'viem';
import ValidatorManagerABI from "../../../contracts/icm-contracts/compiled/ValidatorManager.json";
import { utils } from "@avalabs/avalanchejs";
import SelectSubnetId from "../../components/SelectSubnetId";
import { Container } from "../../components/Container";
import { getSubnetInfo } from "../../coreViem/utils/glacier";
import { EVMAddressInput } from "../../components/EVMAddressInput";
import { useViemChainStore } from "../../stores/toolboxStore";
import { useSelectedL1 } from "../../stores/l1ListStore";
import { useCreateChainStore } from "../../stores/createChainStore";

export default function Initialize() {
    const { showBoundary } = useErrorBoundary();
    const [proxyAddress, setProxyAddress] = useState<string>("");
    const { walletEVMAddress, coreWalletClient, publicClient } = useWalletStore();
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

    useEffect(() => {
        if (proxyAddress) {
            checkIfInitialized();
        }
    }, [proxyAddress]);

    useEffect(() => {
        if (!subnetId) return;
        getSubnetInfo(subnetId).then((subnetInfo) => {
            setProxyAddress(subnetInfo.l1ValidatorManagerDetails?.contractAddress || "");
        }).catch((error) => {
            console.error('Error getting subnet info:', error);
        });
    }, [subnetId]);



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
            showBoundary(error);
        } finally {
            setIsChecking(false);
        }
    }

    async function handleInitialize() {
        if (!proxyAddress || !window.avalanche) return;

        setIsInitializing(true);
        try {
            const formattedSubnetId = subnetIDHex.startsWith('0x') ? subnetIDHex : `0x${subnetIDHex}`;
            const formattedAdmin = adminAddress as `0x${string}`;

            // Create settings object with exact types from the ABI
            const settings = {
                admin: formattedAdmin,
                subnetID: formattedSubnetId, // Note: ABI shows it as subnetID (capital ID), not subnetId
                churnPeriodSeconds: BigInt(churnPeriodSeconds),
                maximumChurnPercentage: Number(maximumChurnPercentage)
            };

            console.log("Settings object:", settings);

            const hash = await coreWalletClient.writeContract({
                address: proxyAddress as `0x${string}`,
                abi: ValidatorManagerABI.abi,
                functionName: 'initialize',
                args: [settings],
                chain: viemChain,
            });

            await publicClient.waitForTransactionReceipt({ hash });
            await checkIfInitialized();
        } catch (error) {
            console.error('Error initializing:', error);
            showBoundary(error);
        } finally {
            setIsInitializing(false);
        }
    }

    return (

        <Container
            title="Initial Validator Manager Configuration"
            description="This will initialize the ValidatorManager contract with the initial configuration."
        >
            <div className="space-y-4">
                <div className="space-y-2">
                    <EVMAddressInput
                        label="Proxy Address of ValidatorManager"
                        value={proxyAddress}
                        onChange={setProxyAddress}
                        disabled={isInitializing}
                    />
                    <Button
                        variant="secondary"
                        onClick={checkIfInitialized}
                        loading={isChecking}
                        disabled={!proxyAddress}
                        size="sm"
                        stickLeft
                    >
                        Check Status
                    </Button>
                </div>

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



                <div className="space-y-4">
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
                    <EVMAddressInput
                        label="Admin Address"
                        value={adminAddress}
                        onChange={setAdminAddress}
                        disabled={isInitializing}
                        placeholder="Enter admin address"
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

    );
};

function jsonStringifyWithBigint(value: unknown) {
    return JSON.stringify(value, (_, v) =>
        typeof v === 'bigint' ? v.toString() : v
        , 2);
}
