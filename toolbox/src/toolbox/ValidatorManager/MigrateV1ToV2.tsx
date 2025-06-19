"use client";

import { useState } from "react";
import { useErrorBoundary } from "react-error-boundary";
import { useWalletStore } from "../../stores/walletStore";
import { useViemChainStore, useToolboxStore } from "../../stores/toolboxStore";
import { Chain } from "viem";
import { Button } from "../../components/Button";
import { Input } from "../../components/Input";
import { Container } from "../../components/Container";
import { ResultField } from "../../components/ResultField";
import { ExternalLink } from "lucide-react";
import ValidatorManagerABI from "../../../contracts/icm-contracts/compiled/ValidatorManager.json";

export default function MigrateV1ToV2() {
  const { showBoundary } = useErrorBoundary();
  const { coreWalletClient, publicClient } = useWalletStore();
  const viemChain = useViemChainStore();
  const { validatorManagerAddress, setValidatorManagerAddress } = useToolboxStore();

  // State variables
  const [localValidatorManagerAddress, setLocalValidatorManagerAddress] = useState<string>(validatorManagerAddress || "");
  const [validationID, setValidationID] = useState<string>("");
  const [receivedNonce, setReceivedNonce] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [validationIDError, setValidationIDError] = useState<string | null>(null);
  const [receivedNonceError, setReceivedNonceError] = useState<string | null>(null);
  const [addressError, setAddressError] = useState<string | null>(null);

  // Validation functions
  const validateInputs = () => {
    let isValid = true;

    // Validate validationID (bytes32)
    if (!validationID) {
      setValidationIDError("Validation ID is required");
      isValid = false;
    } else if (!/^0x[0-9a-fA-F]{64}$/.test(validationID)) {
      setValidationIDError("Validation ID must be a valid bytes32 hex string (0x followed by 64 hex characters)");
      isValid = false;
    } else {
      setValidationIDError(null);
    }

    // Validate receivedNonce (uint32)
    if (!receivedNonce) {
      setReceivedNonceError("Received nonce is required");
      isValid = false;
    } else if (!/^\d+$/.test(receivedNonce) || parseInt(receivedNonce) > 4294967295) {
      setReceivedNonceError("Received nonce must be a valid uint32 value (0 to 4294967295)");
      isValid = false;
    } else {
      setReceivedNonceError(null);
    }

    // Validate validatorManagerAddress
    if (!localValidatorManagerAddress) {
      setAddressError("Validator Manager address is required");
      isValid = false;
    } else if (!/^0x[0-9a-fA-F]{40}$/.test(localValidatorManagerAddress)) {
      setAddressError("Validator Manager address must be a valid Ethereum address");
      isValid = false;
    } else {
      setAddressError(null);
    }

    return isValid;
  };

  // Update toolbox store when local address changes
  const handleAddressChange = (value: string) => {
    setLocalValidatorManagerAddress(value);
    if (value && /^0x[0-9a-fA-F]{40}$/.test(value)) {
      setValidatorManagerAddress(value);
    }
  };

  // Handler for migration
  const handleMigrate = async () => {
    if (!validateInputs()) {
      return;
    }

    setIsProcessing(true);
    setError(null);
    setTxHash(null);

    try {
      if (!viemChain) throw new Error("Chain not selected");
      if (!coreWalletClient) throw new Error("Wallet not connected");

      // Ensure we are on the correct chain
      await coreWalletClient.addChain({ chain: viemChain });
      await coreWalletClient.switchChain({ id: viemChain.id });

      // Call the migrateFromV1 function
      const hash = await coreWalletClient.writeContract({
        address: localValidatorManagerAddress as `0x${string}`,
        abi: ValidatorManagerABI.abi,
        functionName: "migrateFromV1",
        args: [
          validationID as `0x${string}`,
          parseInt(receivedNonce)
        ],
        chain: viemChain as Chain
      });

      // Wait for the transaction to complete
      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      if (receipt.status === 'success') {
        setTxHash(hash);
      } else {
        setError("Transaction failed. Please check the console for more details.");
        console.error("Transaction failed:", receipt);
      }
    } catch (error: any) {
      setError(error.message || "An unknown error occurred");
      showBoundary(error);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Container
      title="Migrate Validator from V1 to V2"
      description="Migrate validators from the Validator Manager contract v1 to v2"
    >
      <div className="space-y-6">
        <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-md text-sm mb-4">
          <p className="mb-2"><strong>Note:</strong> This tool is only required if your L1 has the Validator Manager contract version 1 deployed. If you have deployed the Validator Manager contract with this Toolbox, it is already the version 2. In this case you don't need to do this!</p>
        </div>
        <div>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
            This tool allows you to migrate a validator from the V1 contract to the V2 contract. Before using this tool, ensure that you have the following:
            <ul>
              <li>Deploy the  Messages Library and Validator Manager v2 using the tools in this toolbox</li>
              <li>Upgrade the Proxy to point to the Validator Manager v2 contract address</li>
              <li>Use this tool to migrate every validator using the validationID</li>
            </ul>
            You need to provide the validation ID, the latest nonce received from the P-Chain,
            and the address of the Validator Manager contract.
          </p>
        </div>

        <form className="space-y-4">
          <Input
            id="validatorManagerAddress"
            label="Validator Manager Address"
            placeholder="0x..."
            value={localValidatorManagerAddress}
            onChange={handleAddressChange}
            error={addressError}
          />

          <Input
            id="validationID"
            label="Validation ID"
            placeholder="0x..."
            value={validationID}
            onChange={setValidationID}
            helperText="The bytes32 ID of the validation period to migrate"
            error={validationIDError}
          />

          <Input
            id="receivedNonce"
            label="Received Nonce"
            value={receivedNonce}
            onChange={setReceivedNonce}
            helperText="The latest nonce received from the P-Chain"
            error={receivedNonceError}
          />

          <Button
            onClick={handleMigrate}
            loading={isProcessing}
            loadingText="Migrating..."
            disabled={isProcessing}
          >
            Migrate Validator
          </Button>

          {error && (
            <div className="text-red-500 text-sm p-3 bg-red-50 dark:bg-red-900/30 rounded-lg">
              {error}
            </div>
          )}

          {txHash && (
            <div className="space-y-2">
              <ResultField
                label="Transaction Hash"
                value={txHash}
                showCheck
              />
              <a
                href={`https://subnets.avax.network/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-500 hover:underline flex items-center gap-1"
              >
                View on Explorer
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          )}
        </form>
      </div>
    </Container>
  );
}
