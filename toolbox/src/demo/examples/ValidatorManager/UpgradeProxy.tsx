"use client";

import { useExampleStore } from "../../utils/store";
import { useErrorBoundary } from "react-error-boundary";
import { useState, useEffect } from "react";
import { Button, Input } from "../../ui";
import { Success } from "../../ui/Success";
import { createWalletClient, custom, createPublicClient } from 'viem';
import ProxyAdminABI from "../../../../contracts/openzeppelin-4.9/compiled/ProxyAdmin.json";

export default function UpgradeProxy() {
    const { showBoundary } = useErrorBoundary();
    const {
        walletChainId,
        validatorManagerAddress,
        proxyAddress,
        proxyAdminAddress,
        setProxyAddress,
        setProxyAdminAddress
    } = useExampleStore();
    const [isUpgrading, setIsUpgrading] = useState(false);
    const [currentImplementation, setCurrentImplementation] = useState<string | null>(null);
    const [desiredImplementation, setDesiredImplementation] = useState<string | null>(null);
    const [contractError, setContractError] = useState<string | null>(null);

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

            const publicClient = createPublicClient({
                transport: custom(window.avalanche!),
            });

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
            const walletClient = createWalletClient({
                transport: custom(window.avalanche!),
            });

            const [address] = await walletClient.requestAddresses();

            const hash = await walletClient.writeContract({
                address: proxyAdminAddress,
                abi: ProxyAdminABI.abi,
                functionName: 'upgrade',
                args: [proxyAddress, validatorManagerAddress as `0x${string}`],
                account: address,
                chain: {
                    id: walletChainId,
                    name: "My L1",
                    rpcUrls: {
                        default: { http: [] },
                    },
                    nativeCurrency: {
                        name: "COIN",
                        symbol: "COIN",
                        decimals: 18,
                    },
                },
            });

            const publicClient = createPublicClient({
                transport: custom(window.avalanche!),
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
        <div className="space-y-4">
            <h2 className="text-lg font-semibold ">Upgrade Proxy Implementation</h2>
            <div className="space-y-4">
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
            </div>
            {!isUpgradeNeeded && <Success
                label="Current Implementation"
                value={"No change needed"}
            />}
        </div>
    );
};
