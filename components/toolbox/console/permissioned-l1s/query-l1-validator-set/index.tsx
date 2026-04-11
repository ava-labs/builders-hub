"use client";

import { useWalletStore } from "@/components/toolbox/stores/walletStore";
import { useState, useEffect, useMemo, useCallback } from "react";
import { AlertTriangle, Info } from "lucide-react";
import { Button } from "@/components/toolbox/components/Button";
import { networkIDs } from "@avalabs/avalanchejs";
import { GlobalParamNetwork } from "@avalabs/avacloud-sdk/models/components";
import { AvaCloudSDK } from "@avalabs/avacloud-sdk";
import SelectSubnetId from "@/components/toolbox/components/SelectSubnetId";
import BlockchainDetailsDisplay from "@/components/toolbox/components/BlockchainDetailsDisplay";
import { getSubnetInfo } from "@/components/toolbox/coreViem/utils/glacier";
import { SDKCodeViewer, type SDKCodeSource } from "@/components/console/sdk-code-viewer";
import {
  BaseConsoleToolProps,
  ConsoleToolMetadata,
  withConsoleToolMetadata,
} from "../../../components/WithConsoleToolMetadata";
import { generateConsoleToolGitHubUrl } from "@/components/toolbox/utils/githubUrl";
import { ValidatorTable } from "./ValidatorTable";
import { ValidatorDetails } from "./ValidatorDetails";
import { ValidatorResponse } from "./types";

const metadata: ConsoleToolMetadata = {
  title: "L1 Validators",
  description: "Query the validators of an L1 from the P-Chain using the Avalanche API",
  toolRequirements: [],
  githubUrl: generateConsoleToolGitHubUrl(import.meta.url),
};

const networkNames: Record<number, GlobalParamNetwork> = {
  [networkIDs.MainnetID]: "mainnet",
  [networkIDs.FujiID]: "fuji",
};

