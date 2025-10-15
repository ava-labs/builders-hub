"use client";

import ExampleERC20 from "@/contracts/icm-contracts/compiled/ExampleERC20.json";
import {
  useToolboxStore,
  useViemChainStore,
} from "@/components/toolbox/stores/toolboxStore";
import { useWalletStore } from "@/components/toolbox/stores/walletStore";
import { useState } from "react";
import { Button } from "@/components/toolbox/components/Button";
import { Success } from "@/components/toolbox/components/Success";
import { http, createPublicClient } from "viem";
import { generateConsoleToolGitHubUrl } from "@/components/toolbox/utils/github-url";
import { ExternalLink } from "lucide-react";
import useConsoleNotifications from "@/hooks/useConsoleNotifications";
import { ConsoleToolMetadata, withConsoleToolMetadata } from "@/components/toolbox/components/WithConsoleToolMetadata";
import { WalletRequirementsConfigKey } from "@/components/toolbox/hooks/useWalletRequirements";

const metadata: ConsoleToolMetadata = {
  title: "Deploy Example ERC20",
  description: "Deploy an ERC20 token contract for testing. If you want to use an existing token like USDC, you can skip this step.",
  walletRequirements: [
    WalletRequirementsConfigKey.EVMChainBalance
  ],
  githubUrl: generateConsoleToolGitHubUrl(import.meta.url)
};

function DeployExampleERC20() {
  const [criticalError, setCriticalError] = useState<Error | null>(null);
  const { exampleErc20Address, setExampleErc20Address } = useToolboxStore();
  const { coreWalletClient, walletEVMAddress } = useWalletStore();
  const viemChain = useViemChainStore();
  const [isDeploying, setIsDeploying] = useState(false);
  const { walletChainId } = useWalletStore();
  const { notify } = useConsoleNotifications();
  // Throw critical errors during render
  if (criticalError) {
    throw criticalError;
  }

  async function handleDeploy() {
    if (!coreWalletClient) {
      setCriticalError(new Error("Core wallet not found"));
      return;
    }

    setIsDeploying(true);
    try {
      if (!viemChain) throw new Error("No chain selected");

      const publicClient = createPublicClient({
        transport: http(viemChain.rpcUrls.default.http[0] || ""),
      });

      const deployPromise = coreWalletClient.deployContract({
        abi: ExampleERC20.abi as any,
        bytecode: ExampleERC20.bytecode.object as `0x${string}`,
        args: [],
        chain: viemChain,
        account: walletEVMAddress as `0x${string}`,
      });

      notify(
        {
          type: "deploy",
          name: "ExampleERC20",
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

      setExampleErc20Address(receipt.contractAddress);
    } catch (error) {
      setCriticalError(
        error instanceof Error ? error : new Error(String(error))
      );
    } finally {
      setIsDeploying(false);
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
