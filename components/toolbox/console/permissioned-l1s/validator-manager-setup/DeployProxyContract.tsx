"use client";

import { useViemChainStore } from "@/components/toolbox/stores/toolboxStore";
import { useWalletStore } from "@/components/toolbox/stores/walletStore";
import { useState, useMemo } from "react";
import { Button } from "@/components/toolbox/components/Button";
import ProxyAdminABI from "@/contracts/openzeppelin-4.9/compiled/ProxyAdmin.json";
import TransparentUpgradeableProxyABI from "@/contracts/openzeppelin-4.9/compiled/TransparentUpgradeableProxy.json";
import { ProgressSteps as Steps, ProgressStep as Step } from "@/components/toolbox/components/ProgressSteps";
import { EVMAddressInput } from "@/components/toolbox/components/EVMAddressInput";
import { WalletRequirementsConfigKey } from "@/components/toolbox/hooks/useWalletRequirements";
import { BaseConsoleToolProps, ConsoleToolMetadata, withConsoleToolMetadata } from "../../../components/WithConsoleToolMetadata";
import { useConnectedWallet } from "@/components/toolbox/contexts/ConnectedWalletContext";
import { AcknowledgementCallout } from "@/components/toolbox/components/AcknowledgementCallout";
import { LockedContent } from "@/components/toolbox/components/LockedContent";
import useConsoleNotifications from "@/hooks/useConsoleNotifications";
import { generateConsoleToolGitHubUrl } from "@/components/toolbox/utils/github-url";
import { Copy, Check } from "lucide-react";

const PROXYADMIN_SOURCE_URL = "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v4.9.0/contracts/proxy/transparent/ProxyAdmin.sol";
const TRANSPARENT_PROXY_SOURCE_URL = "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v4.9.0/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";

const metadata: ConsoleToolMetadata = {
    title: "Deploy Proxy Contracts",
    description: "Deploy ProxyAdmin and TransparentUpgradeableProxy contracts to the EVM network",
    toolRequirements: [
        WalletRequirementsConfigKey.EVMChainBalance
    ],
    githubUrl: generateConsoleToolGitHubUrl(import.meta.url)
};

