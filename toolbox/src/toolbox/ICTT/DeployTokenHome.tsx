"use client";

import ERC20TokenHome from "../../../contracts/icm-contracts/compiled/ERC20TokenHome.json";
import NativeTokenHome from "../../../contracts/icm-contracts/compiled/NativeTokenHome.json";
import { useToolboxStore, useViemChainStore } from "../../stores/toolboxStore";
import { useWalletStore } from "../../stores/walletStore";
import { useErrorBoundary } from "react-error-boundary";
import { useState, useEffect } from "react";
import { Button } from "../../components/Button";
import { Success } from "../../components/Success";
import { Input } from "../../components/Input";
import { EVMAddressInput } from "../../components/EVMAddressInput";
import ExampleERC20 from "../../../contracts/icm-contracts/compiled/ExampleERC20.json"
import { createPublicClient, http } from "viem";
import { Note } from "../../components/Note";
import { Container } from "../../components/Container";
import TeleporterRegistryAddressInput from "../../components/TeleporterRegistryAddressInput";
import { RadioGroup } from "../../components/RadioGroup";
import { useSelectedL1 } from "../../stores/l1ListStore";

export default function DeployTokenHome() {
    const { showBoundary } = useErrorBoundary();
    const {
        exampleErc20Address,
        setErc20TokenHomeAddress,
        erc20TokenHomeAddress,
        setNativeTokenHomeAddress,
        nativeTokenHomeAddress
    } = useToolboxStore();
    const selectedL1 = useSelectedL1()();
    const { coreWalletClient, walletEVMAddress, walletChainId } = useWalletStore();
    const viemChain = useViemChainStore();
    const [isDeploying, setIsDeploying] = useState(false);
    const [teleporterManager, setTeleporterManager] = useState("");
    const [minTeleporterVersion, setMinTeleporterVersion] = useState("1");
    const [tokenAddress, setTokenAddress] = useState("");
    const [tokenDecimals, setTokenDecimals] = useState("0");
    const [localError, setLocalError] = useState("");
    const [deployError, setDeployError] = useState("");
    const [teleporterRegistryAddress, setTeleporterRegistryAddress] = useState("");//local, not in store
    const [tokenType, setTokenType] = useState<"erc20" | "native">("erc20");

    useEffect(() => {
        setTokenAddress((tokenType === "erc20" ? exampleErc20Address : selectedL1?.wrappedTokenAddress) || "");
    }, [tokenType, selectedL1, exampleErc20Address]);

    const [initTeleporterManagerRan, setInitTeleporterManagerRan] = useState(false);
    useEffect(() => {
        if (!teleporterManager && walletEVMAddress && !initTeleporterManagerRan) {
            setTeleporterManager(walletEVMAddress);
            setInitTeleporterManagerRan(true);
        }
    }, [walletEVMAddress, teleporterManager, initTeleporterManagerRan]);

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
            setTokenDecimals((res as bigint).toString());
        }).catch((error) => {
            setLocalError("Failed to fetch token decimals: " + error);
        });
    }, [tokenAddress, viemChain?.id]);

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

            const args = [
                teleporterRegistryAddress as `0x${string}`,
                teleporterManager || coreWalletClient.account.address,
                BigInt(minTeleporterVersion),
                tokenAddress as `0x${string}`,
            ];

            if (tokenType === "erc20") {
                args.push(parseInt(tokenDecimals));
            }

            const hash = await coreWalletClient.deployContract({
                abi: tokenType === "erc20" ? ERC20TokenHome.abi : NativeTokenHome.abi,
                bytecode: tokenType === "erc20" ? ERC20TokenHome.bytecode.object as `0x${string}` : NativeTokenHome.bytecode.object as `0x${string}`,
                args,
                chain: viemChain
            });

            const receipt = await publicClient.waitForTransactionReceipt({ hash });

            if (!receipt.contractAddress) {
                throw new Error('No contract address in receipt');
            }

            if (tokenType === "erc20") {
                setErc20TokenHomeAddress(receipt.contractAddress);
            } else {
                setNativeTokenHomeAddress(receipt.contractAddress);
            }
        } catch (error) {
            showBoundary(error);
        } finally {
            setIsDeploying(false);
        }
    }

    const getTokenHomeAddress = () => {
        if (tokenType === "erc20") {
            return erc20TokenHomeAddress;
        } else {
            return nativeTokenHomeAddress;
        }
    }

    return (
        <Container
            title="Deploy Token Home Contract"
            description="Deploy the TokenHome contract for your token."
        >
            <div>
                <p className="mt-2">
                    This will deploy a TokenHome contract to your connected network (Chain ID: <code>{walletChainId}</code>).
                    This contract serves as the home chain endpoint for cross-chain token transfers.
                </p>
            </div>

            {localError && <div className="text-red-500">{localError}</div>}
            {deployError && <div className="text-red-500 mt-2">{deployError}</div>}

            <TeleporterRegistryAddressInput
                value={teleporterRegistryAddress}
                onChange={setTeleporterRegistryAddress}
                disabled={isDeploying}
            />

            {!teleporterRegistryAddress && <Note variant="warning" className="px-2 py-1">
                <p>
                    Please <a href="#teleporterRegistry" className="text-blue-500 no-underline">deploy the Teleporter Registry contract first</a>.
                </p>
            </Note>}

            <EVMAddressInput
                label="L1 Teleporter Manager Address"
                value={teleporterManager}
                onChange={setTeleporterManager}
                disabled={isDeploying}
            />

            <Input
                label="Min Teleporter Version"
                value={minTeleporterVersion}
                onChange={setMinTeleporterVersion}
                type="number"
                required
            />

            <div className="mb-4">
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Transferrer Type</label>
                <RadioGroup
                    items={[
                        { value: "erc20", label: "ERC20" },
                        { value: "native", label: "Native Token" }
                    ]}
                    value={tokenType}
                    onChange={(value) => setTokenType(value as "erc20" | "native")}
                    idPrefix="token-type-"
                />
            </div>

            <EVMAddressInput
                label={tokenType === "erc20" ? "Token Address" : "Wrapped Token Address"}
                value={tokenAddress}
                onChange={setTokenAddress}
                disabled={isDeploying}
                helperText={tokenType === "erc20" ?
                    <>Please <a href="#deployExampleERC20" className="underline">deploy an ERC20 token first</a>.</> :
                    "Enter the wrapped token address of your native token."
                }
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
                label="Token Home Address"
                value={getTokenHomeAddress() || ""}
            />

            <Button
                variant={getTokenHomeAddress() ? "secondary" : "primary"}
                onClick={handleDeploy}
                loading={isDeploying}
                disabled={!teleporterRegistryAddress || !tokenAddress || tokenDecimals === "0"}
            >
                {getTokenHomeAddress() ? "Re-Deploy Token Home" : "Deploy Token Home"}
            </Button>
        </Container>
    );
} 
