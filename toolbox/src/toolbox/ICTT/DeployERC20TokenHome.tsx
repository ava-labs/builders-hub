"use client";

import ERC20TokenHome from "../../../contracts/icm-contracts/compiled/ERC20TokenHome.json";
import { useToolboxStore, useViemChainStore } from "../toolboxStore";
import { useWalletStore } from "../../lib/walletStore";
import { useErrorBoundary } from "react-error-boundary";
import { useState, useEffect } from "react";
import { Button } from "../../components/Button";
import { Success } from "../../components/Success";
import { Input } from "../../components/Input";
import ExampleERC20 from "../../../contracts/icm-contracts/compiled/ExampleERC20.json"
import { createPublicClient, http } from "viem";
import { Note } from "../../components/Note";


export default function DeployERC20TokenHome() {
    const { showBoundary } = useErrorBoundary();
    const {
        teleporterRegistryAddress,
        exampleErc20Address,
        setErc20TokenHomeAddress,
        erc20TokenHomeAddress,
        setTeleporterRegistryAddress
    } = useToolboxStore();
    const { coreWalletClient, walletEVMAddress, walletChainId } = useWalletStore();
    const viemChain = useViemChainStore();
    const [isDeploying, setIsDeploying] = useState(false);
    const [teleporterManager, setTeleporterManager] = useState("");
    const [minTeleporterVersion, setMinTeleporterVersion] = useState("1");
    const [tokenAddress, setTokenAddress] = useState("");
    const [tokenDecimals, setTokenDecimals] = useState("0");
    const [localError, setLocalError] = useState("");
    const [deployError, setDeployError] = useState("");

    // Initialize token address with exampleErc20Address when it becomes available
    useEffect(() => {
        if (exampleErc20Address && !tokenAddress) {
            setTokenAddress(exampleErc20Address);
        }
    }, [exampleErc20Address, tokenAddress]);

    useEffect(() => {
        if (!teleporterManager && walletEVMAddress) {
            setTeleporterManager(walletEVMAddress);
        }
    }, [walletEVMAddress]);

    useEffect(() => {
        if (!tokenAddress) return;
        if (!viemChain) return;

        setLocalError("");
        const publicClient = createPublicClient({
            chain: viemChain,
            transport: http(viemChain.rpcUrls.default.http[0])
        });
        publicClient.readContract({
            address: tokenAddress as `0x${string}`,
            abi: ExampleERC20.abi,
            functionName: "decimals",
        }).then((res) => {
            console.log("Token decimals: " + res);
            setTokenDecimals((res as bigint).toString());
        }).catch((error) => {
            setLocalError("Failed to fetch token decimals: " + error);
        });
    }, [tokenAddress, viemChain]);

    async function handleDeploy() {
        setDeployError("");
        if (!teleporterRegistryAddress) {
            setDeployError("Teleporter Registry address is required. Please deploy it first.");
            return;
        }

        if (!tokenAddress) {
            setDeployError("Token address is required. Please deploy an ERC20 token first.");
            return;
        }

        if (!viemChain) {
            throw new Error("Failed to fetch chain. Please try again.");
        }

        setIsDeploying(true);
        try {
            const publicClient = createPublicClient({
                chain: viemChain,
                transport: http(viemChain.rpcUrls.default.http[0])
            });

            const hash = await coreWalletClient.deployContract({
                abi: ERC20TokenHome.abi,
                bytecode: ERC20TokenHome.bytecode.object as `0x${string}`,
                args: [
                    teleporterRegistryAddress as `0x${string}`,
                    teleporterManager || coreWalletClient.account.address,
                    BigInt(minTeleporterVersion),
                    tokenAddress as `0x${string}`,
                    parseInt(tokenDecimals)
                ],
                chain: viemChain
            });

            const receipt = await publicClient.waitForTransactionReceipt({ hash });

            if (!receipt.contractAddress) {
                throw new Error('No contract address in receipt');
            }

            setErc20TokenHomeAddress(receipt.contractAddress);
        } catch (error) {
            showBoundary(error);
        } finally {
            setIsDeploying(false);
        }
    }

    return (
        <div className="">
            <h2 className="text-lg font-semibold mb-4">Deploy ERC20 Token Home Contract</h2>

            <div className="space-y-4">
                <div className="space-y-4">
                    <div className="mt-4">
                        This will deploy an ERC20TokenHome contract to your connected network (Chain ID: <code>{walletChainId}</code>).
                        This contract serves as the home chain endpoint for cross-chain token transfers.
                    </div>

                    {localError && <div className="text-red-500">{localError}</div>}
                    {deployError && <div className="text-red-500 mt-2">{deployError}</div>}

                    <Input
                        label="Teleporter Registry Address"
                        value={teleporterRegistryAddress}
                        onChange={setTeleporterRegistryAddress}
                    />

                    {!teleporterRegistryAddress && <Note variant="warning">
                        <p>
                            Please <a href="#teleporterRegistry" className="text-blue-500">deploy the Teleporter Registry contract first</a>.
                        </p>
                    </Note>}

                    <Input
                        label="L1 Teleporter Manager Address"
                        value={teleporterManager}
                        onChange={setTeleporterManager}
                        placeholder={coreWalletClient?.account?.address}
                        helperText="default: your address"
                    />

                    <Input
                        label="Min Teleporter Version"
                        value={minTeleporterVersion}
                        onChange={setMinTeleporterVersion}
                        type="number"
                        required
                    />

                    <Input
                        label="Token Address"
                        value={tokenAddress}
                        onChange={setTokenAddress}
                        required
                        error={!tokenAddress ? <>Required. Please <a href="#deployExampleERC20" className="underline">deploy an ERC20 token first</a>.</> : undefined}
                    />

                    <Input
                        label="Token Decimals"
                        value={tokenDecimals}
                        onChange={setTokenDecimals}
                        type="number"
                        disabled
                        helperText="This is automatically fetched from the token contract."
                    />

                    <Success
                        label="ERC20 Token Home Address"
                        value={erc20TokenHomeAddress || ""}
                    />

                    <Button
                        variant={erc20TokenHomeAddress ? "secondary" : "primary"}
                        onClick={handleDeploy}
                        loading={isDeploying}
                        disabled={!teleporterRegistryAddress || !tokenAddress || tokenDecimals === "0"}
                    >
                        {erc20TokenHomeAddress ? "Re-Deploy ERC20 Token Home" : "Deploy ERC20 Token Home"}
                    </Button>
                </div>
            </div>
        </div>
    );
} 
