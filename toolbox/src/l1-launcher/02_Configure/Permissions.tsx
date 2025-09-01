import { isAddress } from 'viem';
import { isValidAllowlistPrecompileConfig } from '../../components/genesis/types';
import { useL1LauncherStore } from '../L1LauncherStore';
import { RadioGroup } from "../../components/RadioGroup";
import { Input } from "../../components/Input";
import NextPrev from "../components/NextPrev";
import AllowlistPrecompileConfigurator from "../../components/genesis/AllowlistPrecompileConfigurator";
import { useWalletStore } from "../../lib/walletStore";
import { Button } from "../../components/Button";
import { useEffect, useState } from 'react';


export default function Permissions() {
    const { poaOwnerAddress, setPoaOwnerAddress, genesisTxAllowlistConfig, setGenesisTxAllowlistConfig, genesisContractDeployerAllowlistConfig, setGenesisContractDeployerAllowlistConfig } = useL1LauncherStore();
    const { walletEVMAddress } = useWalletStore();
    const [initCompleted, setInitCompleted] = useState(false);

    useEffect(() => {
        if (initCompleted) return;
        setInitCompleted(true);

        if (!poaOwnerAddress && walletEVMAddress) {
            setPoaOwnerAddress(walletEVMAddress);
        }
    }, [walletEVMAddress, poaOwnerAddress]);

    return (
        <div className="space-y-12">
            <div className='space-y-4'>
                <h1 className="text-2xl font-medium">Permissions</h1>
                <p>By design, blockchain networks are fully permissionless, allowing anyone to transact and deploy smart contracts. However, certain use cases require permissioning to control who can participate in transactions or deploy contracts. On Avalanche, permissioning is an optional feature for Layer 1 blockchains that may or may not be activated, depending on the network's needs.</p>
                <p>This is achieved through the transaction allowlist and contract deployer allowlist precompiles, which enable fine-grained access control. These precompiles allow network administrators to restrict which addresses can send transactions or deploy contracts, ensuring compliance, security, or governance requirements are met. Permissioning can be flexibly administered by a multi-signature wallet, a simple address, or a decentralized autonomous organization (DAO), providing customizable and decentralized control over network participation.</p>
            </div>

            <div className='space-y-4'>
                <h3 className="font-medium">Validator Set</h3>
                <p className="text-gray-600">How should the validator set of this blockchain be determined? You can migrate from Proof-of-Authority to Proof-of-Stake at a later time.</p>

                <RadioGroup
                    value="fuji-testnet"
                    onChange={() => { }}
                    className="space-y-2"
                    items={[
                        { value: "fuji-testnet", label: "Proof-of-Authority: Only selected parties should validate this blockchain" },
                        { value: "mainnet", label: "Proof-of-Stake: Anyone holding the staking token (Coming soon)", isDisabled: true }
                    ]}
                />
            </div>

            <div className='space-y-4'>
                <Input
                    type='text'
                    value={poaOwnerAddress}
                    onChange={setPoaOwnerAddress}
                    label="POA Owner Address"
                    helperText="This address controls the validator set of the blockchain. It can transfer the ownership to another address at a later time."
                    error={poaOwnerAddress && !isAddress(poaOwnerAddress, { strict: false }) ? "Please paste a valid Ethereum address in 0x format." : ""}
                    button={<Button
                        onClick={() => setPoaOwnerAddress(walletEVMAddress)}
                        stickLeft
                    >
                        Fill from Wallet
                    </Button>}
                />
            </div>

            <AllowlistPrecompileConfigurator
                title="Transaction Allowlist"
                description="This precompile restricts which addresses may submit transactions on this blockchain."
                precompileAction="issue transactions"
                config={genesisTxAllowlistConfig}
                onUpdateConfig={setGenesisTxAllowlistConfig}
                radioOptionFalseLabel="I want anyone to be able to submit transactions on this blockchain."
                radioOptionTrueLabel="I want only approved addresses to be able to submit transactions on this blockchain."
            />

            <AllowlistPrecompileConfigurator
                title="Contract Deployer Allowlist"
                description="This precompile restricts which addresses may deploy smart contracts on this blockchain."
                precompileAction="deploy contracts"
                config={genesisContractDeployerAllowlistConfig}
                onUpdateConfig={setGenesisContractDeployerAllowlistConfig}
                radioOptionFalseLabel="I want anyone to be able to deploy contracts on this blockchain."
                radioOptionTrueLabel="I want only approved addresses to be able to deploy contracts on this blockchain."
            />

            <NextPrev
                nextEnabled={isAddress(poaOwnerAddress, { strict: false }) && isValidAllowlistPrecompileConfig(genesisTxAllowlistConfig) && isValidAllowlistPrecompileConfig(genesisContractDeployerAllowlistConfig)}
            />
        </div>
    );
}
