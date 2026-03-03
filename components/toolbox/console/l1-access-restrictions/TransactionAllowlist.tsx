"use client";

import { useState } from "react";
import { AllowlistRoleManager } from "@/components/toolbox/components/AllowListComponents";
import { CheckPrecompile } from "@/components/toolbox/components/CheckPrecompile";
import { WalletRequirementsConfigKey } from "@/components/toolbox/hooks/useWalletRequirements";
import { BaseConsoleToolProps, ConsoleToolMetadata, withConsoleToolMetadata } from "../../components/WithConsoleToolMetadata";
import { generateConsoleToolGitHubUrl } from "@/components/toolbox/utils/github-url";
import { PrecompileCodeViewer } from "@/components/console/precompile-code-viewer";
import { ArrowRightLeft } from "lucide-react";

// Default Transaction AllowList address
const DEFAULT_TRANSACTION_ALLOWLIST_ADDRESS =
  "0x0200000000000000000000000000000000000002";

const metadata: ConsoleToolMetadata = {
  title: "Transaction Allowlist",
  description: "Manage addresses allowed to send transactions on your L1",
  toolRequirements: [
    WalletRequirementsConfigKey.EVMChainBalance
  ],
  githubUrl: generateConsoleToolGitHubUrl(import.meta.url)
};

function TransactionAllowlist({ onSuccess }: BaseConsoleToolProps) {
  const [highlightFunction, setHighlightFunction] = useState<string>("setEnabled");

  const handleFunctionChange = (fn: string) => {
    setHighlightFunction(fn);
  };

  return (
    <CheckPrecompile
      configKey="txAllowListConfig"
      precompileName="Transaction Allowlist"
    >
      <PrecompileCodeViewer
        precompileName="TxAllowList"
        highlightFunction={highlightFunction}
      >
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 rounded-lg bg-teal-100 dark:bg-teal-900/30">
              <ArrowRightLeft className="w-5 h-5 text-teal-600 dark:text-teal-400" />
            </div>
            <div>
              <h3 className="font-medium text-zinc-900 dark:text-zinc-100">Transaction Permissions</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Manage which addresses can send transactions
              </p>
            </div>
          </div>

          <AllowlistRoleManager
            precompileAddress={DEFAULT_TRANSACTION_ALLOWLIST_ADDRESS}
            precompileType="Transaction"
            onSuccess={onSuccess}
            onFunctionChange={handleFunctionChange}
          />
        </div>
      </PrecompileCodeViewer>
    </CheckPrecompile>
  );
}

export default withConsoleToolMetadata(TransactionAllowlist, metadata);
