"use client";

import { useViemChainStore } from "@/components/toolbox/stores/toolboxStore";
import { useWalletStore } from "@/components/toolbox/stores/walletStore";
import { useState } from "react";
import { Button } from "@/components/toolbox/components/Button";
import ProxyAdminABI from "@/contracts/openzeppelin-4.9/compiled/ProxyAdmin.json";
import TransparentUpgradeableProxyABI from "@/contracts/openzeppelin-4.9/compiled/TransparentUpgradeableProxy.json";
import { Container } from "@/components/toolbox/components/Container";
import { Steps, Step } from "fumadocs-ui/components/steps";
import { EVMAddressInput } from "@/components/toolbox/components/EVMAddressInput";
import { Callout } from "fumadocs-ui/components/callout";
import { Success } from "@/components/toolbox/components/Success";
import { CheckWalletRequirements } from "@/components/toolbox/components/CheckWalletRequirements";
import { WalletRequirementsConfigKey } from "@/components/toolbox/hooks/useWalletRequirements";
import { Checkbox } from "@/components/toolbox/components/Checkbox";

const PROXYADMIN_SOURCE_URL = "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v4.9.0/contracts/proxy/transparent/ProxyAdmin.sol";
const TRANSPARENT_PROXY_SOURCE_URL = "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v4.9.0/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";

