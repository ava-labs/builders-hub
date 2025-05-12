"use client";

import { formatEther, parseEther, createPublicClient, http } from 'viem'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { useSelectedL1, useViemChainStore } from '../toolboxStore';
import { useWalletStore } from '../../lib/walletStore';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import { CodeHighlighter } from '../../components/CodeHighlighter';
import { useState, useEffect } from 'react';
import { useErrorBoundary } from "react-error-boundary";
import { avalancheFuji } from 'viem/chains';

const MINIMUM_BALANCE = parseEther('100')
const MINIMUM_BALANCE_CCHAIN = parseEther('1')

export default function ICMRelayer() {
    const { coreWalletClient } = useWalletStore();
    const selectedL1 = useSelectedL1()();
    const [balanceL1, setBalanceL1] = useState<bigint>(BigInt(0));
    const [balanceCChain, setBalanceCChain] = useState<bigint>(BigInt(0));
    const [isCheckingBalanceL1, setIsCheckingBalanceL1] = useState(true);
    const [isCheckingBalanceCChain, setIsCheckingBalanceCChain] = useState(true);
    const [isSendingL1, setIsSendingL1] = useState(false);
    const [isSendingCChain, setIsSendingCChain] = useState(false);
    const { showBoundary } = useErrorBoundary();
    const viemChain = useViemChainStore();

    // Use sessionStorage for private key to persist across refreshes
    const [privateKey] = useState(() => {
        const storedKey = sessionStorage.getItem('icm-relayer-private-key');
        if (storedKey) return storedKey as `0x${string}`;

        const newKey = generatePrivateKey();
        sessionStorage.setItem('icm-relayer-private-key', newKey);
        return newKey;
    });

    const relayerAddress = privateKeyToAccount(privateKey).address;

    // Create separate clients for L1 and C-Chain
    const l1Client = viemChain ? createPublicClient({
        transport: http(selectedL1?.rpcUrl),
        chain: viemChain,
    }) : null;

    const cChainClient = createPublicClient({
        transport: http(avalancheFuji.rpcUrls.default.http[0]),
        chain: avalancheFuji,
    });

    const checkBalanceL1 = async () => {
        if (!selectedL1?.rpcUrl || !l1Client || !viemChain) {
            setIsCheckingBalanceL1(false);
            return;
        }

        setIsCheckingBalanceL1(true);
        try {
            const balance = await l1Client.getBalance({
                address: relayerAddress
            });

            setBalanceL1(balance);
        } catch (error) {
            console.error("Failed to check L1 balance:", error);
        } finally {
            setIsCheckingBalanceL1(false);
        }
    };

    const checkBalanceCChain = async () => {
        setIsCheckingBalanceCChain(true);
        try {
            const balance = await cChainClient.getBalance({
                address: relayerAddress
            });

            setBalanceCChain(balance);
        } catch (error) {
            console.error("Failed to check C-Chain balance:", error);
        } finally {
            setIsCheckingBalanceCChain(false);
        }
    };

    useEffect(() => {
        if (viemChain && selectedL1?.rpcUrl) {
            checkBalanceL1();
        }
    }, [selectedL1?.rpcUrl, viemChain?.id]);

    useEffect(() => {
        checkBalanceCChain();
    }, []);


    const handleFundL1 = async () => {
        if (!viemChain) {
            showBoundary(new Error("Invalid L1 chain configuration"));
            return;
        }

        setIsSendingL1(true);
        try {
            // Then proceed with transaction
            const hash = await coreWalletClient.sendTransaction({
                to: relayerAddress,
                value: MINIMUM_BALANCE - balanceL1,
                chain: viemChain
            });

            await l1Client?.waitForTransactionReceipt({ hash });
            await checkBalanceL1();
        } catch (error) {
            showBoundary(error);
        } finally {
            setIsSendingL1(false);
        }
    };

    const handleFundCChain = async () => {
        setIsSendingCChain(true);
        try {
            // Then proceed with transaction
            const hash = await coreWalletClient.sendTransaction({
                to: relayerAddress,
                value: MINIMUM_BALANCE_CCHAIN - balanceCChain,
                chain: avalancheFuji
            });

            await cChainClient.waitForTransactionReceipt({ hash });
            await checkBalanceCChain();
        } catch (error) {
            showBoundary(error);
        } finally {
            setIsSendingCChain(false);
        }
    };

    const hasEnoughBalanceL1 = balanceL1 >= MINIMUM_BALANCE;
    const hasEnoughBalanceCChain = balanceCChain >= MINIMUM_BALANCE_CCHAIN;
    const hasEnoughBalance = hasEnoughBalanceL1 && hasEnoughBalanceCChain;

    return (
        <div className="space-y-4">
            <div className="text-lg font-bold">Relayer Configuration</div>
            <Input
                label="Destination Subnet ID"
                value={selectedL1?.subnetId}
                disabled
            />
            <Input
                label="Destination Chain ID"
                value={selectedL1?.evmChainId}
                disabled
            />
            <Input
                label="Destination RPC"
                value={selectedL1?.rpcUrl}
                disabled
            />
            <div className="space-y-2">
                <Input
                    label="Relayer EVM Address"
                    value={relayerAddress}
                    disabled
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* L1 Balance Section */}
                    <div className="space-y-3 p-4 border rounded-md bg-gray-50 dark:bg-gray-900/20">
                        <div>
                            <p className="font-semibold">Subnet (L1) Balance:</p>
                            {isCheckingBalanceL1 ? (
                                <p>Checking balance...</p>
                            ) : (
                                <div className="flex items-center gap-2">
                                    <p>{formatEther(balanceL1)} coins {hasEnoughBalanceL1 ? '✅' : '❌'}</p>
                                    <span
                                        onClick={checkBalanceL1}
                                        className="text-blue-500 hover:underline cursor-pointer"
                                    >
                                        Recheck
                                    </span>
                                </div>
                            )}
                            <div className="pb-2 text-xs">
                                Should be at least {formatEther(MINIMUM_BALANCE)} native coins
                            </div>
                            {!hasEnoughBalanceL1 && (
                                <>
                                    <Button
                                        variant="primary"
                                        onClick={handleFundL1}
                                        loading={isSendingL1}
                                        disabled={isSendingL1 || !viemChain}
                                    >
                                        Fund Relayer on L1
                                    </Button>
                                </>
                            )}
                        </div>
                    </div>

                    {/* C-Chain Balance Section */}
                    <div className="space-y-3 p-4 border rounded-md bg-gray-50 dark:bg-gray-900/20">
                        <div>
                            <p className="font-semibold">C-Chain (Fuji) Balance:</p>
                            {isCheckingBalanceCChain ? (
                                <p>Checking balance...</p>
                            ) : (
                                <div className="flex items-center gap-2">
                                    <p>{formatEther(balanceCChain)} AVAX {hasEnoughBalanceCChain ? '✅' : '❌'}</p>
                                    <span
                                        onClick={checkBalanceCChain}
                                        className="text-blue-500 hover:underline cursor-pointer"
                                    >
                                        Recheck
                                    </span>
                                </div>
                            )}
                            <div className="pb-2 text-xs">
                                Should be at least {formatEther(MINIMUM_BALANCE_CCHAIN)} AVAX
                            </div>
                            {!hasEnoughBalanceCChain && (
                                <>
                                    <Button
                                        variant="primary"
                                        onClick={handleFundCChain}
                                        loading={isSendingCChain}
                                        disabled={isSendingCChain}
                                    >
                                        Fund Relayer on C-Chain
                                    </Button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>
            {hasEnoughBalance && (
                <>
                    <div className="text-sm">
                        ⚠️ The private key is stored in your browser session storage and will persist until you close the browser.
                        Please save the address above as you will need to fund it later.
                    </div>
                    <div className="text-lg font-bold">Write the relayer config file</div>
                    <CodeHighlighter
                        code={genConfigCommand(selectedL1!.subnetId, selectedL1!.id, selectedL1!.rpcUrl, privateKey)}
                        lang="sh"
                    />
                    <div className="text-lg font-bold">Run the relayer</div>
                    <CodeHighlighter
                        code={relayerDockerCommand()}
                        lang="sh"
                    />
                </>
            )}
            {!hasEnoughBalance && (
                <>
                    <div className="text-lg font-bold">
                        You need to fund the relayer with at least {formatEther(MINIMUM_BALANCE)} coins on L1 and {formatEther(MINIMUM_BALANCE_CCHAIN)} AVAX on C-Chain to start relaying messages.
                    </div>
                </>
            )}
        </div>
    );
}

const genConfigCommand = (destinationSubnetID: string, destinationBlockchainID: string, destinationRPC: string, privateKeyhex: string) => {
    const FUJI_C_SUBNET_ID = "11111111111111111111111111111111LpoYY";
    const FUJI_C_BLOCKCHAIN_ID = "yH8D7ThNJkxmtkuv2jgBa4P1Rn3Qpr4pPr7QYNfcdoS6k6HWp";

    const config = {
        "info-api": {
            "base-url": "https://api.avax-test.network"
        },
        "p-chain-api": {
            "base-url": "https://api.avax-test.network"
        },
        "source-blockchains": [
            {
                "subnet-id": FUJI_C_SUBNET_ID,
                "blockchain-id": FUJI_C_BLOCKCHAIN_ID,
                "vm": "evm",
                "rpc-endpoint": {
                    "base-url": "https://api.avax-test.network/ext/bc/C/rpc"
                },
                "ws-endpoint": {
                    "base-url": "wss://api.avax-test.network/ext/bc/C/ws"
                },
                "message-contracts": {
                    "0x253b2784c75e510dD0fF1da844684a1aC0aa5fcf": {
                        "message-format": "teleporter",
                        "settings": {
                            "reward-address": "0x0000000000000000000000000000000000000000"
                        }
                    }
                }
            },
            {
                "subnet-id": destinationSubnetID,
                "blockchain-id": destinationBlockchainID,
                "vm": "evm",
                "rpc-endpoint": {
                    "base-url": destinationRPC,
                },
                "ws-endpoint": {
                    "base-url": destinationRPC.replace("http", "ws").replace("/rpc", "/ws"),
                },
                "message-contracts": {
                    "0x253b2784c75e510dD0fF1da844684a1aC0aa5fcf": {
                        "message-format": "teleporter",
                        "settings": {
                            "reward-address": "0x0000000000000000000000000000000000000000"
                        }
                    }
                }
            },
        ],
        "destination-blockchains": [
            {
                "subnet-id": destinationSubnetID,
                "blockchain-id": destinationBlockchainID,
                "vm": "evm",
                "rpc-endpoint": {
                    "base-url": destinationRPC
                },
                "account-private-key": privateKeyhex
            },
            {
                "subnet-id": FUJI_C_SUBNET_ID,
                "blockchain-id": FUJI_C_BLOCKCHAIN_ID,
                "vm": "evm",
                "rpc-endpoint": {
                    "base-url": "https://api.avax-test.network/ext/bc/C/rpc"
                },
                "account-private-key": privateKeyhex
            }
        ]
    }
    const configStr = JSON.stringify(config, null, 4);
    return `mkdir -p ~/.icm-relayer && echo '${configStr}' > ~/.icm-relayer/config.json`
}

import versions from '../../versions.json';
const relayerDockerCommand = () => {
    return `docker run --name relayer -d \\
    --restart on-failure  \\
    --user=root \\
    -v ~/.icm-relayer/:/icm-relayer/ \\
    avaplatform/icm-relayer:${versions['avaplatform/icm-relayer']} \\
    --config-file /icm-relayer/config.json`
}
