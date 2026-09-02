import ICMRelayer from "@/components/toolbox/console/testnet-infra/managed-testnet-relayers/ManagedTestnetRelayers";
import { consoleToolMetadata } from "@/components/console/tool-metadata";

export const metadata = consoleToolMetadata("/console/testnet-infra/icm-relayer", "ICM Relayer");

export default function ICMRelayerPage() {
    return (
        <ICMRelayer />
    );
}