// Simple component to show deployment status - clickable address to copy
function DeploymentStatus({ address }: { address: string }) {
    const [copied, setCopied] = useState(false);

    if (!address) {
        return <p className="text-sm text-gray-500 mt-2">Deployment Status: Not deployed</p>;
    }

    const handleCopy = async () => {
        await navigator.clipboard.writeText(address);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };

    return (
        <button
            onClick={handleCopy}
            className="mt-2 w-full p-3 rounded-lg border-2 border-green-500 dark:border-green-500 bg-green-100 dark:bg-green-900/30 hover:bg-green-200 dark:hover:bg-green-900/40 transition-colors cursor-pointer group"
        >
            <div className="flex items-center justify-between gap-2">
                <div className="flex-1 min-w-0 text-left">
                    <p className="text-xs text-green-700 dark:text-green-400 font-medium mb-1">Deployment Status</p>
                    <code className="text-sm text-green-900 dark:text-green-100 break-all">{address}</code>
                </div>
                <div className="flex-shrink-0">
                    {copied ? (
                        <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                    ) : (
                        <Copy className="h-4 w-4 text-green-600 dark:text-green-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                    )}
                </div>
            </div>
        </button>
    );
}

function DeployProxyContract({ onSuccess }: BaseConsoleToolProps) {
    const [isDeployingProxyAdmin, setIsDeployingProxyAdmin] = useState(false);
    const [isDeployingProxy, setIsDeployingProxy] = useState(false);
    const [implementationAddress, setImplementationAddress] = useState<string>("");
    const [proxyAddress, setProxyAddress] = useState<string>("");
    const [proxyAdminAddress, setProxyAdminAddress] = useState<string>("");
    const viemChain = useViemChainStore();
    const [acknowledged, setAcknowledged] = useState(false);
    const [warningDismissed, setWarningDismissed] = useState(false);

    const { publicClient, walletEVMAddress } = useWalletStore();
    const { coreWalletClient } = useConnectedWallet();

    const { sendCoreWalletNotSetNotification, notify } = useConsoleNotifications();

    async function deployProxyAdmin() {
        setIsDeployingProxyAdmin(true);
        setProxyAdminAddress("");

        const deployPromise = coreWalletClient.deployContract({
            abi: ProxyAdminABI.abi as any,
            bytecode: ProxyAdminABI.bytecode.object as `0x${string}`,
            args: [],
            chain: viemChain ?? undefined,
            account: walletEVMAddress as `0x${string}`
        });

        notify({
            type: 'deploy',
            name: 'ProxyAdmin'
        }, deployPromise, viemChain ?? undefined);

        const hash = await deployPromise;
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        if (!receipt.contractAddress) {
            throw new Error('No contract address in receipt');
        }
        setProxyAdminAddress(receipt.contractAddress);
        setIsDeployingProxyAdmin(false);
        onSuccess?.();
    }

    async function deployTransparentProxy() {
        setIsDeployingProxy(true);
        setProxyAddress("");

        if (!implementationAddress) throw new Error("Implementation address is required");
        if (!proxyAdminAddress) throw new Error("ProxyAdmin address is required");

        const deployPromise = coreWalletClient.deployContract({
            abi: TransparentUpgradeableProxyABI.abi as any,
            bytecode: TransparentUpgradeableProxyABI.bytecode.object as `0x${string}`,
            args: [implementationAddress, proxyAdminAddress, "0x"],
            chain: viemChain ?? undefined,
            account: walletEVMAddress as `0x${string}`
        });

        notify({
            type: 'deploy',
            name: 'TransparentUpgradeableProxy'
        }, deployPromise, viemChain ?? undefined);

        const hash = await deployPromise;
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        if (!receipt.contractAddress) {
            throw new Error('No contract address in receipt');
        }
        setProxyAddress(receipt.contractAddress);
        setIsDeployingProxy(false);
    }

    // Calculate current step and completed steps
    const currentStep = useMemo(() => {
        if (proxyAddress) return 2; // Both done
        if (proxyAdminAddress) return 2; // Step 1 done, step 2 is current
        return 1; // Starting
    }, [proxyAdminAddress, proxyAddress]);

    const completedSteps = useMemo(() => {
        const completed: number[] = [];
        if (proxyAdminAddress) completed.push(1);
        if (proxyAddress) completed.push(2);
        return completed;
    }, [proxyAdminAddress, proxyAddress]);

    return (
        <>
                <p className="my-3">
                    <a href="https://github.com/OpenZeppelin/openzeppelin-contracts/tree/release-v4.9/contracts/proxy/transparent"
                        target="_blank"
                        rel="noopener noreferrer">
                        OpenZeppelin's Transparent Proxy Pattern
                    </a> enables upgradeability of smart contracts while preserving state and contract addresses.
                </p>

                <p className="mb-3"><strong>How It Works:</strong> The proxy contract stores state and forwards function calls, while the implementation contract contains only the logic. The proxy admin manages implementation upgrades securely.</p>

                <AcknowledgementCallout
                    title="Do You Need to Deploy a New Proxy?"
                    type="warn"
                    checkboxLabel="I understand and need to deploy a new proxy contract"
                    checked={acknowledged}
                    onCheckedChange={(checked: boolean) => {
                        setAcknowledged(checked);
                        if (checked) {
                            setWarningDismissed(true);
                        }
                    }}
                    visible={!warningDismissed}
                >
                    <p>
                        If you created your L1 using the <strong>Builder Console</strong>, a proxy contract is <strong>already pre-deployed</strong> at address <code className="bg-amber-100 dark:bg-amber-900/30 px-1 py-0.5 rounded">0xfacade0000000000000000000000000000000000</code>
                    </p>
                    <p>
                        You only need this tool if:
                    </p>
                    <ul className="list-disc list-inside ml-2 space-y-1">
                        <li>You want to deploy the Validator Manager on a different L1</li>
                        <li>You need to deploy a new proxy contract for a specific reason</li>
                        <li>You're working with an L1 not created through Builder Console (AvaCloud, Gelato, alt BaaS provider)</li>
                    </ul>
                </AcknowledgementCallout>

                <LockedContent
                    isUnlocked={warningDismissed}
                    lockedMessage="Please acknowledge the proxy deployment warning above to continue"
                >
                    <Steps currentStep={currentStep} completedSteps={completedSteps}>
                        <Step stepNumber={1}>
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
                                disabled={isDeployingProxyAdmin || !!proxyAdminAddress}
                                className="mt-4"
                            >
                                Deploy Proxy Admin
                            </Button>

                            <DeploymentStatus address={proxyAdminAddress} />
                        </Step>
                        <Step stepNumber={2}>
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
                                disabled={isDeployingProxy || !proxyAdminAddress || !implementationAddress}
                                className="mt-4"
                            >
                                Deploy Proxy Contract
                            </Button>

                            <DeploymentStatus address={proxyAddress} />

                        </Step>
                    </Steps>
                </LockedContent>
        </>
    );
}

export default withConsoleToolMetadata(DeployProxyContract, metadata);
