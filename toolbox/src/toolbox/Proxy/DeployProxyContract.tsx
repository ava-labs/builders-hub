"use client";

import { useViemChainStore } from "../../stores/toolboxStore";
import { useWalletStore } from "../../stores/walletStore";
import { useErrorBoundary } from "react-error-boundary";
import { useState } from "react";
import { Button } from "../../components/Button";
import { ResultField } from "../../components/ResultField";
import ProxyAdminABI from "../../../contracts/openzeppelin-4.9/compiled/ProxyAdmin.json";
import TransparentUpgradeableProxyABI from "../../../contracts/openzeppelin-4.9/compiled/TransparentUpgradeableProxy.json";
import { Container } from "../../components/Container";
import { Steps, Step } from "fumadocs-ui/components/steps";
import { EVMAddressInput } from "../../components/EVMAddressInput";
import { Callout } from "fumadocs-ui/components/callout";

export default function DeployProxyContract() {
    const { showBoundary } = useErrorBoundary();
    const { coreWalletClient, publicClient } = useWalletStore();
    const [isDeployingProxyAdmin, setIsDeployingProxyAdmin] = useState(false);
    const [isDeployingProxy, setIsDeployingProxy] = useState(false);
    const [implementationAddress, setImplementationAddress] = useState<string>("");
    const [proxyAddress, setProxyAddress] = useState<string>("");
    const [proxyAdminAddress, setProxyAdminAddress] = useState<string>("");
    const viemChain = useViemChainStore();

    async function deployProxyAdmin() {
        setIsDeployingProxyAdmin(true);
        setProxyAdminAddress("");
        try {
            await coreWalletClient.addChain({ chain: viemChain });
            await coreWalletClient.switchChain({ id: viemChain!.id });
            const hash = await coreWalletClient.deployContract({
                abi: ProxyAdminABI.abi,
                bytecode: ProxyAdminABI.bytecode.object as `0x${string}`,
                chain: viemChain,
            });

            const receipt = await publicClient.waitForTransactionReceipt({ hash });

            if (!receipt.contractAddress) {
                throw new Error('No contract address in receipt');
            }

            setProxyAdminAddress(receipt.contractAddress);
        } catch (error) {
            showBoundary(error);
        } finally {
            setIsDeployingProxyAdmin(false);
        }
    }

    async function deployTransparentProxy() {
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
                abi: TransparentUpgradeableProxyABI.abi,
                bytecode: TransparentUpgradeableProxyABI.bytecode.object as `0x${string}`,
                args: [implementationAddress, proxyAdminAddress, "0x"], // No initialization data
                chain: viemChain,
            });

            const receipt = await publicClient.waitForTransactionReceipt({ hash });

            if (!receipt.contractAddress) {
                throw new Error('No contract address in receipt');
            }

            setProxyAddress(receipt.contractAddress);
        } catch (error) {
            showBoundary(error);
        } finally {
            setIsDeployingProxy(false);
        }
    }

    return (
        <Container
            title="Deploy Proxy Contracts"
            description="Deploy ProxyAdmin and TransparentUpgradeableProxy contracts to the EVM network."
        >
            <Callout type="info" className="mb-8">
                <p className="mb-3">
                    <a href="https://github.com/OpenZeppelin/openzeppelin-contracts/tree/release-v4.9/contracts/proxy/transparent" 
                       target="_blank" 
                       rel="noopener noreferrer">
                        OpenZeppelin's Transparent Proxy Pattern
                    </a> enables upgradeability of smart contracts while preserving state and contract addresses.
                </p>
                
                <p className="mb-3"><strong>How It Works:</strong> The proxy contract stores state and forwards function calls, while the implementation contract contains only the logic. The proxy admin manages implementation upgrades securely.</p>
                
                <p className="mb-3"><strong>For <code>ValidatorManager</code> and <code>StakingManager</code>:</strong> These critical contracts manage validator operations and staking in Avalanche's consensus system. Using transparent proxies allows upgrading contract logic without disrupting the network or losing state.</p>
            </Callout>

            <div className="space-y-8">
                <Steps>
                    <Step>
                        <div className="p-6 border rounded-lg">
                            <h3 className="text-xl font-bold mb-6">Deploy Proxy Admin Contract</h3>
                            <div className="mb-6">
                                This will deploy the <code>ProxyAdmin</code> contract to the EVM network <code>{viemChain?.id}</code>. <code>ProxyAdmin</code> is used to manage upgrades for the proxy contract.
                            </div>
                            <div className="mb-8">
                                <Button
                                    variant="primary"
                                    onClick={deployProxyAdmin}
                                    loading={isDeployingProxyAdmin}
                                    disabled={isDeployingProxyAdmin || !!proxyAdminAddress}
                                    className="mt-4"
                                >
                                    Deploy Proxy Admin
                                </Button>
                            </div>
                            
                            {proxyAdminAddress && (
                                <div className="mt-10 pt-6 border-t">
                                    <ResultField
                                        label="ProxyAdmin Address"
                                        value={proxyAdminAddress}
                                        showCheck={!!proxyAdminAddress}
                                    />
                                </div>
                            )}
                        </div>
                    </Step>

                    <Step>
                        <div className="p-6 border rounded-lg mt-8">
                            <h3 className="text-xl font-bold mb-6">Deploy Transparent Proxy Contract</h3>
                            <div className="mb-6">
                                This will deploy the <code>TransparentUpgradeableProxy</code> contract to the EVM network <code>{viemChain?.id}</code>.
                            </div>
                            <div className="mb-6">
                                The proxy requires the <code>ProxyAdmin</code> contract at address: <code>{proxyAdminAddress || "Not deployed"}</code>
                            </div>
                            
                            <div className="mb-4">
                                <EVMAddressInput
                                    label="Implementation Address"
                                    value={implementationAddress}
                                    onChange={setImplementationAddress}
                                    placeholder="Enter implementation contract address (e.g. ValidatorManager or StakingManager)"
                                    disabled={isDeployingProxy}
                                />
                            </div>
                            
                            <div className="mb-8">
                                <Button
                                    variant="primary"
                                    onClick={deployTransparentProxy}
                                    loading={isDeployingProxy}
                                    disabled={isDeployingProxy || !proxyAdminAddress || !implementationAddress}
                                    className="mt-4"
                                >
                                    Deploy Proxy Contract
                                </Button>
                            </div>
                            
                            {proxyAddress && (
                                <div className="mt-10 pt-6 border-t">
                                    <ResultField
                                        label="Proxy Contract Address"
                                        value={proxyAddress}
                                        showCheck={!!proxyAddress}
                                    />
                                </div>
                            )}
                        </div>
                    </Step>
                </Steps>
            </div>
        </Container>
    );
}
