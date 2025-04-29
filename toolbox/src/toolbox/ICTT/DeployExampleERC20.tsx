"use client";

import ExampleERC20 from "../../../contracts/icm-contracts/compiled/ExampleERC20.json"
import { useToolboxStore, useViemChainStore, type DeployOn } from "../toolboxStore";
import { useWalletStore } from "../../lib/walletStore";
import { useErrorBoundary } from "react-error-boundary";
import { useState } from "react";
import { Button } from "../../components/Button";
import { Success } from "../../components/Success";
import { RadioGroup } from "../../components/RadioGroup";
import { avalancheFuji } from "viem/chains";
import { http } from "viem";
import { createPublicClient } from "viem";

export default function DeployExampleERC20() {
    const { showBoundary } = useErrorBoundary();
    const { exampleErc20Address, setExampleErc20Address } = useToolboxStore();
    const { coreWalletClient } = useWalletStore();
    const viemChain = useViemChainStore();
    const [isDeploying, setIsDeploying] = useState(false);
    const [deployOn, setDeployOn] = useState<DeployOn>("C-Chain");
    const { walletChainId } = useWalletStore();

    const deployOnOptions = [
        { label: "L1", value: "L1" },
        { label: "C-Chain", value: "C-Chain" }
    ];

    const requiredChain = deployOn === "L1" ? viemChain : avalancheFuji;

    async function handleDeploy() {
        setIsDeploying(true);
        try {
            if (!requiredChain) throw new Error("No chain selected");

            const requiredPublicClient = createPublicClient({
                transport: http(requiredChain.rpcUrls.default.http[0] || "")
            });

            const hash = await coreWalletClient.deployContract({
                abi: ExampleERC20.abi,
                bytecode: ExampleERC20.bytecode.object as `0x${string}`,
                args: [],
                chain: requiredChain
            });

            const receipt = await requiredPublicClient.waitForTransactionReceipt({ hash });

            if (!receipt.contractAddress) {
                throw new Error('No contract address in receipt');
            }

            setExampleErc20Address(receipt.contractAddress, deployOn);
        } catch (error) {
            showBoundary(error);
        } finally {
            setIsDeploying(false);
        }
    }

    return (
        <div className="space-y-4">
            <h2 className="text-lg font-semibold">Deploy ERC20 Token</h2>

            <div className="p-4 border rounded-md bg-gray-50 dark:bg-gray-900/50">
                <RadioGroup
                    value={deployOn}
                    onChange={(value) => setDeployOn(value as "L1" | "C-Chain")}
                    items={deployOnOptions}
                    idPrefix="deploy-on-"
                />
            </div>

            <div className="space-y-4">
                <div className="">
                    This will deploy an ERC20 token contract to your connected network (Chain ID: <code>{walletChainId}</code>).
                    You can use this token for testing token transfers and other ERC20 interactions. <a href="https://github.com/ava-labs/icm-contracts/blob/51dd21550444e7141d938fd721d994e29a58f7af/contracts/mocks/ExampleERC20.sol" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">View the contract source code</a>.
                </div>

                <Button
                    variant={exampleErc20Address?.[deployOn] ? "secondary" : "primary"}
                    onClick={handleDeploy}
                    loading={isDeploying}
                    disabled={isDeploying}
                >
                    {exampleErc20Address?.[deployOn] ? "Re-Deploy ERC20 Token" : "Deploy ERC20 Token"}
                </Button>

                <Success
                    label="ERC20 Token Address"
                    value={exampleErc20Address?.[deployOn] || ""}
                />
            </div>

        </div >
    );
}
