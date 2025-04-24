"use client";

import { useState } from "react";
import { useWalletStore } from "../../lib/walletStore";
import { useViemChainStore } from "../toolboxStore";
import { Button } from "../../components/Button";
import { Input } from "../../components/Input";
import { Container } from "../components/Container";
import { ResultField } from "../components/ResultField";
import { PrecompileAddressInput } from "../components/PrecompileAddressInput";
import { EVMAddressInput } from "../components/EVMAddressInput";
import nativeMinterAbi from "../../../contracts/precompiles/NativeMinter.json";
import {
  SetAdminComponent,
  SetEnabledComponent,
  SetManagerComponent,
  RemoveAllowListComponent,
  ReadAllowListComponent,
  AllowListWrapper,
} from "../components/AllowListComponents";

// Default Native Minter address
const DEFAULT_NATIVE_MINTER_ADDRESS =
  "0x0200000000000000000000000000000000000001";

export default function NativeMinter() {
  const { coreWalletClient, publicClient, walletEVMAddress, walletChainId } =
    useWalletStore();
  const viemChain = useViemChainStore();
  const [nativeMinterAddress, setNativeMinterAddress] = useState<string>(
    DEFAULT_NATIVE_MINTER_ADDRESS
  );
  const [amount, setAmount] = useState<string>("");
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
        setError(
          "Failed to connect to the network. Please ensure your wallet is connected to the correct L1 chain (Current Chain ID: " +
            walletChainId +
            ")"
        );
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
        address: nativeMinterAddress as `0x${string}`,
      });

      if (!code || code === "0x") {
        setError("Invalid contract address");
        return;
      }

      setIsAddressSet(true);
      setError(null);
    } catch (error) {
      console.error("Error verifying contract:", error);
      // If it's the default address, we'll still proceed
      if (nativeMinterAddress === DEFAULT_NATIVE_MINTER_ADDRESS) {
        setIsAddressSet(true);
        setError(null);
      } else {
        setError(
          error instanceof Error
            ? error.message
            : "Failed to verify contract address"
        );
      }
    }
  };

  const handleMint = async () => {
    if (!recipient) {
      setError("Recipient address is required");
      return;
    }

    if (!amount || Number(amount) <= 0) {
      setError("Amount must be greater than zero");
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
        setError(
          "Failed to connect to the network. Please ensure your wallet is connected to the correct L1 chain (Current Chain ID: " +
            walletChainId +
            ")"
        );
        return;
      }

      // Convert amount to Wei
      const amountInWei = BigInt(amount) * BigInt(10 ** 18);

      // Call the mintNativeCoin function using the contract ABI
      const hash = await coreWalletClient.writeContract({
        address: nativeMinterAddress as `0x${string}`,
        abi: nativeMinterAbi.abi,
        functionName: "mintNativeCoin",
        args: [recipient, amountInWei],
        account: walletEVMAddress as `0x${string}`,
        chain: viemChain,
        gas: BigInt(1_000_000),
      });

      // Wait for transaction confirmation
      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      if (receipt.status === "success") {
        setTxHash(hash);
      } else {
        setError("Transaction failed");
      }
    } catch (error) {
      console.error("Minting error:", error);
      if (error instanceof Error) {
        if (error.message.includes("Failed to fetch")) {
          setError(
            `Failed to connect to the network. Please ensure you are connected to the correct L1 chain (Current Chain ID: ${walletChainId})`
          );
        } else {
          setError(error.message);
        }
      } else {
        setError("An unknown error occurred");
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

          <PrecompileAddressInput
            value={nativeMinterAddress}
            onChange={setNativeMinterAddress}
            precompileName="Native Minter"
            defaultAddress={DEFAULT_NATIVE_MINTER_ADDRESS}
          />

          <div className="flex space-x-4">
            <Button
              variant="primary"
              onClick={handleSetAddress}
              disabled={!nativeMinterAddress || !walletEVMAddress}
            >
              Set Native Minter Address
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
    <div className="space-y-6">
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
              onChange={(value) => setAmount(value)}
              type="number"
              min="0"
              step="0.000000000000000001"
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
            disabled={
              !recipient || !amount || Number(amount) <= 0 || !walletEVMAddress
            }
          >
            {!walletEVMAddress
              ? "Connect Wallet to Mint"
              : "Mint Native Tokens"}
          </Button>
        </div>
      </Container>

      <div className="w-full">
        <AllowListWrapper
          precompileAddress={nativeMinterAddress}
          precompileType="Minter"
        />
      </div>
    </div>
  );
}
