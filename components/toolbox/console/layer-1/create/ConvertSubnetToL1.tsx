"use client";

import { useCreateChainStore } from "@/components/toolbox/stores/createChainStore";
import { useWalletStore } from "@/components/toolbox/stores/walletStore";
import { useState } from "react";
import { type ConvertToL1Validator } from "@/components/toolbox/components/ValidatorListInput";
import { ValidatorListInput } from "@/components/toolbox/components/ValidatorListInput";
import InputChainId from "@/components/toolbox/components/InputChainId";
import SelectSubnet, { SubnetSelection } from "@/components/toolbox/components/SelectSubnet";
import { EVMAddressInput } from "@/components/toolbox/components/EVMAddressInput";
import { WalletRequirementsConfigKey } from "@/components/toolbox/hooks/useWalletRequirements";
import { BaseConsoleToolProps, ConsoleToolMetadata, withConsoleToolMetadata } from "../../../components/WithConsoleToolMetadata";
import useConsoleNotifications from "@/hooks/useConsoleNotifications";
import { generateConsoleToolGitHubUrl } from "@/components/toolbox/utils/github-url";
import { Step, Steps } from 'fumadocs-ui/components/steps';
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { CoreWalletTransactionButton } from "@/components/toolbox/components/CoreWalletTransactionButton";
import { ensureCoreNetworkMode, restoreCoreChain } from "@/components/toolbox/coreViem";

const metadata: ConsoleToolMetadata = {
    title: "Convert Subnet to L1",
    description: <>Converting a Subnet to an <Link href="/docs/avalanche-l1s" className="text-primary hover:underline">L1</Link> enables sovereign <Link href="/docs/avalanche-l1s/validator-manager/contract" className="text-primary hover:underline">validator management</Link> through a smart contract. This conversion is <strong>irreversible</strong>.</>,
    toolRequirements: [
        WalletRequirementsConfigKey.WalletConnected
    ],
    githubUrl: generateConsoleToolGitHubUrl(import.meta.url)
};

