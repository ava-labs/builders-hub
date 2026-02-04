"use client";

import { useState } from "react";
import { useWalletStore } from "@/components/toolbox/stores/walletStore";
import { useToolboxStore, useViemChainStore } from "@/components/toolbox/stores/toolboxStore";
import { Button } from "@/components/toolbox/components/Button";
import { Success } from "@/components/toolbox/components/Success";
import { WalletRequirementsConfigKey } from "@/components/toolbox/hooks/useWalletRequirements";
import ExampleERC20 from "@/contracts/icm-contracts/compiled/ExampleERC20.json";
import versions from '@/scripts/versions.json';
import useConsoleNotifications from '@/hooks/useConsoleNotifications';
import { ConsoleToolMetadata, withConsoleToolMetadata } from '../../../../components/WithConsoleToolMetadata';
import { generateConsoleToolGitHubUrl } from "@/components/toolbox/utils/github-url";
import { http, createPublicClient } from "viem";

const ICM_COMMIT = versions["ava-labs/icm-contracts"];
const EXAMPLE_ERC20_SOURCE_URL = `https://github.com/ava-labs/icm-contracts/blob/${ICM_COMMIT}/contracts/mocks/ExampleERC20.sol`;

const metadata: ConsoleToolMetadata = {
    title: "Deploy Example ERC20 Token",
    description: "Deploy an Example ERC20 token with minting capabilities for testing the staking manager.",
    toolRequirements: [
        WalletRequirementsConfigKey.EVMChainBalance,
    ],
    githubUrl: generateConsoleToolGitHubUrl(import.meta.url)
};

function DeployExampleERC20() {
    const [criticalError, setCriticalError] = useState<Error | null>(null);
    const [isDeploying, setIsDeploying] = useState(false);

    const { coreWalletClient, walletEVMAddress, walletChainId } = useWalletStore();
    const viemChain = useViemChainStore();
    const { exampleErc20Address, setExampleErc20Address } = useToolboxStore();
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
        setExampleErc20Address("");
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

            notify({
                type: 'deploy',
                name: 'Example ERC20 Token'
            }, deployPromise, viemChain ?? undefined);

            const receipt = await publicClient.waitForTransactionReceipt({
                hash: await deployPromise,
            });

            if (!receipt.contractAddress) {
                throw new Error('No contract address in receipt');
            }

            setExampleErc20Address(receipt.contractAddress);
        } catch (error) {
            setCriticalError(error instanceof Error ? error : new Error(String(error)));
        } finally {
            setIsDeploying(false);
        }
    }

    return (
        <div className="space-y-4">
            <div>
                This will deploy an ERC20 token contract to your connected network (Chain ID: <code>{walletChainId}</code>).
                This token implements the <code>IERC20Mintable</code> interface required by the staking manager, with an initial
                supply of 10,000,000 tokens minted to your wallet - view the{" "}
                <a
                    href={EXAMPLE_ERC20_SOURCE_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-500 hover:underline"
                >
                    contract source code
                </a>
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
