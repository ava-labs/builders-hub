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
import { AllowlistComponent } from "../components/AllowListComponents";

// Default Native Minter address
const DEFAULT_NATIVE_MINTER_ADDRESS =
  "0x0200000000000000000000000000000000000001";

export default function NativeMinter() {
  const { coreWalletClient, publicClient, walletEVMAddress } = useWalletStore();
  const viemChain = useViemChainStore();
  const [amount, setAmount] = useState<string>("");
  const [recipient, setRecipient] = useState<string>("");
  const [isMinting, setIsMinting] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);

  const handleMint = async () => {
    if (!coreWalletClient) throw new Error("Wallet client not found");

    setIsMinting(true);

    try {
      // Convert amount to Wei
      const amountInWei = BigInt(amount) * BigInt(10 ** 18);

      // Call the mintNativeCoin function using the contract ABI
      const hash = await coreWalletClient.writeContract({
        address: DEFAULT_NATIVE_MINTER_ADDRESS as `0x${string}`,
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
        <AllowlistComponent
          precompileAddress={DEFAULT_NATIVE_MINTER_ADDRESS}
          precompileType="Minter"
        />
      </div>
    </div>
  );
}