function QueryL1ValidatorSetInner({ onSuccess }: BaseConsoleToolProps) {
  const { avalancheNetworkID, isTestnet } = useWalletStore();
  const [validators, setValidators] = useState<ValidatorResponse[]>([]);
  const [filteredValidators, setFilteredValidators] = useState<ValidatorResponse[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedValidator, setSelectedValidator] = useState<ValidatorResponse | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [subnetId, setSubnetId] = useState<string>("");
  const [subnet, setSubnet] = useState<any>(null);
  const [isLoadingSubnet, setIsLoadingSubnet] = useState(false);
  const [subnetError, setSubnetError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>("");

  // Fetch subnet details when subnet ID changes
  useEffect(() => {
    if (!subnetId) {
      setSubnet(null);
      setSubnetError(null);
      return;
    }

    setIsLoadingSubnet(true);
    setSubnetError(null);
    getSubnetInfo(subnetId)
      .then((subnetInfo) => {
        setSubnet(subnetInfo);
        setSubnetError(null);
      })
      .catch((err) => {
        console.error("Error getting subnet info:", err);
        setSubnet(null);
        setSubnetError((err as Error).message);
      })
      .finally(() => {
        setIsLoadingSubnet(false);
      });
  }, [subnetId]);

  const fetchValidators = useCallback(async () => {
    if (!subnetId) return;

    setIsLoading(true);
    setError(null);
    setSelectedValidator(null);
    try {
      if (!subnetId.trim()) {
        throw new Error("Subnet ID is required to query L1 validators");
      }

      const network = networkNames[Number(avalancheNetworkID)];
      if (!network) {
        throw new Error("Invalid network selected");
      }

      const sdk = new AvaCloudSDK({
        serverURL: isTestnet ? "https://api.avax-test.network" : "https://api.avax.network",
        network,
      });

      const result = await sdk.data.primaryNetwork.listL1Validators({
        network,
        subnetId,
      });

      const allValidators: ValidatorResponse[] = [];
      for await (const page of result) {
        if ("result" in page && page.result && "validators" in page.result) {
          allValidators.push(...(page.result.validators as unknown as ValidatorResponse[]));
        } else if ("validators" in page) {
          allValidators.push(...(page.validators as unknown as ValidatorResponse[]));
        }
      }

      setValidators(allValidators);
      setFilteredValidators(allValidators);
    } catch (err) {
      console.error("Error fetching validators:", err);
      setError("Failed to fetch validators");
    } finally {
      setIsLoading(false);
    }
  }, [subnetId, avalancheNetworkID, isTestnet]);

  const copyToClipboard = useCallback((text: string) => {
    navigator.clipboard.writeText(text)
      .then(() => {
        setCopiedId(text);
        setTimeout(() => setCopiedId(null), 2000);
      })
      .catch((err) => {
        console.error("Failed to copy text:", err);
      });
  }, []);

  const handleSearch = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const term = e.target.value.toLowerCase();
      setSearchTerm(term);

      const validatorsWithWeight = validators.filter((v) => v.weight > 0);

      if (!term.trim()) {
        setFilteredValidators(validatorsWithWeight);
        return;
      }

      const filtered = validatorsWithWeight.filter((v) =>
        v.nodeId.toLowerCase().includes(term)
      );
      setFilteredValidators(filtered);
    },
    [validators]
  );

  // Update filtered validators when validators change
  useEffect(() => {
    const validatorsWithWeight = validators.filter((v) => v.weight > 0);
    setFilteredValidators(validatorsWithWeight);
  }, [validators]);

  // SDK code for the code viewer
  const sdkSources: SDKCodeSource[] = useMemo(
    () => [
      {
        name: "Query Validators",
        filename: "queryValidators.ts",
        code: `import { AvaCloudSDK } from "@avalabs/avacloud-sdk";

const sdk = new AvaCloudSDK({
  serverURL: "${isTestnet ? "https://api.avax-test.network" : "https://api.avax.network"}",
  network: "${isTestnet ? "fuji" : "mainnet"}",
});

const result = await sdk.data.primaryNetwork.listL1Validators({
  network: "${isTestnet ? "fuji" : "mainnet"}",
  subnetId: "${subnetId || "<your-subnet-id>"}",
});

// Paginate through all results
const allValidators = [];
for await (const page of result) {
  if ("result" in page && page.result) {
    allValidators.push(...page.result.validators);
  }
}

console.log(\`Found \${allValidators.length} validators\`);
allValidators.forEach((v) => {
  console.log(\`  \${v.nodeId} - weight: \${v.weight}\`);
});`,
        description: "Uses the AvaCloud Data API to list L1 validators",
        githubUrl: "https://github.com/ava-labs/avacloud-sdk-typescript",
      },
    ],
    [isTestnet, subnetId]
  );

  return (
    <>
      <SDKCodeViewer sources={sdkSources} height="auto">
        <div className="space-y-4">
          <SelectSubnetId value={subnetId} onChange={setSubnetId} hidePrimaryNetwork={true} />
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Subnet ID is required to query L1 validators
          </p>

          <BlockchainDetailsDisplay
            subnet={subnet}
            isLoading={isLoadingSubnet}
            error={subnetError}
          />

          <Button
            variant="primary"
            onClick={fetchValidators}
            disabled={isLoading || !subnetId.trim() || !!subnetError || isLoadingSubnet}
            loading={isLoading || isLoadingSubnet}
            loadingText={isLoading ? "Fetching..." : "Validating..."}
            className="w-full"
          >
            Fetch Validators
          </Button>
        </div>
      </SDKCodeViewer>

      {/* Error Display */}
      {error && (
        <div className="rounded-xl border border-red-200/80 dark:border-red-800 bg-red-50 dark:bg-red-950/30 p-4 mt-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-red-500 shrink-0" />
            <p className="text-sm font-medium text-red-700 dark:text-red-400">{error}</p>
          </div>
        </div>
      )}

      {/* Validators Table */}
      <ValidatorTable
        validators={validators}
        filteredValidators={filteredValidators}
        searchTerm={searchTerm}
        onSearch={handleSearch}
        onViewDetails={setSelectedValidator}
        copyToClipboard={copyToClipboard}
        copiedId={copiedId}
        isLoading={isLoading}
      />

      {/* Validator Details */}
      {selectedValidator && (
        <ValidatorDetails
          validator={selectedValidator}
          onClose={() => setSelectedValidator(null)}
          copyToClipboard={copyToClipboard}
          copiedId={copiedId}
        />
      )}

      {/* Data API Attribution */}
      <div className="flex items-center justify-center text-xs text-zinc-500 dark:text-zinc-400 italic p-2 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-200/80 dark:border-zinc-800 mt-4">
        <Info className="h-3 w-3 mr-1" />
        <a
          href="https://developers.avacloud.io/data-api/primary-network/list-validators"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
        >
          Data retrieved from Data API
        </a>
      </div>
    </>
  );
}

export default withConsoleToolMetadata(QueryL1ValidatorSetInner, metadata);
