"use client";

import { useWalletStore } from "../../stores/walletStore";
import { useViemChainStore } from "../../stores/toolboxStore";
import { useSelectedL1 } from "../../stores/l1ListStore";
import { useErrorBoundary } from "react-error-boundary";
import { useState, useEffect } from "react";
import { Button } from "../../components/Button";
import { Success } from "../../components/Success";
import ProxyAdminABI from "../../../contracts/openzeppelin-4.9/compiled/ProxyAdmin.json";
import { Container } from "../../components/Container";
import { useToolboxStore } from "../../stores/toolboxStore";
import { getSubnetInfo } from "../../coreViem/utils/glacier";
import { EVMAddressInput } from "../../components/EVMAddressInput";
import { Input } from "../../components/Input";

// Storage slot with the admin of the proxy (following EIP1967)
const ADMIN_SLOT = "0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103";

export default function UpgradeProxy() {
    const { showBoundary } = useErrorBoundary();
    const { validatorManagerAddress } = useToolboxStore();
    const [proxyAdminAddress, setProxyAdminAddress] = useState<`0x${string}` | null>(null);
    const selectedL1 = useSelectedL1()();
    const { coreWalletClient, publicClient, walletChainId } = useWalletStore();
    const [isUpgrading, setIsUpgrading] = useState(false);
    const [currentImplementation, setCurrentImplementation] = useState<string | null>(null);
    const [desiredImplementation, setDesiredImplementation] = useState<string | null>(null);
    const [proxySlotAdmin, setProxySlotAdmin] = useState<string | null>(null);
    const [contractError, setContractError] = useState<string | undefined>();
    const viemChain = useViemChainStore();

    const [proxyAddress, setProxyAddress] = useState<string>("");

    useEffect(() => {
        (async function () {
            try {
                const subnetId = selectedL1?.subnetId;
                if (!subnetId) {
                    return;
                }
                const info = await getSubnetInfo(subnetId);
                const newProxyAddress = info.l1ValidatorManagerDetails?.contractAddress || "";
                setProxyAddress(newProxyAddress);

                if (!newProxyAddress) return
                await readProxyAdminSlot(newProxyAddress);
            } catch (error) {
                showBoundary(error);
            }
        })()
    }, [walletChainId]);

    // Read the proxy admin from storage slot
    async function readProxyAdminSlot(address: string) {
        try {
            if (!address) return;

            const data = await publicClient.getStorageAt({
                address: address as `0x${string}`,
                slot: ADMIN_SLOT as `0x${string}`,
            });

            if (data) {
                // Convert the bytes32 value to an address (take the last 20 bytes)
                const adminAddress = `0x${data.slice(-40)}` as `0x${string}`;
                setProxySlotAdmin(adminAddress);

                // Always use the admin from storage
                setProxyAdminAddress(adminAddress);
            }
        } catch (error) {
            console.error("Failed to read proxy admin slot:", error);
        }
    }

    useEffect(() => {
        if (proxyAddress) {
            readProxyAdminSlot(proxyAddress);
        }
    }, [proxyAddress]);

    useEffect(() => {
        if (validatorManagerAddress && !desiredImplementation) {
            setDesiredImplementation(validatorManagerAddress);
        }
    }, [validatorManagerAddress, desiredImplementation]);

    useEffect(() => {
        checkCurrentImplementation();
    }, [viemChain, proxyAddress, proxyAdminAddress]);


    async function checkCurrentImplementation() {
        try {
            if (!proxyAddress || !proxyAdminAddress) {
                setCurrentImplementation(null);
                setContractError("Proxy address and admin address are required");
                return;
            }

            const implementation = await publicClient.readContract({
                address: proxyAdminAddress,
                abi: ProxyAdminABI.abi,
                functionName: 'getProxyImplementation',
                args: [proxyAddress],
            });

            setCurrentImplementation(implementation as string);
            setContractError(undefined);
        } catch (error: unknown) {
            setCurrentImplementation(null);
            const errorMessage = error instanceof Error ? error.message : "Failed to read current implementation";
            setContractError(errorMessage);
            console.error(error);
        }
    }

    async function handleUpgrade() {
        if (!desiredImplementation) {
            throw new Error('Implementation address is required');
        }
        
        if (!proxyAddress) {
            throw new Error('Proxy address is required');
        }
        
        if (!proxyAdminAddress) {
            throw new Error('Proxy admin address is required');
        }

        setIsUpgrading(true);
        try {
            const hash = await coreWalletClient.writeContract({
                address: proxyAdminAddress,
                abi: ProxyAdminABI.abi,
                functionName: 'upgrade',
                args: [proxyAddress, desiredImplementation as `0x${string}`],
                chain: viemChain,
            });

            await publicClient.waitForTransactionReceipt({ hash });
            await checkCurrentImplementation();
        } catch (error) {
            showBoundary(error);
        } finally {
            setIsUpgrading(false);
        }
    }

    const isUpgradeNeeded = currentImplementation?.toLowerCase() !== desiredImplementation?.toLowerCase();
    const canUpgrade = !!proxyAddress && !!proxyAdminAddress && !!desiredImplementation && isUpgradeNeeded;

    return (
        <Container
            title="Upgrade Proxy Implementation"
            description="This will upgrade the proxy implementation to the desired implementation."
        >
            <EVMAddressInput
                label="Proxy Address"
                value={proxyAddress}
                onChange={setProxyAddress}
                disabled={isUpgrading}
                placeholder="Enter proxy address"
            />
            <Input
                label="Proxy Admin Address"
                value={proxySlotAdmin || ""}
                disabled={true}
                placeholder="Proxy admin address will be read from storage"
            />
            <EVMAddressInput
                label="Desired Implementation"
                value={desiredImplementation || ""}
                onChange={(value: string) => setDesiredImplementation(value)}
                placeholder="Enter desired implementation address"
            />
            <Input
                label="Current Implementation"
                value={currentImplementation || ""}
                disabled
                placeholder="Current implementation address will be shown here"
                error={contractError}
            />
            <Button
                variant="primary"
                onClick={handleUpgrade}
                loading={isUpgrading}
                disabled={isUpgrading || !canUpgrade}
            >
                {!canUpgrade ? (isUpgradeNeeded ? "Enter All Required Addresses" : "Already Up To Date") : "Upgrade Proxy"}
            </Button>
            {!isUpgradeNeeded && currentImplementation && <Success
                label="Current Implementation"
                value={"No change needed"}
            />}
        </Container>
    );
};
