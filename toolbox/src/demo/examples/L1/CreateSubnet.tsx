"use client";

import { utils, Context } from "@avalabs/avalanchejs";
import { pvm } from "@avalabs/avalanchejs";
import { getRPCEndpoint } from "../../utils/rpcEndpoint";
import { useExampleStore } from "../../utils/store";
import { Button, Input } from "../../ui";
import { useErrorBoundary } from "react-error-boundary";
import { useState } from "react";
import { Success } from "../../ui/Success";


export default function CreateSubnet() {
  const { showBoundary } = useErrorBoundary();
  const { networkID, getPChainAddress, setSubnetID, subnetID } = useExampleStore(state => state);
  const [isCreating, setIsCreating] = useState(false);

  async function handleCreateSubnet() {
    setSubnetID("");
    setIsCreating(true);
    try {
      const pvmApi = new pvm.PVMApi(getRPCEndpoint(networkID));
      const feeState = await pvmApi.getFeeState();
      const context = await Context.getContextFromURI(getRPCEndpoint(networkID));

      const addressBytes = utils.bech32ToBytes(getPChainAddress());

      const { utxos } = await pvmApi.getUTXOs({
        addresses: [getPChainAddress()]
      });

      const tx = pvm.e.newCreateSubnetTx({
        feeState,
        fromAddressesBytes: [addressBytes],
        utxos,
        subnetOwners: [addressBytes],
      }, context);


      const txID = await window.avalanche!.request({
        method: 'avalanche_sendTransaction',
        params: {
          transactionHex: utils.bufferToHex(tx.toBytes()),
          chainAlias: 'P',
        }
      }) as string;


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
          value={getPChainAddress()}
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
