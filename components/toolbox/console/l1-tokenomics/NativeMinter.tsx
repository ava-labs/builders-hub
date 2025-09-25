"use client";

import { useState } from "react";
import { useWalletStore } from "@/components/toolbox/stores/walletStore";
import { useViemChainStore } from "@/components/toolbox/stores/toolboxStore";
import { Button } from "@/components/toolbox/components/Button";
import { Input } from "@/components/toolbox/components/Input";
import { ResultField } from "@/components/toolbox/components/ResultField";
import { EVMAddressInput } from "@/components/toolbox/components/EVMAddressInput";
import nativeMinterAbi from "@/contracts/precompiles/NativeMinter.json";
import { AllowlistComponent } from "@/components/toolbox/components/AllowListComponents";
import { CheckPrecompile } from "@/components/toolbox/components/CheckPrecompile";
import { WalletRequirementsConfigKey } from "@/components/toolbox/hooks/useWalletRequirements";
import { BaseConsoleToolProps, ConsoleToolMetadata, withConsoleToolMetadata } from "../../components/WithConsoleToolMetadata";
import { useConnectedWallet } from "@/components/toolbox/contexts/ConnectedWalletContext";

// Default Native Minter address
const DEFAULT_NATIVE_MINTER_ADDRESS =
  "0x0200000000000000000000000000000000000001";

const metadata: ConsoleToolMetadata = {
  title: "Native Minter",
  description: "Mint native tokens (AVAX) to any address on your L1",
  walletRequirements: [
    WalletRequirementsConfigKey.EVMChainBalance
  ]
};

function NativeMinter({ onSuccess }: BaseConsoleToolProps) {
  const { publicClient, walletEVMAddress } = useWalletStore();
  const { coreWalletClient } = useConnectedWallet();
  const viemChain = useViemChainStore();
  const [amount, setAmount] = useState<string>("");
  const [recipient, setRecipient] = useState<string>("");
  const [isMinting, setIsMinting] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);

  const handleMint = async () => {
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
        onSuccess?.();
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
    <CheckPrecompile
      configKey="contractNativeMinterConfig"
      precompileName="Native Minter"
    >
      <div>
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
      </div>

      <AllowlistComponent
        precompileAddress={DEFAULT_NATIVE_MINTER_ADDRESS}
        precompileType="Minter"
        onSuccess={onSuccess}
      />
    </CheckPrecompile>
  );
}

export default withConsoleToolMetadata(NativeMinter, metadata);
