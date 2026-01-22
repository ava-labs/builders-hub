"use client";

import { useToolboxStore } from "@/components/toolbox/stores/toolboxStore";
import { TransferOwnership } from "@/components/toolbox/console/permissioned-l1s/multisig-setup/TransferOwnership";
import { ConsoleToolMetadata, withConsoleToolMetadata, BaseConsoleToolProps } from '../../../components/WithConsoleToolMetadata';
import { generateConsoleToolGitHubUrl } from "@/components/toolbox/utils/github-url";
import { WalletRequirementsConfigKey } from "@/components/toolbox/hooks/useWalletRequirements";
import { Callout } from "fumadocs-ui/components/callout";

const metadata: ConsoleToolMetadata = {
  title: "Transfer Ownership to Staking Manager",
  description: "Transfer the ownership of the Validator Manager to your deployed Staking Manager",
  toolRequirements: [
    WalletRequirementsConfigKey.EVMChainBalance,
  ],
  githubUrl: generateConsoleToolGitHubUrl(import.meta.url)
};

function TransferOwnershipToStakingManager({ onSuccess }: BaseConsoleToolProps) {
  const { nativeStakingManagerAddress, erc20StakingManagerAddress } = useToolboxStore();

  // Prefer ERC20 if both are present (user is likely on ERC20 setup flow)
  // Otherwise use whichever is available
  const stakingManagerAddress = erc20StakingManagerAddress || nativeStakingManagerAddress;
  const stakingManagerType = erc20StakingManagerAddress ? "ERC20 Token" : "Native Token";

  return (
    <>
      {stakingManagerAddress && (
        <Callout type="info" className="mb-4">
          <p className="font-semibold mb-2">{stakingManagerType} Staking Manager Detected</p>
          <p>Your {stakingManagerType} Staking Manager address has been automatically filled in below:</p>
          <p className="mt-2">
            <code className="text-xs">{stakingManagerAddress}</code>
          </p>
        </Callout>
      )}

      {!stakingManagerAddress && (
        <Callout type="warn" className="mb-4">
          <p className="font-semibold mb-2">No Staking Manager Found</p>
          <p>No staking manager address found. Please deploy and initialize a Staking Manager (Native or ERC20) first, or manually enter the address below.</p>
        </Callout>
      )}
      
      <TransferOwnership 
        onSuccess={onSuccess}
        defaultNewOwnerAddress={stakingManagerAddress}
      />
    </>
  );
}

export default withConsoleToolMetadata(TransferOwnershipToStakingManager, metadata);

