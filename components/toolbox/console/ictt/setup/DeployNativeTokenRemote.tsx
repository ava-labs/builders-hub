"use client";

import NativeTokenRemote from "@/contracts/icm-contracts/compiled/NativeTokenRemote.json";
import { useL1ByChainId, useSelectedL1 } from "@/components/toolbox/stores/l1ListStore";
import { useToolboxStore, useViemChainStore, getToolboxStore } from "@/components/toolbox/stores/toolboxStore";
import { useWalletStore } from "@/components/toolbox/stores/walletStore";
import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/toolbox/components/Button";
import { Success } from "@/components/toolbox/components/Success";
import { Input, Suggestion } from "@/components/toolbox/components/Input";
import { EVMAddressInput } from "@/components/toolbox/components/EVMAddressInput";
import { createPublicClient, http } from "viem";
import { Note } from "@/components/toolbox/components/Note";
import { utils } from "@avalabs/avalanchejs";
import ERC20TokenHomeABI from "@/contracts/icm-contracts/compiled/ERC20TokenHome.json";
import ExampleERC20 from "@/contracts/icm-contracts/compiled/ExampleERC20.json";
import SelectBlockchainId from "@/components/toolbox/components/SelectBlockchainId";
import { CheckPrecompile } from "@/components/toolbox/components/CheckPrecompile";
import TeleporterRegistryAddressInput from "@/components/toolbox/components/TeleporterRegistryAddressInput";
import useConsoleNotifications from "@/hooks/useConsoleNotifications";
import { AcknowledgementCallout } from "@/components/toolbox/components/AcknowledgementCallout";
import { LockedContent } from "@/components/toolbox/components/LockedContent";
import { ConsoleToolMetadata, withConsoleToolMetadata } from "@/components/toolbox/components/WithConsoleToolMetadata";
import { WalletRequirementsConfigKey } from "@/components/toolbox/hooks/useWalletRequirements";
import { generateConsoleToolGitHubUrl } from "@/components/toolbox/utils/github-url";

