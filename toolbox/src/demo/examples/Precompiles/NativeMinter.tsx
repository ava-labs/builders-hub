"use client";

import { useState } from 'react';
import { useWalletStore } from "../../../lib/walletStore";
import { Button } from "../../../components/Button";
import { Input } from "../../../components/Input";
import { Container } from "../../../toolbox/components/Container";
import { ResultField } from "../../../toolbox/components/ResultField";
import { EVMAddressInput } from "../../../toolbox/components/EVMAddressInput";
// import { AllowListControls } from "../../components/AllowListComponents";

// Native Minter ABI
const NATIVE_MINTER_ABI = [
    {
        inputs: [
            { name: "addr", type: "address" },
            { name: "amount", type: "uint256" }
        ],
        name: "mintNativeCoin",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function"
    },
    {
        inputs: [{ name: "addr", type: "address" }],
        name: "setAdmin",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function"
    },
    {
        inputs: [{ name: "addr", type: "address" }],
        name: "setEnabled",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function"
    },
    {
        inputs: [{ name: "addr", type: "address" }],
        name: "setManager",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function"
    },
    {
        inputs: [{ name: "addr", type: "address" }],
        name: "setNone",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function"
    },
    {
        inputs: [{ name: "addr", type: "address" }],
        name: "readAllowList",
        outputs: [{ name: "role", type: "uint256" }],
        stateMutability: "view",
        type: "function"
    }
] as const;

// Default Native Minter address
const DEFAULT_NATIVE_MINTER_ADDRESS = "0x0200000000000000000000000000000000000001";

