"use client";

import { useCreateChainStore } from "../toolboxStore";
import { useWalletStore } from "../../lib/walletStore";
import { useState } from "react";
import { Button } from "../../components/Button";
import { type ConvertToL1Validator } from "../../components/ValidatorListInput";
import { useErrorBoundary } from "react-error-boundary";
import { Container } from "../components/Container";
import { ResultField } from "../components/ResultField";
import { ValidatorListInput } from "../../components/ValidatorListInput";
import InputChainId from "../components/InputChainId";
import SelectSubnetId from "../components/SelectSubnetId";
import { Callout } from "fumadocs-ui/components/callout";
import { EVMAddressInput } from "../components/EVMAddressInput";

export default function ConvertToL1() {
    const {
        subnetId: storeSubnetId,
        chainID: storeChainID,
        managerAddress,
        setManagerAddress,
        convertToL1TxId,
        setConvertToL1TxId,
    } = useCreateChainStore()();

    const [subnetId, setSubnetId] = useState(storeSubnetId);
    const [chainID, setChainID] = useState(storeChainID);
    const [isConverting, setIsConverting] = useState(false);
    const [validators, setValidators] = useState<ConvertToL1Validator[]>([]);
    const { coreWalletClient, pChainAddress } = useWalletStore();
    const { showBoundary } = useErrorBoundary();

    async function handleConvertToL1() {
        setConvertToL1TxId("");
        setIsConverting(true);
        try {
            const txID = await coreWalletClient.convertToL1({
                managerAddress,
                subnetId: subnetId,
                chainId: chainID,
                subnetAuth: [0],
                validators
            });

            setConvertToL1TxId(txID);
        } catch (error) {
            showBoundary(error);
        } finally {
            setIsConverting(false);
        }
    }

    return (
        <Container
            title="Convert Subnet to L1"
            description="This will convert your subnet to an L1 chain."
        >
            <div className="space-y-4">
                <SelectSubnetId
                    value={subnetId}
                    onChange={setSubnetId}
                    error={null}
                    onlyNotConverted={true}
                />

                <div>
                    <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Validator Manager</h2>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">With the conversion of the Subnet to an L1 the validator set of the L1 will be managed by a validator manager contract. This contract can implement Proof-of-Authority, Proof-of-Stake or any custom logic to determine the validator set. The contract can be deployed on a blockchain of the L1, the C-Chain or any other blockchain in the Avalanche network.</p>
                </div>
                <InputChainId
                    value={chainID}
                    onChange={setChainID}
                    error={null}
                    label="Validator Manager Blockchain ID"
                />
                <EVMAddressInput
                    value={managerAddress}
                    onChange={setManagerAddress}
                    label="Validator Manager Contract Address"
                    disabled={isConverting}
                    showError={true}
                />
                <Callout type="info">
                    In the Genesis Builder an <a href="https://docs.openzeppelin.com/contracts/4.x/api/proxy" target="_blank">OpenZeppelin TransparentUpgradeableProxy</a> contract is pre-deployed at the address <code>0xfacade...</code>. This proxy can be pointed to a reference implementation or customized version of the <a href="https://github.com/ava-labs/icm-contracts/tree/main/contracts/validator-manager" target="_blank">validator manager contract</a>. Tools for the deployment of the reference implementations of validator manager contract are available in the <a href="http://build.avax.network/tools/l1-toolbox#deployValidatorManager" target="_blank">L1 Toolbox</a> for after the conversion.
                </Callout>

                <ValidatorListInput
                    validators={validators}
                    onChange={setValidators}
                    defaultAddress={pChainAddress}
                    label="Initial Validators"
                    description="Specify the intial validator set for the L1 below. You need to add a least one validator. If converting a pre-existing Subnet with validators, you must establish a completely new validator set for the L1 conversion. The existing Subnet validators cannot be transferred. For each new validator you need to specify NodeID, the consensus weight, the initial balance and an address or a multi-sig that can deactivate the validator and that receives its remaining balance. The sum of the initial balances of the validators need to be paid when issuing this transaction."
                />

                <Button
                    variant="primary"
                    onClick={handleConvertToL1}
                    disabled={!subnetId || !managerAddress || validators.length === 0}
                    loading={isConverting}
                >
                    Convert to L1
                </Button>
            </div>
            <ResultField
                label="Transaction ID"
                value={convertToL1TxId}
                showCheck={!!convertToL1TxId}
            />
        </Container>
    );
};
