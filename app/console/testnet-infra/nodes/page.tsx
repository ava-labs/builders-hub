import ManagedTestnetNodes from "@/components/toolbox/console/testnet-infra/managed-testnet-nodes";
import { consoleToolMetadata } from "@/components/console/tool-metadata";

export const metadata = consoleToolMetadata("/console/testnet-infra/nodes", "Testnet Nodes");

export default function Page() {
  return (
    <ManagedTestnetNodes />
  );
}
