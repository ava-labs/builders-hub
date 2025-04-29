"use client";

import { useSelectedL1, useViemChainStore } from "../toolboxStore";
import { useWalletStore } from "../../lib/walletStore";
import { useErrorBoundary } from "react-error-boundary";
import { useEffect, useState } from "react";
import { Button } from "../../components/Button";
import { Input } from "../../components/Input";
import { ResultField } from "../components/ResultField";
import { AbiEvent } from 'viem';
import ValidatorManagerABI from "../../../contracts/icm-contracts/compiled/ValidatorManager.json";
import { utils } from "@avalabs/avalanchejs";

import { Container } from "../components/Container";
import { getSubnetInfo } from "../../coreViem/utils/glacier";
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
    const selectedL1 = useSelectedL1();

    useEffect(() => {
        if (walletEVMAddress && !adminAddress) {
            setAdminAddress(walletEVMAddress);
        }
    }, [walletEVMAddress, adminAddress]);

    let subnetIDHex = "";
    try {
        subnetIDHex = utils.bufferToHex(utils.base58check.decode(selectedL1?.subnetId || ""));
    } catch (error) {
        console.error('Error decoding subnetId:', error);
    }


    useEffect(() => {
        if (proxyAddress) {
            checkIfInitialized();
        }
    }, [proxyAddress]);

    const [contractAddressError, setContractAddressError] = useState<string>("");

    useEffect(() => {
        setContractAddressError("");
        const subnetId = selectedL1?.subnetId;
        if (!subnetId) return;
        getSubnetInfo(subnetId).then((subnetInfo) => {
            setProxyAddress(subnetInfo.l1ValidatorManagerDetails?.contractAddress || "");
        }).catch((error) => {
            console.error('Error getting subnet info:', error);
            setContractAddressError((error as Error)?.message || "Unknown error");
        });
    }, [selectedL1]);



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

            const logs = await publicClient.getLogs({
                address: proxyAddress as `0x${string}`,
                event: initializedEvent as AbiEvent,
                fromBlock: 0n,
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
                    <Input
                        label="Proxy address"
                        value={proxyAddress}
                        onChange={setProxyAddress}
                        placeholder="Enter proxy address"
                        error={contractAddressError}
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

                <Input
                    label="Subnet ID"
                    value={selectedL1?.subnetId}
                    disabled
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
                    <Input
                        label="Admin Address"
                        value={adminAddress}
                        onChange={setAdminAddress}
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
