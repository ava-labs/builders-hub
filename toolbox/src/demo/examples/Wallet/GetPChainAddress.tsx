"use client";

import { useEffect, useState } from "react";
import { useExampleStore } from "../../utils/store";
import { Success, Input, Select } from "../../ui";
import {
  networkIDs,
} from "@avalabs/avalanchejs";
import { pChainAddrFromPubKey } from "./pChainAddrFromPubKey";


export default function GetPChainAddress() {
  const { networkID, setNetworkID } = useExampleStore();
  const [xpPublicKey, setXpPublicKey] = useState<string>("");
  const [pChainAddress, setPChainAddress] = useState<string>("");
  const [error, setError] = useState<string>("");

  useEffect(() => {
    setPChainAddress(xpPublicKey ? pChainAddrFromPubKey(xpPublicKey, networkID) : "")
  }, [xpPublicKey, networkID]);

  async function fetchPubKey() {
    // The public key is already in the store, but we fetch it here for demonstration purposes
    try {
      setError("");
      const pubkeys = await window.avalanche?.request<{ xp: string, evm: string }>({
        method: "avalanche_getAccountPubKey",
      });
      if (!pubkeys) {
        throw new Error("Failed to get public keys");
      }
      setXpPublicKey(pubkeys.xp);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch public key");
    }
  }

  useEffect(() => {
    fetchPubKey();
  }, []);

  return (
    <>
      <h2 className="text-lg font-semibold ">Get P-Chain Address</h2>
      <div className="space-y-2">
        <Input label="XP Public Key" value={xpPublicKey} disabled={true} />
        {error && <p className="text-red-500">{error}</p>}
      </div>
      <div>
        <Select
          label="Select Network"
          value={networkID}
          onChange={(value) => setNetworkID(Number(value))}
          options={[
            { value: networkIDs.FujiID, label: "Fuji" },
            { value: networkIDs.MainnetID, label: "Mainnet" },
          ]}
        />
      </div>
      <Success
        label="P-Chain Address"
        value={pChainAddress}
      />
    </>
  );
};
