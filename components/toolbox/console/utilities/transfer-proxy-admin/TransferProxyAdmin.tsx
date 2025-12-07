"use client";

import { useWalletStore } from "@/components/toolbox/stores/walletStore";
import { useViemChainStore } from "@/components/toolbox/stores/toolboxStore";
import { useSelectedL1 } from "@/components/toolbox/stores/l1ListStore";
import { useState, useEffect } from "react";
import { Button } from "@/components/toolbox/components/Button";
import ProxyAdminABI from "@/contracts/openzeppelin-4.9/compiled/ProxyAdmin.json";
import { getSubnetInfo } from "@/components/toolbox/coreViem/utils/glacier";
import { EVMAddressInput } from "@/components/toolbox/components/EVMAddressInput";
import { Input } from "@/components/toolbox/components/Input";
import { Step, Steps } from "fumadocs-ui/components/steps";
import { WalletRequirementsConfigKey } from "@/components/toolbox/hooks/useWalletRequirements";
import {
  BaseConsoleToolProps,
  ConsoleToolMetadata,
  withConsoleToolMetadata,
} from "../../../components/WithConsoleToolMetadata";
import { useConnectedWallet } from "@/components/toolbox/contexts/ConnectedWalletContext";
import useConsoleNotifications from "@/hooks/useConsoleNotifications";
import { generateConsoleToolGitHubUrl } from "@/components/toolbox/utils/github-url";

// Storage slot with the admin of the proxy (following EIP1967)
const ADMIN_SLOT = "0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103";

const metadata: ConsoleToolMetadata = {
  title: "Transfer Proxy Admin Ownership",
  description: "Transfer ownership of the ProxyAdmin contract to a new owner",
  toolRequirements: [WalletRequirementsConfigKey.EVMChainBalance],
  githubUrl: generateConsoleToolGitHubUrl(import.meta.url),
};

