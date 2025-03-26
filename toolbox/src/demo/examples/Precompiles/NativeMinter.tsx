import { useWalletStore } from "../../utils/store";
import { useNativeMinter } from '@avalabs/builderkit';
import { RequireChainFuji } from "../../ui/RequireChain";
import { Container } from "../../../components/container";
import { Input } from "../../../components/input";
import { Button } from "../../../components/button";
import { useState } from "react";
import { EVMAddressInput } from "../../components/EVMAddressInput";

export default function NativeMinter() {
    const { walletEVMAddress } = useWalletStore();
    const [amount, setAmount] = useState<number>(100);
    const [isMinting, setIsMinting] = useState(false);
    const [isSettingAdmin, setIsSettingAdmin] = useState(false);
    const [isSettingEnabled, setIsSettingEnabled] = useState(false);
    const [isSettingManager, setIsSettingManager] = useState(false);
    const [isSettingNone, setIsSettingNone] = useState(false);
    
    const [adminAddress, setAdminAddress] = useState<string>("");
    const [enabledAddress, setEnabledAddress] = useState<string>("");
    const [managerAddress, setManagerAddress] = useState<string>("");
    const [noneAddress, setNoneAddress] = useState<string>("");
    const [nativeMinterRecipient, setNativeMinterRecipient] = useState<string>(walletEVMAddress);

    const { mintNativeCoin, setAdmin, setEnabled, setManager, setNone } = useNativeMinter();

    const convertToHex = (amount: number): `0x${string}` => {
        const amountInWei = BigInt(amount) * BigInt(10 ** 18);
        return `0x${amountInWei.toString(16)}` as `0x${string}`;
    };

    const handleMint = async () => {
        if (!nativeMinterRecipient) return;
        setIsMinting(true);
        try {
            const amountInHex = convertToHex(amount);
            await mintNativeCoin(nativeMinterRecipient, amountInHex);
        } catch (error) {
            console.error('Minting failed:', error);
        } finally {
            setIsMinting(false);
        }
    };

    return (
        <RequireChainFuji>
            <div className="space-y-6">
                <Container
                    title="Mint Native Tokens"
                    description="This will mint native tokens to the EVM address."
                >
                    <div className="space-y-4">
                        <EVMAddressInput
                            label="Recipient Address"
                            value={nativeMinterRecipient}
                            onChange={setNativeMinterRecipient}
                        />
                        <Input
                            label="Amount"
                            value={amount}
                            onChange={(value) => setAmount(Number(value))}
                            type="number"
                        />
                        <Button
                            onClick={handleMint}
                            loading={isMinting}
                            variant="primary"
                        >
                            Mint
                        </Button>
                    </div>
                </Container>

                <Container
                    title="Set Admin"
                    description="Set an address as admin for the native minter."
                >
                    <div className="space-y-4">
                        <EVMAddressInput
                            label="Admin Address"
                            value={adminAddress}
                            onChange={setAdminAddress}
                        />
                        <Button
                            onClick={() => setAdmin(adminAddress)}
                            loading={isSettingAdmin}
                            variant="primary"
                        >
                            Set Admin
                        </Button>
                    </div>
                </Container>

                <Container
                    title="Set Enabled"
                    description="Set an address as enabled for the native minter."
                >
                    <div className="space-y-4">
                        <EVMAddressInput
                            label="Enabled Address"
                            value={enabledAddress}
                            onChange={setEnabledAddress}
                        />
                        <Button
                            onClick={() => setEnabled(enabledAddress)}
                            loading={isSettingEnabled}
                            variant="primary"
                        >
                            Set Enabled
                        </Button>
                    </div>
                </Container>

                <Container
                    title="Set Manager"
                    description="Set an address as manager for the native minter."
                >
                    <div className="space-y-4">
                        <EVMAddressInput
                            label="Manager Address"
                            value={managerAddress}
                            onChange={setManagerAddress}
                        />
                        <Button
                            onClick={() => setManager(managerAddress)}
                            loading={isSettingManager}
                            variant="primary"
                        >
                            Set Manager
                        </Button>
                    </div>
                </Container>

                <Container
                    title="Set None"
                    description="Remove all permissions for an address."
                >
                    <div className="space-y-4">
                        <EVMAddressInput
                            label="Address"
                            value={noneAddress}
                            onChange={setNoneAddress}
                        />
                        <Button
                            onClick={() => setNone(noneAddress)}
                            loading={isSettingNone}
                            variant="primary"
                        >
                            Set None
                        </Button>
                    </div>
                </Container>
            </div>
        </RequireChainFuji>
    );
}