export default function DeployProxyContract() {
    const [criticalError, setCriticalError] = useState<Error | null>(null);
    const { coreWalletClient, publicClient, walletEVMAddress } = useWalletStore();
    const [isDeployingProxyAdmin, setIsDeployingProxyAdmin] = useState(false);
    const [isDeployingProxy, setIsDeployingProxy] = useState(false);
    const [implementationAddress, setImplementationAddress] = useState<string>("");
    const [proxyAddress, setProxyAddress] = useState<string>("");
    const [proxyAdminAddress, setProxyAdminAddress] = useState<string>("");
    const viemChain = useViemChainStore();
    const [acknowledged, setAcknowledged] = useState(false);
    const [warningDismissed, setWarningDismissed] = useState(false);

    // Throw critical errors during render
    if (criticalError) {
        throw criticalError;
    }

    async function deployProxyAdmin() {
        if (!coreWalletClient) {
            setCriticalError(new Error('Core wallet not found'));
            return;
        }

        setIsDeployingProxyAdmin(true);
        setProxyAdminAddress("");
        try {
            if (!viemChain) throw new Error("Viem chain not found");
            await coreWalletClient.addChain({ chain: viemChain });
            await coreWalletClient.switchChain({ id: viemChain.id });
            const hash = await coreWalletClient.deployContract({
                abi: ProxyAdminABI.abi as any,
                bytecode: ProxyAdminABI.bytecode.object as `0x${string}`,
                chain: viemChain,
                account: walletEVMAddress as `0x${string}`
            });

            const receipt = await publicClient.waitForTransactionReceipt({ hash });

            if (!receipt.contractAddress) {
                throw new Error('No contract address in receipt');
            }

            setProxyAdminAddress(receipt.contractAddress);
        } catch (error) {
            setCriticalError(error instanceof Error ? error : new Error(String(error)));
        } finally {
            setIsDeployingProxyAdmin(false);
        }
    }

    async function deployTransparentProxy() {
        if (!coreWalletClient) {
            setCriticalError(new Error('Core wallet not found'));
            return;
        }

        setIsDeployingProxy(true);
        setProxyAddress("");
        try {
            if (!implementationAddress) throw new Error("Implementation address is required");
            if (!proxyAdminAddress) throw new Error("ProxyAdmin address is required");
            if (!viemChain) throw new Error("Viem chain not found");

            await coreWalletClient.addChain({ chain: viemChain });
            await coreWalletClient.switchChain({ id: viemChain!.id });

            // Deploy the proxy using implementation address and proxy admin address
            const hash = await coreWalletClient.deployContract({
                abi: TransparentUpgradeableProxyABI.abi as any,
                bytecode: TransparentUpgradeableProxyABI.bytecode.object as `0x${string}`,
                args: [implementationAddress, proxyAdminAddress, "0x"], // No initialization data
                chain: viemChain,
                account: walletEVMAddress as `0x${string}`
            });

            const receipt = await publicClient.waitForTransactionReceipt({ hash });

            if (!receipt.contractAddress) {
                throw new Error('No contract address in receipt');
            }

            setProxyAddress(receipt.contractAddress);
        } catch (error) {
            setCriticalError(error instanceof Error ? error : new Error(String(error)));
        } finally {
            setIsDeployingProxy(false);
        }
    }

    return (
        <CheckWalletRequirements configKey={[
            WalletRequirementsConfigKey.EVMChainBalance,
        ]}>
            <Container
                title="Deploy Proxy Contracts"
                description="Deploy ProxyAdmin and TransparentUpgradeableProxy contracts to the EVM network."
            >
                <p className="my-3">
                    <a href="https://github.com/OpenZeppelin/openzeppelin-contracts/tree/release-v4.9/contracts/proxy/transparent"
                        target="_blank"
                        rel="noopener noreferrer">
                        OpenZeppelin's Transparent Proxy Pattern
                    </a> enables upgradeability of smart contracts while preserving state and contract addresses.
                </p>

                <p className="mb-3"><strong>How It Works:</strong> The proxy contract stores state and forwards function calls, while the implementation contract contains only the logic. The proxy admin manages implementation upgrades securely.</p>

                {!warningDismissed && (
                    <div className="relative">
                        <div className="absolute -inset-1 bg-red-500/20 dark:bg-red-500/10 rounded-lg blur-sm" />
                        <Callout type="warn" className="relative mb-8 border-2 border-red-500 dark:border-red-400">
                            <div className="space-y-3">
                                <div className="flex items-start gap-2">
                                    <div className="space-y-2">
                                        <p>
                                            If you created your L1 using the <strong>Builder Console</strong>, a proxy contract is <strong>already pre-deployed</strong> at address <code className="bg-red-100 dark:bg-red-900/30 px-1 py-0.5 rounded">0xfacade0000000000000000000000000000000000</code>
                                        </p>
                                        <p className="text-sm">
                                            You only need this tool if:
                                        </p>
                                        <ul className="list-disc list-inside text-sm ml-2 space-y-1">
                                            <li>You want to deploy the Validator Manager on a different L1</li>
                                            <li>You need to deploy a new proxy contract for a specific reason</li>
                                            <li>You're working with an L1 not created through Builder Console (AvaCloud, Gelato, alt BaaS provider)</li>
                                        </ul>
                                    </div>
                                </div>
                                <div className="pt-2 border-t border-red-300 dark:border-red-700">
                                    <Checkbox
                                        label="I understand and need to deploy a new proxy contract"
                                        checked={acknowledged}
                                        onChange={(checked) => {
                                            setAcknowledged(checked);
                                            if (checked) {
                                                setWarningDismissed(true);
                                            }
                                        }}
                                    />
                                </div>
                            </div>
                        </Callout>
                    </div>
                )}

                <Steps>
                    <Step>
                        <h2 className="text-lg font-semibold">Deploy Proxy Admin Contract</h2>
                        <p className="text-sm text-gray-500">
                            This will deploy the <code>ProxyAdmin</code> contract to the EVM network <code>{viemChain?.id}</code>. <code>ProxyAdmin</code> is used to manage upgrades to the implementation for the proxy contract. For production L1s this should be a multisig wallet, since it can take full control over the L1 validator set by arbitrarily changing the implementation of the ValidatorManager contract.
                        </p>
                        <p className="text-sm text-gray-500">
                            Contract source: <a href={PROXYADMIN_SOURCE_URL} target="_blank" rel="noreferrer">ProxyAdmin.sol</a> @ <code>v4.9.0</code>
                        </p>

                        <Button
                            variant="primary"
                            onClick={deployProxyAdmin}
                            loading={isDeployingProxyAdmin}
                            disabled={isDeployingProxyAdmin || !!proxyAdminAddress || (!acknowledged && !warningDismissed)}
                            className="mt-4"
                        >
                            Deploy Proxy Admin
                        </Button>

                        {proxyAdminAddress && (
                            <Success
                                label="ProxyAdmin Contract Deployed"
                                value={proxyAdminAddress}
                            />
                        )}
                    </Step>
                    <Step>
                        <h2 className="text-lg font-semibold">Deploy Transparent Proxy Contract</h2>
                        <p className="text-sm text-gray-500">
                            The proxy requires the <code>ProxyAdmin</code> contract at address: <code>{proxyAdminAddress || "Not deployed"}</code>
                        </p>
                        <p className="text-sm text-gray-500">
                            Contract source: <a href={TRANSPARENT_PROXY_SOURCE_URL} target="_blank" rel="noreferrer">TransparentUpgradeableProxy.sol</a> @ <code>v4.9.0</code>
                        </p>


                        <EVMAddressInput
                            label="Implementation Address"
                            value={implementationAddress}
                            onChange={setImplementationAddress}
                            placeholder="Enter implementation contract address (e.g. ValidatorManager or StakingManager)"
                            disabled={isDeployingProxy}
                        />

                        <Button
                            variant="primary"
                            onClick={deployTransparentProxy}
                            loading={isDeployingProxy}
                            disabled={isDeployingProxy || !proxyAdminAddress || !implementationAddress || (!acknowledged && !warningDismissed)}
                            className="mt-4"
                        >
                            Deploy Proxy Contract
                        </Button>

                        {proxyAddress && (
                            <Success
                                label="Proxy Contract Deployed"
                                value={proxyAddress}
                            />
                        )}

                    </Step>
                </Steps>
            </Container>
        </CheckWalletRequirements>
    );
}
