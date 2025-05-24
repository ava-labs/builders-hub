"use client";

import { useToolboxStore, useViemChainStore } from "../../stores/toolboxStore";
import { useWalletStore } from "../../stores/walletStore";
import { useErrorBoundary } from "react-error-boundary";
import { useState } from "react";
import { Button } from "../../components/Button";
import { Input } from "../../components/Input";
import MultisigValidatorManagerABI from "../../../contracts/icm-contracts/compiled/MultisigValidatorManager.json";
import { Container } from "../../components/Container";
import { Steps, Step } from "fumadocs-ui/components/steps";
import { Success } from "../../components/Success";

export default function DeployMultisigValidatorManager() {
    const { showBoundary } = useErrorBoundary();
    const { validatorManagerAddress: storeValidatorManagerAddress } = useToolboxStore();
    const { coreWalletClient, publicClient, walletEVMAddress } = useWalletStore();
    const [isDeploying, setIsDeploying] = useState(false);
    const [validatorManagerAddress, setValidatorManagerAddress] = useState("");
    const [adminAddress, setAdminAddress] = useState("");
    const [multisigValidatorManagerAddress, setMultisigValidatorManagerAddress] = useState("");
    const viemChain = useViemChainStore();

    async function deployMultisigValidatorManager() {
        setIsDeploying(true);
        setMultisigValidatorManagerAddress("");
        try {
            if (!viemChain) throw new Error("Viem chain not found");
            if (!validatorManagerAddress) throw new Error("ValidatorManager address is required");
            if (!adminAddress) throw new Error("Admin address is required");

            await coreWalletClient.addChain({ chain: viemChain });
            await coreWalletClient.switchChain({ id: viemChain!.id });

            // Deploy MultisigValidatorManager with ValidatorManager address and admin address
            const hash = await coreWalletClient.deployContract({
                abi: MultisigValidatorManagerABI.abi,
                bytecode: MultisigValidatorManagerABI.bytecode.object as `0x${string}`,
                args: [validatorManagerAddress, adminAddress],
                chain: viemChain,
                gas: BigInt(2_000_000), // Explicit gas limit to avoid estimation errors
            });

            const receipt = await publicClient.waitForTransactionReceipt({ hash });

            if (!receipt.contractAddress) {
                throw new Error('No contract address in receipt');
            }

            setMultisigValidatorManagerAddress(receipt.contractAddress);
        } catch (error) {
            showBoundary(error);
        } finally {
            setIsDeploying(false);
        }
    }

    const isValidAddress = (address: string) => /^0x[a-fA-F0-9]{40}$/.test(address);
    const isValidatorManagerAddressValid = !validatorManagerAddress || isValidAddress(validatorManagerAddress);
    const isAdminAddressValid = !adminAddress || isValidAddress(adminAddress);

    return (
        <Container
            title="Deploy Multisig Validator Manager"
            description="Deploy the MultisigValidatorManager contract that acts as a multisig wrapper for ValidatorManager operations."
        >
            <div className="space-y-4">
                <Steps>
                    <Step>
                        <div className="flex flex-col gap-2">
                            <h3 className="text-lg font-bold">Configure ValidatorManager Address</h3>
                            <div className="text-sm">
                                Set the ValidatorManager contract address that this MultisigValidatorManager will wrap.
                            </div>
                            <Input
                                value={validatorManagerAddress}
                                onChange={setValidatorManagerAddress}
                                placeholder="0x..."
                                label="ValidatorManager Address"
                                error={!isValidatorManagerAddressValid ? "Invalid Ethereum address" : ""}
                                button={<Button
                                    onClick={() => setValidatorManagerAddress(storeValidatorManagerAddress)}
                                    stickLeft
                                    disabled={!storeValidatorManagerAddress}
                                >
                                    Fill from Store
                                </Button>}
                            />
                        </div>
                    </Step>

                    <Step>
                        <div className="flex flex-col gap-2">
                            <h3 className="text-lg font-bold">Configure Multisig Wallet Address</h3>
                            <div className="text-sm">
                                Set the multisig wallet address for the MultisigValidatorManager. This address will have owner privileges to initiate validator operations.
                            </div>
                            <Input
                                value={adminAddress}
                                onChange={setAdminAddress}
                                placeholder="0x..."
                                label="Multisig Wallet Address"
                                error={!isAdminAddressValid ? "Invalid Ethereum address" : ""}
                                button={<Button
                                    onClick={() => setAdminAddress(walletEVMAddress)}
                                    stickLeft
                                >
                                    Fill from Wallet
                                </Button>}
                            />
                        </div>
                    </Step>

                    <Step>
                        <div className="flex flex-col gap-2">
                            <h3 className="text-lg font-bold">Deploy MultisigValidatorManager Contract</h3>
                            <div className="text-sm">
                                This will deploy the <code>MultisigValidatorManager</code> contract to the EVM network <code>{viemChain?.id}</code>.
                                The contract will be initialized with the <code>ValidatorManager</code> at address: <code>{validatorManagerAddress || "Not set"}</code> and multisig wallet address: <code>{adminAddress || "Not set"}</code>
                            </div>
                            <Button
                                variant="primary"
                                onClick={deployMultisigValidatorManager}
                                loading={isDeploying}
                                disabled={isDeploying || !validatorManagerAddress || !adminAddress || !!multisigValidatorManagerAddress || !isValidatorManagerAddressValid || !isAdminAddressValid}
                                className="mt-1"
                            >
                                Deploy MultisigValidatorManager
                            </Button>

                            {multisigValidatorManagerAddress && (
                                <Success
                                    label="MultisigValidatorManager Address"
                                    value={multisigValidatorManagerAddress}
                                />
                            )}
                        </div>
                    </Step>
                </Steps>
            </div>
        </Container>
    );
}
