"use client";

import NativeTokenRemote from "../../../contracts/icm-contracts/compiled/NativeTokenRemote.json";
import { useSelectedL1, useToolboxStore, useViemChainStore, type DeployOn } from "../toolboxStore";
import { useWalletStore } from "../../lib/walletStore";
import { useErrorBoundary } from "react-error-boundary";
import { useState, useEffect, useMemo } from "react";
import { Button } from "../../components/Button";
import { Success } from "../../components/Success";
import { Input } from "../../components/Input";
import { avalancheFuji } from "viem/chains";
import { RadioGroup } from "../../components/RadioGroup";
import { createPublicClient, http } from "viem";
import { Note } from "../../components/Note";
import { utils } from "@avalabs/avalanchejs";
import ERC20TokenHomeABI from "../../../contracts/icm-contracts/compiled/ERC20TokenHome.json";
import ExampleERC20 from "../../../contracts/icm-contracts/compiled/ExampleERC20.json";

const C_CHAIN_TELEPORTER_REGISTRY_ADDRESS = "0xF86Cb19Ad8405AEFa7d09C778215D2Cb6eBfB228";
export const FUJI_C_BLOCKCHAIN_ID = "yH8D7ThNJkxmtkuv2jgBa4P1Rn3Qpr4pPr7QYNfcdoS6k6HWp";

