import { useWalletStore } from "../../utils/store";
import { useAllowList } from '@avalabs/builderkit';
import { RequireChainFuji } from "../../ui/RequireChain";
import { Container } from "../../../components/container";
import { Button } from "../../../components/button";
import { useState } from "react";
import { EVMAddressInput } from "../../components/EVMAddressInput";

export default function AllowList() {
    const { walletEVMAddress } = useWalletStore();
    const [isSettingAdmin, setIsSettingAdmin] = useState(false);
    const [isSettingEnabled, setIsSettingEnabled] = useState(false);
    const [isSettingManager, setIsSettingManager] = useState(false);
    const [isSettingNone, setIsSettingNone] = useState(false);
    const [isReading, setIsReading] = useState(false);
    
    const [adminAddress, setAdminAddress] = useState<string>("");
    const [enabledAddress, setEnabledAddress] = useState<string>("");
    const [managerAddress, setManagerAddress] = useState<string>("");
    const [noneAddress, setNoneAddress] = useState<string>("");
    const [readAddress, setReadAddress] = useState<string>("");
    const [readResult, setReadResult] = useState<any>(null);

    const { setAdmin, setEnabled, setManager, setNone, readAllowList } = useAllowList("0x0200000000000000000000000000000000000000");

    const handleRead = async () => {
        if (!readAddress) return;
        setIsReading(true);
        try {
            const result = await readAllowList(43113, readAddress);
            setReadResult(result);
        } catch (error) {
            console.error('Reading failed:', error);
        } finally {
            setIsReading(false);
        }
    };

    return (
        <RequireChainFuji>
            <div className="space-y-6">
                <Container
                    title="Set Admin"
                    description="Set an address as admin for the allowlist."
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
                    description="Set an address as enabled for the allowlist."
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
                    description="Set an address as manager for the allowlist."
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

                <Container
                    title="Read Allowlist"
                    description="Read the permissions for an address."
                >
                    <div className="space-y-4">
                        <EVMAddressInput
                            label="Address to Read"
                            value={readAddress}
                            onChange={setReadAddress}
                        />
                        <Button
                            onClick={handleRead}
                            loading={isReading}
                            variant="primary"
                        >
                            Read
                        </Button>
                        {readResult && (
                            <div className="mt-4 p-4 bg-gray-100 rounded">
                                <pre>{JSON.stringify(readResult, null, 2)}</pre>
                            </div>
                        )}
                    </div>
                </Container>
            </div>
        </RequireChainFuji>
    );
}