const metadata: ConsoleToolMetadata = {
    title: "Deploy Native Token Remote Contract",
    description: "Deploy the NativeTokenRemote contract for your native token.",
    walletRequirements: [WalletRequirementsConfigKey.EVMChainBalance],
    githubUrl: generateConsoleToolGitHubUrl(import.meta.url)
};
function DeployNativeTokenRemote() {
    const [criticalError, setCriticalError] = useState<Error | null>(null);
    const {
        nativeTokenRemoteAddress,
        setNativeTokenRemoteAddress,
    } = useToolboxStore();
    const [teleporterRegistryAddress, setTeleporterRegistryAddress] = useState("");
    const { coreWalletClient, walletEVMAddress } = useWalletStore();
    const { notify } = useConsoleNotifications();
    const viemChain = useViemChainStore();
    const selectedL1 = useSelectedL1()();
    const [isDeploying, setIsDeploying] = useState(false);
    const [sourceChainId, setSourceChainId] = useState<string>("");
    const [teleporterManager, setTeleporterManager] = useState(walletEVMAddress);
    const [localError, setLocalError] = useState("");
    const [tokenName, setTokenName] = useState("");
    const [tokenSymbol, setTokenSymbol] = useState("");
    const [tokenDecimals, setTokenDecimals] = useState("0");
    const [minTeleporterVersion, setMinTeleporterVersion] = useState("1");
    const [initialReserveImbalance, setInitialReserveImbalance] = useState("0");
    const [burnedFeesReportingRewardPercentage, setBurnedFeesReportingRewardPercentage] = useState("0");
    const [tokenHomeAddress, setTokenHomeAddress] = useState("");
    const [acknowledged, setAcknowledged] = useState(false);
    const [workflowDismissed, setWorkflowDismissed] = useState(false);

    // Throw critical errors during render
    if (criticalError) {
        throw criticalError;
    }

    const sourceL1 = useL1ByChainId(sourceChainId)();
    const sourceToolboxStore = getToolboxStore(sourceChainId)();

    const tokenHomeBlockchainIDHex = useMemo(() => {
        if (!sourceL1?.id) return undefined;
        try {
            return utils.bufferToHex(utils.base58check.decode(sourceL1.id));
        } catch (e) {
            console.error("Error decoding source chain ID:", e);
            return undefined;
        }
    }, [sourceL1?.id]);

    let sourceChainError: string | undefined = undefined;
    if (!sourceChainId) {
        sourceChainError = "Please select a source chain";
    } else if (selectedL1?.id === sourceChainId) {
        sourceChainError = "Source and destination chains must be different";
    }

    // Build suggestions for token home addresses
    const tokenHomeSuggestions = useMemo(() => {
        const suggestions: Suggestion[] = [];
        
        if (sourceToolboxStore.erc20TokenHomeAddress) {
            suggestions.push({
                value: sourceToolboxStore.erc20TokenHomeAddress,
                title: "ERC20 Token Home",
                description: "Previously deployed ERC20 Token Home contract"
            });
        }
        
        if (sourceToolboxStore.nativeTokenHomeAddress) {
            suggestions.push({
                value: sourceToolboxStore.nativeTokenHomeAddress,
                title: "Native Token Home",
                description: "Previously deployed Native Token Home contract"
            });
        }
        
        return suggestions;
    }, [sourceToolboxStore.erc20TokenHomeAddress, sourceToolboxStore.nativeTokenHomeAddress]);

    // Updates token details
    useEffect(() => {
        const fetchTokenDetails = async () => {
            try {
                setLocalError("");
                setTokenDecimals("0");
                setTokenName("loading...");
                setTokenSymbol("loading...");

                if (!sourceL1?.rpcUrl || !tokenHomeAddress) return;

                const publicClient = createPublicClient({
                    transport: http(sourceL1.rpcUrl)
                });

                // Both ERC20TokenHome and NativeTokenHome have the same getTokenAddress function
                const tokenAddress = await publicClient.readContract({
                    address: tokenHomeAddress as `0x${string}`,
                    abi: ERC20TokenHomeABI.abi,
                    functionName: "getTokenAddress"
                });
                
                const decimals = await publicClient.readContract({
                    address: tokenAddress as `0x${string}`,
                    abi: ExampleERC20.abi,
                    functionName: "decimals"
                });
                const name = await publicClient.readContract({
                    address: tokenAddress as `0x${string}`,
                    abi: ExampleERC20.abi,
                    functionName: "name"
                });
                const symbol = await publicClient.readContract({
                    address: tokenAddress as `0x${string}`,
                    abi: ExampleERC20.abi,
                    functionName: "symbol"
                });

                setTokenDecimals(String(decimals));
                setTokenName(name as string);
                setTokenSymbol(symbol as string);
            } catch (error: any) {
                console.error(error);
                setLocalError("Fetching token details failed: " + error.message);
            }
        };

        fetchTokenDetails();
    }, [sourceChainId, sourceL1?.rpcUrl, tokenHomeAddress]);

    async function handleDeploy() {
        if (!coreWalletClient) {
            setCriticalError(new Error('Core wallet not found'));
            return;
        }

        setLocalError("");
        setIsDeploying(true);

        try {
            if (!viemChain || !selectedL1) {
                throw new Error("Destination chain configuration is missing.");
            }

            if (!tokenHomeAddress || !teleporterRegistryAddress || !tokenHomeBlockchainIDHex ||
                tokenDecimals === "0" || !tokenSymbol) {
                throw new Error("Critical deployment parameters missing or invalid.");
            }

            const publicClient = createPublicClient({
                chain: viemChain,
                transport: http(viemChain.rpcUrls.default.http[0])
            });

            const constructorArgs = [
                {
                    teleporterRegistryAddress: teleporterRegistryAddress as `0x${string}`,
                    teleporterManager: teleporterManager || walletEVMAddress,
                    minTeleporterVersion: BigInt(minTeleporterVersion),
                    tokenHomeBlockchainID: tokenHomeBlockchainIDHex as `0x${string}`,
                    tokenHomeAddress: tokenHomeAddress as `0x${string}`,
                    tokenHomeDecimals: parseInt(tokenDecimals)
                },
                tokenSymbol,
                BigInt(initialReserveImbalance),
                BigInt(burnedFeesReportingRewardPercentage)
            ];

            console.log("Deploying NativeTokenRemote with args:", constructorArgs);

            const deployPromise = coreWalletClient.deployContract({
                abi: NativeTokenRemote.abi as any,
                bytecode: NativeTokenRemote.bytecode.object as `0x${string}`,
                args: constructorArgs,
                chain: viemChain,
                account: walletEVMAddress as `0x${string}`
            });
            notify({
                type: 'deploy',
                name: 'NativeTokenRemote'
            }, deployPromise, viemChain ?? undefined);

            const receipt = await publicClient.waitForTransactionReceipt({ hash: await deployPromise });

            if (!receipt.contractAddress) {
                throw new Error("No contract address in receipt");
            }

            setNativeTokenRemoteAddress(receipt.contractAddress);
        } catch (error: any) {
            console.error("Deployment failed:", error);
            setLocalError(`Deployment failed: ${error.shortMessage || error.message}`);
            setCriticalError(error instanceof Error ? error : new Error(String(error)));
        } finally {
            setIsDeploying(false);
        }
    }

    return (
        <CheckPrecompile
            configKey="contractNativeMinterConfig"
            precompileName="Native Minter"
            errorMessage="The Native Minter precompile is not activated on this chain. The NativeTokenRemote contract requires the Native Minter precompile to be active in order to mint incoming bridged tokens."
            docsLink="https://build.avax.network/docs/avalanche-l1s/upgrade/customize-avalanche-l1#network-upgrades-enabledisable-precompiles"
            docsLinkText="Learn how to activate the Native Minter precompile"
        >

                <div>
                    <p className="mt-2">
                        This deploys a `NativeTokenRemote` contract to the current network ({selectedL1?.name}).
                        This contract acts as the bridge endpoint for your native token from the source chain.
                        To mint native tokens, please use the <a href="#precompiles/nativeMinter" className="text-blue-500 hover:text-blue-600 underline">Native Minter Precompile</a>.
                    </p>
                </div>

                <AcknowledgementCallout
                    title="Have You Switched to the Destination Chain?"
                    type="info"
                    checkboxLabel="I have switched to the destination chain and am ready to deploy"
                    checked={acknowledged}
                    onCheckedChange={(checked: boolean) => {
                        setAcknowledged(checked);
                        if (checked) {
                            setWorkflowDismissed(true);
                        }
                    }}
                    visible={!workflowDismissed}
                >
                    <p>
                        <strong>Important:</strong> The Token Remote contract must be deployed on the <strong>destination chain</strong> (where you want to receive bridged tokens as native currency).
                    </p>
                    <p>
                        Before proceeding, make sure you have:
                    </p>
                    <ul className="list-disc list-inside ml-2 space-y-1">
                        <li>Already deployed the <strong>Token Home</strong> contract on the source chain</li>
                        <li>Switched to the <strong>destination chain</strong> using the chain selector in Builder Console</li>
                        <li>Verified that <code className="bg-blue-100 dark:bg-blue-900/30 px-1 py-0.5 rounded">{selectedL1?.name}</code> is your intended destination chain</li>
                        <li>Confirmed the <strong>Native Minter precompile</strong> is enabled on this chain</li>
                    </ul>
                </AcknowledgementCallout>

                <LockedContent
                    isUnlocked={workflowDismissed}
                    lockedMessage="Please acknowledge the chain switching workflow above to continue."
                >
                    <TeleporterRegistryAddressInput
                    value={teleporterRegistryAddress}
                    onChange={setTeleporterRegistryAddress}
                    disabled={isDeploying}
                />

                {!teleporterRegistryAddress && <Note variant="warning">
                    <p>
                        Please <a href="#teleporterRegistry" className="text-blue-500">deploy the Teleporter Registry contract first</a>.
                    </p>
                </Note>}

                <SelectBlockchainId
                    label="Source Chain (where token home is deployed)"
                    value={sourceChainId}
                    onChange={(value) => setSourceChainId(value)}
                    error={sourceChainError}
                />

                {sourceChainId && <EVMAddressInput
                    label={`Token Home Address on ${sourceL1?.name}`}
                    value={tokenHomeAddress}
                    onChange={setTokenHomeAddress}
                    disabled={isDeploying}
                    suggestions={tokenHomeSuggestions}
                    helperText={tokenHomeSuggestions.length === 0 ? `Please deploy a Token Home contract on ${sourceL1?.name} first` : undefined}
                />}

                {tokenHomeBlockchainIDHex && <Input
                    label="Token Home Blockchain ID (hex)"
                    value={tokenHomeBlockchainIDHex}
                    disabled
                />}

                {localError && <div className="text-red-500 mt-2 p-2 border border-red-300 rounded">{localError}</div>}

                {tokenHomeAddress && (
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
                )}

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

                <EVMAddressInput
                    label="Teleporter Manager Address"
                    value={teleporterManager}
                    onChange={setTeleporterManager}
                    disabled={isDeploying}
                    helperText="default: your address"
                />

                <Input
                    label="Min Teleporter Version"
                    value={minTeleporterVersion}
                    onChange={setMinTeleporterVersion}
                    type="number"
                    required
                />

                <div className="mb-6">
                    <Success
                        label={`Native Token Remote Address (on ${selectedL1?.name})`}
                        value={nativeTokenRemoteAddress || ""}
                    />
                </div>

                <Button
                    variant={nativeTokenRemoteAddress ? "secondary" : "primary"}
                    onClick={handleDeploy}
                    loading={isDeploying}
                    disabled={isDeploying ||
                        !tokenHomeAddress ||
                        !tokenHomeBlockchainIDHex ||
                        tokenDecimals === "0" ||
                        !tokenSymbol ||
                        !teleporterRegistryAddress ||
                        !!sourceChainError}
                >
                    {nativeTokenRemoteAddress ? "Re-Deploy Native Token Remote" : "Deploy Native Token Remote"}
                </Button>
                </LockedContent>
        </CheckPrecompile>
    );
} 

export default withConsoleToolMetadata(DeployNativeTokenRemote, metadata);