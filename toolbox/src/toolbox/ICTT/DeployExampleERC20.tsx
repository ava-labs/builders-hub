"use client";

import ExampleERC20 from "../../../contracts/icm-contracts/compiled/ExampleERC20.json"
import { useToolboxStore, useViemChainStore } from "../toolboxStore";
import { useWalletStore } from "../../lib/walletStore";
import { useErrorBoundary } from "react-error-boundary";
import { useState } from "react";
import { Button } from "../../components/Button";
import { Success } from "../../components/Success";
import { http, createPublicClient } from "viem";
import { Container } from "../components/Container";

export default function DeployExampleERC20() {
    const { showBoundary } = useErrorBoundary();
    const { exampleErc20Address, setExampleErc20Address } = useToolboxStore();
    const { coreWalletClient } = useWalletStore();
    const viemChain = useViemChainStore();
    const [isDeploying, setIsDeploying] = useState(false);
    const { walletChainId } = useWalletStore();

    async function handleDeploy() {
        setIsDeploying(true);
        try {
            if (!viemChain) throw new Error("No chain selected");

            const publicClient = createPublicClient({
                transport: http(viemChain.rpcUrls.default.http[0] || "")
            });

            const hash = await coreWalletClient.deployContract({
                abi: ExampleERC20.abi,
                bytecode: ExampleERC20.bytecode.object as `0x${string}`,
                args: [],
                chain: viemChain
            });

            const receipt = await publicClient.waitForTransactionReceipt({ hash });

            if (!receipt.contractAddress) {
                throw new Error('No contract address in receipt');
            }

            setExampleErc20Address(receipt.contractAddress);
        } catch (error) {
            showBoundary(error);
        } finally {
            setIsDeploying(false);
        }
    }

    return (
        <Container title="Deploy ERC20 Token" description="Deploy an ERC20 token contract for testing.">
            <div className="space-y-4">
                <div className="">
                    This will deploy an ERC20 token contract to your connected network (Chain ID: <code>{walletChainId}</code>).
                    You can use this token for testing token transfers and other ERC20 interactions. <a href="https://github.com/ava-labs/icm-contracts/blob/51dd21550444e7141d938fd721d994e29a58f7af/contracts/mocks/ExampleERC20.sol" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">View the contract source code</a>.
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
        </Container>
    );
}