export default function DeployNativeTokenRemote() {
    const { showBoundary } = useErrorBoundary();
    const {
        teleporterRegistryAddress,
        erc20TokenHomeAddress,
        nativeTokenRemoteAddress,
        setNativeTokenRemoteAddress,
        setErc20TokenHomeAddress,
        setTeleporterRegistryAddress,
    } = useToolboxStore();
    const { coreWalletClient, walletEVMAddress } = useWalletStore();
    const viemChain = useViemChainStore();
    const [isDeploying, setIsDeploying] = useState(false);
    const [deployOn, setDeployOn] = useState<DeployOn>("L1");
    const [teleporterManager, setTeleporterManager] = useState(walletEVMAddress);
    const [localError, setLocalError] = useState("");
    const [tokenName, setTokenName] = useState("");
    const [tokenSymbol, setTokenSymbol] = useState("");
    const [tokenDecimals, setTokenDecimals] = useState("0");
    const [minTeleporterVersion, setMinTeleporterVersion] = useState("1");
    const [initialReserveImbalance, setInitialReserveImbalance] = useState("0");
    const [burnedFeesReportingRewardPercentage, setBurnedFeesReportingRewardPercentage] = useState("0");

    const deployOnReversed = useMemo(() => {
        return deployOn === "L1" ? "C-Chain" : "L1";
    }, [deployOn]);

    const deployOnOptions = [
        { label: "L1", value: "L1" },
        { label: "C-Chain", value: "C-Chain" }
    ];

    const selectedL1 = useSelectedL1()();
    if (!selectedL1) return null;

    const tokenHomeBlockchainIDHex = useMemo(() => {
        let chainIDBase58 = deployOn === "L1" ? FUJI_C_BLOCKCHAIN_ID : selectedL1?.id;
        return utils.bufferToHex(utils.base58check.decode(chainIDBase58));
    }, [deployOn, selectedL1?.id]);

    //Updates token decimals
    useEffect(() => {
        const fetchTokenDecimals = async () => {
            try {
                setLocalError("");
                setTokenDecimals("0");
                setTokenName("loading...");
                setTokenSymbol("loading...");

                const sourceChain = deployOnReversed === "L1" ? viemChain : avalancheFuji;
                if (!sourceChain) return;

                const publicClient = createPublicClient({
                    chain: sourceChain,
                    transport: http(sourceChain.rpcUrls.default.http[0])
                });

                const tokenAddress = await publicClient.readContract({
                    address: erc20TokenHomeAddress[deployOnReversed] as `0x${string}`,
                    abi: ERC20TokenHomeABI.abi,
                    functionName: "getTokenAddress"
                });
                const decimals = await publicClient.readContract({
                    address: tokenAddress as `0x${string}`,
                    abi: ExampleERC20.abi,
                    functionName: "decimals"
                });
                const tokenName = await publicClient.readContract({
                    address: tokenAddress as `0x${string}`,
                    abi: ExampleERC20.abi,
                    functionName: "name"
                });
                const tokenSymbol = await publicClient.readContract({
                    address: tokenAddress as `0x${string}`,
                    abi: ExampleERC20.abi,
                    functionName: "symbol"
                });

                setTokenDecimals(String(decimals));
                setTokenName(tokenName as string);
                setTokenSymbol(tokenSymbol as string);
            } catch (error: any) {
                console.error(error);
                setLocalError("Fetching token decimals failed: " + error.message);
            }
        };

        fetchTokenDecimals();
    }, [deployOnReversed, erc20TokenHomeAddress["C-Chain"], erc20TokenHomeAddress["L1"], viemChain]);

    const requiredChain = deployOn === "L1" ? viemChain : avalancheFuji;

    async function handleDeploy() {
        setLocalError(""); // Clear previous errors

        setIsDeploying(true);
        try {
            // Re-check requiredChain just in case, though button should prevent this state
            if (!requiredChain) {
                throw new Error("Required chain configuration is missing.");
            }

            // Re-fetch values needed for args, ensuring they are available
            const homeAddress = erc20TokenHomeAddress?.[deployOnReversed];
            const registryAddress = deployOn === "L1" ? teleporterRegistryAddress : C_CHAIN_TELEPORTER_REGISTRY_ADDRESS;

            // Double check critical values before proceeding
            if (!homeAddress || !registryAddress || !tokenHomeBlockchainIDHex || tokenDecimals === "0" || !tokenSymbol) {
                throw new Error("Critical deployment parameters missing or invalid despite button being enabled. Please refresh and try again.");
            }

            const publicClient = createPublicClient({
                chain: requiredChain,
                transport: http(requiredChain.rpcUrls.default.http[0])
            });

            // Construct arguments for the contract constructor
            const constructorArgs = [
                // 1. settings (struct)
                {
                    teleporterRegistryAddress: registryAddress as `0x${string}`,
                    teleporterManager: teleporterManager || coreWalletClient.account.address,
                    minTeleporterVersion: BigInt(minTeleporterVersion),
                    tokenHomeBlockchainID: tokenHomeBlockchainIDHex as `0x${string}`,
                    tokenHomeAddress: homeAddress as `0x${string}`,
                    tokenHomeDecimals: parseInt(tokenDecimals) // Decimals from source token
                },
                // 2. nativeAssetSymbol (from source token)
                tokenSymbol,
                // 3. initialReserveImbalance 
                BigInt(initialReserveImbalance),
                // 4. burnedFeesReportingRewardPercentage
                BigInt(burnedFeesReportingRewardPercentage)
            ];

            console.log("Deploying NativeTokenRemote with args:", constructorArgs);

            const hash = await coreWalletClient.deployContract({
                abi: NativeTokenRemote.abi,
                bytecode: NativeTokenRemote.bytecode.object as `0x${string}`,
                args: constructorArgs,
                chain: requiredChain
            });

            const receipt = await publicClient.waitForTransactionReceipt({ hash });

            if (!receipt.contractAddress) {
                throw new Error("No contract address in receipt");
            }

            setNativeTokenRemoteAddress(receipt.contractAddress, deployOn);
        } catch (error: any) {
            console.error("Deployment failed:", error);
            setLocalError(`Deployment failed: ${error.shortMessage || error.message}`);
            showBoundary(error);
        } finally {
            setIsDeploying(false);
        }
    }

    return (
        <div className="">
            <h2 className="text-lg font-semibold mb-4">Deploy Native Token Remote Contract</h2>

            <div className="p-4 border rounded-md bg-gray-50 dark:bg-gray-900/50">
                <RadioGroup
                    value={deployOn}
                    onChange={(value) => setDeployOn(value as DeployOn)}
                    items={deployOnOptions}
                    idPrefix="deploy-native-remote-on-"
                />
            </div>
            <div className="space-y-4 mt-4">
                <div className="">
                    This deploys a `NativeTokenRemote` contract to the selected network. This contract acts as the bridge endpoint on the destination chain for your native token.
                </div>


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

                {/* Source ChainID */}
                {deployOn === "C-Chain" && <Input
                    label="L1 Chain ID (source chain)"
                    value={selectedL1.id}
                    disabled
                />}

                {deployOn === "L1" && <Input
                    label="C-Chain Chain ID (source chain)"
                    value={FUJI_C_BLOCKCHAIN_ID}
                    disabled
                />}

                {<Input
                    label={`Token Home Blockchain ID, hex (${deployOnReversed} in this case)`}
                    value={tokenHomeBlockchainIDHex}
                    disabled
                />}

                {localError && <div className="text-red-500 mt-2 p-2 border border-red-300 rounded">{localError}</div>}


                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Input
                        label="Token Name (from source)"
                        value={tokenName}
                        disabled
                    />

                    <Input
                        label="Token Symbol (from source)"
                        value={tokenSymbol}
                        disabled
                    />

                    <Input
                        label="Token Decimals (from source)"
                        value={tokenDecimals}
                        disabled
                    />
                </div>

                <Input
                    label="Initial Reserve Imbalance"
                    value={initialReserveImbalance}
                    onChange={setInitialReserveImbalance}
                    type="number"
                    helperText="The initial reserve imbalance that must be collateralized before minting"
                    required
                />

                <Input
                    label="Burned Fees Reporting Reward Percentage"
                    value={burnedFeesReportingRewardPercentage}
                    onChange={setBurnedFeesReportingRewardPercentage}
                    type="number"
                    helperText="The percentage of burned transaction fees that will be rewarded to sender of the report"
                    required
                />

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
                    label={`Token Home Address on ${deployOnReversed}`}
                    value={erc20TokenHomeAddress[deployOnReversed]}
                    onChange={(value) => setErc20TokenHomeAddress(value, deployOnReversed)}
                    required
                />

                <Success
                    label={`Native Token Remote Address (on ${deployOn})`}
                    value={nativeTokenRemoteAddress?.[deployOn] || ""}
                />

                <Button
                    variant={nativeTokenRemoteAddress?.[deployOn] ? "secondary" : "primary"}
                    onClick={handleDeploy}
                    loading={isDeploying}
                    disabled={isDeploying || !erc20TokenHomeAddress?.[deployOnReversed] || !tokenHomeBlockchainIDHex || tokenDecimals === "0" || !tokenSymbol || (deployOn === "L1" && !teleporterRegistryAddress)}
                >
                    {nativeTokenRemoteAddress?.[deployOn] ? "Re-Deploy Native Token Remote" : "Deploy Native Token Remote"}
                </Button>

            </div>
        </div >
    );
} 
