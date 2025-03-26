import { useWalletStore } from "../../utils/store";
import { Success } from "../../ui/Success";
import { RequireChainFuji } from "../../ui/RequireChain";
import { Container } from "../../../components/container";
import { Input } from "../../../components/input";
import { Button } from "../../../components/button";
import { useState } from "react";
import { useNativeMinter } from '@avalabs/builderkit';
import { EVMAddressInput } from "../../components/EVMAddressInput";

const NATIVE_MINTER_ADDRESS = "0x0200000000000000000000000000000000000001";

export default function NativeMinter() {
    const { walletEVMAddress } = useWalletStore();
    const [amount, setAmount] = useState<number>(100);
    const [nativeMinterRecipient, setNativeMinterRecipient] = useState<string>(walletEVMAddress);
    const [isMinting, setIsMinting] = useState(false);
    const { mintNativeCoin } = useNativeMinter();

    const convertToHex = (amount: number): `0x${string}` => {
        const amountInWei = BigInt(amount) * BigInt(10 ** 18);
        return `0x${amountInWei.toString(16)}` as `0x${string}`;
    };

    const handleMint = async () => {
        if (!nativeMinterRecipient) return;
        setIsMinting(true);
        try {
            const amountInHex = convertToHex(amount);
            await mintNativeCoin(
                nativeMinterRecipient,
                amountInHex
            );
        } catch (error) {
            console.error('Minting failed:', error);
        } finally {
            setIsMinting(false);
        }
    };

    return (
        <RequireChainFuji>
            <Container
                title="Mint Native Tokens"
                description="This will mint native tokens to the EVM address."
            >
                <div className="space-y-4">
                    <EVMAddressInput
                        label="Recipient Address"
                        value={nativeMinterRecipient}
                        onChange={(value) => setNativeMinterRecipient(value)}
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
        </RequireChainFuji>
    );
}
