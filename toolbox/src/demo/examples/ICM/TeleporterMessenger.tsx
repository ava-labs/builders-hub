"use client";

import { useState, useEffect } from "react";
import { useErrorBoundary } from "react-error-boundary";
import { Button } from "../../ui";
import { Success } from "../../ui/Success";
import { createPublicClient, createWalletClient, custom, formatEther, parseEther } from 'viem';
import { useExampleStore } from "../../utils/store";
import TeleporterMessengerDeploymentTransaction from '../../../../contracts/icm-contracts-releases/v1.0.0/TeleporterMessenger_Deployment_Transaction_v1.0.0.txt.json';
import TeleporterMessengerDeployerAddress from '../../../../contracts/icm-contracts-releases/v1.0.0/TeleporterMessenger_Deployer_Address_v1.0.0.txt.json';
import TeleporterMessengerAddress from '../../../../contracts/icm-contracts-releases/v1.0.0/TeleporterMessenger_Contract_Address_v1.0.0.txt.json';
import KnownChainIDWarning from "../../ui/KnownChainIDWarning";

const MINIMUM_BALANCE = parseEther('11');

const TopUpComponent = ({
    deployerAddress,
    onTopUp
}: {
    deployerAddress: `0x${string}`,
    onTopUp: () => void
}) => {
    const [amount, setAmount] = useState(formatEther(MINIMUM_BALANCE));
    const [isSending, setIsSending] = useState(false);
    const { showBoundary } = useErrorBoundary();
    const { walletChainId } = useExampleStore();

    const handleTopUp = async () => {
        setIsSending(true);
        try {
            const walletClient = createWalletClient({
                transport: custom(window.avalanche!),
            });

            const [address] = await walletClient.requestAddresses();

            const hash = await walletClient.sendTransaction({
                to: deployerAddress as `0x${string}`,
                value: parseEther(amount),
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
            onTopUp();
        } catch (error) {
            showBoundary(error);
        } finally {
            setIsSending(false);
        }
    };

    return (
        <div className="space-y-4">
            <h3 className="font-semibold">Top Up Deployer Address</h3>
            <p>The deployer address needs at least {formatEther(MINIMUM_BALANCE)} native coins to send the transaction.</p>
            <div className="flex items-center gap-2">
                <input
                    type="text"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="p-2 rounded w-32"
                />
                <Button
                    type="primary"
                    onClick={handleTopUp}
                    loading={isSending}
                    disabled={isSending}
                >
                    Send Funds
                </Button>
            </div>
        </div>
    );
};

export default function TeleporterMessenger() {
    const { showBoundary } = useErrorBoundary();
    const { walletChainId } = useExampleStore();
    const [isDeploying, setIsDeploying] = useState(false);
    const [deployerBalance, setDeployerBalance] = useState(BigInt(0));
    const [isCheckingBalance, setIsCheckingBalance] = useState(true);
    const [isDeployed, setIsDeployed] = useState(false);
    const [txHash, setTxHash] = useState("");

    const deployerAddress = TeleporterMessengerDeployerAddress.content as `0x${string}`;
    const expectedContractAddress = TeleporterMessengerAddress.content;

    const checkDeployerBalance = async () => {
        setIsCheckingBalance(true);
        try {
            const publicClient = createPublicClient({
                transport: custom(window.avalanche!),
            });

            const balance = await publicClient.getBalance({
                address: deployerAddress,
            });

            setDeployerBalance(balance);

            // Also check if contract is already deployed
            const code = await publicClient.getBytecode({
                address: expectedContractAddress as `0x${string}`,
            });

            setIsDeployed(code !== undefined && code !== '0x');
        } catch (error) {
            console.error("Failed to check balance:", error);
        } finally {
            setIsCheckingBalance(false);
        }
    };

    useEffect(() => {
        checkDeployerBalance();
    }, []);

    const handleDeploy = async () => {
        setIsDeploying(true);
        try {
            const publicClient = createPublicClient({
                transport: custom(window.avalanche!),
            });

            const walletClient = createWalletClient({
                transport: custom(window.avalanche!),
            });

            // Send the raw presigned transaction
            const hash = await walletClient.sendRawTransaction({
                serializedTransaction: TeleporterMessengerDeploymentTransaction.content as `0x${string}`,
            });

            setTxHash(hash);

            await publicClient.waitForTransactionReceipt({ hash });
            setIsDeployed(true);

            // Refresh balance after deployment
            await checkDeployerBalance();
        } catch (error) {
            showBoundary(error);
        } finally {
            setIsDeploying(false);
        }
    };

    const hasEnoughBalance = deployerBalance >= MINIMUM_BALANCE;

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold">Deploy TeleporterMessenger Contract</h1>

            <div>
                <p className="mt-2">This tool deploys the TeleporterMessenger contract, which is the core contract that handles cross-subnet message sending and receiving. Please read more <a href="https://github.com/ava-labs/icm-contracts/blob/main/contracts/teleporter/README.md" target="_blank" rel="noopener noreferrer" className="text-blue-500 underline">here</a>.</p>
            </div>

            <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <p className="font-semibold">Deployer Address:</p>
                        <code className="block py-2 rounded text-sm break-all">
                            {deployerAddress}
                        </code>
                        <div className="pb-2 text-xs">
                            TeleporterMessenger_Deployer_Address_v1.0.0.txt.json
                        </div>
                    </div>
                    <div>
                        <p className="font-semibold">Expected Contract Address:</p>
                        <code className="block py-2 rounded text-sm break-all">
                            {expectedContractAddress}
                        </code>
                        <div className="pb-2 text-xs">
                            TeleporterMessenger_Contract_Address_v1.0.0.txt.json
                        </div>
                    </div>
                </div>

                <div>
                    <p className="font-semibold">Deployer Balance:</p>
                    {isCheckingBalance ? (
                        <p>Checking balance...</p>
                    ) : (
                        <p>{formatEther(deployerBalance)} coins {hasEnoughBalance ? '✅' : '❌'}</p>
                    )}
                    <div className="pb-2 text-xs">
                        Should be at least {formatEther(MINIMUM_BALANCE)} native coins
                    </div>
                </div>

                {!hasEnoughBalance && !isDeployed && (
                    <TopUpComponent
                        deployerAddress={deployerAddress}
                        onTopUp={checkDeployerBalance}
                    />
                )}

                {isDeployed ? (
                    <div className="py-4">
                        <h3 className="font-semibold">Contract Already Deployed</h3>
                        <p>The TeleporterMessenger contract is already deployed at the expected address.</p>
                    </div>
                ) : (
                    <Button
                        type="primary"
                        onClick={handleDeploy}
                        loading={isDeploying}
                        disabled={isDeploying || !hasEnoughBalance}
                    >
                        Deploy TeleporterMessenger
                    </Button>
                )}

                {txHash && (
                    <Success
                        label="Transaction Hash"
                        value={txHash}
                    />
                )}

                {isDeployed && (
                    <Success
                        label="TeleporterMessenger Address"
                        value={expectedContractAddress}
                    />
                )}

                <KnownChainIDWarning walletChainId={walletChainId} />
            </div>
        </div>
    );
}