function ConvertToL1({ onSuccess }: BaseConsoleToolProps) {
    const {
        subnetId: storeSubnetId,
        chainID: storeChainID,
        managerAddress: validatorManagerAddress,
        setManagerAddress: setValidatorManagerAddress,
        setConvertToL1TxId,
    } = useCreateChainStore()();

    const [selection, setSelection] = useState<SubnetSelection>({
        subnetId: storeSubnetId,
        subnet: null
    });
    const [validatorManagerChainID, setValidatorManagerChainID] = useState(storeChainID);
    const [validators, setValidators] = useState<ConvertToL1Validator[]>([]);

    const { pChainAddress, isTestnet } = useWalletStore();
    const pChainBalance = useWalletStore((s) => s.balances.pChain);
    const coreWalletClient = useWalletStore((s) => s.coreWalletClient);

    const [isConverting, setIsConverting] = useState(false);

    const { notify } = useConsoleNotifications();

    function buildConvertCliCommand() {
        const parts = [
            `platform subnet convert-l1`,
            `--subnet-id ${selection.subnetId || "<subnet-id>"}`,
            `--chain-id ${validatorManagerChainID || "<chain-id>"}`,
            `--manager ${validatorManagerAddress || "<address>"}`,
        ];

        if (validators.length > 0) {
            const nodeIds = validators.map(v => v.nodeID || "<node-id>").join(",");
            const blsKeys = validators.map(v => v.nodePOP.publicKey || "<bls-key>").join(",");
            const blsPops = validators.map(v => v.nodePOP.proofOfPossession || "<bls-pop>").join(",");
            const balanceAvax = validators[0]?.validatorBalance
                ? (Number(validators[0].validatorBalance) / 1e9).toString()
                : "1.0";
            parts.push(`--validator-node-ids ${nodeIds}`);
            parts.push(`--validator-bls-public-keys ${blsKeys}`);
            parts.push(`--validator-bls-pops ${blsPops}`);
            parts.push(`--validator-balance ${balanceAvax}`);
        } else {
            parts.push(`--mock-validator`);
        }

        parts.push(`--network ${isTestnet ? "fuji" : "mainnet"}`);
        return parts.join(" ");
    }

    async function handleConvertToL1() {
        if (!coreWalletClient) return;

        setConvertToL1TxId("");
        setIsConverting(true);

        try {
            // Ensure Core Wallet is in the correct network mode for P-Chain ops
            const previousChainId = await ensureCoreNetworkMode(isTestnet);

            const convertSubnetToL1Tx = coreWalletClient.convertToL1({
                subnetId: selection.subnetId,
                chainId: validatorManagerChainID,
                managerAddress: validatorManagerAddress,
                subnetAuth: [0],
                validators
            });

            notify('convertToL1', convertSubnetToL1Tx);

            const txID = await convertSubnetToL1Tx;

            if (previousChainId) await restoreCoreChain(previousChainId);

            setConvertToL1TxId(txID);
            onSuccess?.();
        } finally {
            setIsConverting(false);
        }
    }

    return (
        <div className="space-y-6">
            <Steps>
                <Step>
                    <h3 className="text-sm font-semibold mb-3">Select Subnet</h3>
                    <SelectSubnet
                        value={selection.subnetId}
                        onChange={setSelection}
                        error={null}
                        onlyNotConverted={true}
                    />
                </Step>

                <Step>
                    <h3 className="text-sm font-semibold mb-3">Validator Manager</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                        The validator manager contract controls your L1's validator set.
                        If you used <strong>Console defaults</strong> for your L1 genesis, a proxy is pre-deployed at{" "}
                        <code className="text-xs bg-muted px-1 py-0.5 rounded">0xfacade...</code>
                    </p>

                    <p className="text-xs text-muted-foreground mb-4 flex items-center gap-1.5">
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                        <span>These values are <strong>permanent</strong> and cannot be changed after conversion.</span>
                    </p>

                    <div className="space-y-4">
                        <InputChainId
                            value={validatorManagerChainID}
                            onChange={setValidatorManagerChainID}
                            error={null}
                            label="Manager Chain ID"
                            helperText="Chain where the manager contract is deployed"
                        />
                        <EVMAddressInput
                            value={validatorManagerAddress}
                            onChange={setValidatorManagerAddress}
                            label="Manager Contract Address"
                            disabled={isConverting}
                            helperText="Address of the validator manager contract"
                        />
                    </div>
                </Step>

                <Step>
                    <h3 className="text-sm font-semibold mb-3">Initial Validators</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                        Add at least one validator. Existing Subnet validators cannot be transferred.
                    </p>
                    <ValidatorListInput
                        validators={validators}
                        onChange={setValidators}
                        defaultAddress={pChainAddress}
                        label=""
                        description=""
                        userPChainBalanceNavax={BigInt(pChainBalance * 1e9)}
                        selectedSubnetId={selection.subnetId}
                        isTestnet={isTestnet}
                    />
                </Step>

                <Step>
                    <div>
                        <h2 className="text-sm font-semibold mb-1">Convert to L1</h2>
                        <p className="text-xs text-muted-foreground">
                            Issues a{" "}
                            <Link
                                href="/docs/rpcs/p-chain/txn-format#unsigned-convert-subnet-to-l1-tx"
                                className="text-primary hover:underline"
                            >
                                ConvertSubnetToL1Tx
                            </Link>{" "}
                            on the P-Chain.
                        </p>
                    </div>
                    <CoreWalletTransactionButton
                        variant="primary"
                        onClick={handleConvertToL1}
                        disabled={!selection.subnetId || !validatorManagerAddress || validators.length === 0 || (selection.subnet?.isL1)}
                        loading={isConverting}
                        className="w-full"
                        cliCommand={buildConvertCliCommand()}
                    >
                        {selection.subnet?.isL1 ? "Already Converted" : "Convert to L1"}
                    </CoreWalletTransactionButton>
                </Step>
            </Steps>
        </div>
    );
}

export default withConsoleToolMetadata(ConvertToL1, metadata);