export default function NativeMinter() {
    const { coreWalletClient, publicClient, walletEVMAddress, walletChainId } = useWalletStore();
    const [nativeMinterAddress, setNativeMinterAddress] = useState<string>(DEFAULT_NATIVE_MINTER_ADDRESS);
    const [amount, setAmount] = useState<number>(100);
    const [recipient, setRecipient] = useState<string>("");
    const [isMinting, setIsMinting] = useState(false);
    const [txHash, setTxHash] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isAddressSet, setIsAddressSet] = useState(false);

    const verifyChainConnection = async () => {
        try {
            // Get the current chain ID
            const currentChainId = await publicClient.getChainId();
            console.log("Current chain ID:", currentChainId);
            
            // Get the current block number to verify connection
            const blockNumber = await publicClient.getBlockNumber();
            console.log("Current block number:", blockNumber);
            
            return true;
        } catch (error) {
            console.error("Chain verification failed:", error);
            return false;
        }
    };

    const handleSetAddress = async () => {
        if (!nativeMinterAddress) {
            setError("Native Minter address is required");
            return;
        }

        if (!walletEVMAddress) {
            setError("Please connect your wallet first");
            return;
        }

        try {
            // Verify chain connection
            const isConnected = await verifyChainConnection();
            if (!isConnected) {
                setError("Failed to connect to the network. Please ensure your wallet is connected to the correct L1 chain (Current Chain ID: " + walletChainId + ")");
                return;
            }

            // Skip bytecode verification for the default address
            if (nativeMinterAddress === DEFAULT_NATIVE_MINTER_ADDRESS) {
                setIsAddressSet(true);
                setError(null);
                return;
            }

            // Verify the address is a valid Native Minter contract
            const code = await publicClient.getBytecode({
                address: nativeMinterAddress as `0x${string}`
            });

            if (!code || code === "0x") {
                setError("Invalid contract address");
                return;
            }

            setIsAddressSet(true);
            setError(null);
        } catch (error) {
            console.error('Error verifying contract:', error);
            // If it's the default address, we'll still proceed
            if (nativeMinterAddress === DEFAULT_NATIVE_MINTER_ADDRESS) {
                setIsAddressSet(true);
                setError(null);
            } else {
                setError(error instanceof Error ? error.message : "Failed to verify contract address");
            }
        }
    };

    const handleMint = async () => {
        if (!recipient) {
            setError("Recipient address is required");
            return;
        }

        if (!walletEVMAddress) {
            setError("Please connect your wallet first");
            return;
        }

        if (!coreWalletClient) {
            setError("Wallet client not found");
            return;
        }

        setIsMinting(true);
        setError(null);

        try {
            // Verify chain connection
            const isConnected = await verifyChainConnection();
            if (!isConnected) {
                setError("Failed to connect to the network. Please ensure your wallet is connected to the correct L1 chain (Current Chain ID: " + walletChainId + ")");
                return;
            }

            // Convert amount to Wei
            const amountInWei = BigInt(amount) * BigInt(10 ** 18);

            // Prepare transaction arguments
            const txArgs = [recipient as `0x${string}`, amountInWei] as const;

            // First check if the account has permission to mint
            const role = await publicClient.readContract({
                address: nativeMinterAddress as `0x${string}`,
                abi: NATIVE_MINTER_ABI,
                functionName: "readAllowList",
                args: [walletEVMAddress as `0x${string}`]
            });

            // Role 2 is admin, role 1 is enabled
            if (role !== 2n && role !== 1n) {
                setError("Your account does not have permission to mint tokens. Please ensure you are an admin or enabled address.");
                return;
            }

            // Simulate transaction first
            const sim = await publicClient.simulateContract({
                address: nativeMinterAddress as `0x${string}`,
                abi: NATIVE_MINTER_ABI,
                functionName: "mintNativeCoin",
                args: txArgs,
                gas: BigInt(1_000_000),
                account: walletEVMAddress as `0x${string}`
            });

            console.log("Simulated transaction:", sim);

            // Send transaction
            const hash = await coreWalletClient.writeContract(sim.request);

            // Wait for transaction confirmation
            const receipt = await publicClient.waitForTransactionReceipt({ hash });

            if (receipt.status === 'success') {
                setTxHash(hash);
            } else {
                setError("Transaction failed");
            }

        } catch (error) {
            console.error('Minting error:', error);
            if (error instanceof Error) {
                if (error.message.includes("Failed to fetch")) {
                    setError(`Failed to connect to the network. Please ensure you are connected to the correct L1 chain (Current Chain ID: ${walletChainId})`);
                } else {
                    setError(error.message);
                }
            } else {
                setError('An unknown error occurred');
            }
        } finally {
            setIsMinting(false);
        }
    };

    if (!isAddressSet) {
        return (
            <Container
                title="Configure Native Minter"
                description="Set the address of the Native Minter precompile contract. The default address is pre-filled, but you can change it if needed."
            >
                <div className="space-y-4">
                    {error && (
                        <div className="p-4 text-red-700 bg-red-100 rounded-md">
                            {error}
                        </div>
                    )}

                    <EVMAddressInput
                        label="Native Minter Address"
                        value={nativeMinterAddress}
                        onChange={setNativeMinterAddress}
                    />

                    <div className="flex space-x-4">
                        <Button
                            variant="primary"
                            onClick={handleSetAddress}
                            disabled={!nativeMinterAddress || !walletEVMAddress}
                        >
                            Use Default Address
                        </Button>
                        <Button
                            variant="secondary"
                            onClick={() => setNativeMinterAddress("")}
                        >
                            Clear Address
                        </Button>
                    </div>
                </div>
            </Container>
        );
    }

    return (
        <Container
            title="Mint Native Tokens"
            description="This will mint native tokens to the specified address."
        >
            <div className="space-y-4">
                {error && (
                    <div className="p-4 text-red-700 bg-red-100 rounded-md">
                        {error}
                    </div>
                )}

                <div className="space-y-4">
                    <EVMAddressInput
                        label="Recipient Address"
                        value={recipient}
                        onChange={setRecipient}
                    />
                    <Input
                        label="Amount"
                        value={amount}
                        onChange={(value) => setAmount(Number(value))}
                        type="number"
                    />
                </div>

                {txHash && (
                    <ResultField
                        label="Transaction Successful"
                        value={txHash}
                        showCheck={true}
                    />
                )}

                <Button
                    variant="primary"
                    onClick={handleMint}
                    loading={isMinting}
                    disabled={!recipient || !amount || !walletEVMAddress}
                >
                    {!walletEVMAddress ? "Connect Wallet to Mint" : "Mint Native Tokens"}
                </Button>
            </div>

            {/* Use AllowListControls component with the Native Minter precompile address */}
            {/* TODO: Temporarily disabled allow list controls
            <AllowListControls precompileAddress={nativeMinterAddress} /> 
            */}
        </Container>
    );
}
