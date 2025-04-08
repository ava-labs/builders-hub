import { useAllowList } from '@avalabs/builderkit';
import { Container } from "../../components/container";
import { Button } from "../../components/button";
import { useState } from "react";
import { EVMAddressInput } from "./EVMAddressInput";

// Component for setting Admin permissions
export function SetAdminComponent({ precompileAddress }: { precompileAddress: string }) {
    const [isSettingAdmin, setIsSettingAdmin] = useState(false);
    const [adminAddress, setAdminAddress] = useState<string>("");
    const { setAdmin } = useAllowList(precompileAddress);

    const handleSetAdmin = async () => {
        if (!adminAddress) return;
        setIsSettingAdmin(true);
        try {
            await setAdmin(adminAddress);
        } catch (error) {
            console.error('Setting admin failed:', error);
        } finally {
            setIsSettingAdmin(false);
        }
    };

    return (
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
                    onClick={handleSetAdmin}
                    loading={isSettingAdmin}
                    variant="primary"
                >
                    Set Admin
                </Button>
            </div>
        </Container>
    );
}

// Component for setting Enabled permissions
export function SetEnabledComponent({ precompileAddress }: { precompileAddress: string }) {
    const [isSettingEnabled, setIsSettingEnabled] = useState(false);
    const [enabledAddress, setEnabledAddress] = useState<string>("");
    const { setEnabled } = useAllowList(precompileAddress);

    const handleSetEnabled = async () => {
        if (!enabledAddress) return;
        setIsSettingEnabled(true);
        try {
            await setEnabled(enabledAddress);
        } catch (error) {
            console.error('Setting enabled failed:', error);
        } finally {
            setIsSettingEnabled(false);
        }
    };

    return (
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
                    onClick={handleSetEnabled}
                    loading={isSettingEnabled}
                    variant="primary"
                >
                    Set Enabled
                </Button>
            </div>
        </Container>
    );
}

// Component for setting Manager permissions
export function SetManagerComponent({ precompileAddress }: { precompileAddress: string }) {
    const [isSettingManager, setIsSettingManager] = useState(false);
    const [managerAddress, setManagerAddress] = useState<string>("");
    const { setManager } = useAllowList(precompileAddress);

    const handleSetManager = async () => {
        if (!managerAddress) return;
        setIsSettingManager(true);
        try {
            await setManager(managerAddress);
        } catch (error) {
            console.error('Setting manager failed:', error);
        } finally {
            setIsSettingManager(false);
        }
    };

    return (
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
                    onClick={handleSetManager}
                    loading={isSettingManager}
                    variant="primary"
                >
                    Set Manager
                </Button>
            </div>
        </Container>
    );
}

// Component for setting None permissions
export function RemoveAllowListComponent({ precompileAddress }: { precompileAddress: string }) {
    const [isRemoving, setIsRemoving] = useState(false);
    const [removeAddress, setRemoveAddress] = useState<string>("");
    const { setNone } = useAllowList(precompileAddress);

    const handleRemove = async () => {
        if (!removeAddress) return;
        setIsRemoving(true);
        try {
            await setNone(removeAddress);
        } catch (error) {
            console.error('Removing from allowlist failed:', error);
        } finally {
            setIsRemoving(false);
        }
    };

    return (
        <Container
            title="Remove from Allowlist"
            description="Remove all permissions for an address."
        >
            <div className="space-y-4">
                <EVMAddressInput
                    label="Address"
                    value={removeAddress}
                    onChange={setRemoveAddress}
                />
                <Button
                    onClick={handleRemove}
                    loading={isRemoving}
                    variant="primary"
                >
                    Remove Address
                </Button>
            </div>
        </Container>
    );
}

// Component for reading permissions
export function ReadAllowListComponent({ precompileAddress }: { precompileAddress: string }) {
    const [isReading, setIsReading] = useState(false);
    const [readAddress, setReadAddress] = useState<string>("");
    const [readResult, setReadResult] = useState<any>(null);
    const { readAllowList } = useAllowList(precompileAddress);

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
    );
}

// Convenience component that includes all AllowList functionality
export function AllowListControls({ precompileAddress }: { precompileAddress: string }) {
    return (
        <div className="space-y-6">
            <SetEnabledComponent precompileAddress={precompileAddress} />
            <SetManagerComponent precompileAddress={precompileAddress} />
            <SetAdminComponent precompileAddress={precompileAddress} />
            <ReadAllowListComponent precompileAddress={precompileAddress} />
            <RemoveAllowListComponent precompileAddress={precompileAddress} />
        </div>
    );
} 