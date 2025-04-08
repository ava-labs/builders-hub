"use client";

import { useWalletStore } from "../../lib/walletStore";
import { useToolboxStore } from "../toolboxStore";
import { Button } from "../../components/Button";
import { Input } from "../../components/Input";
import { useErrorBoundary } from "react-error-boundary";
import { useState } from "react";
import { ResultField } from "../components/ResultField";
import { Container } from "../components/Container";

export default function CreateSubnet() {
  const { showBoundary } = useErrorBoundary();
  const { setSubnetID, subnetId } = useToolboxStore();
  const { coreWalletClient, pChainAddress } = useWalletStore();
  const [isCreating, setIsCreating] = useState(false);

  async function handleCreateSubnet() {
    setSubnetID("");
    setIsCreating(true);
    try {
      const txID = await coreWalletClient.createSubnet({
        subnetOwners: [pChainAddress]
      });

      setSubnetID(txID);
    } catch (error) {
      showBoundary(error);
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <Container
      title="Create Subnet"
      description="This will create a new subnet on the P-Chain."
    >
      <div className="space-y-4">
        <Input
          label="Your P-Chain Address"
          value={pChainAddress}
          disabled={true}
          type="text"
        />
        <Button
          onClick={handleCreateSubnet}
          loading={isCreating}
          variant="primary"
        >
          Create Subnet
        </Button>
      </div>
      {subnetId && (
        <ResultField
          label="Subnet ID"
          value={subnetId}
          showCheck={!!subnetId}
        />
      )}
    </Container>
  );
};
