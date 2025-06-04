"use client";

import { useToolboxStore, useViemChainStore } from "../../stores/toolboxStore";
import { useWalletStore } from "../../stores/walletStore";
import { useErrorBoundary } from "react-error-boundary";
import { useState, useEffect } from "react";
import { Button } from "../../components/Button";
import { Input } from "../../components/Input";
import PoAManagerABI from "../../../contracts/icm-contracts/compiled/PoAManager.json";
import { Container } from "../../components/Container";
import { Steps, Step } from "fumadocs-ui/components/steps";
import { Success } from "../../components/Success";
import { EVMAddressInput } from "../../components/EVMAddressInput";
import { ResultField } from "../../components/ResultField";
import { AbiEvent } from 'viem';

export default function DeployPoAManager() {
    const { showBoundary } = useErrorBoundary();
    const { validatorManagerAddress } = useToolboxStore();
    const { walletEVMAddress, coreWalletClient, publicClient } = useWalletStore();
    const [isDeploying, setIsDeploying] = useState(false);
    const [isInitializing, setIsInitializing] = useState(false);
    const [isChecking, setIsChecking] = useState(false);
    const [poaManagerAddress, setPoaManagerAddress] = useState("");
    const [poaOwnerAddress, setPoaOwnerAddress] = useState("");
    const [validatorManagerAddr, setValidatorManagerAddr] = useState("");
    const [isInitialized, setIsInitialized] = useState<boolean | null>(null);
    const [initEvent, setInitEvent] = useState<any>(null);
    const viemChain = useViemChainStore();

    useEffect(() => {
        if (walletEVMAddress && !poaOwnerAddress) {
            setPoaOwnerAddress(walletEVMAddress);
        }
    }, [walletEVMAddress, poaOwnerAddress]);

    useEffect(() => {
        if (validatorManagerAddress && !validatorManagerAddr) {
            setValidatorManagerAddr(validatorManagerAddress);
        }
    }, [validatorManagerAddress, validatorManagerAddr]);

    useEffect(() => {
        if (poaManagerAddress) {
            checkIfInitialized();
        }
    }, [poaManagerAddress]);

    async function deployPoAManager() {
        setIsDeploying(true);
        setPoaManagerAddress("");
        try {
            if (!viemChain) throw new Error("Viem chain not found");
            await coreWalletClient.addChain({ chain: viemChain });
            await coreWalletClient.switchChain({ id: viemChain!.id });

            const hash = await coreWalletClient.deployContract({
                abi: PoAManagerABI.abi,
                bytecode: PoAManagerABI.bytecode.object as `0x${string}`,
                chain: viemChain,
            });

            const receipt = await publicClient.waitForTransactionReceipt({ hash });

            if (!receipt.contractAddress) {
                throw new Error('No contract address in receipt');
            }

            setPoaManagerAddress(receipt.contractAddress);
        } catch (error) {
            showBoundary(error);
        } finally {
            setIsDeploying(false);
        }
    }

    async function checkIfInitialized() {
        if (!poaManagerAddress) return;

        setIsChecking(true);
        try {
            const initializedEvent = PoAManagerABI.abi.find(
                item => item.type === 'event' && item.name === 'Initialized'
            );

            if (!initializedEvent) {
                throw new Error('Initialized event not found in ABI');
            }

            // Try to call a read-only method that would fail if not initialized
            try {
                const owner = await publicClient.readContract({
                    address: poaManagerAddress as `0x${string}`,
                    abi: PoAManagerABI.abi,
                    functionName: 'owner'
                }) as string;

                // Check if owner is set to a non-zero address (initialized contracts should have an owner)
                const isOwnerSet = owner && owner !== '0x0000000000000000000000000000000000000000';
                setIsInitialized(Boolean(isOwnerSet));
                console.log('Contract owner check:', owner, 'isInitialized:', Boolean(isOwnerSet));
                return;
            } catch (readError) {
                // If this fails with a specific revert message about not being initialized, we know it's not initialized
                if ((readError as any)?.message?.includes('not initialized')) {
                    setIsInitialized(false);
                    return;
                }
                // Otherwise, fallback to log checking with a smaller block range
            }

            // Fallback: Check logs but with a more limited range
            const latestBlock = await publicClient.getBlockNumber();
            const fromBlock = latestBlock > 2000n ? latestBlock - 2000n : 0n;

            const logs = await publicClient.getLogs({
                address: poaManagerAddress as `0x${string}`,
                event: initializedEvent as AbiEvent,
                fromBlock: fromBlock,
                toBlock: 'latest'
            });

            console.log('Initialization logs:', logs);
            setIsInitialized(logs.length > 0);
            if (logs.length > 0) {
                setInitEvent(logs[0]);
            }
        } catch (error) {
            console.error('Error checking initialization:', error);
            showBoundary(error);
        } finally {
            setIsChecking(false);
        }
    }

    async function handleInitialize() {
        if (!poaManagerAddress || !poaOwnerAddress || !validatorManagerAddr) return;

        setIsInitializing(true);
        try {
            const hash = await coreWalletClient.writeContract({
                address: poaManagerAddress as `0x${string}`,
                abi: PoAManagerABI.abi,
                functionName: 'initialize',
                args: [
                    poaOwnerAddress as `0x${string}`,
                    validatorManagerAddr as `0x${string}`
                ],
                chain: viemChain,
            });

            await publicClient.waitForTransactionReceipt({ hash });
            await checkIfInitialized();
        } catch (error) {
            console.error('Error initializing:', error);
            showBoundary(error);
        } finally {
            setIsInitializing(false);
        }
    }

    function jsonStringifyWithBigint(value: unknown) {
        return JSON.stringify(value, (_, v) =>
            typeof v === 'bigint' ? v.toString() : v
            , 2);
    }

    return (
        <Container
            title="Deploy PoA Manager"
            description="Deploy and initialize the PoAManager contract to manage Proof of Authority validators."
        >
            <div className="space-y-4">
                <Steps>
                    <Step>
                        <div className="flex flex-col gap-2">
                            <h3 className="text-lg font-bold">Deploy PoA Manager Contract</h3>
                            <div className="text-sm">
                                This will deploy the <code>PoAManager</code> contract to the EVM network <code>{viemChain?.id}</code>. 
                                The PoA Manager allows the owner to manage validator registration, removal, and weight updates.
                            </div>
                            <Button
                                variant="primary"
                                onClick={deployPoAManager}
                                loading={isDeploying}
                                disabled={isDeploying || !!poaManagerAddress}
                            >
                                Deploy PoA Manager
                            </Button>

                            {poaManagerAddress && (
                                <Success
                                    label="PoA Manager Deployed"
                                    value={poaManagerAddress}
                                />
                            )}
                        </div>
                    </Step>

                    <Step>
                        <div className="flex flex-col gap-2">
                            <h3 className="text-lg font-bold">Initialize PoA Manager</h3>
                            <div className="text-sm">
                                Initialize the PoA Manager with the owner address and validator manager address.
                            </div>

                            <div className="space-y-4">
                                <EVMAddressInput
                                    label="PoA Manager Address"
                                    value={poaManagerAddress}
                                    onChange={setPoaManagerAddress}
                                    disabled={isInitializing}
                                />

                                <Input
                                    label="Multisig / Owner Address"
                                    value={poaOwnerAddress}
                                    onChange={setPoaOwnerAddress}
                                    disabled={isInitializing}
                                    placeholder="Enter owner address"
                                    button={<Button
                                        onClick={() => setPoaOwnerAddress(walletEVMAddress)}
                                        stickLeft
                                    >
                                        Fill from Wallet
                                    </Button>}
                                />

                                <Input
                                    label="Validator Manager Address"
                                    value={validatorManagerAddr}
                                    onChange={setValidatorManagerAddr}
                                    disabled={isInitializing}
                                    placeholder="Enter validator manager address"
                                    button={<Button
                                        onClick={() => setValidatorManagerAddr(validatorManagerAddress)}
                                        stickLeft
                                        disabled={!validatorManagerAddress}
                                    >
                                        Fill from Store
                                    </Button>}
                                />

                                <div className="flex gap-2">
                                    <Button
                                        variant="secondary"
                                        onClick={checkIfInitialized}
                                        loading={isChecking}
                                        disabled={!poaManagerAddress}
                                        size="sm"
                                    >
                                        Check Status
                                    </Button>

                                    <Button
                                        variant="primary"
                                        onClick={handleInitialize}
                                        loading={isInitializing}
                                        disabled={isInitializing || !poaManagerAddress || !poaOwnerAddress || !validatorManagerAddr || isInitialized === true}
                                    >
                                        Initialize Contract
                                    </Button>
                                </div>
                            </div>

                            {isInitialized === true && (
                                <Success
                                    label="PoA Manager Initialized"
                                    value="Contract successfully initialized"
                                />
                            )}

                            {isInitialized === true && initEvent && (
                                <ResultField
                                    label="Initialization Event"
                                    value={jsonStringifyWithBigint(initEvent) || ""}
                                    showCheck={isInitialized === true}
                                />
                            )}
                        </div>
                    </Step>
                </Steps>
            </div>
        </Container>
    );
}
