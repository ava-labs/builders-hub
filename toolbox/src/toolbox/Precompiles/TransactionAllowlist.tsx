"use client";

import { useState } from "react";
import { useWalletStore } from "../../lib/walletStore";
import { Button } from "../../components/Button";
import { Container } from "../components/Container";
import { EVMAddressInput } from "../components/EVMAddressInput";
import { AllowListWrapper } from "../components/AllowListComponents";

// Default Transaction AllowList address
const DEFAULT_TRANSACTION_ALLOWLIST_ADDRESS =
  "0x0200000000000000000000000000000000000002";

export default function TransactionAllowlist() {
  const { publicClient, walletEVMAddress } = useWalletStore();
  const [transactionAllowlistAddress, setTransactionAllowlistAddress] =
    useState<string>(DEFAULT_TRANSACTION_ALLOWLIST_ADDRESS);
  const [isAddressSet, setIsAddressSet] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSetAddress = async () => {
    setIsProcessing(true);

    // Skip bytecode verification for the default address
    if (transactionAllowlistAddress === DEFAULT_TRANSACTION_ALLOWLIST_ADDRESS) {
      setIsAddressSet(true);
      setIsProcessing(false);
      return;
    }

    // Verify the address is a valid Transaction AllowList contract
    const code = await publicClient.getBytecode({
      address: transactionAllowlistAddress as `0x${string}`,
    });

    if (!code || code === "0x") {
      throw new Error("Invalid contract address");
    }

    setIsAddressSet(true);
    setIsProcessing(false);
  };

  const canSetAddress = Boolean(
    transactionAllowlistAddress &&
    walletEVMAddress &&
    !isProcessing
  );

  if (!isAddressSet) {
    return (
      <Container
        title="Configure Transaction AllowList"
        description="Set the address of the Transaction AllowList precompile contract. The default address is pre-filled, but you can change it if needed."
      >
        <div className="space-y-4">
          <EVMAddressInput
            value={transactionAllowlistAddress}
            onChange={setTransactionAllowlistAddress}
            label="Transaction Allowlist Address"
            disabled={isProcessing}
          />

          <div className="flex space-x-4">
            <Button
              variant="primary"
              onClick={handleSetAddress}
              disabled={!canSetAddress}
              loading={isProcessing}
            >
              Use Default Address
            </Button>
            <Button
              variant="secondary"
              onClick={() => setTransactionAllowlistAddress("")}
              disabled={isProcessing}
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
      <div className="w-full">
        <AllowListWrapper
          precompileAddress={transactionAllowlistAddress}
          precompileType="Transaction"
        />
      </div>
    </div>
  );
}
