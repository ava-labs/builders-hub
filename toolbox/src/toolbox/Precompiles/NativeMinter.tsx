"use client";

import { useState } from "react";
import { useWalletStore } from "../../lib/walletStore";
import { useViemChainStore } from "../toolboxStore";
import { Button } from "../../components/Button";
import { Input } from "../../components/Input";
import { Container } from "../components/Container";
import { ResultField } from "../components/ResultField";
import { EVMAddressInput } from "../components/EVMAddressInput";
import nativeMinterAbi from "../../../contracts/precompiles/NativeMinter.json";
import { AllowListWrapper } from "../components/AllowListComponents";

// Default Native Minter address
const DEFAULT_NATIVE_MINTER_ADDRESS =
  "0x0200000000000000000000000000000000000001";

export default function NativeMinter() {
  const { coreWalletClient, publicClient, walletEVMAddress } = useWalletStore();
  const viemChain = useViemChainStore();
  const [nativeMinterAddress, setNativeMinterAddress] = useState<string>(
    DEFAULT_NATIVE_MINTER_ADDRESS
  );
  const [amount, setAmount] = useState<string>("");
  const [recipient, setRecipient] = useState<string>("");
  const [isMinting, setIsMinting] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [isAddressSet, setIsAddressSet] = useState(false);

  const handleSetAddress = async () => {
    // Skip bytecode verification for the default address
    if (nativeMinterAddress === DEFAULT_NATIVE_MINTER_ADDRESS) {
      setIsAddressSet(true);
      return;
    }

    // Verify the address is a valid Native Minter contract
    const code = await publicClient.getBytecode({
      address: nativeMinterAddress as `0x${string}`,
    });

    if (!code || code === "0x") {
      throw new Error("Invalid contract address");
    }

    setIsAddressSet(true);
  };

  const handleMint = async () => {
    if (!coreWalletClient) throw new Error("Wallet client not found");

    setIsMinting(true);

    try {
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
        throw new Error("Transaction failed");
      }
    } finally {
      setIsMinting(false);
    }
  };

  const isValidAmount = amount && Number(amount) > 0;
  const canMint = Boolean(recipient && isValidAmount && walletEVMAddress && coreWalletClient && !isMinting);

  if (!isAddressSet) {
    return (
      <Container
        title="Configure Native Minter"
        description="Set the address of the Native Minter precompile contract. The default address is pre-filled, but you can change it if needed."
      >
        <div className="space-y-4">
          <EVMAddressInput
            value={nativeMinterAddress}
            onChange={setNativeMinterAddress}
            label="Native Minter Address"
            disabled={isMinting}
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
              disabled={isMinting}
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
          <div className="space-y-4">
            <EVMAddressInput
              label="Recipient Address"
              value={recipient}
              onChange={setRecipient}
              disabled={isMinting}
            />
            <Input
              label="Amount"
              value={amount}
              onChange={(value) => setAmount(value)}
              type="number"
              min="0"
              step="0.000000000000000001"
              disabled={isMinting}
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
            disabled={!canMint}
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
