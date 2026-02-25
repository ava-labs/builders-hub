"use client";

import { useState } from "react";
import { useWalletStore } from "@/components/toolbox/stores/walletStore";
import { Button } from "@/components/toolbox/components/Button";
import { Input } from "@/components/toolbox/components/Input";
import { ResultField } from "@/components/toolbox/components/ResultField";
import { EVMAddressInput } from "@/components/toolbox/components/EVMAddressInput";
import { AllowlistComponent } from "@/components/toolbox/components/AllowListComponents";
import { CheckPrecompile } from "@/components/toolbox/components/CheckPrecompile";
import { WalletRequirementsConfigKey } from "@/components/toolbox/hooks/useWalletRequirements";
import { BaseConsoleToolProps, ConsoleToolMetadata, withConsoleToolMetadata } from "../../components/WithConsoleToolMetadata";
import { useConnectedWallet } from "@/components/toolbox/contexts/ConnectedWalletContext";
import { generateConsoleToolGitHubUrl } from "@/components/toolbox/utils/github-url";
import { usePrecompiles } from "@/components/toolbox/hooks/contracts";
import { parseEther } from "viem";

// Default Native Minter address
const DEFAULT_NATIVE_MINTER_ADDRESS =
  "0x0200000000000000000000000000000000000001";

const metadata: ConsoleToolMetadata = {
  title: "Native Minter",
  description: "Mint native tokens (AVAX) to any address on your L1",
  toolRequirements: [
    WalletRequirementsConfigKey.EVMChainBalance
  ],
  githubUrl: generateConsoleToolGitHubUrl(import.meta.url)
};

function NativeMinter({ onSuccess }: BaseConsoleToolProps) {
  const { publicClient, walletEVMAddress } = useWalletStore();
  const { coreWalletClient } = useConnectedWallet();
  const precompiles = usePrecompiles();
  const [amount, setAmount] = useState<string>("");
  const [recipient, setRecipient] = useState<string>("");
  const [isMinting, setIsMinting] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);

  const handleMint = async () => {
    setIsMinting(true);

    try {
      const amountInWei = parseEther(amount);

      const hash = await precompiles.nativeMinter.mintNativeCoin(recipient, amountInWei);

      // Wait for transaction confirmation
      const receipt = await publicClient.waitForTransactionReceipt({ hash: hash as `0x${string}` });

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

  const numAmount = Number(amount);
  const isValidAmount = amount !== "" && !isNaN(numAmount) && numAmount > 0;
  const hasTooManyDecimals = amount.includes(".") && (amount.split(".")[1]?.length ?? 0) > 18;
  const canMint = Boolean(recipient && isValidAmount && !hasTooManyDecimals && walletEVMAddress && coreWalletClient && !isMinting);

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
              label="Amount (supports decimals, e.g. 3.5)"
              value={amount}
              onChange={(value) => setAmount(value)}
              type="number"
              min="0"
              step="any"
              disabled={isMinting}
            />
            {hasTooManyDecimals && (
              <p className="text-sm text-red-500">Maximum 18 decimal places allowed</p>
            )}
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