function TransferProxyAdmin({ onSuccess }: BaseConsoleToolProps) {
  const [criticalError, setCriticalError] = useState<Error | null>(null);
  const [proxyAdminAddress, setProxyAdminAddress] = useState<`0x${string}` | null>(null);
  const selectedL1 = useSelectedL1()();
  const { publicClient, walletChainId, walletEVMAddress } = useWalletStore();
  const { coreWalletClient } = useConnectedWallet();
  const [isTransferring, setIsTransferring] = useState(false);
  const [currentOwner, setCurrentOwner] = useState<string | null>(null);
  const [newOwner, setNewOwner] = useState<string>("");
  const [proxySlotAdmin, setProxySlotAdmin] = useState<string | null>(null);
  const [contractError, setContractError] = useState<string | undefined>();
  const viemChain = useViemChainStore();

  const [proxyAddress, setProxyAddress] = useState<string>("");

  const { notify } = useConsoleNotifications();

  // Throw critical errors during render
  if (criticalError) {
    throw criticalError;
  }

  useEffect(() => {
    (async function () {
      try {
        const subnetId = selectedL1?.subnetId;
        if (!subnetId) {
          return;
        }
        const info = await getSubnetInfo(subnetId);
        const newProxyAddress = info.l1ValidatorManagerDetails?.contractAddress || "";
        setProxyAddress(newProxyAddress);

        if (!newProxyAddress) return;
        await readProxyAdminSlot(newProxyAddress);
      } catch (error) {
        setCriticalError(error instanceof Error ? error : new Error(String(error)));
      }
    })();
  }, [walletChainId]);

  // Read the proxy admin from storage slot
  async function readProxyAdminSlot(address: string) {
    try {
      if (!address) return;

      const data = await publicClient.getStorageAt({
        address: address as `0x${string}`,
        slot: ADMIN_SLOT as `0x${string}`,
      });

      if (data) {
        // Convert the bytes32 value to an address (take the last 20 bytes)
        const adminAddress = `0x${data.slice(-40)}` as `0x${string}`;
        setProxySlotAdmin(adminAddress);

        // Always use the admin from storage
        setProxyAdminAddress(adminAddress);
      }
    } catch (error) {
      console.error("Failed to read proxy admin slot:", error);
    }
  }

  useEffect(() => {
    if (proxyAddress) {
      readProxyAdminSlot(proxyAddress);
    }
  }, [proxyAddress]);

  useEffect(() => {
    checkCurrentOwner();
  }, [viemChain, proxyAdminAddress]);

  async function checkCurrentOwner() {
    try {
      if (!proxyAdminAddress) {
        setCurrentOwner(null);
        setContractError("Proxy admin address is required");
        return;
      }

      const owner = await publicClient.readContract({
        address: proxyAdminAddress,
        abi: ProxyAdminABI.abi,
        functionName: "owner",
        args: [],
      });

      setCurrentOwner(owner as string);
      setContractError(undefined);
    } catch (error: unknown) {
      setCurrentOwner(null);
      const errorMessage = error instanceof Error ? error.message : "Failed to read current owner";
      setContractError(errorMessage);
      console.error(error);
    }
  }

  async function handleTransferOwnership() {
    if (!newOwner) {
      throw new Error("New owner address is required");
    }

    if (!proxyAdminAddress) {
      throw new Error("Proxy admin address is required");
    }

    setIsTransferring(true);

    const transferPromise = coreWalletClient.writeContract({
      address: proxyAdminAddress,
      abi: ProxyAdminABI.abi,
      functionName: "transferOwnership",
      args: [newOwner as `0x${string}`],
      chain: viemChain ?? undefined,
      account: walletEVMAddress as `0x${string}`,
    });

    notify(
      {
        type: "call",
        name: "Transfer ProxyAdmin Ownership",
      },
      transferPromise,
      viemChain ?? undefined
    );

    try {
      const hash = await transferPromise;
      await publicClient.waitForTransactionReceipt({ hash });
      await checkCurrentOwner();
      onSuccess?.();
    } finally {
      setIsTransferring(false);
    }
  }

  const canTransfer =
    !!proxyAdminAddress && !!newOwner && currentOwner?.toLowerCase() !== newOwner?.toLowerCase();

  return (
    <>
      <Steps>
        <Step>
          <h2 className="text-lg font-semibold">Select Proxy</h2>
          <p className="text-sm text-gray-500">
            Select the proxy contract to read the ProxyAdmin address from.
          </p>

          <EVMAddressInput
            label="Proxy Address"
            value={proxyAddress}
            onChange={setProxyAddress}
            disabled={isTransferring}
            placeholder="Enter proxy address"
          />
          <Input
            label="Proxy Admin Address"
            value={proxySlotAdmin || ""}
            disabled
            placeholder="Proxy admin address will be read from storage"
          />
          <Input
            label="Current Owner"
            value={currentOwner || ""}
            disabled
            placeholder="Current owner address will be shown here"
            error={contractError}
          />
        </Step>
        <Step>
          <h2 className="text-lg font-semibold">Transfer Ownership</h2>
          <p className="text-sm text-gray-500">
            Enter the new owner address for the ProxyAdmin contract.
          </p>

          <EVMAddressInput
            label="New Owner Address"
            value={newOwner}
            onChange={(value: string) => setNewOwner(value)}
            placeholder="Enter new owner address"
          />

          <Button
            variant="primary"
            onClick={handleTransferOwnership}
            loading={isTransferring}
            disabled={isTransferring || !canTransfer}
          >
            {!canTransfer
              ? currentOwner?.toLowerCase() === newOwner?.toLowerCase()
                ? "Already Current Owner"
                : "Enter New Owner Address"
              : "Transfer Ownership"}
          </Button>
        </Step>
      </Steps>

      {currentOwner?.toLowerCase() === newOwner?.toLowerCase() && newOwner && (
        <p className="mt-4 text-yellow-600">
          The new owner address is the same as the current owner
        </p>
      )}
    </>
  );
}

export default withConsoleToolMetadata(TransferProxyAdmin, metadata);
