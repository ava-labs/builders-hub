"use client";

import { createPublicClient, createWalletClient, custom, formatEther, parseEther } from 'viem'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { useExampleStore } from '../../utils/store';
import { Input, Button } from '../../ui';
import { CodeHighlighter } from '../../ui/CodeHighlighter';
import { useState, useEffect } from 'react';
import { useErrorBoundary } from "react-error-boundary";
import KnownChainIDWarning from '../../ui/KnownChainIDWarning';
const randomPrivateKey = generatePrivateKey()
const MINIMUM_BALANCE = parseEther('100')

export default function ICMRelayer() {
    const { chainID, setChainID, subnetID, setSubnetID, evmChainRpcUrl, setEvmChainRpcUrl, walletChainId } = useExampleStore();
    const [balance, setBalance] = useState<bigint>(BigInt(0));
    const [isCheckingBalance, setIsCheckingBalance] = useState(true);
    const [isSending, setIsSending] = useState(false);
    const { showBoundary } = useErrorBoundary();
    const relayerAddress = privateKeyToAccount(randomPrivateKey).address;

    const checkBalance = async () => {
        if (!evmChainRpcUrl) return;

        setIsCheckingBalance(true);
        try {
            const publicClient = createPublicClient({
                transport: custom(window.avalanche!)
            });

            const balance = await publicClient.getBalance({
                address: relayerAddress
            });

            setBalance(balance);
        } catch (error) {
            console.error("Failed to check balance:", error);
        } finally {
            setIsCheckingBalance(false);
        }
    };

    useEffect(() => {
        checkBalance();
    }, [evmChainRpcUrl]);

    const handleFund = async () => {
        setIsSending(true);
        try {
            const walletClient = createWalletClient({
                transport: custom(window.avalanche!)
            });

            const [address] = await walletClient.requestAddresses();

            const hash = await walletClient.sendTransaction({
                to: relayerAddress,
                value: MINIMUM_BALANCE - balance,
                account: address,
                chain: {
                    id: walletChainId,
                    name: "Chain",
                    rpcUrls: {
                        default: { http: [] }
                    },
                    nativeCurrency: {
                        name: "COIN",
                        symbol: "COIN",
                        decimals: 18
                    }
                }
            });

            const publicClient = createPublicClient({
                transport: custom(window.avalanche!)
            });

            await publicClient.waitForTransactionReceipt({ hash });
            await checkBalance();
        } catch (error) {
            showBoundary(error);
        } finally {
            setIsSending(false);
        }
    };

    const hasEnoughBalance = balance >= MINIMUM_BALANCE;

    return <div className="space-y-4">
        <div className="text-lg font-bold">Relayer Configuration</div>
        <Input
            label="Destination Subnet ID"
            value={subnetID}
            onChange={setSubnetID}
        />
        <Input
            label="Destination Chain ID"
            value={chainID}
            onChange={setChainID}
        />
        <Input
            label="Destination RPC"
            value={evmChainRpcUrl}
            onChange={setEvmChainRpcUrl}
        />
        <div className="space-y-2">
            <Input
                label="Relayer EVM Address"
                value={relayerAddress}
                disabled
            />
            <div>
                <p className="font-semibold">Relayer Balance:</p>
                {isCheckingBalance ? (
                    <p>Checking balance...</p>
                ) : (
                    <div className="flex items-center gap-2">
                        <p>{formatEther(balance)} coins {hasEnoughBalance ? '✅' : '❌'}</p>
                        <span
                            onClick={checkBalance}
                            className="text-blue-500 hover:underline cursor-pointer"
                        >
                            Recheck
                        </span>
                    </div>
                )}
                <div className="pb-2 text-xs">
                    Should be at least {formatEther(MINIMUM_BALANCE)} native coins
                </div>
                {!hasEnoughBalance && (
                    <Button
                        type="primary"
                        onClick={handleFund}
                        loading={isSending}
                        disabled={isSending}
                    >
                        Fund Relayer
                    </Button>
                )}
            </div>
        </div>
        {hasEnoughBalance && (
            <>
                <div className="text-sm">
                    ⚠️ The private key is randomly generated on every page load and only available in your browser until you refresh the page.
                    Please save the address above as you will need to fund it later.
                </div>
                <div className="text-lg font-bold">Write the relayer config file</div>
                <CodeHighlighter
                    code={genConfigCommand(subnetID, chainID, evmChainRpcUrl, randomPrivateKey)}
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
                <KnownChainIDWarning walletChainId={walletChainId} />
                <div className="text-lg font-bold">
                    You need to fund the relayer with at least {formatEther(MINIMUM_BALANCE)} native coins to start relaying messages.
                </div>
            </>
        )}
    </div>
}

const genConfigCommand = (destinationSubnetID: string, destinationBlockchainID: string, destinationRPC: string, privateKeyhex: string) => {
    const config = {
        "info-api": {
            "base-url": "https://api.avax-test.network"
        },
        "p-chain-api": {
            "base-url": "https://api.avax-test.network"
        },
        "source-blockchains": [
            {
                "subnet-id": "11111111111111111111111111111111LpoYY",
                "blockchain-id": "yH8D7ThNJkxmtkuv2jgBa4P1Rn3Qpr4pPr7QYNfcdoS6k6HWp",
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
            }
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
            }
        ]
    }

    const configStr = JSON.stringify(config, null, 4);
    return `mkdir -p ~/.icm-relayer && echo '${configStr}' > ~/.icm-relayer/config.json`
}

const relayerDockerCommand = () => {
    return `docker run --name relayer -d \\
    --restart on-failure  \\
    --user=root \\
    -v ~/.icm-relayer/:/icm-relayer/ \\
    avaplatform/icm-relayer:v1.5.1-rc.4 \\
    --config-file /icm-relayer/config.json`
}
