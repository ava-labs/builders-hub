"use client";

import { AllowlistComponent } from "@/components/toolbox/components/AllowListComponents";
import { CheckPrecompile } from "@/components/toolbox/components/CheckPrecompile";
import { WalletRequirementsConfigKey } from "@/components/toolbox/hooks/useWalletRequirements";
import { BaseConsoleToolProps, ConsoleToolMetadata, withConsoleToolMetadata } from "../../components/WithConsoleToolMetadata";
import { generateConsoleToolGitHubUrl } from "@/components/toolbox/utils/github-url";

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
  return (
    <CheckPrecompile
      configKey="txAllowListConfig"
      precompileName="Transaction Allowlist"
    >
      <AllowlistComponent
        precompileAddress={DEFAULT_TRANSACTION_ALLOWLIST_ADDRESS}
        precompileType="Transaction"
        onSuccess={onSuccess}
      />
    </CheckPrecompile>
  );
}

export default withConsoleToolMetadata(TransactionAllowlist, metadata);
