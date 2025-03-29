"use client";

import { useWalletStore, useToolboxStore } from "../../utils/store";
import { Button } from "../../../components/button";
import { Input } from "../../../components/input";
import { useErrorBoundary } from "react-error-boundary";
import { useState } from "react";
import { ResultField } from "../../../components/result-field";
import { Container } from "../../../components/container";
export default function CreateSubnet() {
  const { showBoundary } = useErrorBoundary();
  const { setSubnetID, subnetID } = useToolboxStore();
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
      {subnetID && (
        <ResultField
          label="Subnet ID"
          value={subnetID}
          showCheck={!!subnetID}
        />
      )}
    </Container>
  );
};
