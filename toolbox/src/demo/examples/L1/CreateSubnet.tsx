"use client";

import { useWalletStore, useToolboxStore } from "../../utils/store";
import { Button, Input } from "../../ui";
import { useErrorBoundary } from "react-error-boundary";
import { useState } from "react";
import { Success } from "../../ui/Success";

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
    <div className="space-y-4">
      <h2 className="text-lg font-semibold ">Create Subnet</h2>
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
          type="primary"
        >
          Create Subnet
        </Button>
      </div>
      <Success
        label="Subnet ID"
        value={subnetID}
      />
    </div>
  );
};
