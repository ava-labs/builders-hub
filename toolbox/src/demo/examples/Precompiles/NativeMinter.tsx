import { useWalletStore } from "../../utils/store";
import { Success } from "../../ui/Success";
import { RequireChainFuji } from "../../ui/RequireChain";
import { Container } from "../../../components/container";
import { Input } from "../../../components/input";
import { Button } from "../../../components/button";
import { useState } from "react";

export default function NativeMinter() {
    const { walletEVMAddress} = useWalletStore();
    const [amount, setAmount] = useState<number>(100);
    const [nativeMinterRecipient, setNativeMinterRecipient] = useState<string>(walletEVMAddress);

    return (
        <RequireChainFuji>
            <Container
                title="Mint Native Tokens"
                description="This will mint native tokens to the EVM address."
            >
                <div className="space-y-4">
                    <Input
                        label="L1 Address"
                        value={nativeMinterRecipient}
                        onChange={(value) => setNativeMinterRecipient(value)}
                        type="text"
                    />
                    <Input
                        label="Amount"
                        value={amount}
                        onChange={(value) => setAmount(Number(value))}
                        type="number"
                    />
                    <Button
                        onClick={() => { }}
                        loading={false}
                        variant="primary"
                    >
                        Mint
                    </Button>
                </div>
                {/* {subnetID && (
                    <ResultField
                        label="Subnet ID"
                        value={subnetID}
                        showCheck={!!subnetID}
                    />
                )} */}
            </Container>
        </RequireChainFuji>
    );
}
