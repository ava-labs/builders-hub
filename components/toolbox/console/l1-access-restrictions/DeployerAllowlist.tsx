"use client";

import { useState } from "react";
import { AllowlistRoleManager } from "@/components/toolbox/components/AllowListComponents";
import { CheckPrecompile } from "@/components/toolbox/components/CheckPrecompile";
import { WalletRequirementsConfigKey } from "@/components/toolbox/hooks/useWalletRequirements";
import { BaseConsoleToolProps, ConsoleToolMetadata, withConsoleToolMetadata } from "../../components/WithConsoleToolMetadata";
import { generateConsoleToolGitHubUrl } from "@/components/toolbox/utils/github-url";
import { PrecompileCodeViewer } from "@/components/console/precompile-code-viewer";
import { FileCode } from "lucide-react";

// Default Deployer AllowList address
const DEFAULT_DEPLOYER_ALLOWLIST_ADDRESS =
  "0x0200000000000000000000000000000000000000";

const metadata: ConsoleToolMetadata = {
  title: "Deployer Allowlist",
  description: "Control which addresses can deploy smart contracts on your L1",
  toolRequirements: [
    WalletRequirementsConfigKey.EVMChainBalance
  ],
  githubUrl: generateConsoleToolGitHubUrl(import.meta.url)
};

function DeployerAllowlist({ onSuccess }: BaseConsoleToolProps) {
  const [highlightFunction, setHighlightFunction] = useState<string>("setEnabled");

  const handleFunctionChange = (fn: string) => {
    setHighlightFunction(fn);
  };

  return (
    <CheckPrecompile
      configKey="contractDeployerAllowListConfig"
      precompileName="Deployer Allowlist"
    >
      <PrecompileCodeViewer
        precompileName="ContractDeployerAllowList"
        highlightFunction={highlightFunction}
      >
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-900/30">
              <FileCode className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h3 className="font-medium text-zinc-900 dark:text-zinc-100">Contract Deployment Permissions</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Manage which addresses can deploy smart contracts
              </p>
            </div>
          </div>

          <AllowlistRoleManager
            precompileAddress={DEFAULT_DEPLOYER_ALLOWLIST_ADDRESS}
            precompileType="Deployer"
            onSuccess={onSuccess}
            onFunctionChange={handleFunctionChange}
          />
        </div>
      </PrecompileCodeViewer>
    </CheckPrecompile>
  );
}

export default withConsoleToolMetadata(DeployerAllowlist, metadata);
