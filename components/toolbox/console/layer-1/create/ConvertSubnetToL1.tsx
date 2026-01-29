"use client";

import { useCreateChainStore } from "@/components/toolbox/stores/createChainStore";
import { useWalletStore } from "@/components/toolbox/stores/walletStore";
import { useState } from "react";
import { Button } from "@/components/toolbox/components/Button";
import { type ConvertToL1Validator } from "@/components/toolbox/components/ValidatorListInput";
import { ValidatorListInput } from "@/components/toolbox/components/ValidatorListInput";
import InputChainId from "@/components/toolbox/components/InputChainId";
import SelectSubnet, { SubnetSelection } from "@/components/toolbox/components/SelectSubnet";
import { EVMAddressInput } from "@/components/toolbox/components/EVMAddressInput";
import { WalletRequirementsConfigKey } from "@/components/toolbox/hooks/useWalletRequirements";
import { BaseConsoleToolProps, ConsoleToolMetadata, withConsoleToolMetadata } from "../../../components/WithConsoleToolMetadata";
import { useConnectedWallet } from "@/components/toolbox/contexts/ConnectedWalletContext";
import useConsoleNotifications from "@/hooks/useConsoleNotifications";
import { generateConsoleToolGitHubUrl } from "@/components/toolbox/utils/github-url";
import { Step, Steps } from 'fumadocs-ui/components/steps';
import Link from "next/link";
import { BookOpen, ExternalLink, AlertTriangle } from "lucide-react";

const metadata: ConsoleToolMetadata = {
    title: "Convert Subnet to L1",
    description: "Convert your existing Subnet to an L1 with validator management",
    toolRequirements: [
        WalletRequirementsConfigKey.PChainBalance
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
    const { coreWalletClient } = useConnectedWallet();

    const [isConverting, setIsConverting] = useState(false);

    const { notify } = useConsoleNotifications();

    async function handleConvertToL1() {
        setConvertToL1TxId("");
        setIsConverting(true);

        const convertSubnetToL1Tx = coreWalletClient.convertToL1({
            subnetId: selection.subnetId,
            chainId: validatorManagerChainID,
            managerAddress: validatorManagerAddress,
            subnetAuth: [0],
            validators
        });

        notify('convertToL1', convertSubnetToL1Tx);

        try {
            const txID = await convertSubnetToL1Tx;
            setConvertToL1TxId(txID);
            onSuccess?.();
        } finally {
            setIsConverting(false);
        }
    }

    return (
        <div className="space-y-6">
            {/* Context */}
            <div className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-4">
                <p className="mb-2">
                    Converting a Subnet to an L1 enables sovereign validator management through a smart contract.
                </p>
                <Link
                    href="/docs/avalanche-l1s"
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                >
                    <BookOpen className="h-3 w-3" />
                    Learn more about L1s
                    <ExternalLink className="h-3 w-3" />
                </Link>
            </div>

            <Steps>
                <Step>
                    <h3 className="font-medium mb-3">Select Subnet</h3>
                    <SelectSubnet
                        value={selection.subnetId}
                        onChange={setSelection}
                        error={null}
                        onlyNotConverted={true}
                    />
                </Step>

                <Step>
                    <h3 className="font-medium mb-3">Validator Manager</h3>
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
                    <h3 className="font-medium mb-3">Initial Validators</h3>
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
            </Steps>

            <div className="text-xs text-muted-foreground mb-3">
                Issues a{" "}
                <Link
                    href="/docs/rpcs/p-chain/txn-format#unsigned-convert-subnet-to-l1-tx"
                    className="text-primary hover:underline"
                >
                    ConvertSubnetToL1Tx
                </Link>{" "}
                on the P-Chain. This conversion is <strong>irreversible</strong>.
            </div>
            <Button
                variant="primary"
                onClick={handleConvertToL1}
                disabled={!selection.subnetId || !validatorManagerAddress || validators.length === 0 || (selection.subnet?.isL1)}
                loading={isConverting}
                className="w-full"
            >
                {selection.subnet?.isL1 ? "Already Converted" : "Convert to L1"}
            </Button>
        </div>
    );
}

export default withConsoleToolMetadata(ConvertToL1, metadata);
