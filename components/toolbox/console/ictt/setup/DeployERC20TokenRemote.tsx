"use client";

import ERC20TokenRemote from "@/contracts/icm-contracts/compiled/ERC20TokenRemote.json";
import {
  useL1ByChainId,
  useSelectedL1,
} from "@/components/toolbox/stores/l1ListStore";
import {
  useToolboxStore,
  useViemChainStore,
  getToolboxStore,
} from "@/components/toolbox/stores/toolboxStore";
import { useWalletStore } from "@/components/toolbox/stores/walletStore";
import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/toolbox/components/Button";
import { Success } from "@/components/toolbox/components/Success";
import { Input, Suggestion } from "@/components/toolbox/components/Input";
import { EVMAddressInput } from "@/components/toolbox/components/EVMAddressInput";
import { createPublicClient, http } from "viem";
import { Note } from "@/components/toolbox/components/Note";
import { utils } from "@avalabs/avalanchejs";
import ERC20TokenHomeABI from "@/contracts/icm-contracts/compiled/ERC20TokenHome.json";
import ExampleERC20 from "@/contracts/icm-contracts/compiled/ExampleERC20.json";
import SelectBlockchainId from "@/components/toolbox/components/SelectBlockchainId";
import { generateConsoleToolGitHubUrl } from "@/components/toolbox/utils/github-url";
import TeleporterRegistryAddressInput from "@/components/toolbox/components/TeleporterRegistryAddressInput";
import useConsoleNotifications from "@/hooks/useConsoleNotifications";
import { AcknowledgementCallout } from "@/components/toolbox/components/AcknowledgementCallout";
import { LockedContent } from "@/components/toolbox/components/LockedContent";
import { ConsoleToolMetadata, withConsoleToolMetadata } from "@/components/toolbox/components/WithConsoleToolMetadata";
import { WalletRequirementsConfigKey } from "@/components/toolbox/hooks/useWalletRequirements";

const metadata: ConsoleToolMetadata = {
  title: "Deploy ERC20 Token Remote Contract",
  description: "Deploy the ERC20TokenRemote contract for your ERC20 token.",
  toolRequirements: [WalletRequirementsConfigKey.EVMChainBalance],
  githubUrl: generateConsoleToolGitHubUrl(import.meta.url)
};

