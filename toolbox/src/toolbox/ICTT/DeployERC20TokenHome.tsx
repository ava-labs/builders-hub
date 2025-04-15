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
import { avalancheFuji } from "viem/chains";
import { RadioGroup } from "../../components/RadioGroup";
import { type DeployOn } from "../toolboxStore";
import { createPublicClient, http } from "viem";
import { Note } from "../../components/Note";
import { RequireChainToolbox } from "../components/RequireChainToolboxL1";

const C_CHAIN_TELEPORTER_REGISTRY_ADDRESS = "0xF86Cb19Ad8405AEFa7d09C778215D2Cb6eBfB228";

export default function DeployERC20TokenHome() {
    const { showBoundary } = useErrorBoundary();
    const {
        teleporterRegistryAddress,
        exampleErc20Address,
        setErc20TokenHomeAddress,
        erc20TokenHomeAddress,
        setTeleporterRegistryAddress
    } = useToolboxStore();
    const { coreWalletClient, walletChainId, walletEVMAddress } = useWalletStore();
    const viemChain = useViemChainStore();
    const [isDeploying, setIsDeploying] = useState(false);
    const [teleporterManager, setTeleporterManager] = useState("");
    const [minTeleporterVersion, setMinTeleporterVersion] = useState("1");
    const [tokenAddress, setTokenAddress] = useState("");
    const [tokenDecimals, setTokenDecimals] = useState("0");
    const [localError, setLocalError] = useState("");
    const [deployOn, setDeployOn] = useState<DeployOn>("C-Chain");
    const [deployError, setDeployError] = useState("");

    const deployOnOptions = [
        { label: "L1", value: "L1" },
        { label: "C-Chain", value: "C-Chain" }
    ];

    // Initialize token address with exampleErc20Address when it becomes available
    useEffect(() => {
        if (exampleErc20Address?.[deployOn] && !tokenAddress) {
            setTokenAddress(exampleErc20Address[deployOn]);
        }
    }, [exampleErc20Address, deployOn, tokenAddress]);

    // Automatically update tokenAddress when deployOn changes if it was empty or set to the default example address
    useEffect(() => {
        const l1ExampleAddress = exampleErc20Address?.L1;
        const cChainExampleAddress = exampleErc20Address?.['C-Chain'];
        const targetExampleAddress = exampleErc20Address?.[deployOn];
        const oppositeExampleAddress = deployOn === "L1" ? cChainExampleAddress : l1ExampleAddress;

        if (!tokenAddress || tokenAddress === oppositeExampleAddress) {
            setTokenAddress(targetExampleAddress);
        }
    }, [deployOn, exampleErc20Address, tokenAddress]);

    useEffect(() => {
        if (!teleporterManager && walletEVMAddress) {
            setTeleporterManager(walletEVMAddress);
        }
    }, [walletEVMAddress]);

    const requiredChain = deployOn === "L1" ? viemChain : avalancheFuji;


    useEffect(() => {
        if (!tokenAddress) return;
        if (!requiredChain) return;

        setLocalError("");
        const publicClient = createPublicClient({
            chain: requiredChain,
            transport: http(requiredChain.rpcUrls.default.http[0])
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
    }, [tokenAddress]);


    async function handleDeploy() {
        setDeployError("");
        if (!teleporterRegistryAddress && deployOn === "L1") {
            setDeployError("Teleporter Registry address is required for L1 deployment. Please deploy it first.");
            return;
        }

        if (!tokenAddress) {
            setDeployError("Token address is required. Please deploy an ERC20 token first.");
            return;
        }

        if (!requiredChain) {
            throw new Error("Failed to fetch chain. Please try again.");
        }

        setIsDeploying(true);
        try {
            const publicClient = createPublicClient({
                chain: requiredChain,
                transport: http(requiredChain.rpcUrls.default.http[0])
            });

            const registryAddress = deployOn === "L1" ? teleporterRegistryAddress : C_CHAIN_TELEPORTER_REGISTRY_ADDRESS;

            const hash = await coreWalletClient.deployContract({
                abi: ERC20TokenHome.abi,
                bytecode: ERC20TokenHome.bytecode.object as `0x${string}`,
                args: [
                    registryAddress as `0x${string}`,
                    teleporterManager || coreWalletClient.account.address,
                    BigInt(minTeleporterVersion),
                    tokenAddress as `0x${string}`,
                    parseInt(tokenDecimals)
                ],
                chain: requiredChain
            });

            const receipt = await publicClient.waitForTransactionReceipt({ hash });

            if (!receipt.contractAddress) {
                throw new Error('No contract address in receipt');
            }

            setErc20TokenHomeAddress(receipt.contractAddress, deployOn);
        } catch (error) {
            showBoundary(error);
        } finally {
            setIsDeploying(false);
        }
    }

    return (
        <div className="">
            < h2 className="text-lg font-semibold mb-4" > Deploy ERC20 Token Home Contract</h2 >

            <div className="p-4 border rounded-md bg-gray-50 dark:bg-gray-900/50">
                <RadioGroup
                    value={deployOn}
                    onChange={(value) => setDeployOn(value as DeployOn)}
                    items={deployOnOptions}
                    idPrefix="deploy-on-"
                />
            </div>
            <RequireChainToolbox requireChain={deployOn}>
                <div className="space-y-4">
                    <div className="space-y-4">
                        <div className="mt-4">
                            This will deploy an ERC20TokenHome contract to your connected network (Chain ID: <code>{walletChainId}</code>).
                            This contract serves as the home chain endpoint for cross-chain token transfers.
                        </div>

                        {localError && <div className="text-red-500">{localError}</div>}
                        {deployError && <div className="text-red-500 mt-2">{deployError}</div>}

                        {deployOn === "L1" && <><Input
                            label="Teleporter Registry Address"
                            value={teleporterRegistryAddress}
                            onChange={setTeleporterRegistryAddress}
                        />

                            {!teleporterRegistryAddress && <Note variant="warning">
                                <p>
                                    Please <a href="#teleporterRegistry" className="text-blue-500">deploy the Teleporter Registry contract first</a>.
                                </p>
                            </Note>}

                        </>}

                        {deployOn === "C-Chain" && <Input
                            label="C-Chain Teleporter Registry Address"
                            value={C_CHAIN_TELEPORTER_REGISTRY_ADDRESS}
                            disabled
                        />}

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
                            error={!tokenAddress ? "Required. Deploy an ERC20 token first." : undefined}
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
                            value={erc20TokenHomeAddress?.[deployOn] || ""}
                        />

                        <Button
                            variant={erc20TokenHomeAddress?.[deployOn] ? "secondary" : "primary"}
                            onClick={handleDeploy}
                            loading={isDeploying}
                            disabled={(!teleporterRegistryAddress && deployOn === "L1") || (!tokenAddress || tokenDecimals === "0")}
                        >
                            {erc20TokenHomeAddress?.[deployOn] ? "Re-Deploy ERC20 Token Home" : "Deploy ERC20 Token Home"}
                        </Button>


                    </div>
                </div >
            </RequireChainToolbox >
        </div >
    );
} 
