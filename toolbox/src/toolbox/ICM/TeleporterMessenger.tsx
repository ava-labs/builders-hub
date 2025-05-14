"use client";

import { useState, useEffect } from "react";
import { useErrorBoundary } from "react-error-boundary";
import { Button } from "../../components/Button";
import { Success } from "../../components/Success";
import { formatEther, parseEther } from 'viem';
import { useViemChainStore } from "../../stores/toolboxStore";
import { useWalletStore } from "../../stores/walletStore";
import TeleporterMessengerDeploymentTransaction from '../../../contracts/icm-contracts-releases/v1.0.0/TeleporterMessenger_Deployment_Transaction_v1.0.0.txt.json';
import TeleporterMessengerDeployerAddress from '../../../contracts/icm-contracts-releases/v1.0.0/TeleporterMessenger_Deployer_Address_v1.0.0.txt.json';
import TeleporterMessengerAddress from '../../../contracts/icm-contracts-releases/v1.0.0/TeleporterMessenger_Contract_Address_v1.0.0.txt.json';
import { Container } from "../../components/Container";
import { Step, Steps } from "fumadocs-ui/components/steps";

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
    const viemChain = useViemChainStore();
    const { coreWalletClient, publicClient } = useWalletStore();

    const handleTopUp = async () => {
        setIsSending(true);
        try {
            const hash = await coreWalletClient.sendTransaction({
                to: deployerAddress as `0x${string}`,
                value: parseEther(amount),
                chain: viemChain
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

        <Step>
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
                    variant="primary"
                    onClick={handleTopUp}
                    loading={isSending}
                    disabled={isSending}
                >
                    Send Funds
                </Button>
            </div>
        </Step>)
};

export default function TeleporterMessenger() {
    const { showBoundary } = useErrorBoundary();
    const { publicClient, coreWalletClient } = useWalletStore();
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
            // Send the raw presigned transaction
            const hash = await coreWalletClient.sendRawTransaction({
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
        <Container
            title="Deploy TeleporterMessenger"
            description="Deploy the TeleporterMessenger contract to your L1 to enable cross-L1 messaging and applications like ICTT."
        >
            <div>
                <p className="mt-2">This tool deploys the TeleporterMessenger contract, which is the core contract that handles cross-subnet message sending and receiving. Please read more <a href="https://github.com/ava-labs/icm-contracts/blob/main/contracts/teleporter/README.md" target="_blank" rel="noopener noreferrer" className="text-blue-500 underline">here</a>.</p>
            </div>
            <Steps>
                <Step>
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

                        {!isDeployed &&
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
                        }

                        {!hasEnoughBalance && !isDeployed && (
                            <TopUpComponent
                                deployerAddress={deployerAddress}
                                onTopUp={checkDeployerBalance}
                            />
                        )}
                    </div>
                </Step>
                <Step>
                    {isDeployed ? (
                        <div className="py-4">
                            <h3 className="font-semibold">Contract Already Deployed</h3>
                            <p>The TeleporterMessenger contract is already deployed at the expected address.</p>
                        </div>
                    ) : (
                        <Button
                            variant="primary"
                            onClick={handleDeploy}
                            loading={isDeploying}
                            disabled={isDeploying || !hasEnoughBalance}
                        >
                            Deploy TeleporterMessenger
                        </Button>
                    )}

                </Step>
            </Steps>
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
        </Container >
    );
}