function DeployERC20TokenRemote() {
  const [criticalError, setCriticalError] = useState<Error | null>(null);
  const { erc20TokenRemoteAddress, setErc20TokenRemoteAddress } =
    useToolboxStore();
  const { coreWalletClient, walletEVMAddress } = useWalletStore();
  const { notify } = useConsoleNotifications();
  const viemChain = useViemChainStore();
  const selectedL1 = useSelectedL1()();
  const [isDeploying, setIsDeploying] = useState(false);
  const [sourceChainId, setSourceChainId] = useState<string>("");
  const [teleporterManager, setTeleporterManager] = useState(walletEVMAddress);
  const [localError, setLocalError] = useState("");
  const [tokenName, setTokenName] = useState("");
  const [tokenSymbol, setTokenSymbol] = useState("");
  const [tokenDecimals, setTokenDecimals] = useState("0");
  const [minTeleporterVersion, setMinTeleporterVersion] = useState("1");
  const [tokenHomeAddress, setTokenHomeAddress] = useState("");
  const [teleporterRegistryAddress, setTeleporterRegistryAddress] =
    useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [workflowDismissed, setWorkflowDismissed] = useState(false);
  
  // Throw critical errors during render
  if (criticalError) {
    throw criticalError;
  }

  const sourceL1 = useL1ByChainId(sourceChainId)();
  const sourceToolboxStore = getToolboxStore(sourceChainId)();

  const tokenHomeBlockchainIDHex = useMemo(() => {
    if (!sourceL1?.id) return undefined;
    try {
      return utils.bufferToHex(utils.base58check.decode(sourceL1.id));
    } catch (e) {
      console.error("Error decoding source chain ID:", e);
      return undefined;
    }
  }, [sourceL1?.id]);

  let sourceChainError: string | undefined = undefined;
  if (!sourceChainId) {
    sourceChainError = "Please select a source chain";
  } else if (selectedL1?.id === sourceChainId) {
    sourceChainError = "Source and destination chains must be different";
  }

  //Updates token decimals
  useEffect(() => {
    const fetchTokenDetails = async () => {
      try {
        setLocalError("");
        setTokenDecimals("0");
        setTokenName("loading...");
        setTokenSymbol("loading...");

        if (!sourceL1?.rpcUrl || !tokenHomeAddress) return;

        const publicClient = createPublicClient({
          transport: http(sourceL1.rpcUrl),
        });

        const tokenAddress = await publicClient.readContract({
          address: tokenHomeAddress as `0x${string}`,
          abi: ERC20TokenHomeABI.abi,
          functionName: "getTokenAddress",
        });
        const decimals = await publicClient.readContract({
          address: tokenAddress as `0x${string}`,
          abi: ExampleERC20.abi,
          functionName: "decimals",
        });
        const name = await publicClient.readContract({
          address: tokenAddress as `0x${string}`,
          abi: ExampleERC20.abi,
          functionName: "name",
        });
        const symbol = await publicClient.readContract({
          address: tokenAddress as `0x${string}`,
          abi: ExampleERC20.abi,
          functionName: "symbol",
        });

        setTokenDecimals(String(decimals));
        setTokenName(name as string);
        setTokenSymbol(symbol as string);
      } catch (error: any) {
        console.error(error);
        setLocalError("Fetching token details failed: " + error.message);
      }
    };

    fetchTokenDetails();
  }, [sourceChainId, sourceL1?.rpcUrl, tokenHomeAddress]);

  // Suggestions for source contract address on current chain
  const [homeContractSuggestions, setHomeContractSuggestions] = useState<
    Suggestion[]
  >([]);
  useEffect(() => {
    const fetchSuggestions = async () => {
      const suggestions: Suggestion[] = [];

      if (sourceToolboxStore.erc20TokenHomeAddress) {
        suggestions.push({
          title: sourceToolboxStore.erc20TokenHomeAddress,
          value: sourceToolboxStore.erc20TokenHomeAddress,
          description: `ERC20 Token Home on ${sourceL1?.name}`,
        });
      }

      if (sourceToolboxStore.nativeTokenHomeAddress) {
        suggestions.push({
          title: sourceToolboxStore.nativeTokenHomeAddress,
          value: sourceToolboxStore.nativeTokenHomeAddress,
          description: `Native Token Home on ${sourceL1?.name}`,
        });
      }

      setHomeContractSuggestions(suggestions);
    };

    fetchSuggestions();
  }, [sourceChainId]);

  async function handleDeploy() {
    if (!coreWalletClient) {
      setCriticalError(new Error("Core wallet not found"));
      return;
    }

    setLocalError("");
    setIsDeploying(true);

    try {
      if (!viemChain || !selectedL1) {
        throw new Error("Destination chain configuration is missing.");
      }

      const homeAddress = tokenHomeAddress;

      if (
        !homeAddress ||
        !teleporterRegistryAddress ||
        !tokenHomeBlockchainIDHex ||
        tokenDecimals === "0" ||
        !tokenName ||
        !tokenSymbol
      ) {
        throw new Error("Critical deployment parameters missing or invalid.");
      }

      const publicClient = createPublicClient({
        chain: viemChain,
        transport: http(viemChain.rpcUrls.default.http[0]),
      });

      const constructorArgs = [
        {
          teleporterRegistryAddress: teleporterRegistryAddress as `0x${string}`,
          teleporterManager:
            teleporterManager || walletEVMAddress,
          minTeleporterVersion: BigInt(minTeleporterVersion),
          tokenHomeBlockchainID: tokenHomeBlockchainIDHex as `0x${string}`,
          tokenHomeAddress: homeAddress as `0x${string}`,
          tokenHomeDecimals: parseInt(tokenDecimals),
        },
        tokenName,
        tokenSymbol,
        parseInt(tokenDecimals),
      ];

      console.log("Deploying ERC20TokenRemote with args:", constructorArgs);

      const deployPromise = coreWalletClient.deployContract({
        abi: ERC20TokenRemote.abi as any,
        bytecode: ERC20TokenRemote.bytecode.object as `0x${string}`,
        args: constructorArgs,
        account: walletEVMAddress as `0x${string}`,
        chain: viemChain,
      });
      notify(
        {
          type: "deploy",
          name: "ERC20TokenRemote",
        },
        deployPromise,
        viemChain ?? undefined
      );

      const receipt = await publicClient.waitForTransactionReceipt({
        hash: await deployPromise,
      });

      if (!receipt.contractAddress) {
        throw new Error("No contract address in receipt");
      }

      setErc20TokenRemoteAddress(receipt.contractAddress);
    } catch (error: any) {
      console.error("Deployment failed:", error);
      setLocalError(
        `Deployment failed: ${error.shortMessage || error.message}`
      );
      setCriticalError(
        error instanceof Error ? error : new Error(String(error))
      );
    } finally {
      setIsDeploying(false);
    }
  }

  return (
    <>
      <div>
        <p className="mt-2">
          This deploys an `ERC20TokenRemote` contract to the current network (
          {selectedL1?.name}). This contract acts as the bridge endpoint for
          your ERC20 token from the source chain.
        </p>
      </div>

      <AcknowledgementCallout
        title="Have You Switched to the Destination Chain?"
        type="info"
        checkboxLabel="I have switched to the destination chain and am ready to deploy"
        checked={acknowledged}
        onCheckedChange={(checked: boolean) => {
          setAcknowledged(checked);
          if (checked) {
            setWorkflowDismissed(true);
          }
        }}
        visible={!workflowDismissed}
      >
        <p>
          <strong>Important:</strong> The Token Remote contract must be deployed on the <strong>destination chain</strong> (where you want to receive bridged tokens).
        </p>
        <p>
          Before proceeding, make sure you have:
        </p>
        <ul className="list-disc list-inside ml-2 space-y-1">
          <li>Already deployed the <strong>Token Home</strong> contract on the source chain</li>
          <li>Switched to the <strong>destination chain</strong> using the chain selector in Builder Console</li>
          <li>Verified that <code className="bg-blue-100 dark:bg-blue-900/30 px-1 py-0.5 rounded">{selectedL1?.name}</code> is your intended destination chain</li>
        </ul>
      </AcknowledgementCallout>

      <LockedContent
        isUnlocked={workflowDismissed}
        lockedMessage="Please acknowledge the chain switching workflow above to continue."
      >
        <TeleporterRegistryAddressInput
        value={teleporterRegistryAddress}
        onChange={setTeleporterRegistryAddress}
        disabled={isDeploying}
      />

      {!teleporterRegistryAddress && (
        <Note variant="warning">
          <p>
            Please{" "}
            <a href="#teleporterRegistry" className="text-blue-500">
              deploy the Teleporter Registry contract first
            </a>
            .
          </p>
        </Note>
      )}

      <SelectBlockchainId
        label="Source Chain (where token home is deployed)"
        value={sourceChainId}
        onChange={(value) => setSourceChainId(value)}
        error={sourceChainError}
      />

      {sourceChainId && (
        <EVMAddressInput
          label={`Token Home Address on ${sourceL1?.name}`}
          value={tokenHomeAddress}
          onChange={setTokenHomeAddress}
          helperText={
            !sourceToolboxStore.erc20TokenHomeAddress
              ? `Please deploy the Token Home contract on ${sourceL1?.name} first`
              : undefined
          }
          suggestions={homeContractSuggestions}
        />
      )}

      {tokenHomeBlockchainIDHex && (
        <Input
          label="Token Home Blockchain ID (hex)"
          value={tokenHomeBlockchainIDHex}
          disabled
        />
      )}

      {localError && (
        <div className="text-red-500 mt-2 p-2 border border-red-300 rounded">
          {localError}
        </div>
      )}

      {tokenHomeAddress && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input label="Token Name" value={tokenName} disabled />

          <Input label="Token Symbol" value={tokenSymbol} disabled />

          <Input label="Token Decimals" value={tokenDecimals} disabled />
        </div>
      )}

      <EVMAddressInput
        label="Teleporter Manager Address"
        value={teleporterManager}
        onChange={setTeleporterManager}
        disabled={isDeploying}
      />

      <Input
        label="Min Teleporter Version"
        value={minTeleporterVersion}
        onChange={setMinTeleporterVersion}
        type="number"
        required
      />

      <Success
        label={`ERC20 Token Remote Address (on ${selectedL1?.name})`}
        value={erc20TokenRemoteAddress || ""}
      />

      <Button
        variant={erc20TokenRemoteAddress ? "secondary" : "primary"}
        onClick={handleDeploy}
        loading={isDeploying}
        disabled={
          isDeploying ||
          !tokenHomeAddress ||
          !tokenHomeBlockchainIDHex ||
          tokenDecimals === "0" ||
          !tokenName ||
          !tokenSymbol ||
          !teleporterRegistryAddress ||
          !!sourceChainError
        }
      >
        {erc20TokenRemoteAddress
          ? "Re-Deploy ERC20 Token Remote"
          : "Deploy ERC20 Token Remote"}
      </Button>
      </LockedContent>
    </>
  );
}

export default withConsoleToolMetadata(DeployERC20TokenRemote, metadata);