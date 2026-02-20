"use client";

import ExampleERC20 from "@/contracts/icm-contracts/compiled/ExampleERC20.json";
import { useToolboxStore } from "@/components/toolbox/stores/toolboxStore";
import { useWalletStore } from "@/components/toolbox/stores/walletStore";
import { useState } from "react";
import { Button } from "@/components/toolbox/components/Button";
import { Success } from "@/components/toolbox/components/Success";
import { generateConsoleToolGitHubUrl } from "@/components/toolbox/utils/github-url";
import { ExternalLink } from "lucide-react";
import { ConsoleToolMetadata, withConsoleToolMetadata } from "@/components/toolbox/components/WithConsoleToolMetadata";
import { WalletRequirementsConfigKey } from "@/components/toolbox/hooks/useWalletRequirements";
import { useContractDeployer } from "@/components/toolbox/hooks/contracts";

const metadata: ConsoleToolMetadata = {
  title: "Deploy Example ERC20",
  description: "Deploy an ERC20 token contract for testing. If you want to use an existing token like USDC, you can skip this step.",
  toolRequirements: [
    WalletRequirementsConfigKey.EVMChainBalance
  ],
  githubUrl: generateConsoleToolGitHubUrl(import.meta.url)
};

function DeployExampleERC20() {
  const [criticalError, setCriticalError] = useState<Error | null>(null);
  const { exampleErc20Address, setExampleErc20Address } = useToolboxStore();
  const { walletChainId } = useWalletStore();
  const { deploy, isDeploying } = useContractDeployer();
  // Throw critical errors during render
  if (criticalError) {
    throw criticalError;
  }

  async function handleDeploy() {
    try {
      const result = await deploy({
        abi: ExampleERC20.abi as any,
        bytecode: ExampleERC20.bytecode.object,
        args: [],
        name: "ExampleERC20"
      });

      setExampleErc20Address(result.contractAddress);
    } catch (error) {
      setCriticalError(
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  return (
    <div className="space-y-4">
      <div className="">
        This will deploy an ERC20 token contract to your connected network
        (Chain ID: <code>{walletChainId}</code>). You can use this token for
        testing token transfers and other ERC20 interactions, where a total
        supply of 1,000,000 tokens will be minted to your wallet - view the
        contract{" "}
        <a
          href="https://github.com/ava-labs/icm-contracts/blob/51dd21550444e7141d938fd721d994e29a58f7af/contracts/mocks/ExampleERC20.sol"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-500 hover:underline"
        >
          source code
        </a>
        <p className="flex items-center gap-1 mt-2">
          To deploy more custom ERC20 tokens, you can use the{" "}
          <a
            href="https://wizard.openzeppelin.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:underline inline-flex items-center gap-1"
          >
            OpenZeppelin ERC20 Contract Wizard
            <ExternalLink className="h-4 w-4" />
          </a>
        </p>
      </div>

      <Button
        variant={exampleErc20Address ? "secondary" : "primary"}
        onClick={handleDeploy}
        loading={isDeploying}
        disabled={isDeploying}
      >
        {exampleErc20Address ? "Re-Deploy ERC20 Token" : "Deploy ERC20 Token"}
      </Button>

      <Success
        label="ERC20 Token Address"
        value={exampleErc20Address || ""}
      />
    </div>
  );
}

export default withConsoleToolMetadata(DeployExampleERC20, metadata);
