"use client";

import { useToolboxStore, useViemChainStore, useWalletStore } from "../../utils/store";
import { useErrorBoundary } from "react-error-boundary";
import { useState, useEffect } from "react";
import { Button, Input } from "../../ui";
import { Success } from "../../ui/Success";
import ProxyAdminABI from "../../../../contracts/openzeppelin-4.9/compiled/ProxyAdmin.json";
import { RequireChainL1 } from "../../ui/RequireChain";
import { Container } from "../../../components/container";
export default function UpgradeProxy() {
    const { showBoundary } = useErrorBoundary();
    const {
        validatorManagerAddress,
        proxyAddress,
        proxyAdminAddress,
        setProxyAddress,
        setProxyAdminAddress
    } = useToolboxStore();
    const { walletChainId, coreWalletClient, publicClient } = useWalletStore();
    const [isUpgrading, setIsUpgrading] = useState(false);
    const [currentImplementation, setCurrentImplementation] = useState<string | null>(null);
    const [desiredImplementation, setDesiredImplementation] = useState<string | null>(null);
    const [contractError, setContractError] = useState<string | null>(null);
    const viemChain = useViemChainStore();

    useEffect(() => {
        if (validatorManagerAddress && !desiredImplementation && validatorManagerAddress !== desiredImplementation) {
            setDesiredImplementation(validatorManagerAddress);
        }
    }, [validatorManagerAddress, desiredImplementation]);

    useEffect(() => {
        checkCurrentImplementation();
    }, [walletChainId, validatorManagerAddress, proxyAddress, proxyAdminAddress]);

    async function checkCurrentImplementation() {
        try {
            if (!proxyAddress || !proxyAdminAddress) {
                setCurrentImplementation(null);
                setContractError(null);
                return;
            }

            const implementation = await publicClient.readContract({
                address: proxyAdminAddress,
                abi: ProxyAdminABI.abi,
                functionName: 'getProxyImplementation',
                args: [proxyAddress],
            });

            setCurrentImplementation(implementation as string);
            setContractError(null);
        } catch (error: unknown) {
            setCurrentImplementation(null);
            setContractError("No contract found at Proxy Address");
            console.error(error);
        }
    }

    async function handleUpgrade() {
        if (!validatorManagerAddress) {
            throw new Error('Validator Manager must be deployed first');
        }

        setIsUpgrading(true);
        try {

            const hash = await coreWalletClient.writeContract({
                address: proxyAdminAddress,
                abi: ProxyAdminABI.abi,
                functionName: 'upgrade',
                args: [proxyAddress, validatorManagerAddress as `0x${string}`],
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

    return (
        <RequireChainL1>
            <Container
                title="Upgrade Proxy Implementation"
                description="This will upgrade the proxy implementation to the desired implementation."
            >
                    <Input
                        label="Proxy Address"
                        value={proxyAddress}
                        onChange={setProxyAddress}
                        placeholder="Enter proxy address"
                        error={contractError}
                    />
                    <Input
                        label="Proxy Admin Address"
                        value={proxyAdminAddress}
                        onChange={(value: string) => setProxyAdminAddress(value as `0x${string}`)}
                        placeholder="Enter proxy admin address"
                    />
                    <Input
                        label="Desired Implementation"
                        value={desiredImplementation || ""}
                        onChange={(value: string) => setDesiredImplementation(value)}
                        placeholder="Enter desired implementation address"
                    />
                    <Input
                        label="Current Implementation"
                        value={currentImplementation || ""}
                        disabled
                        error={contractError}
                    />
                    <Button
                        type="primary"
                        onClick={handleUpgrade}
                        loading={isUpgrading}
                        disabled={isUpgrading || !validatorManagerAddress || !isUpgradeNeeded}
                    >
                        {!validatorManagerAddress ? "Deploy ValidatorManager First" :
                            !isUpgradeNeeded ? "Already Up To Date" :
                                "Upgrade Proxy"}
                    </Button>
                {!isUpgradeNeeded && <Success
                    label="Current Implementation"
                    value={"No change needed"}
                    />}
            </Container>
        </RequireChainL1>
    );
};
