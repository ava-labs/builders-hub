"use client";

import { useSelectedL1, useToolboxStore, useViemChainStore, type DeployOn } from "../toolboxStore";
import { useWalletStore } from "../../lib/walletStore";
import { useErrorBoundary } from "react-error-boundary";
import { useState, useCallback, useEffect } from "react";
import { Button } from "../../components/Button";
import { Success } from "../../components/Success";
import { RadioGroup } from "../../components/RadioGroup";
import { avalancheFuji } from "viem/chains";
import ERC20TokenRemoteABI from "../../../contracts/icm-contracts/compiled/ERC20TokenRemote.json";
import ERC20TokenHomeABI from "../../../contracts/icm-contracts/compiled/ERC20TokenHome.json";
import { Abi, createPublicClient, http, PublicClient, zeroAddress } from "viem";
import { Input } from "../../components/Input";
import { utils } from "@avalabs/avalanchejs";
import { FUJI_C_BLOCKCHAIN_ID } from "./DeployERC20TokenRemote";
import { ListContractEvents } from "../../components/ListContractEvents";

export default function RegisterWithHome() {
    const { showBoundary } = useErrorBoundary();
    const { erc20TokenRemoteAddress, setErc20TokenRemoteAddress } = useToolboxStore();
    const { coreWalletClient } = useWalletStore();
    const viemChain = useViemChainStore();
    const [deployOn, setDeployOn] = useState<DeployOn>("L1");
    const [isRegistering, setIsRegistering] = useState(false);
    const [lastTxId, setLastTxId] = useState<string>();
    const [localError, setLocalError] = useState("");
    const [homeContractAddress, setHomeContractAddress] = useState<string | null>(null);
    const [homeContractClient, setHomeContractClient] = useState<PublicClient | null>(null);
    const [isRegistered, setIsRegistered] = useState(false);
    const deployOnOptions = [
        { label: "L1", value: "L1" },
        { label: "C-Chain", value: "C-Chain" }
    ];
    const [isCheckingRegistration, setIsCheckingRegistration] = useState(false);
    const selectedL1 = useSelectedL1();
    if (!selectedL1) return null;

    const requiredChain = deployOn === "L1" ? viemChain : avalancheFuji;

    // Move fetchSettings outside useEffect and wrap in useCallback for stable reference
    const fetchSettings = useCallback(async () => {
        if (isCheckingRegistration) return;
        setIsCheckingRegistration(true);
        try {
            const remoteChain = deployOn === "L1" ? viemChain : avalancheFuji;
            const homeChain = deployOn === "L1" ? avalancheFuji : viemChain;
            if (!remoteChain || !homeChain) return;

            const remotePublicClient = createPublicClient({
                chain: remoteChain,
                transport: http(remoteChain.rpcUrls.default.http[0])
            });
            const homePublicClient = createPublicClient({
                chain: homeChain,
                transport: http(homeChain.rpcUrls.default.http[0])
            });

            setHomeContractClient(homePublicClient);
            const currentRemoteAddress = erc20TokenRemoteAddress?.[deployOn];

            if (!currentRemoteAddress) {
                setHomeContractAddress(null);
                return;
            }

            const tokenHomeAddress = await remotePublicClient.readContract({
                address: currentRemoteAddress as `0x${string}`,
                abi: ERC20TokenRemoteABI.abi,
                functionName: 'getTokenHomeAddress',
            });

            setHomeContractAddress(tokenHomeAddress as string);

            const chainIDBase58 = deployOn === "L1" ? selectedL1.id : FUJI_C_BLOCKCHAIN_ID;
            const tokenHomeBlockchainIDHex = utils.bufferToHex(utils.base58check.decode(chainIDBase58));
            console.log({ deployOn, chainIDBase58, tokenHomeBlockchainIDHex, FUJI_C_BLOCKCHAIN_ID, "chainID": selectedL1.id });

            const remoteSettings = await homePublicClient.readContract({
                address: tokenHomeAddress as `0x${string}`,
                abi: ERC20TokenHomeABI.abi,
                functionName: 'getRemoteTokenTransferrerSettings',
                args: [tokenHomeBlockchainIDHex, currentRemoteAddress]
            }) as { registered: boolean, collateralNeeded: bigint, tokenMultiplier: bigint, multiplyOnRemote: boolean };

            setIsRegistered(remoteSettings.registered);
        } catch (error: any) {
            console.error("Error fetching token home address:", error);
            setLocalError(`Error fetching token home address: ${error.shortMessage || error.message}`);
            setHomeContractAddress(null);
        } finally {
            setIsCheckingRegistration(false);
        }
    }, [deployOn, erc20TokenRemoteAddress["C-Chain"], erc20TokenRemoteAddress["L1"], selectedL1.id, viemChain]);

    useEffect(() => {
        fetchSettings();
    }, [fetchSettings]);

    async function handleRegister() {
        setLocalError("");
        const currentRemoteAddress = erc20TokenRemoteAddress?.[deployOn];

        if (!currentRemoteAddress) {
            setLocalError(`ERC20 Token Remote address for ${deployOn} is not set. Please deploy it first.`);
            return;
        }
        if (!requiredChain) {
            setLocalError("Required chain configuration is missing.");
            return;
        }

        setIsRegistering(true);
        setLastTxId(undefined);

        try {
            const publicClient = createPublicClient({
                chain: requiredChain,
                transport: http(requiredChain.rpcUrls.default.http[0])
            });

            const feeInfo: readonly [`0x${string}`, bigint] = [zeroAddress, 0n]; // feeTokenAddress, amount

            console.log(`Calling registerWithHome on ${currentRemoteAddress} with feeInfo:`, feeInfo);

            // Simulate the transaction first (optional but recommended)
            const { request } = await publicClient.simulateContract({
                address: currentRemoteAddress as `0x${string}`,
                abi: ERC20TokenRemoteABI.abi,
                functionName: 'registerWithHome',
                args: [feeInfo],
                chain: requiredChain,
                // account: coreWalletClient.account // Ensure account is passed if needed by simulate
            });

            // Send the transaction
            const hash = await coreWalletClient.writeContract(request);
            setLastTxId(hash);

            // Wait for confirmation
            await publicClient.waitForTransactionReceipt({ hash });
            setLocalError(""); // Clear error on success

        } catch (error: any) {
            console.error("Registration failed:", error);
            setLocalError(`Registration failed: ${error.shortMessage || error.message}`);
            showBoundary(error);
        } finally {
            setIsRegistering(false);
        }
    }

    return (
        <div className="space-y-4">
            <h2 className="text-lg font-semibold">Register Remote Bridge with Home Bridge</h2>

            <div className="p-4 border rounded-md bg-gray-50 dark:bg-gray-900/50">
                <RadioGroup
                    value={deployOn}
                    onChange={(value) => setDeployOn(value as DeployOn)}
                    items={deployOnOptions}
                    idPrefix="register-on-"
                />
            </div>

            <div className="space-y-4">
                <p>
                    This will call the `registerWithHome` function on the deployed ERC20 Token Remote contract
                    on the selected chain ({deployOn}). This step is necessary to link the remote bridge back to the home bridge.
                </p>

                <Input
                    label={`ERC20 Token Remote Address (${deployOn})`}
                    value={erc20TokenRemoteAddress?.[deployOn] || ""}
                    onChange={(value) => setErc20TokenRemoteAddress(value, deployOn)}
                    required
                    error={!erc20TokenRemoteAddress?.[deployOn] ? `Remote address for ${deployOn} not found. Deploy or enter address.` : undefined}
                />

                {localError && <div className="text-red-500 mt-2 p-2 border border-red-300 rounded">{localError}</div>}

                <Button
                    variant="primary"
                    onClick={handleRegister}
                    loading={isRegistering}
                    disabled={isRegistering || !erc20TokenRemoteAddress?.[deployOn]}
                >
                    Register Remote on {deployOn} with Home
                </Button>

                {lastTxId && (
                    <div className="space-y-2">
                        <Success
                            label="Registration Transaction ID"
                            value={lastTxId ?? ""}
                        />
                    </div>
                )}

                {isCheckingRegistration && (
                    <div className=" text-gray-500">
                        ⏳ Checking registration status...
                    </div>
                )}

                {!isCheckingRegistration && isRegistered && (
                    <div className=" ">
                        ✅ Remote contract is registered with the Home contract
                    </div>
                )}
                {!isCheckingRegistration && !isRegistered && (
                    <div className=" ">
                        ⚠️ Remote contract is not yet registered with the Home contract{' '}. ICM message needs a few seconds to be processed.
                        <button
                            className="underline text-blue-500 px-1 py-0 h-auto"
                            onClick={fetchSettings}
                            disabled={isCheckingRegistration}
                        >
                            Refresh
                        </button>
                    </div>
                )}

                {homeContractAddress && homeContractClient && (
                    <div className="mt-8 pt-4 border-t border-gray-200">
                        <ListContractEvents
                            contractAddress={homeContractAddress}
                            contractABI={ERC20TokenHomeABI.abi as Abi}
                            publicClient={homeContractClient}
                            title={`Events from Home Contract (${deployOn === "L1" ? "C-Chain" : "L1"})`}
                        />
                    </div>
                )}
            </div>
        </div >
    );
}
